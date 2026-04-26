// =============================================================================
// PHASE 7.2 — EXTRACT + COMMIT ENDPOINT
//
// Paste this file at:
//     app/api/admin/extract-programs/commit/route.ts
//
// What it does:
//   POST { documentId: "<lender_documents.id>" }
//   1. Runs extraction (same logic as Phase 7.1 POC)
//   2. For each extracted program, INSERTs into programs (is_active=false,
//      source='extracted') and program_guidelines (source='extracted')
//   3. Returns counts and the inserted program IDs
//
// What it does NOT do:
//   - Does not activate the programs (you do that in /admin/programs after review)
//   - Does not deduplicate against existing programs (every commit creates new
//     drafts — Phase 7.3 problem if it becomes an issue)
//
// Auth: admin only.
// Required env: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Required dep: @anthropic-ai/sdk (already installed for Phase 7.1).
// =============================================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isAdminSignedIn } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

// -----------------------------------------------------------------------------
// Allow long execution time (PDF download + Claude call can take 30-60s)
// -----------------------------------------------------------------------------
export const maxDuration = 120
export const runtime = 'nodejs'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
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

type ExtractionResponse = {
  programs: ProposedProgram[]
  documentSummary: string
  warnings: string[]
}

// -----------------------------------------------------------------------------
// Extraction prompt (same as Phase 7.1 — proven on ITIN Obsidian)
// -----------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are an expert mortgage operations analyst working for Beyond Intelligence, a mortgage decision-support platform. Your job is to read lender guideline PDFs, rate sheets, and program matrices, and extract structured program data that loan officers can use to match borrower scenarios to lender programs.

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

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function parseJsonFromResponse(text: string): ExtractionResponse | null {
  let cleaned = text.trim()
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fenceMatch) cleaned = fenceMatch[1].trim()

  try {
    const parsed = JSON.parse(cleaned)
    if (
      parsed &&
      Array.isArray(parsed.programs) &&
      typeof parsed.documentSummary === 'string'
    ) {
      return parsed as ExtractionResponse
    }
    return null
  } catch {
    return null
  }
}

function deriveOccupancyString(occupancy: string[] | null): string | null {
  if (!occupancy || occupancy.length === 0) return null
  // programs.occupancy is a single text column; pick the first or join
  if (occupancy.length === 1) return occupancy[0]
  return occupancy.join(', ')
}

// -----------------------------------------------------------------------------
// Route
// -----------------------------------------------------------------------------
export async function POST(req: Request) {
  if (!(await isAdminSignedIn())) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized.' },
      { status: 401 }
    )
  }

  let body: { documentId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body.' },
      { status: 400 }
    )
  }

  const documentId = String(body?.documentId || '').trim()
  if (!documentId) {
    return NextResponse.json(
      { ok: false, error: 'documentId is required.' },
      { status: 400 }
    )
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'ANTHROPIC_API_KEY is not configured.' },
      { status: 500 }
    )
  }

  // 1. Look up document + lender.
  const { data: doc, error: docError } = await supabaseAdmin
    .from('lender_documents')
    .select(
      'id, lender_id, original_filename, storage_bucket, storage_path, mime_type, document_type, document_group, lenders(name)'
    )
    .eq('id', documentId)
    .maybeSingle()

  if (docError) {
    return NextResponse.json(
      { ok: false, error: `Database error: ${docError.message}` },
      { status: 500 }
    )
  }
  if (!doc) {
    return NextResponse.json(
      { ok: false, error: `Document ${documentId} not found.` },
      { status: 404 }
    )
  }
  if (!doc.lender_id) {
    return NextResponse.json(
      { ok: false, error: 'Document is not linked to a lender.' },
      { status: 400 }
    )
  }
  if (doc.mime_type && doc.mime_type !== 'application/pdf') {
    return NextResponse.json(
      { ok: false, error: `Document is ${doc.mime_type}, not a PDF.` },
      { status: 400 }
    )
  }

  const lenderName = Array.isArray(doc.lenders)
    ? (doc.lenders[0] as { name: string | null } | undefined)?.name || null
    : (doc.lenders as { name: string | null } | null)?.name || null

  // 2. Download PDF.
  const bucket = doc.storage_bucket || 'lender-files'
  const path = doc.storage_path
  if (!path) {
    return NextResponse.json(
      { ok: false, error: 'Document has no storage_path.' },
      { status: 500 }
    )
  }

  const { data: fileData, error: storageError } = await supabaseAdmin.storage
    .from(bucket)
    .download(path)

  if (storageError || !fileData) {
    return NextResponse.json(
      {
        ok: false,
        error: `Storage download failed: ${
          storageError?.message || 'unknown'
        }`,
      },
      { status: 500 }
    )
  }

  const arrayBuffer = await fileData.arrayBuffer()
  const sizeBytes = arrayBuffer.byteLength
  if (sizeBytes / (1024 * 1024) > 32) {
    return NextResponse.json(
      { ok: false, error: 'PDF exceeds 32MB Anthropic input limit.' },
      { status: 400 }
    )
  }
  const base64Pdf = Buffer.from(arrayBuffer).toString('base64')

  // 3. Call Claude.
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let claudeResponseText = ''
  let claudeUsage: { input_tokens: number; output_tokens: number } | null = null

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
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
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { ok: false, error: `Claude API error: ${message}` },
      { status: 500 }
    )
  }

  // 4. Parse extraction.
  const parsed = parseJsonFromResponse(claudeResponseText)
  if (!parsed) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Could not parse Claude response as JSON.',
        rawResponse: claudeResponseText,
        usage: claudeUsage,
      },
      { status: 500 }
    )
  }

  if (parsed.programs.length === 0) {
    return NextResponse.json({
      ok: true,
      message: 'Extraction completed but no programs found in this document.',
      documentSummary: parsed.documentSummary,
      warnings: parsed.warnings,
      programsCreated: 0,
      programIds: [],
      usage: claudeUsage,
    })
  }

  // 5. Insert each program as inactive draft.
  const insertedPrograms: { id: string; name: string }[] = []
  const insertErrors: string[] = []

  for (const program of parsed.programs) {
    const occupancyString = deriveOccupancyString(program.occupancy)

    // 5a. Insert into programs.
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

    // 5b. Insert into program_guidelines.
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

  return NextResponse.json({
    ok: true,
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
    usage: claudeUsage,
  })
}
