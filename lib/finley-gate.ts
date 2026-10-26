// =============================================================================
// lib/finley-gate.ts — the signed pass a website visitor gets after proving who they are (2026-10-26).
//
// Owner: "before taking questions, user must type name, phone number and email ... and choose ... a code to
// continue ... I do not want robots to use her and flood her" + "Employee, Business Partner or Client ... she
// knows to whom she is talking". /api/finley-gate issues the pass; /api/chat (quick_question) refuses without it.
// Format: base64url(JSON payload) + "." + HMAC-SHA256(TEAM_AUTH_SECRET). 12 hours.
// =============================================================================
import crypto from "node:crypto";

export type GateRole = "client" | "partner" | "employee";
export type GatePass = { gid: string; role: GateRole; name: string; email: string; exp: number; listed: boolean };

const TTL_MS = 12 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.TEAM_AUTH_SECRET;
  if (!s) throw new Error("Missing TEAM_AUTH_SECRET.");
  return "finley-gate:" + s;
}
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (body: string) => crypto.createHmac("sha256", secret()).update(body).digest("base64url");

export function issuePass(p: Omit<GatePass, "exp">): string {
  const body = b64(JSON.stringify({ ...p, exp: Date.now() + TTL_MS }));
  return body + "." + sign(body);
}

export function readPass(token: string | null | undefined): GatePass | null {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const want = sign(body);
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as GatePass;
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

export function hashCode(id: string, code: string): string {
  return crypto.createHmac("sha256", secret()).update(id + ":" + code).digest("hex");
}
