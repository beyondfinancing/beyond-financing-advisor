// =============================================================================
// PHASE 7.5 — REPLACEMENT for app/api/admin/extract-programs/auto/route.ts
//
// What changed vs Phase 7.3:
//   - Detects when the document belongs to "Fannie Mae" or "Freddie Mac"
//     AND the document_type is "Selling Guide". In that case it routes to
//     a different prompt tuned for agency mega-docs and writes results to
//     global_guidelines instead of programs.
//   - Everything else (regular lender extraction → programs table) is
//     unchanged from Phase 7.3.
//   - The replace strategy still works: when a new Selling Guide upload
//     supersedes an old one, old global_guidelines rows from the old doc
//     are deactivated.
// =============================================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isAdminSignedIn } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 300
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
// PROMPT 1 — regular lender programs (Phase 7.3 prompt, unchanged)
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
// PROMPT 2 — agency Selling Guide extraction (NEW for Phase 7.5)
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
8. Skip non-program content: servicing rules, rep & warranty chapters, master agreement boilerplate, glossary, table of contents.
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
// Helpers
// ----------------------------------------------------------------------------
function parseJsonFromResponse<T>(text: string): T | null {
  let cleaned = text.trim()
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fenceMatch) cleaned = fenceMatch[1].trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
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
    if (groupLower.includes('multi-family') || groupLower.includes('multifamily') || groupLower.includes('multi family')) {
      productFamily = 'Multi-Family'
    } else if (groupLower.includes('single-family') || groupLower.includes('single family')) {
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

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
        model: 'claude-opus-4-7',
        max_tokens: 8000,
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
      const errMessage = 'Could not parse Claude response as JSON.'
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
        notes: [g.guidelineSummary, g.notes].filter(Boolean).join('\n\n') || null,
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
      model: 'claude-opus-4-7',
      max_tokens: 8000,
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
    const errMessage = 'Could not parse Claude response as JSON.'
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
