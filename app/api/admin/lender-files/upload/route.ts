import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const formData = await req.formData();

    const lenderId = String(formData.get("lenderId") || "").trim();
    const documentType = String(formData.get("documentType") || "").trim();
    const documentGroup = String(formData.get("documentGroup") || "").trim() || "Master";
    const programId = String(formData.get("programId") || "").trim() || null;
    const effectiveDate = String(formData.get("effectiveDate") || "").trim() || null;
    const notes = String(formData.get("notes") || "").trim() || null;
    const file = formData.get("file") as File | null;

    if (!lenderId) {
      return NextResponse.json({ error: "Missing lenderId." }, { status: 400 });
    }

    if (!documentType) {
      return NextResponse.json({ error: "Missing documentType." }, { status: 400 });
    }

    if (!documentGroup) {
      return NextResponse.json({ error: "Missing documentGroup." }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }

    const { data: lender, error: lenderError } = await supabase
      .from("lenders")
      .select("id, name")
      .eq("id", lenderId)
      .single();

    if (lenderError || !lender) {
      return NextResponse.json({ error: "Lender not found." }, { status: 404 });
    }

    const { data: existingActive, error: activeError } = await supabase
      .from("lender_documents")
      .select("id, version_number")
      .eq("lender_id", lenderId)
      .eq("document_type", documentType)
      .eq("document_group", documentGroup)
      .eq("is_active", true)
      .maybeSingle();

    if (activeError) {
      return NextResponse.json(
        { error: activeError.message || "Failed checking active slot." },
        { status: 500 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = [
      slugify(lender.name),
      slugify(documentType),
      slugify(documentGroup),
      `${timestamp}-${slugify(file.name.replace(/\.[^/.]+$/, ""))}.${ext}`,
    ].join("/");

    const { error: uploadError } = await supabase.storage
      .from("lender-documents")
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || "Storage upload failed." },
        { status: 500 }
      );
    }

    if (existingActive?.id) {
      const { error: archiveExistingError } = await supabase
        .from("lender_documents")
        .update({
          is_active: false,
          archived_at: new Date().toISOString(),
        })
        .eq("id", existingActive.id);

      if (archiveExistingError) {
        return NextResponse.json(
          { error: archiveExistingError.message || "Failed to archive previous active file." },
          { status: 500 }
        );
      }
    }

    const nextVersion =
      existingActive?.version_number && Number.isFinite(existingActive.version_number)
        ? existingActive.version_number + 1
        : 1;

    const { error: insertError } = await supabase.from("lender_documents").insert({
      lender_id: lenderId,
      program_id: programId,
      document_type: documentType,
      document_group: documentGroup,
      original_filename: file.name,
      stored_filename: path.split("/").pop(),
      storage_bucket: "lender-documents",
      storage_path: path,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      effective_date: effectiveDate,
      notes,
      is_active: true,
      version_number: nextVersion,
      uploaded_at: new Date().toISOString(),
    });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message || "Failed to insert document record." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      slotLabel: `${lender.name} / ${documentType} / ${documentGroup}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Server error.",
      },
      { status: 500 }
    );
  }
}
