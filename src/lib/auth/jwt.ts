import { SignJWT, jwtVerify } from "jose";
function getSecret() {
  const s = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s || s.includes("dev-secret")) {
    if (process.env.NODE_ENV === "production") throw new Error("Missing BETTER_AUTH_SECRET in production");
  }
  const key = s || "dev-secret-32chars-long-change-me-fallback-only-dev";
  return new TextEncoder().encode(key);
}
export async function signJwt(payload: Record<string, any>, expiresIn = "24h") {
  return await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expiresIn).sign(getSecret());
}
export async function verifyJwt(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  return payload;
}
