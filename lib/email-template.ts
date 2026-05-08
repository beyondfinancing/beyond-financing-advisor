// lib/email-template.ts
// Shared email template helpers for Beyond Intelligence internal-team emails.
// Style-1: uniform dark-blue hero banner with TEAM COMMAND CENTER pill,
// navy #263366 CTA buttons, Outlook-safe table-based markup (no real gradients).
// Used by: cron/daily-workflow-update, cron/stale-check, workflow/file-change.

const BRAND_NAVY = "#263366";
const HERO_BG = "#0F2A57";
const HERO_BG_DARK = "#0A1F44";
const PAGE_BG = "#F4F6FB";
const CARD_BG = "#FFFFFF";
const BORDER = "#E5E7EB";
const TEXT_PRIMARY = "#0F172A";
const TEXT_MUTED = "#64748B";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  "https://beyondintelligence.io";

export function appBaseUrl(): string {
  return APP_URL.replace(/\/$/, "");
}

export function workflowFileUrl(fileId: string): string {
  return `${appBaseUrl()}/workflow/${fileId}`;
}

export function commandCenterUrl(): string {
  return `${appBaseUrl()}/workflow`;
}

export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(n));
}

/**
 * Branded dark-blue hero banner.
 * Uses solid colors (no gradients) so Outlook 2016+/365 renders correctly.
 * pill: small uppercase tag (e.g. "TEAM COMMAND CENTER", "STALE FILE ALERT")
 * title: main headline
 * subtitle: optional one-line description below the title
 */
export function brandedHero(opts: {
  pill: string;
  title: string;
  subtitle?: string;
}): string {
  const pill = escapeHtml(opts.pill);
  const title = escapeHtml(opts.title);
  const subtitle = opts.subtitle ? escapeHtml(opts.subtitle) : "";

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background:${HERO_BG};border-radius:14px 14px 0 0;">
    <tr>
      <td style="padding:32px 36px 28px 36px;background:${HERO_BG};border-radius:14px 14px 0 0;">
        <div style="display:inline-block;padding:8px 16px;border-radius:999px;background:#FFFFFF;color:${HERO_BG};font-size:12px;font-weight:800;letter-spacing:1.4px;font-family:Arial,Helvetica,sans-serif;">${pill}</div>
        <h1 style="margin:14px 0 0 0;color:#FFFFFF;font-size:26px;line-height:1.25;font-weight:800;font-family:Arial,Helvetica,sans-serif;">${title}</h1>
        ${
          subtitle
            ? `<p style="margin:10px 0 0 0;color:#C7D5EE;font-size:14px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">${subtitle}</p>`
            : ""
        }
      </td>
    </tr>
  </table>`;
}

/**
 * Primary CTA button. Renders as a solid navy button via VML for Outlook.
 * label: e.g. "Open This File in Workflow Intelligence"
 * href: deep-link URL
 */
export function ctaButton(opts: { label: string; href: string }): string {
  const label = escapeHtml(opts.label);
  const href = escapeHtml(opts.href);

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"
    style="margin:24px auto;">
    <tr>
      <td align="center" style="border-radius:8px;background:${BRAND_NAVY};">
        <a href="${href}" target="_blank"
          style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:8px;background:${BRAND_NAVY};">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

/**
 * "Sign-in is required..." disclaimer block that mirrors the workflow-notify
 * gold-standard pattern. Shown directly below the CTA.
 */
export function signInDisclaimer(href: string): string {
  const safeHref = escapeHtml(href);
  return `
  <p style="margin:0 0 6px 0;text-align:center;color:${TEXT_MUTED};font-size:12px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
    Sign-in is required. If you are not currently logged in, you will be prompted to sign in directly on the workflow page.
  </p>
  <p style="margin:0 0 8px 0;text-align:center;color:${TEXT_MUTED};font-size:12px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;word-break:break-all;">
    Direct link: <a href="${safeHref}" style="color:${BRAND_NAVY};text-decoration:underline;">${safeHref}</a>
  </p>`;
}

/**
 * Outer email shell wraps hero + body content in a centered card layout
 * with the page background color. Returns full <html><body>...</body></html>.
 */
export function outerShell(opts: {
  preheader?: string;
  hero: string;
  bodyHtml: string;
  footerNote?: string;
}): string {
  const preheader = opts.preheader ? escapeHtml(opts.preheader) : "";
  const footerNote = opts.footerNote
    ? escapeHtml(opts.footerNote)
    : "Internal team notification from Beyond Intelligence Workflow Intelligence.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Beyond Intelligence</title>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:Arial,Helvetica,sans-serif;color:${TEXT_PRIMARY};">
  ${
    preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;color:${PAGE_BG};">${preheader}</div>`
      : ""
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE_BG};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0"
          style="max-width:640px;width:100%;background:${CARD_BG};border-radius:14px;border:1px solid ${BORDER};overflow:hidden;">
          <tr><td>${opts.hero}</td></tr>
          <tr>
            <td style="padding:28px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;color:${TEXT_PRIMARY};font-size:15px;line-height:1.55;">
              ${opts.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 28px 32px;border-top:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;color:${TEXT_MUTED};font-size:12px;line-height:1.5;">
              ${footerNote}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Re-export key colors so route handlers can use them inline if they
 * need to compose custom inner blocks (loan cards, KPI tiles, etc.).
 */
export const COLORS = {
  BRAND_NAVY,
  HERO_BG,
  HERO_BG_DARK,
  PAGE_BG,
  CARD_BG,
  BORDER,
  TEXT_PRIMARY,
  TEXT_MUTED,
} as const;
