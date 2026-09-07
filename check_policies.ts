import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
pool.connect().then(async client => {
  try {
    const policies = await client.query("SELECT polname, polcmd, polroles, polqual, polwithcheck FROM pg_policy WHERE schemaname = 'public' ORDER BY polname");
    console.log('=== RLS POLICIES ===');
    console.log(JSON.stringify(policies.rows, null, 2));
  } finally {
    await pool.end();
  }
}).catch(e => console.error("Error:", e));