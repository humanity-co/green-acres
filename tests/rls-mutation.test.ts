import { Pool } from "pg";
const ownerPool = new Pool({ connectionString: process.env.DATABASE_URL! });
const appPool = new Pool({ connectionString: process.env.APP_DATABASE_URL! });

async function withTenant(pool: Pool, societyId: string, fn: (client: any) => Promise<any>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.society_id', $1, true)", [societyId]);
    const res = await fn(client);
    await client.query("COMMIT");
    return res;
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    throw e;
  } finally { client.release(); }
}

async function run() {
  let pass=0, fail=0;
  const assert = (c:boolean, msg:string)=>{ if(c){console.log(`✓ ${msg}`); pass++;} else {console.log(`✗ ${msg}`); fail++;} };

  // Setup two societies via owner
  const societies = await ownerPool.query("SELECT id FROM societies LIMIT 2");
  if (societies.rows.length <2) {
    console.log("Need 2 societies, found", societies.rows.length);
    process.exit(1);
  }
  const socA = societies.rows[0].id;
  const socB = societies.rows[1].id;
  // Create a unit in B for mutation tests
  const unitB = await ownerPool.query("SELECT id FROM units WHERE society_id=$1 LIMIT 1", [socB]);
  const unitBId = unitB.rows[0]?.id;
  const unitA = await ownerPool.query("SELECT id FROM units WHERE society_id=$1 LIMIT 1", [socA]);

  console.log(`SocA ${socA} SocB ${socB}`);

  // A: SELECT denied (app_user without context sees 0)
  const rA = await appPool.query("SELECT count(*) as c FROM units");
  assert(rA.rows[0].c==="0", "A: SELECT without tenant context = 0 (RLS blocks)");

  // A2: SELECT with A context sees only A
  const cntA = await withTenant(appPool, socA, async (c)=> {
    const r = await c.query("SELECT count(*) as c FROM units WHERE society_id=$1", [socA]);
    return r.rows[0].c;
  });
  const cntViaRls = await withTenant(appPool, socA, async (c)=> {
    const r = await c.query("SELECT count(*) as c FROM units");
    return r.rows[0].c;
  });
  assert(cntA===cntViaRls, "A: SELECT with tenant context returns only own society");

  // Cross-tenant SELECT check via RLS
  const crossSelect = await withTenant(appPool, socA, async (c)=>{
    const r = await c.query("SELECT count(*) as c FROM units WHERE society_id=$1", [socB]);
    return r.rows[0].c;
  });
  assert(crossSelect==="0", "A: Cross-tenant SELECT via RLS = 0");

  // B: INSERT denied (try to insert unit with socB while context is socA)
  let insertBlocked = false;
  try {
    await withTenant(appPool, socA, async (c)=>{
      const b = await c.query("SELECT id FROM buildings WHERE society_id=$1 LIMIT 1", [socA]);
      const f = await c.query("SELECT id FROM floors WHERE society_id=$1 LIMIT 1", [socA]);
      await c.query("INSERT INTO units (id, society_id, building_id, floor_id, number) VALUES (gen_random_uuid(), $1, $2, $3, 'RLS-INJECT')", [socB, b.rows[0].id, f.rows[0].id]);
    });
  } catch { insertBlocked = true; }
  assert(insertBlocked, "B: INSERT cross-tenant blocked by RLS");

  // C: UPDATE denied
  let updateBlocked = false;
  let updatedCount = "0";
  try {
    const upd = await withTenant(appPool, socA, async (c)=>{
      const r = await c.query("UPDATE units SET number='HACKED' WHERE id=$1 AND society_id=$2 RETURNING id", [unitBId, socB]);
      return r.rowCount;
    });
    updatedCount = String(upd);
    if (upd===0) updateBlocked = true; // RLS hides row, so 0 rows updated is also blocked
  } catch { updateBlocked = true; }
  assert(updateBlocked || updatedCount==="0", "C: UPDATE cross-tenant blocked (0 rows)");

  // D: DELETE denied
  let deleteBlocked = false;
  try {
    const del = await withTenant(appPool, socA, async (c)=>{
      const r = await c.query("DELETE FROM units WHERE id=$1 RETURNING id", [unitBId]);
      return r.rowCount;
    });
    if (del===0) deleteBlocked = true;
  } catch { deleteBlocked = true; }
  assert(deleteBlocked, "D: DELETE cross-tenant blocked");

  // E: Missing tenant context already tested (0 rows)

  // F: Invalid tenant context (random UUID not in DB) -> should see 0
  const fake = "00000000-0000-0000-0000-000000000000";
  const fakeCnt = await withTenant(appPool, fake, async (c)=>{
    const r = await c.query("SELECT count(*) as c FROM units");
    return r.rows[0].c;
  });
  assert(fakeCnt==="0", "F: Invalid tenant context = 0 rows");

  // G: Tenant leak test - after commit, next query without context should be 0
  await withTenant(appPool, socA, async (c)=>{ await c.query("SELECT count(*) FROM units"); });
  const leak = await appPool.query("SELECT count(*) as c FROM units");
  assert(leak.rows[0].c==="0", "G: Tenant context does not leak to next request");

  // Audit log append-only check via app_user
  let auditUpdBlocked = false;
  try {
    await appPool.query("UPDATE audit_logs SET action='hacked' WHERE id=(SELECT id FROM audit_logs LIMIT 1)");
  } catch { auditUpdBlocked = true; }
  // For app_user, UPDATE should be denied (we revoked)
  const updCheck = await appPool.query("SELECT has_table_privilege('app_user','audit_logs','UPDATE') as upd");
  // Actually test via appPool as app_user
  const appClient = await appPool.connect();
  try {
    await appClient.query("UPDATE audit_logs SET action='hacked' WHERE id=(SELECT id FROM audit_logs LIMIT 1)");
  } catch { auditUpdBlocked = true; } finally { appClient.release(); }
  assert(auditUpdBlocked, "Audit UPDATE blocked for app_user");
  assert(updCheck.rows[0].upd===false, "Audit UPDATE privilege revoked");

  console.log(`\nRLS Results: ${pass} passed, ${fail} failed`);
  process.exit(fail>0?1:0);
}
run().catch(e=>{ console.error(e); process.exit(1); });
