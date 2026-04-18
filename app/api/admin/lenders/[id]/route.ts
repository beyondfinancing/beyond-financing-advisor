import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type EligibilityType = "owner_occupied" | "non_owner_occupied";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function normalizeStates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function normalizeChannels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.map((item) => String(item || "").trim()).filter(Boolean)
    )
  );
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing lender id." },
        { status: 400 }
      );
    }

    const { data: lender, error: lenderError } = await supabaseAdmin
      .from("lenders")
      .select("*")
      .eq("id", id)
      .single();

    if (lenderError) {
      return NextResponse.json(
        { error: lenderError.message || "Failed to load lender." },
        { status: 500 }
      );
    }

    const { data: eligibilityRows, error: eligibilityError } = await supabaseAdmin
      .from("lender_state_eligibility")
      .select("state, eligibility_type")
      .eq("lender_id", id);

    if (eligibilityError) {
      return NextResponse.json(
        { error: eligibilityError.message || "Failed to load state eligibility." },
        { status: 500 }
      );
    }

    const ownerOccupiedStates = (eligibilityRows || [])
      .filter((row) => row.eligibility_type === "owner_occupied")
      .map((row) => row.state)
      .filter(Boolean)
      .sort();

    const nonOwnerOccupiedStates = (eligibilityRows || [])
      .filter((row) => row.eligibility_type === "non_owner_occupied")
      .map((row) => row.state)
      .filter(Boolean)
      .sort();

    return NextResponse.json({
      success: true,
      lender,
      ownerOccupiedStates,
      nonOwnerOccupiedStates,
    });
  } catch (error) {
    console.error("GET lender detail error:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing lender id." },
        { status: 400 }
      );
    }

    const body = await req.json();

    const name = String(body?.name || "").trim();
    const channels = normalizeChannels(body?.channels);
    const ownerOccupiedStates = normalizeStates(body?.ownerOccupiedStates);
    const nonOwnerOccupiedStates = normalizeStates(body?.nonOwnerOccupiedStates);

    if (!name) {
      return NextResponse.json(
        { error: "Lender name is required." },
        { status: 400 }
      );
    }

    const { error: lenderUpdateError } = await supabaseAdmin
      .from("lenders")
      .update({
        name,
        channel: channels,
      })
      .eq("id", id);

    if (lenderUpdateError) {
      return NextResponse.json(
        { error: lenderUpdateError.message || "Failed to update lender." },
        { status: 500 }
      );
    }

    const { error: deleteEligibilityError } = await supabaseAdmin
      .from("lender_state_eligibility")
      .delete()
      .eq("lender_id", id);

    if (deleteEligibilityError) {
      return NextResponse.json(
        {
          error:
            deleteEligibilityError.message ||
            "Failed to clear prior lender state eligibility.",
        },
        { status: 500 }
      );
    }

    const eligibilityRows: {
      lender_id: string;
      state: string;
      eligibility_type: EligibilityType;
    }[] = [
      ...ownerOccupiedStates.map((state) => ({
        lender_id: id,
        state,
        eligibility_type: "owner_occupied" as EligibilityType,
      })),
      ...nonOwnerOccupiedStates.map((state) => ({
        lender_id: id,
        state,
        eligibility_type: "non_owner_occupied" as EligibilityType,
      })),
    ];

    if (eligibilityRows.length > 0) {
      const { error: insertEligibilityError } = await supabaseAdmin
        .from("lender_state_eligibility")
        .insert(eligibilityRows);

      if (insertEligibilityError) {
        return NextResponse.json(
          {
            error:
              insertEligibilityError.message ||
              "Failed to save lender state eligibility.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Lender updated successfully.",
    });
  } catch (error) {
    console.error("POST lender detail error:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing lender id." },
        { status: 400 }
      );
    }

    const { error: deleteEligibilityError } = await supabaseAdmin
      .from("lender_state_eligibility")
      .delete()
      .eq("lender_id", id);

    if (deleteEligibilityError) {
      return NextResponse.json(
        {
          error:
            deleteEligibilityError.message ||
            "Failed deleting lender state eligibility.",
        },
        { status: 500 }
      );
    }

    const { error: deleteLenderError } = await supabaseAdmin
      .from("lenders")
      .delete()
      .eq("id", id);

    if (deleteLenderError) {
      return NextResponse.json(
        { error: deleteLenderError.message || "Failed deleting lender." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Lender deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE lender detail error:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
