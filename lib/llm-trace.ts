// =============================================================================
// lib/llm-trace.ts
// =============================================================================
//
// Finley LLM tracing → Langfuse (Phase 1 of the Finley enhancement plan).
//
// Dependency-free: builds an OTLP/HTTP JSON export and POSTs it to
// Langfuse's OpenTelemetry endpoint, same raw-fetch pattern the chat routes
// already use for OpenAI / Anthropic.
//
// Guarantees:
//   - Never blocks or breaks a chat. The export is scheduled with next/server
//     after(), runs once the response is sent, and swallows every error.
//   - No-op when LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY are not set.
//   - Borrower PII is masked BEFORE anything leaves our server: emails,
//     phone numbers, SSN-shaped numbers, and every known borrower / realtor
//     name token passed in via `pii`.
//
// ENVIRONMENT VARIABLES:
//
//   LANGFUSE_PUBLIC_KEY   (optional — tracing off when missing)
//   LANGFUSE_SECRET_KEY   (optional — tracing off when missing)
//   LANGFUSE_BASEURL      (optional — defaults to https://us.cloud.langfuse.com)
//
// =============================================================================

import { after } from "next/server";
import { createHash, randomBytes } from "crypto";

type ChatTurn = { role: string; content: string };

export type GenerationRecord = {
  name: string;
  model: string;
  input: ChatTurn[];
  output: string | null;
  startedAt: number;
  endedAt: number;
  usage?: Record<string, number | undefined>;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type FinleyTraceInit = {
  name: string;
  sessionId?: string | null;
  userId?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
  pii?: Array<string | null | undefined>;
};

const DEFAULT_BASEURL = "https://us.cloud.langfuse.com";

// -----------------------------------------------------------------------------
// PII masking
// -----------------------------------------------------------------------------

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SSN_RE = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildMasker(pii: Array<string | null | undefined> = []) {
  const tokens = new Set<string>();
  for (const value of pii) {
    if (typeof value !== "string") continue;
    for (const part of value.split(/[\s,]+/)) {
      const t = part.trim();
      if (t.length >= 2 && !EMAIL_RE.test(t)) tokens.add(t);
      EMAIL_RE.lastIndex = 0;
    }
  }
  const nameRe = tokens.size
    ? new RegExp(
        `\\b(?:${[...tokens].sort((a, b) => b.length - a.length).map(escapeRegex).join("|")})\\b`,
        "gi"
      )
    : null;

  return (text: string): string => {
    let out = text.replace(EMAIL_RE, "[email]").replace(SSN_RE, "[ssn]").replace(PHONE_RE, "[phone]");
    if (nameRe) out = out.replace(nameRe, "[name]");
    return out;
  };
}

// -----------------------------------------------------------------------------
// OTLP JSON helpers
// -----------------------------------------------------------------------------

type OtlpValue = { stringValue: string } | { intValue: string } | { boolValue: boolean };
type OtlpAttr = { key: string; value: OtlpValue };

function attr(key: string, value: unknown): OtlpAttr | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return { key, value: { boolValue: value } };
  if (typeof value === "number" && Number.isInteger(value)) {
    return { key, value: { intValue: String(value) } };
  }
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return { key, value: { stringValue: s } };
}

function attrs(pairs: Array<[string, unknown]>): OtlpAttr[] {
  return pairs.map(([k, v]) => attr(k, v)).filter((a): a is OtlpAttr => a !== null);
}

function hexId(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

function nanos(ms: number): string {
  return (BigInt(Math.round(ms)) * BigInt(1_000_000)).toString();
}

export function promptVersion(systemPrompt: string): string {
  return createHash("sha256").update(systemPrompt).digest("hex").slice(0, 12);
}

// -----------------------------------------------------------------------------
// Trace collector
// -----------------------------------------------------------------------------

export function startFinleyTrace(init: FinleyTraceInit) {
  const startedAt = Date.now();
  const generations: GenerationRecord[] = [];
  const mask = buildMasker(init.pii);
  let finalOutput: string | null = null;
  let traceInput: unknown = null;
  let sessionId = init.sessionId || null;

  return {
    setSessionId(id: string | null | undefined) {
      if (id) sessionId = id;
    },
    setInput(input: unknown) {
      traceInput = input;
    },
    addGeneration(g: GenerationRecord) {
      generations.push(g);
    },
    // Schedules the export for after the response is sent. Call once.
    end(output: string | null, extraMetadata?: Record<string, unknown>) {
      finalOutput = output;
      const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
      const secretKey = process.env.LANGFUSE_SECRET_KEY;
      if (!publicKey || !secretKey) return;

      const endedAt = Date.now();
      const baseUrl = (process.env.LANGFUSE_BASEURL || DEFAULT_BASEURL).replace(/\/+$/, "");
      const maskJson = (v: unknown) => mask(typeof v === "string" ? v : JSON.stringify(v ?? null));

      try {
        after(async () => {
          try {
            const traceId = hexId(16);
            const rootSpanId = hexId(8);
            const metadata = { ...(init.metadata || {}), ...(extraMetadata || {}) };
            const spans = [
              {
                traceId,
                spanId: rootSpanId,
                name: init.name,
                kind: 1,
                startTimeUnixNano: nanos(startedAt),
                endTimeUnixNano: nanos(endedAt),
                status: { code: 1 },
                attributes: attrs([
                  ["langfuse.trace.name", init.name],
                  ["langfuse.session.id", sessionId],
                  ["langfuse.user.id", init.userId || null],
                  ["langfuse.trace.tags", init.tags && init.tags.length ? init.tags : null],
                  ["langfuse.environment", process.env.VERCEL_ENV || "development"],
                  ["langfuse.release", process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null],
                  ["langfuse.observation.input", traceInput === null ? null : maskJson(traceInput)],
                  ["langfuse.observation.output", finalOutput === null ? null : mask(finalOutput)],
                  ...Object.entries(metadata).map(
                    ([k, v]) => [`langfuse.trace.metadata.${k}`, v] as [string, unknown]
                  ),
                ]),
              },
              ...generations.map((g) => ({
                traceId,
                spanId: hexId(8),
                parentSpanId: rootSpanId,
                name: g.name,
                kind: 1,
                startTimeUnixNano: nanos(g.startedAt),
                endTimeUnixNano: nanos(g.endedAt),
                status: g.error ? { code: 2, message: g.error } : { code: 1 },
                attributes: attrs([
                  ["langfuse.observation.type", "generation"],
                  ["langfuse.observation.model.name", g.model],
                  [
                    "langfuse.observation.input",
                    maskJson(g.input.map((m) => ({ role: m.role, content: m.content }))),
                  ],
                  ["langfuse.observation.output", g.output === null ? null : mask(g.output)],
                  ["langfuse.observation.level", g.error ? "ERROR" : null],
                  ["langfuse.observation.status_message", g.error || null],
                  [
                    "langfuse.observation.usage_details",
                    g.usage
                      ? Object.fromEntries(
                          Object.entries(g.usage).filter(([, v]) => typeof v === "number")
                        )
                      : null,
                  ],
                  ...Object.entries(g.metadata || {}).map(
                    ([k, v]) => [`langfuse.observation.metadata.${k}`, v] as [string, unknown]
                  ),
                ]),
              })),
            ];

            const auth = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");
            const res = await fetch(`${baseUrl}/api/public/otel/v1/traces`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${auth}`,
                "x-langfuse-ingestion-version": "4",
              },
              body: JSON.stringify({
                resourceSpans: [
                  {
                    resource: { attributes: attrs([["service.name", "finley"]]) },
                    scopeSpans: [{ scope: { name: "finley-llm-trace" }, spans }],
                  },
                ],
              }),
            });
            if (!res.ok) {
              console.error("llm-trace: Langfuse export failed", res.status);
            }
          } catch (err) {
            console.error("llm-trace: export error", err instanceof Error ? err.message : err);
          }
        });
      } catch (err) {
        // after() throws outside a request scope; tracing must never break the caller.
        console.error("llm-trace: could not schedule export", err instanceof Error ? err.message : err);
      }
    },
  };
}

export type FinleyTrace = ReturnType<typeof startFinleyTrace>;
