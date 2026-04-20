import { NextResponse } from "next/server";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

type PromotePayload = {
  lenderId?: unknown;
  productName?: unknown;
  category?: unknown;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCategory(value: string): string {
  const v = value.trim().toLowerCase();

  if (!v) return "non_qm";
  if (v === "agency") return "agency";
  if (v === "government") return "government";
  if (v === "second_lien") return "second_lien";
  if (v === "second lien") return "second_lien";
  if (v === "equity") return "second_lien";
  if (v === "heloc") return "second_lien";
  if (v === "non-qm") return "non_qm";
  if (v === "non_qm") return "non_qm";
  if (v === "non qm") return "non_qm";

  return slugify(v) || "non_qm";
}

function normalizeCustomProducts(value: unknown): Array<{ name: string; category: string }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const raw = item as Record<string, unknown>;
      const name = normalizeString(raw.name);
      const category = normalizeCategory(normalizeString(raw.category));

      if (!name) return null;

      return { name, category };
    })
    .filter(Boolean) as Array<{ name: string; category: string }>;
}

export async function POST(req: Request) {
  const signedIn = await isAdminSignedIn();

  if (!signedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as PromotePayload;

    const lenderId = normalizeString(body.lenderId);
    const productName = normalizeString(body.productName);
    const category = normalizeCategory(normalizeString(body.category));

    if (!lenderId || !productName) {
      return NextResponse.json(
        { error: "lenderId and productName are required." },
        { status: 400 }
      );
    }

    const { data: lenderRow, error: lenderError } = await supabaseAdmin
      .from("lenders")
      .select("id, custom_product_types")
      .eq("id", lenderId)
      .maybeSingle();

    if (lenderError) {
      return NextResponse.json({ error: lenderError.message }, { status: 500 });
    }

    if (!lenderRow) {
      return NextResponse.json({ error: "Lender not found." }, { status: 404 });
    }

    const customProducts = normalizeCustomProducts(lenderRow.custom_product_types);
    const match = customProducts.find(
      (item) => item.name.toLowerCase() === productName.toLowerCase()
    );

    if (!match) {
      return NextResponse.json(
        { error: "Exclusive product not found on this lender." },
        { status: 404 }
      );
    }

    const sharedProductId = slugify(match.name);

    const { error: upsertSharedError } = await supabaseAdmin
      .from("loan_product_types")
      .upsert(
        {
          id: sharedProductId,
          name: match.name,
          category: match.category,
          is_shared: true,
          is_active: true,
          promoted_from_lender_id: lenderId,
          promoted_from_custom_name: match.name,
        },
        { onConflict: "id" }
      );

    if (upsertSharedError) {
      return NextResponse.json(
        { error: upsertSharedError.message },
        { status: 500 }
      );
    }

    const { data: assignmentExisting, error: assignmentCheckError } = await supabaseAdmin
      .from("lender_product_assignments")
      .select("lender_id, product_type_id")
      .eq("lender_id", lenderId)
      .eq("product_type_id", sharedProductId)
      .maybeSingle();

    if (assignmentCheckError) {
      return NextResponse.json(
        { error: assignmentCheckError.message },
        { status: 500 }
      );
    }

    if (!assignmentExisting) {
      const { error: insertAssignmentError } = await supabaseAdmin
        .from("lender_product_assignments")
        .insert({
          lender_id: lenderId,
          product_type_id: sharedProductId,
          owner_occupied_allowed: true,
          non_owner_occupied_allowed: true,
          notes: `Promoted from lender-exclusive product "${match.name}".`,
        });

      if (insertAssignmentError) {
        return NextResponse.json(
          { error: insertAssignmentError.message },
          { status: 500 }
        );
      }
    }

    const updatedCustomProducts = customProducts.filter(
      (item) => item.name.toLowerCase() !== match.name.toLowerCase()
    );

    const { error: updateLenderError } = await supabaseAdmin
      .from("lenders")
      .update({
        custom_product_types: updatedCustomProducts,
      })
      .eq("id", lenderId);

    if (updateLenderError) {
      return NextResponse.json(
        { error: updateLenderError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      promoted: {
        lenderId,
        productName: match.name,
        sharedProductId,
        category: match.category,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected product promotion error.",
      },
      { status: 500 }
    );
  }
}
