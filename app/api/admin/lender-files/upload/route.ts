// =============================================================================
// PHASE 7.3 — REPLACEMENT for app/api/admin/lender-files/upload/route.ts
//
// Drop-in replacement for your existing upload route.
//
// What changed from your original:
//   1. After a successful upload + insert, the route fires off an extraction
//      call in the background using waitUntil() so the user gets their
//      response immediately.
//   2. Sets extraction_status='pending' on insert so the UI can show a
//      "queued" badge before extraction kicks in.
//   3. Calls the new internal extract endpoint with the new document's id.
//      That endpoint handles status updates, replace strategy, and inserts.
//
// What is unchanged:
//   - All your validation logic, file storage, archive-existing-active flow,
//     version_number bump, slot label response — byte-identical.
//
// Why fire-and-forget instead of awaiting:
//   Extraction takes 20-60 seconds. We don't want the user's upload UI to
//   sit on a spinner that long. waitUntil() lets the function continue
//   running after the response is sent, up to maxDuration (we set it to
//   300s on the extract endpoint to be safe).
// =============================================================================

import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getBaseUrl(): string {
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl}`
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://beyondintelligence.io'
}

// PDF document types that should be auto-extracted.
// Pricing sheets and rate sheets typically don't define program parameters,
// so we skip them by default. Other types are worth extracting.
const AUTO_EXTRACT_DOCUMENT_TYPES = new Set([
  'Program Matrix',
  'Programs',
  'Qualification Guide',
  'Selling Guide',
  'Overlays',
])

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const formData = await req.formData()

    const lenderId = String(formData.get('lenderId') || '').trim()
    const documentType = String(formData.get('documentType') || '').trim()
    const documentGroup =
      String(formData.get('documentGroup') || '').trim() || 'Master'
    const programId = String(formData.get('programId') || '').trim() || null
    const effectiveDate =
      String(formData.get('effectiveDate') || '').trim() || null
    const notes = String(formData.get('notes') || '').trim() || null
    const file = formData.get('file') as File | null

    if (!lenderId) {
      return NextResponse.json({ error: 'Missing lenderId.' }, { status: 400 })
    }
    if (!documentType) {
      return NextResponse.json(
        { error: 'Missing documentType.' },
        { status: 400 }
      )
    }
    if (!documentGroup) {
      return NextResponse.json(
        { error: 'Missing documentGroup.' },
        { status: 400 }
      )
    }
    if (!file) {
      return NextResponse.json({ error: 'Missing file.' }, { status: 400 })
    }

    // Verify lender exists.
    const { data: lender, error: lenderError } = await supabase
      .from('lenders')
      .select('id, name')
      .eq('id', lenderId)
      .single()

    if (lenderError || !lender) {
      return NextResponse.json({ error: 'Lender not found.' }, { status: 404 })
    }

    // Find the existing active doc in this slot, if any.
    const { data: existingActive, error: activeError } = await supabase
      .from('lender_documents')
      .select('id, version_number')
      .eq('lender_id', lenderId)
      .eq('document_type', documentType)
      .eq('document_group', documentGroup)
      .eq('is_active', true)
      .maybeSingle()

    if (activeError) {
      return NextResponse.json(
        { error: activeError.message || 'Failed checking active slot.' },
        { status: 500 }
      )
    }

    const previousActiveDocumentId = existingActive?.id || null

    // Upload bytes to storage.
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const path = [
      slugify(lender.name),
      slugify(documentType),
      slugify(documentGroup),
      `${timestamp}-${slugify(file.name.replace(/\.[^/.]+$/, ''))}.${ext}`,
    ].join('/')

    const { error: uploadError } = await supabase.storage
      .from('lender-documents')
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || 'Storage upload failed.' },
        { status: 500 }
      )
    }

    // Archive the old active row.
    if (previousActiveDocumentId) {
      const { error: archiveExistingError } = await supabase
        .from('lender_documents')
        .update({
          is_active: false,
          archived_at: new Date().toISOString(),
        })
        .eq('id', previousActiveDocumentId)

      if (archiveExistingError) {
        return NextResponse.json(
          {
            error:
              archiveExistingError.message ||
              'Failed to archive previous active file.',
          },
          { status: 500 }
        )
      }
    }

    const nextVersion =
      existingActive?.version_number && Number.isFinite(existingActive.version_number)
        ? existingActive.version_number + 1
        : 1

    // Decide whether to auto-extract this document type.
    const shouldExtract =
      file.type === 'application/pdf' &&
      AUTO_EXTRACT_DOCUMENT_TYPES.has(documentType)

    // Insert the new active row, marked pending (or skipped if not a PDF
    // we should extract).
    const { data: insertedDoc, error: insertError } = await supabase
      .from('lender_documents')
      .insert({
        lender_id: lenderId,
        program_id: programId,
        document_type: documentType,
        document_group: documentGroup,
        original_filename: file.name,
        stored_filename: path.split('/').pop(),
        storage_bucket: 'lender-documents',
        storage_path: path,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        effective_date: effectiveDate,
        notes,
        is_active: true,
        version_number: nextVersion,
        uploaded_at: new Date().toISOString(),
        extraction_status: shouldExtract ? 'pending' : 'skipped',
      })
      .select('id')
      .single()

    if (insertError || !insertedDoc) {
      return NextResponse.json(
        {
          error:
            insertError?.message || 'Failed to insert document record.',
        },
        { status: 500 }
      )
    }

    // Fire-and-forget: trigger extraction in the background.
    // The user gets their upload-success response immediately.
    if (shouldExtract) {
      const newDocumentId = insertedDoc.id
      const baseUrl = getBaseUrl()

      // Forward the admin session cookie so the internal call passes auth.
      const cookieHeader = req.headers.get('cookie') || ''

      after(async () => {
        try {
          const response = await fetch(
            `${baseUrl}/api/admin/extract-programs/auto`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                cookie: cookieHeader,
              },
              body: JSON.stringify({
                documentId: newDocumentId,
                previousActiveDocumentId,
              }),
            }
          )

          if (!response.ok) {
            const errText = await response.text()
            console.warn(
              `[upload->auto-extract] Extraction trigger failed for ${newDocumentId}:`,
              errText
            )
          }
        } catch (err) {
          console.warn(
            `[upload->auto-extract] Could not trigger extraction for ${newDocumentId}:`,
            err
          )
        }
      })
    }

    return NextResponse.json({
      success: true,
      slotLabel: `${lender.name} / ${documentType} / ${documentGroup}`,
      documentId: insertedDoc.id,
      extractionQueued: shouldExtract,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Server error.',
      },
      { status: 500 }
    )
  }
}
