// =============================================================================
// REPLACEMENT for app/api/admin/lender-files/upload/route.ts
//
// FIX vs Phase 7.3 v1:
//   The previous version used process.env.VERCEL_URL to build the URL for
//   the background auto-extract call. VERCEL_URL points to the deployment
//   URL like "beyond-financing-advisor-xyz.vercel.app", not the production
//   domain "beyondintelligence.io". The admin session cookie is scoped to
//   beyondintelligence.io, so the background call hit a different domain
//   without a valid cookie and was rejected as unauthorized — silently.
//
// This version uses the URL from the incoming request itself, so the
// background fetch goes back to the same domain the user is actually on.
//
// Everything else in the route is unchanged.
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

    const { data: lender, error: lenderError } = await supabase
      .from('lenders')
      .select('id, name')
      .eq('id', lenderId)
      .single()

    if (lenderError || !lender) {
      return NextResponse.json({ error: 'Lender not found.' }, { status: 404 })
    }

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

    const shouldExtract =
      file.type === 'application/pdf' &&
      AUTO_EXTRACT_DOCUMENT_TYPES.has(documentType)

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
    // CRITICAL: use the incoming request's URL so the background call goes
    // back to the same domain where the admin session cookie is valid.
    if (shouldExtract) {
      const newDocumentId = insertedDoc.id
      const reqUrl = new URL(req.url)
      const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`
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
              `[upload->auto-extract] Trigger failed for ${newDocumentId} (status ${response.status}):`,
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
