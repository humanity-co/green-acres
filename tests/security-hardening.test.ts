import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { hashSessionToken } from "../src/lib/auth/session-token";

const root = process.cwd();
const source = async (file: string) => readFile(path.join(root, file), "utf8");

async function run() {
  const token = "session-token-fixture";
  const digest = hashSessionToken(token);
  assert.equal(digest.length, 64, "session tokens are stored as SHA-256 digests");
  assert.notEqual(digest, token, "session token plaintext is not stored");
  assert.equal(digest, hashSessionToken(token), "session token hashing is deterministic");

  const db = await source("src/lib/db.ts");
  assert.match(db, /const runtimeUrl = process\.env\.APP_DATABASE_URL;/);
  assert.doesNotMatch(db, /APP_DATABASE_URL\s*\|\|\s*process\.env\.DATABASE_URL/);

  const manualPass = await source("src/app/api/guard/manual-pass/route.ts");
  assert.match(manualPass, /status: "PENDING"/);
  assert.doesNotMatch(manualPass, /status:\s*["']APPROVED["']/);

  const checkIn = await source("src/app/api/guard/check-in/route.ts");
  const checkOut = await source("src/app/api/guard/check-out/route.ts");
  assert.match(checkIn, /OFFLINE_AUTHORIZATION_REQUIRED/);
  assert.match(checkOut, /OFFLINE_AUTHORIZATION_REQUIRED/);
  assert.doesNotMatch(checkIn, /offlineTimestamp/);
  assert.doesNotMatch(checkOut, /offlineTimestamp/);

  const upload = await source("src/app/api/upload/route.ts");
  assert.doesNotMatch(upload, /public["'],\s*["']uploads/);
  assert.match(upload, /\.private/);

  console.log("Security hardening checks: 11 passed, 0 failed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});