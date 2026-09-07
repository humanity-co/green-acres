import { SignJWT, jwtVerify } from "jose";
function getSecret() {
  const s = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 32 || s.includes("dev-secret") || s.includes("change-this")) {
    throw new Error("A strong authentication secret is required");
  }
  return new TextEncoder().encode(s);
}
export async function signJwt(payload: Record<string, any>, expiresIn = "24h") {
  return await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expiresIn).sign(getSecret());
}
export async function verifyJwt(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  return payload;
}
