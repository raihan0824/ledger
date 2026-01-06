import pg from 'pg';
import dotenv from 'dotenv';

// Only load .env file in development (Docker sets env vars directly)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const { Pool } = pg;

// Debug: log connection params
console.log('DB Connection Config:', {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '5432',
  database: process.env.DB_NAME || 'finance',
  user: process.env.DB_USER || 'postgres',
  NODE_ENV: process.env.NODE_ENV
});

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'finance',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = (text, params) => pool.query(text, params);

export const getClient = () => pool.connect();

export default pool;
