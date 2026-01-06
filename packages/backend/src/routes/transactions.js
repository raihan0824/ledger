import express from 'express';
import { query } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Apply auth to all routes
router.use(authMiddleware);

// Get all transactions with pagination and filters
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      channel,
      status,
      merchant,
      kind,
      startDate,
      endDate,
      search,
      sortBy = 'datetime_iso',
      sortOrder = 'DESC',
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (category) {
      conditions.push(`category_code = $${paramIndex++}`);
      params.push(category);
    }
    if (channel) {
      conditions.push(`channel = $${paramIndex++}`);
      params.push(channel);
    }
    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (merchant) {
      conditions.push(`merchant ILIKE $${paramIndex++}`);
      params.push(`%${merchant}%`);
    }
    if (kind) {
      conditions.push(`kind = $${paramIndex++}`);
      params.push(kind);
    }
    if (startDate) {
      conditions.push(`datetime_iso >= $${paramIndex++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`datetime_iso <= $${paramIndex++}`);
      params.push(endDate);
    }
    if (search) {
      conditions.push(`(merchant ILIKE $${paramIndex} OR summary ILIKE $${paramIndex} OR reference_id ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort column
    const allowedSortColumns = ['datetime_iso', 'amount_rp', 'total_rp', 'merchant', 'category_code', 'created_at'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'datetime_iso';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM public.transactions ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get transactions
    const result = await query(
      `SELECT t.*, c.name as category_name
       FROM public.transactions t
       LEFT JOIN public.categories c ON t.category_code = c.code
       ${whereClause}
       ORDER BY ${sortColumn} ${order}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single transaction
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT t.*, c.name as category_name
       FROM public.transactions t
       LEFT JOIN public.categories c ON t.category_code = c.code
       WHERE t.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create transaction
router.post('/', async (req, res) => {
  try {
    const {
      kind,
      channel,
      document_type,
      event_type,
      status,
      merchant,
      account_masked,
      reference_id,
      datetime_iso,
      currency = 'IDR',
      amount_rp,
      fee_rp = 0,
      total_rp,
      risk_flags = [],
      summary,
      category_code = 'other',
      notes,
    } = req.body;

    // Validation
    if (!kind || !channel || !status || !datetime_iso) {
      return res.status(400).json({ error: 'Missing required fields: kind, channel, status, datetime_iso' });
    }

    const result = await query(
      `INSERT INTO public.transactions (
        kind, channel, document_type, event_type, status, merchant,
        account_masked, reference_id, datetime_iso, currency, amount_rp,
        fee_rp, total_rp, risk_flags, summary, category_code, notes, raw_normalized
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        kind, channel, document_type, event_type, status, merchant,
        account_masked, reference_id, datetime_iso, currency, amount_rp,
        fee_rp, total_rp || (amount_rp + (fee_rp || 0)), risk_flags, summary,
        category_code, notes, JSON.stringify(req.body),
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Create transaction error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Transaction with this reference_id already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update transaction
router.put('/:id', async (req, res) => {
  try {
    const {
      kind,
      channel,
      document_type,
      event_type,
      status,
      merchant,
      account_masked,
      datetime_iso,
      currency,
      amount_rp,
      fee_rp,
      total_rp,
      risk_flags,
      summary,
      category_code,
      notes,
    } = req.body;

    const result = await query(
      `UPDATE public.transactions SET
        kind = COALESCE($1, kind),
        channel = COALESCE($2, channel),
        document_type = COALESCE($3, document_type),
        event_type = COALESCE($4, event_type),
        status = COALESCE($5, status),
        merchant = COALESCE($6, merchant),
        account_masked = COALESCE($7, account_masked),
        datetime_iso = COALESCE($8, datetime_iso),
        currency = COALESCE($9, currency),
        amount_rp = COALESCE($10, amount_rp),
        fee_rp = COALESCE($11, fee_rp),
        total_rp = COALESCE($12, total_rp),
        risk_flags = COALESCE($13, risk_flags),
        summary = COALESCE($14, summary),
        category_code = COALESCE($15, category_code),
        notes = COALESCE($16, notes)
      WHERE id = $17
      RETURNING *`,
      [
        kind, channel, document_type, event_type, status, merchant,
        account_masked, datetime_iso, currency, amount_rp, fee_rp,
        total_rp, risk_flags, summary, category_code, notes, req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete transaction
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM public.transactions WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get transaction statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (startDate && endDate) {
      dateFilter = 'WHERE datetime_iso >= $1 AND datetime_iso <= $2';
      params.push(startDate, endDate);
    }

    // Total income and expenses
    const summaryResult = await query(
      `SELECT 
        SUM(CASE WHEN kind = 'credit' THEN total_rp ELSE 0 END) as total_income,
        SUM(CASE WHEN kind = 'debit' THEN total_rp ELSE 0 END) as total_expense,
        COUNT(*) as total_transactions
       FROM public.transactions
       ${dateFilter}`,
      params
    );

    res.json({ data: summaryResult.rows[0] });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
