import express from 'express';
import { query } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// Get all categories
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM public.categories ORDER BY name ASC'
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get category with transaction count
router.get('/with-stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (startDate && endDate) {
      dateFilter = 'AND t.datetime_iso >= $1 AND t.datetime_iso <= $2';
      params.push(startDate, endDate);
    }

    const result = await query(
      `SELECT 
        c.*,
        COALESCE(SUM(CASE WHEN t.kind = 'debit' THEN t.total_rp ELSE 0 END), 0) as total_expense,
        COALESCE(SUM(CASE WHEN t.kind = 'credit' THEN t.total_rp ELSE 0 END), 0) as total_income,
        COUNT(t.id) as transaction_count
       FROM public.categories c
       LEFT JOIN public.transactions t ON c.code = t.category_code ${dateFilter}
       GROUP BY c.code, c.name, c.created_at
       ORDER BY total_expense DESC`,
      params
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get categories with stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create category
router.post('/', async (req, res) => {
  try {
    const { code, name } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Code and name are required' });
    }

    const result = await query(
      'INSERT INTO public.categories (code, name) VALUES ($1, $2) RETURNING *',
      [code, name]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Create category error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Category with this code already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update category
router.put('/:code', async (req, res) => {
  try {
    const { name } = req.body;

    const result = await query(
      'UPDATE public.categories SET name = $1 WHERE code = $2 RETURNING *',
      [name, req.params.code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete category
router.delete('/:code', async (req, res) => {
  try {
    // Check if category is in use
    const usageCheck = await query(
      'SELECT COUNT(*) FROM public.transactions WHERE category_code = $1',
      [req.params.code]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category that is in use by transactions' 
      });
    }

    const result = await query(
      'DELETE FROM public.categories WHERE code = $1 RETURNING code',
      [req.params.code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
