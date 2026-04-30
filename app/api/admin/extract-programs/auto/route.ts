// =============================================================================
// PHASE 7.5f — REPLACEMENT for app/api/admin/extract-programs/auto/route.ts
//
// Changes vs Phase 7.5e:
//   1. maxDuration bumped from 300s to 800s (Vercel Pro plan max).
//      Rationale: Sonnet extraction on dense ~370-page PDF chunks can take
//      4–10 minutes when the model has to chase deep cross-references and
//      generate ~20 program records per call. The 300s ceiling was being
//      hit on Freddie Mac SF Selling Guide Parts 3–8, leaving zombie
//      "Extracting" rows in the DB because the function got killed before
//      it could write extraction_status='failed'. 800s gives comfortable
//      headroom for any single chunk and fits the Vercel Pro plan max.
//   2. AGENCY_SYSTEM_PROMPT rule 8 expanded from one-liner to detailed
//      exclusion list with 7 sub-categories (a-g):
//        a. Servicing-side rules (existing)
//        b. Rep & warranty / boilerplate (existing)
//        c. NEW: Suspended/discontinued programs (e.g. High LTV Refinance,
//           Enhanced Relief Refinance)
//        d. NEW: Government conduit programs (FHA, VA, Section 184, 502 GRH)
//        e. NEW: Transaction structures (Single-Closing, Two-Closing, Texas
//           50(a)(6) eligibility)
//        f. NEW: Servicing-side seller mechanisms (Seller-Owned Converted/
//           Modified, Employee Relocation, Resale Restrictions)
//        g. NEW: Secondary-financing mechanisms (Home Possible with RHS
//           Leveraged Seconds)
//      Test: would a borrower walk into a broker's office and ask for this
//      by name? If no, skip. Targets the noise we saw in Freddie SF Part 2
//      output — should reduce manual-rejection burden and shorten generation
//      time per chunk (fewer items to write = less time = fewer timeouts).
//
// All other logic (PATH A agency vs PATH B lender, archive strategy, doc-group
// product family detection, replace strategy, tolerant JSON parser, max_tokens
// 16000, maxRetries 8, claude-sonnet-4-6 model) is unchanged from 7.5e.
//
// Changes vs Phase 7.5d:
//   1. Extraction model swapped from 'claude-opus-4-7' to 'claude-sonnet-4-6'
//      at both call sites (PATH A agency Selling Guide AND PATH B regular
//      lender). Rationale: Each multi-part Selling Guide chunk tokenizes to
//      ~200K input tokens. Six concurrent parts blow past Opus's 450K
//      input-tokens-per-minute org rate limit, and the SDK retry budget
//      from 7.5d (~127s) wasn't enough headroom for the rate-limit window
//      to drain. Sonnet has ~2-3× higher rate limits and ~5× lower cost,
//      and is fully capable for structured JSON extraction from PDFs.
//      maxRetries: 8 from 7.5d is retained as defense-in-depth.
//
// Changes vs Phase 7.5c:
//   1. Anthropic SDK client gets explicit maxRetries: 8 (was default 2).
//      Rationale: When multiple parts of a multi-part Selling Guide upload
//      kick off extraction in parallel (e.g. 6× Freddie Mac SF parts), the
//      organization's input-token-per-minute rate limit gets hit and every
//      call returns 429. With only 2 default SDK retries (~3s of backoff),
//      the rate-limit window doesn't have time to clear. maxRetries: 8
//      gives ~127s of exponential backoff with jitter, which fits inside
//      maxDuration (now 800s in 7.5f) and lets the SDK negotiate its own
//      timing with the rate limiter.
//
// Changes vs Phase 7.5:
//   1. max_tokens bumped from 8000 → 16000 (both PATH A agency and PATH B lender)
//      Dense chunks (e.g. Fannie SF Subpart B5) need more output room.
//   2. parseJsonFromResponse() upgraded to tolerant 4-strategy parser:
//      Strategy 1: direct JSON.parse (happy path, unchanged behavior)
//      Strategy 2: strip markdown code fences ```json ... ``` (was already in old version, kept)
//      Strategy 3: extract substring between first { and last }
//      Strategy 4: extract substring between first [ and last ]
//      On total failure, error message now includes first 500 chars of Claude's
//      actual response so we can diagnose what went wrong.
//   3. Both call sites still pass rawResponse on parse failure for visibility.
// =============================================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isAdminSignedIn } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 800
export const runtime = 'nodejs'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
type ProposedProgram = {
  programName: string
  loanCategory: string | null
  occupancy: string[] | null
  minCredit: number | null
  maxLtv: number | null
  maxDti: number | null
  minLoanAmount: number | null
  maxLoanAmount: number | null
  maxUnits: number | null
  allowsItin: boolean | null
  allowsForeignNational: boolean | null
  allowsFirstTimeHomebuyer: boolean | null
  reservesRequiredMonths: number | null
  guidelineSummary: string | null
  notes: string | null
  confidence: 'high' | 'medium' | 'low'
  sourceQuote: string | null
}

type ProgramExtractionResponse = {
  programs: ProposedProgram[]
  documentSummary: string
  warnings: string[]
}

type ProposedAgencyGuideline = {
  agency: 'Fannie Mae' | 'Freddie Mac'
  productFamily: 'Single-Family' | 'Multi-Family'
  programName: string
  occupancy: string[] | null
  incomeTypes: string[] | null
  minCredit: number | null
  maxLtv: number | null
  maxDti: number | null
  maxUnits: number | null
  notes: string | null
  guidelineSummary: string | null
  effectiveDate: string | null
  confidence: 'high' | 'medium' | 'low'
  sourceQuote: string | null
}

type AgencyExtractionResponse = {
  guidelines: ProposedAgencyGuideline[]
  documentSummary: string
  warnings: string[]
}

// ----------------------------------------------------------------------------
// PROMPT 1 — regular lender programs (unchanged)
// ----------------------------------------------------------------------------
const PROGRAM_SYSTEM_PROMPT = `You are an expert mortgage operations analyst working for Beyond Intelligence, a mortgage decision-support platform. Your job is to read lender guideline PDFs, rate sheets, and program matrices, and extract structured program data that loan officers can use to match borrower scenarios to lender programs.

You are reading documents like:
- Lender program matrices (e.g. "Plus Connect Product Matrix", "Investor Connect Matrix")
- Pricing sheets and rate sheets
- Selling guides and qualification guides
- Bank Statement, DSCR, ITIN, Foreign National, and other Non-QM program guidelines

For each distinct loan program described in the document, return a structured record. A "program" is a named, marketable loan offering with its own qualification criteria — for example, "Bank Statement", "DSCR", "ITIN Obsidian", "Plus Connect", "Jade", "Prime Connect", "Conventional", "FHA", etc.

If the document describes multiple programs (which is common in matrices), return one record per program. If it only describes one program in detail, return one record.

CRITICAL RULES:
1. Only extract data that is EXPLICITLY stated in the document. Do not infer, guess, or fill in industry defaults.
2. If a field is not stated, return null. Do not make up numbers.
3. For each program, set "confidence" to:
   - "high" if the program's parameters are clearly stated in a structured matrix or table
   - "medium" if the parameters are stated in prose but unambiguous
   - "low" if you had to interpret ambiguous text
4. Include a short "sourceQuote" — a 1-2 sentence verbatim excerpt from the document that supports the extraction. This helps the human reviewer verify your work.
5. If the document is a pricing/rate sheet without program-level qualification rules (just rates by FICO/LTV grid), return an empty programs array and explain in documentSummary.
6. If you encounter conditional rules ("min FICO 680 unless self-employed, then 700"), use the more conservative number and note the conditional in "notes".

LOAN CATEGORY VALUES (use these exact strings or null):
"Conventional", "FHA", "VA", "USDA", "DSCR", "Bank Statement", "ITIN", "Foreign National", "P&L", "1099", "Asset Depletion", "Stated Income", "Interest Only", "Jumbo Non-QM", "HELOC", "Other"

OCCUPANCY VALUES (array, use any combination of):
"Primary", "Second Home", "Investment"

OUTPUT FORMAT:
Return a single JSON object matching this exact shape:
{
  "programs": [ProposedProgram, ...],
  "documentSummary": "1-2 sentence description of what this document is",
  "warnings": ["array of strings flagging anything unclear or that the reviewer should double-check"]
}

Each ProposedProgram has these fields:
- programName: string (required)
- loanCategory: string or null (from list above)
- occupancy: string[] or null
- minCredit: number or null
- maxLtv: number or null (as decimal percentage, e.g. 80 not 0.80)
- maxDti: number or null (as decimal percentage, e.g. 50 not 0.50)
- minLoanAmount: number or null (in dollars)
- maxLoanAmount: number or null (in dollars)
- maxUnits: number or null
- allowsItin: boolean or null
- allowsForeignNational: boolean or null
- allowsFirstTimeHomebuyer: boolean or null
- reservesRequiredMonths: number or null
- guidelineSummary: string or null (2-3 sentence plain-English summary of the program)
- notes: string or null (any caveats, overlays, or edge cases worth flagging)
- confidence: "high" | "medium" | "low"
- sourceQuote: string or null

Return ONLY the JSON object. No prose before or after.`

// ----------------------------------------------------------------------------
// PROMPT 2 — agency Selling Guide extraction (unchanged)
// ----------------------------------------------------------------------------
const AGENCY_SYSTEM_PROMPT = `You are an expert mortgage operations analyst working for Beyond Intelligence, a mortgage decision-support platform. Your task is to read agency Selling Guides from Fannie Mae or Freddie Mac and extract structured program data for residential and multifamily lending.

These documents are large and define MANY distinct named programs. Each program has its own eligibility rules and underwriting criteria. Your job is to extract one record per distinct named program.

For Fannie Mae Single-Family expect to find programs like:
- Standard Conforming
- HomeReady
- HomeStyle Renovation
- High-Balance / High Balance Conforming
- Manufactured Housing
- Condo / PUD financing variants if presented as their own programs
- Construction-to-Permanent

For Fannie Mae Multi-Family expect:
- DUS (Delegated Underwriting and Servicing) Standard
- Small Loan
- Affordable / MAH (Multifamily Affordable Housing)
- Green Financing / Green Rewards
- Manufactured Housing Communities
- Seniors Housing / Healthcare

For Freddie Mac Single-Family expect:
- Standard Conforming (Mortgages)
- Home Possible
- HomeOne
- CHOICERenovation
- CHOICEHome (manufactured housing)
- Super Conforming
- Construction Conversion / Renovation

For Freddie Mac Multi-Family (Optigo) expect:
- Conventional Multifamily
- Targeted Affordable Housing (TAH)
- Small Balance Loan (SBL)
- Seniors Housing
- Manufactured Housing Communities
- Green Advantage

Note: actual programs found may differ from this list. Extract what the document describes, not what you expect.

CRITICAL RULES:
1. Only extract data that is EXPLICITLY stated. Do not infer or guess. If unstated, return null.
2. Each distinct named program gets its own record. Do NOT collapse multiple programs into one.
3. The "agency" field MUST be exactly "Fannie Mae" or "Freddie Mac" — match the value provided in the document context.
4. The "productFamily" field MUST be exactly "Single-Family" or "Multi-Family" — match the value provided in the document context.
5. The "programName" should be the canonical name as written in the document (e.g. "HomeReady" not "Home Ready" or "homeready").
6. For numerical fields, return the most permissive value when conditional rules apply (e.g. if max LTV is 95% for first-time homebuyers but 90% otherwise, return 95 and note the FTHB condition in notes).
7. If a program has multiple FICO/LTV combinations (e.g. matrices), capture the most permissive minimums (lowest required FICO, highest allowed LTV/DTI) and describe the matrix in notes.
8. Skip non-program content. The following are NOT programs and must NOT be extracted:
   a. Servicing-side rules and chapters (servicing fees, default management, loss mitigation, post-funding operations).
   b. Rep & warranty chapters, master agreement boilerplate, glossary, table of contents, definitions chapters.
   c. SUSPENDED or DISCONTINUED programs — if the text says "not eligible for delivery until further notice", "suspended", "no longer available", "discontinued", or similar, do NOT extract them as active programs. Examples: Fannie High LTV Refinance, Freddie Enhanced Relief Refinance.
   d. Government conduit programs where the agency only purchases with recourse and the underwriting is governed entirely by the underlying government agency. Do NOT extract: "FHA Mortgages", "VA Mortgages", "Section 184 Indian Housing", "Section 502 GRH / USDA Rural Housing" as standalone Freddie/Fannie programs. These are HUD/VA/USDA programs, not Freddie/Fannie programs.
   e. Transaction structures, mortgage features, or document classifications that are NOT standalone borrower-facing loan products. Do NOT extract: "Construction-to-Permanent Single-Closing", "Construction-to-Permanent Two-Closing", "Single-Closing transactions", "Two-Closing transactions", "Texas Section 50(a)(6) Loan" (this is a state constitutional eligibility overlay, not a program). DO extract the parent program (e.g. "Construction-to-Permanent Financing") if it is described as a product offering.
   f. Servicing-side mortgage operations and seller-side post-origination mechanisms. Do NOT extract: "Seller-Owned Converted Mortgages", "Seller-Owned Modified Mortgages", "Mortgages Made Pursuant to Employee Relocation Programs" (this is an underwriting flexibility, not a program), "Mortgages Secured by Properties Subject to Resale Restrictions" (overlay, not a program).
   g. Mechanisms for combining programs with secondary financing. Do NOT extract: "Home Possible with RHS Leveraged Seconds" as a separate program (the parent is Home Possible).
   When in doubt: ask "would a borrower walk into a mortgage broker's office and ask for this by name?" If no, skip it.
9. For "confidence", use "high" only when explicitly stated in tables/matrices, "medium" for clear prose, "low" if you had to interpret.
10. "sourceQuote" must be a 1-2 sentence verbatim excerpt that supports the extraction.

OCCUPANCY VALUES (array):
"Primary", "Second Home", "Investment"
For multi-family programs, occupancy is typically just "Investment" or null if not specified.

INCOME TYPES (array, use any combination):
"W-2", "Self-Employed", "1099", "Asset-Based", "Rental", "Pension", "Social Security", "Other"

OUTPUT FORMAT:
Return ONLY a single JSON object matching this exact shape:
{
  "guidelines": [ProposedAgencyGuideline, ...],
  "documentSummary": "1-2 sentence description of what this document is",
  "warnings": ["strings flagging things the reviewer should double-check"]
}

Each ProposedAgencyGuideline has these fields:
- agency: "Fannie Mae" | "Freddie Mac"
- productFamily: "Single-Family" | "Multi-Family"
- programName: string (required)
- occupancy: string[] or null
- incomeTypes: string[] or null
- minCredit: number or null
- maxLtv: number or null (as percentage, e.g. 95 not 0.95)
- maxDti: number or null (as percentage, e.g. 50 not 0.50)
- maxUnits: number or null (1-4 for single-family, 5+ for multi-family)
- notes: string or null
- guidelineSummary: string or null (2-3 sentence plain-English summary)
- effectiveDate: string or null (YYYY-MM-DD if stated)
- confidence: "high" | "medium" | "low"
- sourceQuote: string or null

Return ONLY the JSON object. No prose before or after.`

// ----------------------------------------------------------------------------
// Helpers — UPGRADED in Phase 7.5c
// ----------------------------------------------------------------------------

/**
 * Tolerant JSON parser. Tries 4 strategies before giving up.
 * Strategy 1: direct JSON.parse (happy path)
 * Strategy 2: strip markdown code fences ```json ... ```
 * Strategy 3: extract substring between first { and last }
 * Strategy 4: extract substring between first [ and last ]
 *
 * Returns null on total failure. Caller is responsible for surfacing the
 * raw response to the user.
 */
function parseJsonFromResponse<T>(text: string): T | null {
  if (!text || text.trim().length === 0) return null

  const trimmed = text.trim()

  // Strategy 1: direct parse
  try {
    return JSON.parse(trimmed) as T
  } catch {
    // fall through
  }

  // Strategy 2: strip markdown code fences ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T
    } catch {
      // fall through
    }
  }

  // Strategy 3: substring between first { and last }
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.substring(firstBrace, lastBrace + 1)
    try {
      return JSON.parse(candidate) as T
    } catch {
      // fall through
    }
  }

  // Strategy 4: substring between first [ and last ]
  const firstBracket = trimmed.indexOf('[')
  const lastBracket = trimmed.lastIndexOf(']')
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const candidate = trimmed.substring(firstBracket, lastBracket + 1)
    try {
      return JSON.parse(candidate) as T
    } catch {
      // fall through
    }
  }

  return null
}

function deriveOccupancyString(occupancy: string[] | null): string | null {
  if (!occupancy || occupancy.length === 0) return null
  if (occupancy.length === 1) return occupancy[0]
  return occupancy.join(', ')
}

async function setDocStatus(
  documentId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('lender_documents')
    .update(patch)
    .eq('id', documentId)
  if (error) {
    console.warn(
      `[auto-extract] Failed to update doc ${documentId}:`,
      error.message
    )
  }
}

async function archivePreviousExtractedPrograms(
  previousDocumentId: string | null
): Promise<number> {
  if (!previousDocumentId) return 0
  const { data: archived, error } = await supabaseAdmin
    .from('programs')
    .update({ is_active: false })
    .eq('source_document_id', previousDocumentId)
    .eq('is_active', true)
    .select('id')
  if (error) {
    console.warn(
      `[auto-extract] Failed to archive programs from ${previousDocumentId}:`,
      error.message
    )
    return 0
  }
  const programIds = (archived || []).map((row) => row.id)
  if (programIds.length > 0) {
    await supabaseAdmin
      .from('program_guidelines')
      .update({ is_active: false })
      .in('program_id', programIds)
  }
  return programIds.length
}

async function archivePreviousAgencyGuidelines(
  previousDocumentId: string | null
): Promise<number> {
  if (!previousDocumentId) return 0
  const { data: archived, error } = await supabaseAdmin
    .from('global_guidelines')
    .update({ is_active: false })
    .eq('source_document_id', previousDocumentId)
    .eq('is_active', true)
    .select('id')
  if (error) {
    console.warn(
      `[auto-extract] Failed to archive global_guidelines from ${previousDocumentId}:`,
      error.message
    )
    return 0
  }
  return (archived || []).length
}

function isAgencyExtraction(
  lenderName: string | null,
  documentType: string | null
): boolean {
  const lenderLower = (lenderName || '').toLowerCase()
  const docTypeLower = (documentType || '').toLowerCase()
  return (
    (lenderLower === 'fannie mae' || lenderLower === 'freddie mac') &&
    docTypeLower === 'selling guide'
  )
}

// ----------------------------------------------------------------------------
// Route
// ----------------------------------------------------------------------------
export async function POST(req: Request) {
  if (!(await isAdminSignedIn())) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized.' },
      { status: 401 }
    )
  }

  let body: { documentId?: string; previousActiveDocumentId?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body.' },
      { status: 400 }
    )
  }

  const documentId = String(body?.documentId || '').trim()
  const previousActiveDocumentId = body?.previousActiveDocumentId || null

  if (!documentId) {
    return NextResponse.json(
      { ok: false, error: 'documentId is required.' },
      { status: 400 }
    )
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    await setDocStatus(documentId, {
      extraction_status: 'failed',
      extraction_error: 'ANTHROPIC_API_KEY not configured.',
      extraction_completed_at: new Date().toISOString(),
    })
    return NextResponse.json(
      { ok: false, error: 'ANTHROPIC_API_KEY not configured.' },
      { status: 500 }
    )
  }

  await setDocStatus(documentId, {
    extraction_status: 'running',
    extraction_started_at: new Date().toISOString(),
    extraction_error: null,
  })

  const { data: doc, error: docError } = await supabaseAdmin
    .from('lender_documents')
    .select(
      'id, lender_id, original_filename, storage_bucket, storage_path, mime_type, document_type, document_group, lenders(name)'
    )
    .eq('id', documentId)
    .maybeSingle()

  if (docError || !doc) {
    await setDocStatus(documentId, {
      extraction_status: 'failed',
      extraction_error: docError?.message || 'Document not found.',
      extraction_completed_at: new Date().toISOString(),
    })
    return NextResponse.json(
      { ok: false, error: docError?.message || 'Document not found.' },
      { status: 404 }
    )
  }

  if (!doc.lender_id) {
    await setDocStatus(documentId, {
      extraction_status: 'failed',
      extraction_error: 'Document has no lender_id.',
      extraction_completed_at: new Date().toISOString(),
    })
    return NextResponse.json(
      { ok: false, error: 'Document is not linked to a lender.' },
      { status: 400 }
    )
  }

  if (doc.mime_type && doc.mime_type !== 'application/pdf') {
    await setDocStatus(documentId, {
      extraction_status: 'skipped',
      extraction_error: `Document is ${doc.mime_type}, not a PDF.`,
      extraction_completed_at: new Date().toISOString(),
    })
    return NextResponse.json(
      { ok: false, error: `Document is ${doc.mime_type}, not a PDF.` },
      { status: 400 }
    )
  }

  const lenderName = Array.isArray(doc.lenders)
    ? (doc.lenders[0] as { name: string | null } | undefined)?.name || null
    : (doc.lenders as { name: string | null } | null)?.name || null

  // ---------- Branch on agency vs lender ----------
  const useAgencyPrompt = isAgencyExtraction(lenderName, doc.document_type)

  // Determine product family from document_group.
  // document_group values now include part suffixes like:
  //   "Single-Family"
  //   "Single-Family Part 1"
  //   "Single-Family Whole Document"
  //   "Multi-Family Part 3"
  //   etc.
  // We do a substring check rather than exact match.
  const groupLower = (doc.document_group || '').toLowerCase()
  let productFamily: 'Single-Family' | 'Multi-Family' | null = null
  if (useAgencyPrompt) {
    if (
      groupLower.includes('multi-family') ||
      groupLower.includes('multifamily') ||
      groupLower.includes('multi family')
    ) {
      productFamily = 'Multi-Family'
    } else if (
      groupLower.includes('single-family') ||
      groupLower.includes('single family')
    ) {
      productFamily = 'Single-Family'
    } else {
      // Fallback: filename heuristic
      const fnLower = (doc.original_filename || '').toLowerCase()
      if (fnLower.includes('multi') || fnLower.includes('mf')) {
        productFamily = 'Multi-Family'
      } else {
        productFamily = 'Single-Family'
      }
    }
  }

  // Download PDF
  const bucket = doc.storage_bucket || 'lender-documents'
  const path = doc.storage_path
  if (!path) {
    await setDocStatus(documentId, {
      extraction_status: 'failed',
      extraction_error: 'Document has no storage_path.',
      extraction_completed_at: new Date().toISOString(),
    })
    return NextResponse.json(
      { ok: false, error: 'Document has no storage_path.' },
      { status: 500 }
    )
  }

  const { data: fileData, error: storageError } = await supabaseAdmin.storage
    .from(bucket)
    .download(path)

  if (storageError || !fileData) {
    const errMessage = `Storage download failed: ${
      storageError?.message || 'unknown'
    }`
    await setDocStatus(documentId, {
      extraction_status: 'failed',
      extraction_error: errMessage,
      extraction_completed_at: new Date().toISOString(),
    })
    return NextResponse.json({ ok: false, error: errMessage }, { status: 500 })
  }

  const arrayBuffer = await fileData.arrayBuffer()
  const sizeBytes = arrayBuffer.byteLength
  if (sizeBytes / (1024 * 1024) > 32) {
    const errMessage = 'PDF exceeds 32MB Anthropic input limit.'
    await setDocStatus(documentId, {
      extraction_status: 'failed',
      extraction_error: errMessage,
      extraction_completed_at: new Date().toISOString(),
    })
    return NextResponse.json({ ok: false, error: errMessage }, { status: 400 })
  }

  const base64Pdf = Buffer.from(arrayBuffer).toString('base64')

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 8,
  })

  // ============================================================
  // PATH A — agency Selling Guide → global_guidelines
  // ============================================================
  if (useAgencyPrompt && productFamily) {
    const userPrompt = `Document context:
- Agency: ${lenderName}
- Product Family: ${productFamily}
- Document type: Selling Guide
- Filename: ${doc.original_filename}

Extract every distinct named program defined in this Selling Guide. Return ONE record per program. Use exactly "${lenderName}" as the agency value and exactly "${productFamily}" as the productFamily value for every record.

Return only the JSON object as instructed.`

    let claudeResponseText = ''
    let claudeUsage: { input_tokens: number; output_tokens: number } | null =
      null

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system: AGENCY_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64Pdf,
                },
              },
              { type: 'text', text: userPrompt },
            ],
          },
        ],
      })

      const textBlocks = message.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
      claudeResponseText = textBlocks.join('\n').trim()
      claudeUsage = {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      }
    } catch (error) {
      const errMessage = `Claude API error: ${
        error instanceof Error ? error.message : String(error)
      }`
      await setDocStatus(documentId, {
        extraction_status: 'failed',
        extraction_error: errMessage,
        extraction_completed_at: new Date().toISOString(),
      })
      return NextResponse.json({ ok: false, error: errMessage }, { status: 500 })
    }

    const parsed = parseJsonFromResponse<AgencyExtractionResponse>(
      claudeResponseText
    )
    if (!parsed) {
      const preview = claudeResponseText.substring(0, 500)
      const errMessage = `Could not parse Claude response as JSON after 4 strategies. First 500 chars: ${preview}`
      await setDocStatus(documentId, {
        extraction_status: 'failed',
        extraction_error: errMessage,
        extraction_completed_at: new Date().toISOString(),
      })
      return NextResponse.json(
        { ok: false, error: errMessage, rawResponse: claudeResponseText },
        { status: 500 }
      )
    }

    if (parsed.guidelines.length === 0) {
      await setDocStatus(documentId, {
        extraction_status: 'completed',
        extraction_drafts_count: 0,
        extraction_completed_at: new Date().toISOString(),
        extraction_error: null,
      })
      return NextResponse.json({
        ok: true,
        message: 'Extraction completed but no programs found.',
        documentSummary: parsed.documentSummary,
        warnings: parsed.warnings,
        programsCreated: 0,
        usage: claudeUsage,
      })
    }

    const insertedGuidelines: { id: string; programName: string }[] = []
    const insertErrors: string[] = []

    for (const g of parsed.guidelines) {
      const insertPayload = {
        agency: g.agency,
        product_family: g.productFamily,
        program_name: g.programName,
        document_type: 'selling_guide',
        occupancy: g.occupancy || [],
        income_types: g.incomeTypes || [],
        min_credit: g.minCredit,
        max_ltv: g.maxLtv,
        max_dti: g.maxDti,
        max_units: g.maxUnits,
        notes:
          [g.guidelineSummary, g.notes].filter(Boolean).join('\n\n') || null,
        source_name: doc.original_filename,
        effective_date: g.effectiveDate,
        is_active: false,
        source: 'extracted',
        source_document_id: doc.id,
        extraction_metadata: {
          documentId: doc.id,
          documentFilename: doc.original_filename,
          documentType: doc.document_type,
          documentGroup: doc.document_group,
          extractedAt: new Date().toISOString(),
          confidence: g.confidence,
          sourceQuote: g.sourceQuote,
          documentSummary: parsed.documentSummary,
          documentWarnings: parsed.warnings,
          rawProposed: g,
          usage: claudeUsage,
        },
      }

      const { data: row, error: insertError } = await supabaseAdmin
        .from('global_guidelines')
        .insert(insertPayload)
        .select('id, program_name')
        .single()

      if (insertError || !row) {
        insertErrors.push(
          `${g.programName}: ${insertError?.message || 'insert failed'}`
        )
        continue
      }

      insertedGuidelines.push({ id: row.id, programName: row.program_name })
    }

    await setDocStatus(documentId, {
      extraction_status: 'completed',
      extraction_drafts_count: insertedGuidelines.length,
      extraction_completed_at: new Date().toISOString(),
      extraction_error: insertErrors.length > 0 ? insertErrors.join('; ') : null,
    })

    let archivedCount = 0
    if (previousActiveDocumentId) {
      archivedCount = await archivePreviousAgencyGuidelines(
        previousActiveDocumentId
      )
    }

    return NextResponse.json({
      ok: true,
      mode: 'agency',
      lender: { id: doc.lender_id, name: lenderName },
      productFamily,
      document: {
        id: doc.id,
        filename: doc.original_filename,
        documentType: doc.document_type,
        documentGroup: doc.document_group,
      },
      documentSummary: parsed.documentSummary,
      documentWarnings: parsed.warnings,
      programsCreated: insertedGuidelines.length,
      programIds: insertedGuidelines.map((p) => p.id),
      programNames: insertedGuidelines.map((p) => p.programName),
      insertErrors: insertErrors.length > 0 ? insertErrors : undefined,
      archivedFromPreviousDoc: archivedCount,
      usage: claudeUsage,
    })
  }

  // ============================================================
  // PATH B — regular lender → programs (unchanged from Phase 7.3)
  // ============================================================
  let claudeResponseText = ''
  let claudeUsage: { input_tokens: number; output_tokens: number } | null = null

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: PROGRAM_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf,
              },
            },
            {
              type: 'text',
              text: `Document context:
- Lender: ${lenderName || 'Unknown'}
- Document type: ${doc.document_type || 'Unknown'}
- Document group: ${doc.document_group || 'Unknown'}
- Filename: ${doc.original_filename}

Extract all distinct loan programs. Return only the JSON object as instructed.`,
            },
          ],
        },
      ],
    })

    const textBlocks = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
    claudeResponseText = textBlocks.join('\n').trim()
    claudeUsage = {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    }
  } catch (error) {
    const errMessage = `Claude API error: ${
      error instanceof Error ? error.message : String(error)
    }`
    await setDocStatus(documentId, {
      extraction_status: 'failed',
      extraction_error: errMessage,
      extraction_completed_at: new Date().toISOString(),
    })
    return NextResponse.json({ ok: false, error: errMessage }, { status: 500 })
  }

  const parsed = parseJsonFromResponse<ProgramExtractionResponse>(
    claudeResponseText
  )
  if (!parsed) {
    const preview = claudeResponseText.substring(0, 500)
    const errMessage = `Could not parse Claude response as JSON after 4 strategies. First 500 chars: ${preview}`
    await setDocStatus(documentId, {
      extraction_status: 'failed',
      extraction_error: errMessage,
      extraction_completed_at: new Date().toISOString(),
    })
    return NextResponse.json(
      { ok: false, error: errMessage, rawResponse: claudeResponseText },
      { status: 500 }
    )
  }

  if (parsed.programs.length === 0) {
    await setDocStatus(documentId, {
      extraction_status: 'completed',
      extraction_drafts_count: 0,
      extraction_completed_at: new Date().toISOString(),
      extraction_error: null,
    })
    return NextResponse.json({
      ok: true,
      message: 'Extraction completed but no programs found.',
      documentSummary: parsed.documentSummary,
      warnings: parsed.warnings,
      programsCreated: 0,
      usage: claudeUsage,
    })
  }

  const insertedPrograms: { id: string; name: string }[] = []
  const insertErrors: string[] = []

  for (const program of parsed.programs) {
    const occupancyString = deriveOccupancyString(program.occupancy)

    const programInsert = {
      lender_id: doc.lender_id,
      name: program.programName,
      loan_category: program.loanCategory,
      min_credit: program.minCredit,
      max_ltv: program.maxLtv,
      max_dti: program.maxDti,
      occupancy: occupancyString,
      notes: program.notes,
      is_active: false,
      source: 'extracted',
      source_document_id: doc.id,
      extraction_metadata: {
        documentId: doc.id,
        documentFilename: doc.original_filename,
        documentType: doc.document_type,
        documentGroup: doc.document_group,
        extractedAt: new Date().toISOString(),
        confidence: program.confidence,
        sourceQuote: program.sourceQuote,
        documentSummary: parsed.documentSummary,
        documentWarnings: parsed.warnings,
        rawProposed: program,
        usage: claudeUsage,
      },
    }

    const { data: programRow, error: programError } = await supabaseAdmin
      .from('programs')
      .insert(programInsert)
      .select('id, name')
      .single()

    if (programError || !programRow) {
      insertErrors.push(
        `Program "${program.programName}": ${
          programError?.message || 'insert failed'
        }`
      )
      continue
    }

    insertedPrograms.push({ id: programRow.id, name: programRow.name })

    const guidelineInsert = {
      program_id: programRow.id,
      occupancy_types: program.occupancy ? program.occupancy : [],
      min_credit_score: program.minCredit,
      max_ltv: program.maxLtv,
      max_dti: program.maxDti,
      min_loan_amount: program.minLoanAmount,
      max_loan_amount: program.maxLoanAmount,
      max_units: program.maxUnits,
      allows_itin: program.allowsItin,
      allows_foreign_national: program.allowsForeignNational,
      allows_first_time_homebuyer: program.allowsFirstTimeHomebuyer,
      reserves_required_months: program.reservesRequiredMonths,
      guideline_summary: program.guidelineSummary,
      guideline_notes: program.notes,
      is_active: false,
      source: 'extracted',
      extraction_metadata: {
        documentId: doc.id,
        confidence: program.confidence,
        sourceQuote: program.sourceQuote,
      },
    }

    const { error: guidelineError } = await supabaseAdmin
      .from('program_guidelines')
      .insert(guidelineInsert)

    if (guidelineError) {
      insertErrors.push(
        `Guideline for "${program.programName}": ${guidelineError.message}`
      )
    }
  }

  await setDocStatus(documentId, {
    extraction_status: 'completed',
    extraction_drafts_count: insertedPrograms.length,
    extraction_completed_at: new Date().toISOString(),
    extraction_error: insertErrors.length > 0 ? insertErrors.join('; ') : null,
  })

  let archivedCount = 0
  if (previousActiveDocumentId) {
    archivedCount = await archivePreviousExtractedPrograms(
      previousActiveDocumentId
    )
  }

  return NextResponse.json({
    ok: true,
    mode: 'lender',
    lender: { id: doc.lender_id, name: lenderName },
    document: {
      id: doc.id,
      filename: doc.original_filename,
      documentType: doc.document_type,
      documentGroup: doc.document_group,
    },
    documentSummary: parsed.documentSummary,
    documentWarnings: parsed.warnings,
    programsCreated: insertedPrograms.length,
    programIds: insertedPrograms.map((p) => p.id),
    programNames: insertedPrograms.map((p) => p.name),
    insertErrors: insertErrors.length > 0 ? insertErrors : undefined,
    archivedFromPreviousDoc: archivedCount,
    usage: claudeUsage,
  })
}
