import express from 'express';
import { query } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// Helper to calculate budget period dates based on start day
function getBudgetPeriod(startDay, date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const currentDay = date.getDate();

  let periodStart, periodEnd;

  if (currentDay >= startDay) {
    // Current period started this month
    periodStart = new Date(year, month, startDay);
    periodEnd = new Date(year, month + 1, startDay - 1);
  } else {
    // Current period started last month
    periodStart = new Date(year, month - 1, startDay);
    periodEnd = new Date(year, month, startDay - 1);
  }

  // Handle month-end edge cases
  periodEnd.setHours(23, 59, 59, 999);

  return { periodStart, periodEnd };
}

// Get all budgets with current period spending
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's budget cycle start day
    const settingsResult = await query(
      `SELECT setting_value FROM public.settings 
       WHERE user_id = $1 AND setting_key = 'budget_cycle_start_day'`,
      [userId]
    );

    const startDay = settingsResult.rows.length > 0 
      ? settingsResult.rows[0].setting_value.day 
      : 25;

    const { periodStart, periodEnd } = getBudgetPeriod(startDay);

    // Get budgets with actual spending (no date filter)
    const result = await query(
      `SELECT 
        b.*,
        c.name as category_name,
        COALESCE(
          (SELECT SUM(t.total_rp) 
           FROM public.transactions t 
           WHERE t.category_code = b.category_code),
          0
        ) as actual_spent
       FROM public.budgets b
       JOIN public.categories c ON b.category_code = c.code
       WHERE b.user_id = $1 AND b.is_active = true
       ORDER BY b.amount_rp DESC`,
      [userId]
    );

    res.json({
      data: result.rows,
      period: {
        startDay,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get budget summary (total budget vs total spent)
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's budget cycle start day
    const settingsResult = await query(
      `SELECT setting_value FROM public.settings 
       WHERE user_id = $1 AND setting_key = 'budget_cycle_start_day'`,
      [userId]
    );

    const startDay = settingsResult.rows.length > 0 
      ? settingsResult.rows[0].setting_value.day 
      : 25;

    const { periodStart, periodEnd } = getBudgetPeriod(startDay);

    // Get total budget
    const budgetResult = await query(
      `SELECT COALESCE(SUM(amount_rp), 0) as total_budget
       FROM public.budgets
       WHERE user_id = $1 AND is_active = true`,
      [userId]
    );

    // Get actual spending in budgeted categories (no date filter)
    const spentResult = await query(
      `SELECT COALESCE(SUM(t.total_rp), 0) as total_spent
       FROM public.transactions t
       JOIN public.budgets b ON t.category_code = b.category_code
       WHERE b.user_id = $1 
         AND b.is_active = true`,
      [userId]
    );

    // Get total spending (all categories, no date filter)
    const totalSpentResult = await query(
      `SELECT COALESCE(SUM(total_rp), 0) as total_all_spent
       FROM public.transactions`
    );

    res.json({
      data: {
        totalBudget: parseInt(budgetResult.rows[0].total_budget),
        totalSpent: parseInt(spentResult.rows[0].total_spent),
        totalAllSpent: parseInt(totalSpentResult.rows[0].total_all_spent),
        remaining: parseInt(budgetResult.rows[0].total_budget) - parseInt(spentResult.rows[0].total_spent),
      },
      period: {
        startDay,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get budget summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update budget for a category
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { category_code, amount_rp, period_type = 'monthly' } = req.body;

    if (!category_code || !amount_rp) {
      return res.status(400).json({ error: 'category_code and amount_rp are required' });
    }

    // Upsert budget
    const result = await query(
      `INSERT INTO public.budgets (user_id, category_code, amount_rp, period_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, category_code) 
       DO UPDATE SET amount_rp = $3, period_type = $4, updated_at = NOW(), is_active = true
       RETURNING *`,
      [userId, category_code, amount_rp, period_type]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Create budget error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update budget
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount_rp, period_type, is_active } = req.body;

    const result = await query(
      `UPDATE public.budgets SET
        amount_rp = COALESCE($1, amount_rp),
        period_type = COALESCE($2, period_type),
        is_active = COALESCE($3, is_active),
        updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [amount_rp, period_type, is_active, req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete budget
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      'DELETE FROM public.budgets WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
