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
  notes?: unknown;
  productAssignments?: unknown;
  customProductTypes?: unknown;
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

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
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

function normalizeProductAssignments(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Map(
      value
        .map((item) => {
          const row = (item ?? {}) as ProductAssignmentInput;

          const productId = normalizeString(row.productId);
          const productName = normalizeString(row.productName);
          const categories = normalizeStringArray(row.categories);

          if (!productId || !productName) return null;

          return [
            productId.toLowerCase(),
            {
              productId,
              productName,
              categories,
            },
          ] as const;
        })
        .filter(Boolean) as Array<
        readonly [
          string,
          {
            productId: string;
            productName: string;
            categories: string[];
          }
        ]
      >
    ).values()
  );
}

function normalizeCustomProductTypes(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Map(
      value
        .map((item) => {
          const row = (item ?? {}) as CustomProductTypeInput;

          const id = normalizeString(row.id);
          const name = normalizeString(row.name);
          const category = normalizeNullableString(row.category);

          if (!id || !name) return null;

          return [
            id.toLowerCase(),
            {
              id,
              name,
              category,
            },
          ] as const;
        })
        .filter(Boolean) as Array<
        readonly [
          string,
          {
            id: string;
            name: string;
            category: string | null;
          }
        ]
      >
    ).values()
  );
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
    const notes = normalizeNullableString(body.notes);
    const productAssignments = normalizeProductAssignments(body.productAssignments);
    const customProductTypes = normalizeCustomProductTypes(body.customProductTypes);

    if (!name) {
      return NextResponse.json(
        { error: "Lender name is required." },
        { status: 400 }
      );
    }

    const mergedLegacyStates = Array.from(
      new Set([...legacyStates, ...ownerOccupiedStates, ...nonOwnerOccupiedStates])
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

    const stateMap = new Map<
      string,
      {
        owner_occupied_allowed: boolean;
        non_owner_occupied_allowed: boolean;
        second_home_allowed: boolean;
        heloc_allowed: boolean;
        notes: string | null;
      }
    >();

    const allStates = Array.from(
      new Set([...ownerOccupiedStates, ...nonOwnerOccupiedStates])
    ).sort();

    for (const stateCode of allStates) {
      const existing = existingMap.get(stateCode);

      stateMap.set(stateCode, {
        owner_occupied_allowed: ownerOccupiedStates.includes(stateCode),
        non_owner_occupied_allowed: nonOwnerOccupiedStates.includes(stateCode),
        second_home_allowed: existing?.second_home_allowed ?? false,
        heloc_allowed: existing?.heloc_allowed ?? false,
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
        notes,
        productAssignments,
        customProductTypes,
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
