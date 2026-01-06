import bcrypt from 'bcrypt';
import { query } from './index.js';

const SALT_ROUNDS = 10;

export async function initializeDatabase() {
  console.log('🔄 Initializing database...');

  // Create users table
  await query(`
    CREATE TABLE IF NOT EXISTS public.users (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT users_pkey PRIMARY KEY (id)
    )
  `);

  // Create settings table
  await query(`
    CREATE TABLE IF NOT EXISTS public.settings (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
      setting_key VARCHAR(100) NOT NULL,
      setting_value JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT settings_pkey PRIMARY KEY (id),
      CONSTRAINT settings_user_key_unique UNIQUE(user_id, setting_key)
    )
  `);

  // Create budgets table
  await query(`
    CREATE TABLE IF NOT EXISTS public.budgets (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
      category_code TEXT REFERENCES public.categories(code) ON DELETE CASCADE,
      amount_rp BIGINT NOT NULL,
      period_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT budgets_pkey PRIMARY KEY (id),
      CONSTRAINT budgets_user_category_unique UNIQUE(user_id, category_code)
    )
  `);

  // Create indexes for budgets
  await query(`CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON public.budgets(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_budgets_category_code ON public.budgets(category_code)`);

  // Create import_batches table
  await query(`
    CREATE TABLE IF NOT EXISTS public.import_batches (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT import_batches_pkey PRIMARY KEY (id)
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_import_batches_user_id ON public.import_batches(user_id)`);

  // Add import_batch_id to transactions if not exists
  try {
    await query(`
      ALTER TABLE public.transactions 
      ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL
    `);
  } catch (err) {
    // Column might already exist
  }

  console.log('✅ Database tables initialized');
}

export async function createDefaultUser() {
  const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@localhost';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

  // Check if any user exists
  const existingUsers = await query('SELECT COUNT(*) FROM public.users');
  
  if (parseInt(existingUsers.rows[0].count) > 0) {
    console.log('👤 Users already exist, skipping default user creation');
    return;
  }

  // Create default admin user
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  
  const result = await query(
    `INSERT INTO public.users (username, email, password_hash) 
     VALUES ($1, $2, $3) 
     RETURNING id`,
    [username, email, passwordHash]
  );

  const userId = result.rows[0].id;

  // Create default settings for the user
  await query(
    `INSERT INTO public.settings (user_id, setting_key, setting_value) 
     VALUES ($1, 'budget_cycle_start_day', '{"day": 25}')`,
    [userId]
  );

  await query(
    `INSERT INTO public.settings (user_id, setting_key, setting_value) 
     VALUES ($1, 'dark_mode', '{"enabled": true}')`,
    [userId]
  );

  console.log(`✅ Default admin user created: ${username}`);
  console.log(`⚠️  Please change the default password after first login!`);
}

export async function setupDatabase() {
  try {
    await initializeDatabase();
    await createDefaultUser();
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    throw error;
  }
}
