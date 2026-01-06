import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { query, getClient } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

router.use(authMiddleware);

// Parse CSV and return preview
router.post('/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const results = [];
    const errors = [];
    let rowNumber = 0;

    const stream = Readable.from(req.file.buffer.toString());

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv({
          mapHeaders: ({ header }) => header.toLowerCase().trim().replace(/\s+/g, '_'),
          mapValues: ({ value }) => value.trim(),
        }))
        .on('data', (data) => {
          rowNumber++;
          
          // Map common CSV columns to our schema
          const mapped = mapCsvRow(data, rowNumber);
          
          if (mapped.error) {
            errors.push({ row: rowNumber, error: mapped.error });
          } else {
            results.push(mapped);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    res.json({
      preview: results.slice(0, 10), // First 10 rows as preview
      totalRows: results.length,
      errors: errors.slice(0, 10), // First 10 errors
      totalErrors: errors.length,
      columns: results.length > 0 ? Object.keys(results[0]) : [],
    });
  } catch (error) {
    console.error('CSV preview error:', error);
    res.status(500).json({ error: 'Failed to parse CSV file' });
  }
});

// Import CSV data
router.post('/commit', upload.single('file'), async (req, res) => {
  const client = await getClient();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.userId;
    const results = [];
    const errors = [];
    let rowNumber = 0;

    const stream = Readable.from(req.file.buffer.toString());

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv({
          mapHeaders: ({ header }) => header.toLowerCase().trim().replace(/\s+/g, '_'),
          mapValues: ({ value }) => value.trim(),
        }))
        .on('data', (data) => {
          rowNumber++;
          const mapped = mapCsvRow(data, rowNumber);
          
          if (mapped.error) {
            errors.push({ row: rowNumber, error: mapped.error });
          } else {
            results.push(mapped);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (results.length === 0) {
      return res.status(400).json({ error: 'No valid rows found in CSV' });
    }

    await client.query('BEGIN');

    // Create import batch
    const batchResult = await client.query(
      `INSERT INTO public.import_batches (user_id, filename, row_count, status)
       VALUES ($1, $2, $3, 'processing')
       RETURNING id`,
      [userId, req.file.originalname, results.length]
    );
    const batchId = batchResult.rows[0].id;

    // Insert transactions
    let inserted = 0;
    let skipped = 0;

    for (const row of results) {
      try {
        await client.query(
          `INSERT INTO public.transactions (
            kind, channel, status, merchant, datetime_iso, currency,
            amount_rp, fee_rp, total_rp, summary, category_code, 
            raw_normalized, import_batch_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            row.kind || 'debit',
            row.channel || 'csv_import',
            row.status || 'completed',
            row.merchant || null,
            row.datetime_iso,
            row.currency || 'IDR',
            row.amount_rp || 0,
            row.fee_rp || 0,
            row.total_rp || row.amount_rp || 0,
            row.summary || row.description || null,
            row.category_code || 'other',
            JSON.stringify(row),
            batchId,
          ]
        );
        inserted++;
      } catch (err) {
        if (err.code === '23505') {
          skipped++; // Duplicate
        } else {
          errors.push({ row: row._rowNumber, error: err.message });
        }
      }
    }

    // Update batch status
    await client.query(
      `UPDATE public.import_batches 
       SET status = 'completed', row_count = $1 
       WHERE id = $2`,
      [inserted, batchId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      batchId,
      inserted,
      skipped,
      errors: errors.length,
      errorDetails: errors.slice(0, 10),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('CSV import error:', error);
    res.status(500).json({ error: 'Failed to import CSV file' });
  } finally {
    client.release();
  }
});

// Get import history
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      `SELECT * FROM public.import_batches 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get import history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to map CSV columns to transaction schema
function mapCsvRow(data, rowNumber) {
  // Try to find datetime
  let datetime = data.datetime_iso || data.datetime || data.date || data.tanggal || data.time;
  
  if (!datetime) {
    return { error: 'Missing date/datetime field' };
  }

  // Parse datetime
  let parsedDate;
  try {
    parsedDate = new Date(datetime);
    if (isNaN(parsedDate.getTime())) {
      // Try Indonesian date format (DD/MM/YYYY or DD-MM-YYYY)
      const parts = datetime.split(/[\/\-]/);
      if (parts.length === 3) {
        parsedDate = new Date(parts[2], parts[1] - 1, parts[0]);
      }
    }
    if (isNaN(parsedDate.getTime())) {
      return { error: `Invalid date format: ${datetime}` };
    }
  } catch (e) {
    return { error: `Cannot parse date: ${datetime}` };
  }

  // Try to find amount
  let amount = data.amount_rp || data.amount || data.nominal || data.jumlah || data.total || 0;
  amount = parseFloat(String(amount).replace(/[^0-9.-]/g, '')) || 0;

  // Determine kind (credit/debit)
  let kind = data.kind || data.type || data.jenis;
  if (!kind) {
    // Try to infer from amount sign or other fields
    if (amount < 0) {
      kind = 'debit';
      amount = Math.abs(amount);
    } else if (data.debit && parseFloat(data.debit) > 0) {
      kind = 'debit';
      amount = parseFloat(String(data.debit).replace(/[^0-9.-]/g, ''));
    } else if (data.credit && parseFloat(data.credit) > 0) {
      kind = 'credit';
      amount = parseFloat(String(data.credit).replace(/[^0-9.-]/g, ''));
    } else {
      kind = 'debit'; // Default to expense
    }
  }

  return {
    _rowNumber: rowNumber,
    kind: kind.toLowerCase() === 'credit' || kind.toLowerCase() === 'masuk' ? 'credit' : 'debit',
    channel: data.channel || data.bank || 'csv_import',
    status: data.status || 'completed',
    merchant: data.merchant || data.description || data.keterangan || data.nama || null,
    datetime_iso: parsedDate.toISOString(),
    currency: data.currency || data.mata_uang || 'IDR',
    amount_rp: Math.round(amount),
    fee_rp: parseFloat(String(data.fee_rp || data.fee || data.biaya || 0).replace(/[^0-9.-]/g, '')) || 0,
    total_rp: Math.round(amount),
    summary: data.summary || data.description || data.keterangan || null,
    category_code: data.category_code || data.category || data.kategori || 'other',
  };
}

export default router;
