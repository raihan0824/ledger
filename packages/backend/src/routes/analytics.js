import express from 'express';
import { query } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// Get dashboard analytics
router.get('/overview', async (req, res) => {
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

    // Calculate period dates for display
    const now = new Date();
    const currentDay = now.getDate();
    const year = now.getFullYear();
    const month = now.getMonth();

    let periodStart, periodEnd;
    if (currentDay >= startDay) {
      periodStart = new Date(year, month, startDay);
      periodEnd = new Date(year, month + 1, startDay - 1);
    } else {
      periodStart = new Date(year, month - 1, startDay);
      periodEnd = new Date(year, month, startDay - 1);
    }
    periodEnd.setHours(23, 59, 59, 999);

    // Get summary stats (all transactions, no date filter)
    const summaryResult = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN kind = 'credit' THEN total_rp ELSE 0 END), 0) as total_income,
        COALESCE(SUM(total_rp), 0) as total_expense,
        COUNT(*) as transaction_count
       FROM public.transactions`
    );

    // Get spending by category (all transactions)
    const categoryResult = await query(
      `SELECT 
        c.code,
        c.name,
        COALESCE(SUM(t.total_rp), 0) as total,
        COUNT(t.id) as count
       FROM public.categories c
       LEFT JOIN public.transactions t ON c.code = t.category_code
       GROUP BY c.code, c.name
       HAVING COALESCE(SUM(t.total_rp), 0) > 0
       ORDER BY total DESC
       LIMIT 10`
    );

    // Get daily spending trend (all transactions)
    const trendResult = await query(
      `SELECT 
        DATE(datetime_iso) as date,
        COALESCE(SUM(total_rp), 0) as expense,
        COALESCE(SUM(CASE WHEN kind = 'credit' THEN total_rp ELSE 0 END), 0) as income
       FROM public.transactions
       GROUP BY DATE(datetime_iso)
       ORDER BY date ASC`
    );

    // Get recent transactions
    const recentResult = await query(
      `SELECT t.*, c.name as category_name
       FROM public.transactions t
       LEFT JOIN public.categories c ON t.category_code = c.code
       ORDER BY t.datetime_iso DESC
       LIMIT 5`
    );

    // Get spending by channel (all transactions)
    const channelResult = await query(
      `SELECT 
        channel,
        COALESCE(SUM(total_rp), 0) as total,
        COUNT(*) as count
       FROM public.transactions
       GROUP BY channel
       ORDER BY total DESC`
    );

    // Get top merchants (all transactions)
    const merchantResult = await query(
      `SELECT 
        merchant,
        COALESCE(SUM(total_rp), 0) as total,
        COUNT(*) as count
       FROM public.transactions
       WHERE merchant IS NOT NULL
       GROUP BY merchant
       ORDER BY total DESC
       LIMIT 10`
    );

    res.json({
      period: {
        startDay,
        startDate: periodStart.toISOString(),
        endDate: periodEnd.toISOString(),
      },
      summary: {
        totalIncome: parseInt(summaryResult.rows[0].total_income),
        totalExpense: parseInt(summaryResult.rows[0].total_expense),
        balance: parseInt(summaryResult.rows[0].total_income) - parseInt(summaryResult.rows[0].total_expense),
        transactionCount: parseInt(summaryResult.rows[0].transaction_count),
      },
      categoryBreakdown: categoryResult.rows.map(row => ({
        code: row.code,
        name: row.name,
        total: parseInt(row.total),
        count: parseInt(row.count),
      })),
      dailyTrend: trendResult.rows.map(row => ({
        date: row.date,
        expense: parseInt(row.expense),
        income: parseInt(row.income),
      })),
      recentTransactions: recentResult.rows,
      channelBreakdown: channelResult.rows.map(row => ({
        channel: row.channel,
        total: parseInt(row.total),
        count: parseInt(row.count),
      })),
      topMerchants: merchantResult.rows.map(row => ({
        merchant: row.merchant,
        total: parseInt(row.total),
        count: parseInt(row.count),
      })),
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get monthly comparison (last 6 months)
router.get('/monthly', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        TO_CHAR(datetime_iso, 'YYYY-MM') as month,
        COALESCE(SUM(CASE WHEN kind = 'credit' THEN total_rp ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN kind = 'debit' THEN total_rp ELSE 0 END), 0) as expense
       FROM public.transactions
       WHERE datetime_iso >= NOW() - INTERVAL '6 months'
       GROUP BY TO_CHAR(datetime_iso, 'YYYY-MM')
       ORDER BY month ASC`
    );

    res.json({
      data: result.rows.map(row => ({
        month: row.month,
        income: parseInt(row.income),
        expense: parseInt(row.expense),
        savings: parseInt(row.income) - parseInt(row.expense),
      })),
    });
  } catch (error) {
    console.error('Get monthly analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
