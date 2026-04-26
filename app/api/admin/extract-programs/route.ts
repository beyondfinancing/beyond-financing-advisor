// =============================================================================
// PHASE 7.1 — PROGRAM EXTRACTION PROOF OF CONCEPT
//
// Paste this file at:
//     app/api/admin/extract-programs/route.ts
//
// What it does:
//   POST { documentId: "<lender_documents.id>" }
//   Returns { ok: true, lender, document, extracted: ProposedProgram[] }
//
// What it does NOT do:
//   No database writes. No staging table. No commit. Read-only POC.
//   This is here so you can call it once against an existing PDF and see
//   what Claude returns. If the output is good, we build Phase 7.2.
//   If it's garbage, we change approach before building anything around it.
//
// Auth:
//   Reuses isAdminSignedIn() — only the admin can call this, same as the
//   rest of /api/admin/*.
//
// Required env vars (already set):
//   - ANTHROPIC_API_KEY
//   - SUPABASE_SERVICE_ROLE_KEY (already used by supabaseAdmin)
//
// Required dependency:
//   - @anthropic-ai/sdk (we'll install in Step 2 of this phase)
// =============================================================================

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isAdminSignedIn } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

// -----------------------------------------------------------------------------
// Types — what we expect Claude to return
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
// Extraction prompt — the heart of this phase
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
// Helper: parse Claude's response, handling fenced code blocks if present
// -----------------------------------------------------------------------------
function parseJsonFromResponse(text: string): ExtractionResponse | null {
  let cleaned = text.trim()

  // Strip ```json ... ``` fences if Claude added them despite instructions
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim()
  }

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

// -----------------------------------------------------------------------------
// Route handler
// -----------------------------------------------------------------------------
export async function POST(req: Request) {
  // 1. Auth — admin only.
  if (!(await isAdminSignedIn())) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized.' },
      { status: 401 }
    )
  }

  // 2. Parse body.
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

  // 3. Verify env.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'ANTHROPIC_API_KEY is not configured on the server.' },
      { status: 500 }
    )
  }

  // 4. Look up the document + lender.
  const { data: doc, error: docError } = await supabaseAdmin
    .from('lender_documents')
    .select(
      'id, lender_id, original_filename, storage_bucket, storage_path, mime_type, document_type, document_group, file_size, lenders(name)'
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
      { ok: false, error: `No document found with id ${documentId}.` },
      { status: 404 }
    )
  }

  const lenderName =
    Array.isArray(doc.lenders)
      ? (doc.lenders[0] as { name: string | null } | undefined)?.name
      : (doc.lenders as { name: string | null } | null)?.name

  // 5. Validate it's a PDF.
  if (doc.mime_type && doc.mime_type !== 'application/pdf') {
    return NextResponse.json(
      {
        ok: false,
        error: `This document is ${doc.mime_type}, not a PDF. Phase 7.1 only handles PDFs.`,
      },
      { status: 400 }
    )
  }

  // 6. Fetch the PDF bytes from Supabase storage.
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
        error: `Could not download from storage: ${
          storageError?.message || 'unknown error'
        }`,
      },
      { status: 500 }
    )
  }

  const arrayBuffer = await fileData.arrayBuffer()
  const base64Pdf = Buffer.from(arrayBuffer).toString('base64')
  const sizeBytes = arrayBuffer.byteLength
  const sizeMb = sizeBytes / (1024 * 1024)

  // Claude's PDF document input has a 32MB limit.
  if (sizeMb > 32) {
    return NextResponse.json(
      {
        ok: false,
        error: `PDF is ${sizeMb.toFixed(
          1
        )}MB, which exceeds Claude's 32MB limit for direct PDF input.`,
      },
      { status: 400 }
    )
  }

  // 7. Call Claude with the PDF as a document content block.
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

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
              text: `Document context (for your reference, not for inclusion in output):
- Lender: ${lenderName || 'Unknown'}
- Document type: ${doc.document_type || 'Unknown'}
- Document group: ${doc.document_group || 'Unknown'}
- Original filename: ${doc.original_filename}

Extract all distinct loan programs from this document. Return only the JSON object as instructed.`,
            },
          ],
        },
      ],
    })

    // Pull text content blocks out of the response.
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
      {
        ok: false,
        error: `Claude API error: ${message}`,
        stage: 'anthropic_call',
      },
      { status: 500 }
    )
  }

  // 8. Parse the JSON Claude returned.
  const parsed = parseJsonFromResponse(claudeResponseText)
  if (!parsed) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Claude returned a response we could not parse as JSON.',
        rawResponse: claudeResponseText,
        usage: claudeUsage,
      },
      { status: 500 }
    )
  }

  // 9. Return everything to the caller. No DB writes.
  return NextResponse.json({
    ok: true,
    lender: {
      id: doc.lender_id,
      name: lenderName || null,
    },
    document: {
      id: doc.id,
      filename: doc.original_filename,
      documentType: doc.document_type,
      documentGroup: doc.document_group,
      sizeBytes,
    },
    extracted: parsed.programs,
    documentSummary: parsed.documentSummary,
    warnings: parsed.warnings,
    usage: claudeUsage,
  })
}
