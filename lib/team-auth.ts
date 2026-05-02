import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const SESSION_COOKIE = "bf_team_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

// ---------------------------------------------------------------------------
// F3.2 BACKWARD-COMPAT SHIM — REMOVE AT F3.7
// ---------------------------------------------------------------------------
// This fallback resolves missing/null tenantId values to Beyond Financing's
// tenant UUID. It exists so:
//   (1) sessions issued before F3.2 (which have no tenantId field) keep
//       working until they expire (12hr TTL),
//   (2) team_users rows with no matching employees row (e.g. Real Estate
//       Agents authenticated via team_users) still resolve to a tenant.
//
// At F3.7, when we drop the DEFAULT scaffolding off tenant_id columns, we
// also remove this shim. After that point, getCurrentTenantId may return
// null and callers must handle that explicitly.
//
// Grep target for cleanup: BF_TENANT_UUID_FALLBACK
// ---------------------------------------------------------------------------
export const BF_TENANT_UUID_FALLBACK = "b7fbd7b2-dca6-4669-abd6-c27769c4b7f3";

export type SessionPayload = {
  userId: string;
  email: string;
  role: string;
  tenantId: string | null;
  exp: number;
};

function getSecret() {
  const secret = process.env.TEAM_AUTH_SECRET;
  if (!secret) {
    throw new Error("Missing TEAM_AUTH_SECRET.");
  }
  return secret;
}

export function normalizeCredential(value: string) {
  return value.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, original] = storedHash.split(":");
  if (!salt || !original) return false;

  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(original, "hex");
  const b = Buffer.from(derived, "hex");

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function signSession(payload: Omit<SessionPayload, "exp">) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const fullPayload: SessionPayload = { ...payload, exp };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  const parsed = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8")
  ) as Partial<SessionPayload>;

  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  // Backward-compat: pre-F3.2 sessions have no tenantId field. Normalize
  // missing tenantId to null here so consumers can rely on the field
  // existing on every SessionPayload. The BF fallback is applied at the
  // helper layer (getCurrentTenantId), not here.
  return {
    userId: parsed.userId as string,
    email: parsed.email as string,
    role: parsed.role as string,
    tenantId: parsed.tenantId ?? null,
    exp: parsed.exp,
  };
}

export async function setTeamSessionCookie(payload: Omit<SessionPayload, "exp">) {
  const token = signSession(payload);
  const store = await cookies();

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearTeamSessionCookie() {
  const store = await cookies();

  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function getSessionFromRequest(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Returns the tenantId for the current request's session, applying the
 * BF backward-compat fallback for pre-F3.2 sessions and team_users rows
 * with no matching employees row.
 *
 * Returns null only when there is no valid session at all (no cookie,
 * expired cookie, or invalid signature). A signed-in user always
 * resolves to a non-null tenantId until F3.7 removes the fallback.
 */
export function getCurrentTenantId(req: NextRequest): string | null {
  const session = getSessionFromRequest(req);
  if (!session) return null;
  return session.tenantId ?? BF_TENANT_UUID_FALLBACK;
}

export function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createResetToken() {
  return crypto.randomBytes(32).toString("hex");
}
