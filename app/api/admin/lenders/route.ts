import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { signInAdminSession } from "@/lib/admin-auth";

type ProductAssignmentInput = {
  productId: string;
  productName: string;
  categories: string[];
};

type CustomProductTypeInput = {
  id: string;
  name: string;
  category: string | null;
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeStateArray(value: unknown): string[] {
  return Array.from(
    new Set(normalizeStringArray(value).map((state) => state.toUpperCase()))
  );
}

const ALLOWED_AUS_METHODS = new Set(["du", "lpa", "manual"]);

// Phase 7.1b — AUS Methods Filtering on create.
//
// Same semantics as the helper in app/api/admin/lenders/[id]/route.ts.
// Accepts a payload like ["du","lpa","manual"] (case-insensitive), returns
// a deduped, lowercased subset filtered to allowed values. Invalid values
// are dropped silently. Empty array is returned as-is.
function normalizeAusMethods(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim().toLowerCase())
        .filter((item) => ALLOWED_AUS_METHODS.has(item))
    )
  ).sort();
}

function normalizeNotes(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeProductAssignments(value: unknown): ProductAssignmentInput[] {
  if (!Array.isArray(value)) return [];

  const cleaned = value
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;

      return {
        productId: String(row.productId ?? row.product_id ?? "").trim(),
        productName: String(row.productName ?? row.product_name ?? "").trim(),
        categories: normalizeStringArray(row.categories),
      };
    })
    .filter((item) => item.productId && item.productName);

  const dedupedMap = new Map<string, ProductAssignmentInput>();

  for (const item of cleaned) {
    const key = item.productId.toLowerCase();
    const existing = dedupedMap.get(key);

    if (!existing) {
      dedupedMap.set(key, {
        productId: item.productId,
        productName: item.productName,
        categories: item.categories,
      });
      continue;
    }

    dedupedMap.set(key, {
      productId: existing.productId,
      productName: existing.productName || item.productName,
      categories: Array.from(
        new Set([...(existing.categories || []), ...(item.categories || [])])
      ),
    });
  }

  return Array.from(dedupedMap.values());
}

function normalizeCustomProductTypes(value: unknown): CustomProductTypeInput[] {
  if (!Array.isArray(value)) return [];

  const cleaned = value
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;

      const id = String(row.id ?? "").trim();
      const name = String(row.name ?? "").trim();
      const rawCategory = row.category;

      return {
        id,
        name,
        category:
          rawCategory === null || rawCategory === undefined
            ? null
            : String(rawCategory).trim() || null,
      };
    })
    .filter((item) => item.id && item.name);

  const dedupedMap = new Map<string, CustomProductTypeInput>();

  for (const item of cleaned) {
    dedupedMap.set(item.id.toLowerCase(), item);
  }

  return Array.from(dedupedMap.values());
}

async function ensureAdminAccess() {
  try {
    await signInAdminSession();
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const isAdmin = await ensureAdminAccess();

  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("lenders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load lenders." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    lenders: data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const isAdmin = await ensureAdminAccess();

  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json." },
      { status: 400 }
    );
  }

  const body = await request.json();

  const name = String(body?.name ?? "").trim();
  const channels = normalizeStringArray(body?.channels);
  const ownerOccupiedStates = normalizeStateArray(body?.ownerOccupiedStates);
  const nonOwnerOccupiedStates = normalizeStateArray(body?.nonOwnerOccupiedStates);
  const notes = normalizeNotes(body?.notes);
  const productAssignments = normalizeProductAssignments(body?.productAssignments);
  const customProductTypes = normalizeCustomProductTypes(body?.customProductTypes);

  if (!name) {
    return NextResponse.json(
      { error: "Lender name is required." },
      { status: 400 }
    );
  }

  const { data: existingLender, error: existingLenderError } = await supabaseAdmin
    .from("lenders")
    .select("id")
    .ilike("name", name)
    .maybeSingle();

  if (existingLenderError) {
    return NextResponse.json(
      { error: existingLenderError.message || "Failed checking lender name." },
      { status: 500 }
    );
  }

  if (existingLender) {
    return NextResponse.json(
      { error: "A lender with this name already exists." },
      { status: 409 }
    );
  }

  const combinedStates = Array.from(
    new Set([...ownerOccupiedStates, ...nonOwnerOccupiedStates])
  );

  // Phase 7.1b — AUS Methods on create.
  //
  // If the body explicitly includes an `ausMethods` field, we honor what
  // the caller sent (after normalization, including an explicit empty
  // array meaning "accepts no AUS methods"). If the field is absent from
  // the request entirely (e.g., legacy callers built before this column
  // existed), we OMIT aus_methods from the insert so the DB default
  // ['du','lpa'] kicks in. The new LendersClient form always sends an
  // explicit array, so the omit branch is purely defensive.
  const baseInsert: Record<string, unknown> = {
    name,
    channel: channels,
    states: combinedStates,
    notes,
    product_assignments: productAssignments,
    custom_product_types: customProductTypes,
  };

  const insertPayload =
    body?.ausMethods !== undefined
      ? { ...baseInsert, aus_methods: normalizeAusMethods(body.ausMethods) }
      : baseInsert;

  const { data: insertedLender, error: lenderInsertError } = await supabaseAdmin
    .from("lenders")
    .insert(insertPayload)
    .select("*")
    .single();

  if (lenderInsertError || !insertedLender) {
    return NextResponse.json(
      { error: lenderInsertError?.message || "Failed creating lender." },
      { status: 500 }
    );
  }

  // Bug fix bundled with Phase 7.1b — Repair create flow's eligibility schema.
  //
  // The lender_state_eligibility table was migrated to a wide format
  // (one row per state with boolean flags per occupancy type) but this
  // create route was never updated to match. The PATCH route in
  // app/api/admin/lenders/[id]/route.ts already uses the wide format;
  // we mirror it here so create matches edit.
  //
  // Schema: { lender_id, state_code, owner_occupied_allowed,
  // non_owner_occupied_allowed, second_home_allowed, heloc_allowed, notes }
  //
  // The create form only collects ownerOccupiedStates and
  // nonOwnerOccupiedStates. Second-home and HELOC default to false; admins
  // can enable those on the lender's detail page after creation.
  const allStates = Array.from(
    new Set([...ownerOccupiedStates, ...nonOwnerOccupiedStates])
  ).sort();

  const eligibilityRows = allStates.map((stateCode) => ({
    lender_id: insertedLender.id,
    state_code: stateCode,
    owner_occupied_allowed: ownerOccupiedStates.includes(stateCode),
    non_owner_occupied_allowed: nonOwnerOccupiedStates.includes(stateCode),
    second_home_allowed: false,
    heloc_allowed: false,
    notes: null as string | null,
  }));

  if (eligibilityRows.length > 0) {
    const { error: eligibilityInsertError } = await supabaseAdmin
      .from("lender_state_eligibility")
      .insert(eligibilityRows);

    if (eligibilityInsertError) {
      await supabaseAdmin.from("lenders").delete().eq("id", insertedLender.id);

      return NextResponse.json(
        {
          error:
            eligibilityInsertError.message ||
            "Failed saving lender state eligibility.",
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    lender: insertedLender,
  });
}
