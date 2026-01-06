import express from 'express';
import { query } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// Get all settings for user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      'SELECT setting_key, setting_value FROM public.settings WHERE user_id = $1',
      [userId]
    );

    // Convert to object
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    res.json({ data: settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific setting
router.get('/:key', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      'SELECT setting_value FROM public.settings WHERE user_id = $1 AND setting_key = $2',
      [userId, req.params.key]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ data: result.rows[0].setting_value });
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update or create setting
router.put('/:key', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const result = await query(
      `INSERT INTO public.settings (user_id, setting_key, setting_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, setting_key) 
       DO UPDATE SET setting_value = $3, updated_at = NOW()
       RETURNING *`,
      [userId, req.params.key, JSON.stringify(value)]
    );

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete setting
router.delete('/:key', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      'DELETE FROM public.settings WHERE user_id = $1 AND setting_key = $2 RETURNING setting_key',
      [userId, req.params.key]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    console.error('Delete setting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
