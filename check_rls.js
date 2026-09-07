const { Pool } = require('pg');
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Just get table RLS status
  const tablesRes = await pool.query("SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relrowsecurity IS NOT NULL ORDER BY relname");
  console.log('Tables with RLS:');
  tablesRes.rows.forEach(r => {
    const rls = r.relrowsecurity ? 'ENABLED' : 'DISABLED';
    const force = r.relforcerowsecurity ? 'FORCE' : 'OPT-IN';
    console.log(`  ${r.relname}: ${rls} (${force})`);
  });
  
  // Count total
  const policiesRes = await pool.query("SELECT count(*) as cnt FROM pg_policy");
  console.log('\nTotal policies in pg_policy:', policiesRes.rows[0].cnt);
  
  // Sample some policies
  const sampleRes = await pool.query("SELECT policyname, tablename, cmd FROM (SELECT p.polname, c.relname as tablename, p.polcmd, row_number() over (partition by c.relname order by p.polname) as rn FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid) WHERE rn = 1 LIMIT 30");
  // Hmm, pg_policy doesn't have tablename. Let me just do a different approach.
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });