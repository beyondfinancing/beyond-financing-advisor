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

type EligibilityInsertRow = {
  lender_id: string;
  state_code: string;
  occupancy_type: "owner_occupied" | "non_owner_occupied";
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

    // IMPORTANT:
    // Current database structure allows only ONE row per lender_id + state_code.
    // So if a state appears in both ownerOccupiedStates and nonOwnerOccupiedStates,
    // we must save only one row for that state.
    //
    // Priority rule for now:
    // - If a state is selected in ownerOccupiedStates, save it as owner_occupied
    // - Otherwise, if it is selected in nonOwnerOccupiedStates, save it as non_owner_occupied
    //
    // This avoids duplicate-key errors on:
    // lender_state_eligibility_lender_id_state_code_key

    const mergedStates = Array.from(
      new Set([...ownerOccupiedStates, ...nonOwnerOccupiedStates])
    ).sort();

    const rows: EligibilityInsertRow[] = mergedStates.map((stateCode) => {
      const isOwnerOccupied = ownerOccupiedStates.includes(stateCode);

      return {
        lender_id: id,
        state_code: stateCode,
        occupancy_type: isOwnerOccupied
          ? "owner_occupied"
          : "non_owner_occupied",
      };
    });

    if (rows.length > 0) {
      const { error: insertEligibilityError } = await supabaseAdmin
        .from("lender_state_eligibility")
        .insert(rows);

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
      note:
        "Because the current lender_state_eligibility table allows only one row per lender and state, states selected in both lists are currently saved as owner_occupied.",
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
