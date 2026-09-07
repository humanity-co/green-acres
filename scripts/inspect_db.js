const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
for (const line of env.split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#') && t.includes('=')) {
    const i = t.indexOf('=');
    process.env[t.slice(0, i).trim()] = t.slice(i+1).trim().replace(/^["']|["']$/g, '');
  }
}
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await pool.query("ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY");
    console.log('Successfully disabled RLS on audit_logs per migration 0002 specification.');
    const tables = await pool.query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs'");
    console.log('AUDIT_LOGS_ROWSECURITY:', tables.rows);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}
run();
