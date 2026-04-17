import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const STORAGE_BUCKET = "lender-files";

function buildRedirectUrl(type: "success" | "error", message: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://beyondintelligence.io";
  const url = new URL("/admin/files", baseUrl);
  url.searchParams.set(type, message);
  return url;
}

function sanitizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].toLowerCase();
}

async function archivePreviousActiveDocuments(lenderId: string, documentType: string, excludeId?: string) {
  let query = supabaseAdmin
    .from("lender_documents")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
    })
    .eq("lender_id", lenderId)
    .eq("document_type", documentType)
    .eq("status", "active");

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  return query;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const action = String(formData.get("action") || "").trim();

    if (action === "archive") {
      const id = String(formData.get("id") || "").trim();

      if (!id) {
        return NextResponse.redirect(
          buildRedirectUrl("error", "Document id is required for archive.")
        );
      }

      const { error } = await supabaseAdmin
        .from("lender_documents")
        .update({
          status: "archived",
          archived_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        return NextResponse.redirect(
          buildRedirectUrl("error", `Archive failed: ${error.message}`)
        );
      }

      return NextResponse.redirect(
        buildRedirectUrl("success", "Document archived successfully.")
      );
    }

    if (action !== "upload") {
      return NextResponse.redirect(
        buildRedirectUrl("error", "Invalid file action.")
      );
    }

    const lenderId = String(formData.get("lender_id") || "").trim();
    const documentType = String(formData.get("document_type") || "").trim();
    const effectiveDate = String(formData.get("effective_date") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    const file = formData.get("file");

    if (!lenderId || !documentType || !(file instanceof File) || !file.name) {
      return NextResponse.redirect(
        buildRedirectUrl("error", "Lender, document type, and file are required.")
      );
    }

    const { data: lenderData, error: lenderError } = await supabaseAdmin
      .from("lenders")
      .select("id, name")
      .eq("id", lenderId)
      .single();

    if (lenderError || !lenderData) {
      return NextResponse.redirect(
        buildRedirectUrl("error", "Lender not found for file upload.")
      );
    }

    const lenderName = lenderData.name || "unknown-lender";
    const safeLenderName = sanitizeName(lenderName);
    const safeDocType = sanitizeName(documentType);
    const extension = getFileExtension(file.name);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const storedFilename = extension
      ? `${safeLenderName}__${safeDocType}__${timestamp}.${extension}`
      : `${safeLenderName}__${safeDocType}__${timestamp}`;

    const storagePath = `${safeLenderName}/${safeDocType}/${storedFilename}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.redirect(
        buildRedirectUrl("error", `File upload failed: ${uploadError.message}`)
      );
    }

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from("lender_documents")
      .insert({
        lender_id: lenderId,
        document_type: documentType,
        original_filename: file.name,
        stored_filename: storedFilename,
        storage_bucket: STORAGE_BUCKET,
        storage_path: storagePath,
        mime_type: file.type || null,
        file_size: file.size || null,
        status: "active",
        effective_date: effectiveDate || null,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (insertError || !insertData) {
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);

      return NextResponse.redirect(
        buildRedirectUrl("error", `Document record save failed: ${insertError?.message || "Unknown error"}`)
      );
    }

    const { error: archiveError } = await archivePreviousActiveDocuments(
      lenderId,
      documentType,
      insertData.id
    );

    if (archiveError) {
      return NextResponse.redirect(
        buildRedirectUrl(
          "error",
          `File uploaded but previous version archive failed: ${archiveError.message}`
        )
      );
    }

    return NextResponse.redirect(
      buildRedirectUrl("success", "File uploaded and activated successfully.")
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected file upload error.";

    return NextResponse.redirect(buildRedirectUrl("error", message));
  }
}
