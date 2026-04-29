import { NextResponse } from "next/server";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ProductAssignmentInput = {
  productId?: unknown;
  productName?: unknown;
  categories?: unknown;
};

type CustomProductTypeInput = {
  id?: unknown;
  name?: unknown;
  category?: unknown;
};

type JsonPayload = {
  name?: unknown;
  channels?: unknown;
  states?: unknown;
  ownerOccupiedStates?: unknown;
  nonOwnerOccupiedStates?: unknown;
  secondHomeStates?: unknown;
  helocStates?: unknown;
  notes?: unknown;
  productAssignments?: unknown;
  customProductTypes?: unknown;
  doesConventional?: unknown;
  doesFha?: unknown;
  doesVa?: unknown;
  doesUsda?: unknown;
  ausMethods?: unknown;
};

type EligibilityExistingRow = {
  lender_id: string;
  state_code: string;
  owner_occupied_allowed: boolean | null;
  non_owner_occupied_allowed: boolean | null;
  second_home_allowed: boolean | null;
  heloc_allowed: boolean | null;
  notes: string | null;
};

type EligibilityUpsertRow = {
  lender_id: string;
  state_code: string;
  owner_occupied_allowed: boolean;
  non_owner_occupied_allowed: boolean;
  second_home_allowed: boolean;
  heloc_allowed: boolean;
  notes: string | null;
};

type ProductAssignmentNormalized = {
  productId: string;
  productName: string;
  categories: string[];
};

type CustomProductTypeNormalized = {
  id: string;
  name: string;
  category: string | null;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "yes" || v === "1" || v === "on";
  }
  if (typeof value === "number") return value !== 0;
  return false;
}

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
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim().toUpperCase())
        .filter(Boolean)
    )
  ).sort();
}

const ALLOWED_AUS_METHODS = new Set(["du", "lpa", "manual"]);

// Phase 7.1a — AUS Methods Filtering.
//
// Accepts a payload like ["du","lpa","manual"] (case-insensitive) and returns
// a deduped, lowercased subset filtered to the allowed values. Invalid values
// are dropped silently. Empty array is returned as-is (specialty edge case
// for lenders that accept no AUS — rare but valid). The DB column has a
// default of ['du','lpa'] which only kicks in on INSERT when the field is
// omitted; this helper always returns an explicit array for UPDATE writes.
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

function normalizeProductAssignments(value: unknown): ProductAssignmentNormalized[] {
  if (!Array.isArray(value)) return [];

  const dedupeMap = new Map<string, ProductAssignmentNormalized>();

  for (const item of value) {
    const row = (item ?? {}) as ProductAssignmentInput;

    const productId = normalizeString(row.productId);
    const productName = normalizeString(row.productName);
    const categories = normalizeStringArray(row.categories);

    if (!productId || !productName) continue;

    dedupeMap.set(productId.toLowerCase(), {
      productId,
      productName,
      categories,
    });
  }

  return Array.from(dedupeMap.values());
}

function normalizeCustomProductTypes(value: unknown): CustomProductTypeNormalized[] {
  if (!Array.isArray(value)) return [];

  const dedupeMap = new Map<string, CustomProductTypeNormalized>();

  for (const item of value) {
    const row = (item ?? {}) as CustomProductTypeInput;

    const id = normalizeString(row.id);
    const name = normalizeString(row.name);
    const category = normalizeNullableString(row.category);

    if (!id || !name) continue;

    dedupeMap.set(id.toLowerCase(), {
      id,
      name,
      category,
    });
  }

  return Array.from(dedupeMap.values());
}

async function ensureAdmin() {
  const signedIn = await isAdminSignedIn();

  if (!signedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

async function saveLenderDetail(req: Request, context: RouteContext) {
  const authError = await ensureAdmin();
  if (authError) return authError;

  const { id } = await context.params;
  const contentType = req.headers.get("content-type") || "";

  try {
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      return NextResponse.json(
        { error: "Unsupported form request." },
        { status: 400 }
      );
    }

    const body = (await req.json()) as JsonPayload;

    const name = normalizeString(body.name);
    const channels = normalizeStringArray(body.channels);
    const legacyStates = normalizeStateArray(body.states);
    const ownerOccupiedStates = normalizeStateArray(body.ownerOccupiedStates);
    const nonOwnerOccupiedStates = normalizeStateArray(body.nonOwnerOccupiedStates);
    const secondHomeStates = normalizeStateArray(body.secondHomeStates);
    const helocStates = normalizeStateArray(body.helocStates);
    const notes = normalizeNullableString(body.notes);
    const productAssignments = normalizeProductAssignments(body.productAssignments);
    const customProductTypes = normalizeCustomProductTypes(body.customProductTypes);

    const doesConventional = normalizeBoolean(body.doesConventional);
    const doesFha = normalizeBoolean(body.doesFha);
    const doesVa = normalizeBoolean(body.doesVa);
    const doesUsda = normalizeBoolean(body.doesUsda);

    const ausMethods = normalizeAusMethods(body.ausMethods);

    if (!name) {
      return NextResponse.json(
        { error: "Lender name is required." },
        { status: 400 }
      );
    }

    const mergedLegacyStates = Array.from(
      new Set([
        ...legacyStates,
        ...ownerOccupiedStates,
        ...nonOwnerOccupiedStates,
        ...secondHomeStates,
        ...helocStates,
      ])
    ).sort();

    const { error: lenderUpdateError } = await supabaseAdmin
      .from("lenders")
      .update({
        name,
        channel: channels,
        states: mergedLegacyStates,
        notes,
        product_assignments: productAssignments,
        custom_product_types: customProductTypes,
        does_conventional: doesConventional,
        does_fha: doesFha,
        does_va: doesVa,
        does_usda: doesUsda,
        aus_methods: ausMethods,
      })
      .eq("id", id);

    if (lenderUpdateError) {
      return NextResponse.json(
        { error: lenderUpdateError.message },
        { status: 500 }
      );
    }

    const { data: existingEligibility, error: existingEligibilityError } =
      await supabaseAdmin
        .from("lender_state_eligibility")
        .select(
          "lender_id, state_code, owner_occupied_allowed, non_owner_occupied_allowed, second_home_allowed, heloc_allowed, notes"
        )
        .eq("lender_id", id);

    if (existingEligibilityError) {
      return NextResponse.json(
        { error: existingEligibilityError.message },
        { status: 500 }
      );
    }

    const existingMap = new Map<string, EligibilityExistingRow>();

    for (const row of (existingEligibility ?? []) as EligibilityExistingRow[]) {
      existingMap.set(normalizeString(row.state_code).toUpperCase(), row);
    }

    type StateEligibilityFlags = {
      owner_occupied_allowed: boolean;
      non_owner_occupied_allowed: boolean;
      second_home_allowed: boolean;
      heloc_allowed: boolean;
      notes: string | null;
    };

    const stateMap = new Map<string, StateEligibilityFlags>();

    const allStates = Array.from(
      new Set([
        ...ownerOccupiedStates,
        ...nonOwnerOccupiedStates,
        ...secondHomeStates,
        ...helocStates,
      ])
    ).sort();

    for (const stateCode of allStates) {
      const existing = existingMap.get(stateCode);

      stateMap.set(stateCode, {
        owner_occupied_allowed: ownerOccupiedStates.includes(stateCode),
        non_owner_occupied_allowed: nonOwnerOccupiedStates.includes(stateCode),
        second_home_allowed: secondHomeStates.includes(stateCode),
        heloc_allowed: helocStates.includes(stateCode),
        notes: existing?.notes ?? null,
      });
    }

    const upsertRows: EligibilityUpsertRow[] = Array.from(stateMap.entries()).map(
      ([state_code, flags]) => ({
        lender_id: id,
        state_code,
        owner_occupied_allowed: flags.owner_occupied_allowed,
        non_owner_occupied_allowed: flags.non_owner_occupied_allowed,
        second_home_allowed: flags.second_home_allowed,
        heloc_allowed: flags.heloc_allowed,
        notes: flags.notes,
      })
    );

    const { error: deleteEligibilityError } = await supabaseAdmin
      .from("lender_state_eligibility")
      .delete()
      .eq("lender_id", id);

    if (deleteEligibilityError) {
      return NextResponse.json(
        { error: deleteEligibilityError.message },
        { status: 500 }
      );
    }

    if (upsertRows.length > 0) {
      const { error: insertEligibilityError } = await supabaseAdmin
        .from("lender_state_eligibility")
        .insert(upsertRows);

      if (insertEligibilityError) {
        return NextResponse.json(
          { error: insertEligibilityError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      lenderId: id,
      saved: {
        name,
        channels,
        states: mergedLegacyStates,
        ownerOccupiedStates,
        nonOwnerOccupiedStates,
        secondHomeStates,
        helocStates,
        notes,
        productAssignments,
        customProductTypes,
        doesConventional,
        doesFha,
        doesVa,
        doesUsda,
        ausMethods,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected lender detail route error.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, context: RouteContext) {
  const authError = await ensureAdmin();
  if (authError) return authError;

  const { id } = await context.params;
  const contentType = req.headers.get("content-type") || "";

  try {
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.formData();
      const methodOverride = normalizeString(formData.get("_method")).toUpperCase();

      if (methodOverride === "DELETE") {
        const { error: deleteEligibilityError } = await supabaseAdmin
          .from("lender_state_eligibility")
          .delete()
          .eq("lender_id", id);

        if (deleteEligibilityError) {
          return NextResponse.json(
            { error: deleteEligibilityError.message },
            { status: 500 }
          );
        }

        const { error: deleteLenderError } = await supabaseAdmin
          .from("lenders")
          .delete()
          .eq("id", id);

        if (deleteLenderError) {
          return NextResponse.json(
            { error: deleteLenderError.message },
            { status: 500 }
          );
        }

        return NextResponse.redirect(new URL("/admin/lenders", req.url), 303);
      }

      return NextResponse.json(
        { error: "Unsupported form request." },
        { status: 400 }
      );
    }

    return saveLenderDetail(req, context);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected lender detail route error.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, context: RouteContext) {
  return saveLenderDetail(req, context);
}

export async function PATCH(req: Request, context: RouteContext) {
  return saveLenderDetail(req, context);
}

export async function DELETE(_req: Request, context: RouteContext) {
  const authError = await ensureAdmin();
  if (authError) return authError;

  const { id } = await context.params;

  try {
    const { error: deleteEligibilityError } = await supabaseAdmin
      .from("lender_state_eligibility")
      .delete()
      .eq("lender_id", id);

    if (deleteEligibilityError) {
      return NextResponse.json(
        { error: deleteEligibilityError.message },
        { status: 500 }
      );
    }

    const { error: deleteLenderError } = await supabaseAdmin
      .from("lenders")
      .delete()
      .eq("id", id);

    if (deleteLenderError) {
      return NextResponse.json(
        { error: deleteLenderError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected lender delete route error.",
      },
      { status: 500 }
    );
  }
}
