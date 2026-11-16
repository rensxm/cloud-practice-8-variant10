const fs = require('node:fs');
const path = require('node:path');
const pool = require('./db');

async function initialize() {
  const client = await pool.connect();
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS practice8');
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    await client.query('COMMIT');
    console.log('Деректер қоры дайын: files кестесі және бес бастапқы жазба.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

initialize()
  .catch((error) => {
    console.error('DB_INIT_ERROR', error.code || 'UNKNOWN');
    process.exitCode = 1;
  })
  .finally(() => pool.end());

