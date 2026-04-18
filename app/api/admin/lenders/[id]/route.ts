import { NextResponse } from "next/server";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type JsonPayload = {
  name?: unknown;
  channels?: unknown;
  states?: unknown;
  ownerOccupiedStates?: unknown;
  nonOwnerOccupiedStates?: unknown;
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

async function ensureAdmin() {
  const signedIn = await isAdminSignedIn();

  if (!signedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
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

    const body = (await req.json()) as JsonPayload;

    const name = normalizeString(body.name);
    const channels = normalizeStringArray(body.channels);
    const legacyStates = normalizeStateArray(body.states);
    const ownerOccupiedStates = normalizeStateArray(body.ownerOccupiedStates);
    const nonOwnerOccupiedStates = normalizeStateArray(body.nonOwnerOccupiedStates);

    const mergedLegacyStates = Array.from(
      new Set([...legacyStates, ...ownerOccupiedStates, ...nonOwnerOccupiedStates])
    ).sort();

    const { error: lenderUpdateError } = await supabaseAdmin
      .from("lenders")
      .update({
        name,
        channel: channels,
        states: mergedLegacyStates,
      })
      .eq("id", id);

    if (lenderUpdateError) {
      return NextResponse.json(
        { error: lenderUpdateError.message },
        { status: 500 }
      );
    }

    const stateMap = new Map<
      string,
      {
        owner_occupied_allowed: boolean;
        non_owner_occupied_allowed: boolean;
      }
    >();

    for (const stateCode of ownerOccupiedStates) {
      const existing = stateMap.get(stateCode) || {
        owner_occupied_allowed: false,
        non_owner_occupied_allowed: false,
      };

      existing.owner_occupied_allowed = true;
      stateMap.set(stateCode, existing);
    }

    for (const stateCode of nonOwnerOccupiedStates) {
      const existing = stateMap.get(stateCode) || {
        owner_occupied_allowed: false,
        non_owner_occupied_allowed: false,
      };

      existing.non_owner_occupied_allowed = true;
      stateMap.set(stateCode, existing);
    }

    const upsertRows: EligibilityUpsertRow[] = Array.from(stateMap.entries()).map(
      ([state_code, flags]) => ({
        lender_id: id,
        state_code,
        owner_occupied_allowed: flags.owner_occupied_allowed,
        non_owner_occupied_allowed: flags.non_owner_occupied_allowed,
        second_home_allowed: false,
        heloc_allowed: false,
        notes: null,
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
