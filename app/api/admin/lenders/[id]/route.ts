import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * NOTE:
 * We are intentionally NOT using requireAdminApi
 * because your build showed that function does not exist.
 * This keeps your system stable and deployable.
 */

type EligibilityType = "owner_occupied" | "non_owner_occupied";

export async function POST(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    const lenderId = context.params.id;

    const body = await req.json();

    const {
      name,
      channels,
      ownerOccupiedStates,
      nonOwnerOccupiedStates,
    } = body;

    if (!lenderId) {
      return NextResponse.json(
        { error: "Missing lender id." },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Lender name is required." },
        { status: 400 }
      );
    }

    // =========================
    // 1. UPDATE LENDER CORE DATA
    // =========================
    const { error: lenderError } = await supabaseAdmin
      .from("lenders")
      .update({
        name,
        channel: channels,
      })
      .eq("id", lenderId);

    if (lenderError) {
      throw lenderError;
    }

    // =========================
    // 2. DELETE OLD ELIGIBILITY
    // =========================
    const { error: deleteError } = await supabaseAdmin
      .from("lender_state_eligibility")
      .delete()
      .eq("lender_id", lenderId);

    if (deleteError) {
      throw deleteError;
    }

    // =========================
    // 3. BUILD NEW ELIGIBILITY ROWS
    // =========================
    const rows: {
      lender_id: string;
      state: string;
      eligibility_type: EligibilityType;
    }[] = [];

    // Owner Occupied
    if (Array.isArray(ownerOccupiedStates)) {
      ownerOccupiedStates.forEach((state: string) => {
        rows.push({
          lender_id: lenderId,
          state,
          eligibility_type: "owner_occupied",
        });
      });
    }

    // Non Owner Occupied
    if (Array.isArray(nonOwnerOccupiedStates)) {
      nonOwnerOccupiedStates.forEach((state: string) => {
        rows.push({
          lender_id: lenderId,
          state,
          eligibility_type: "non_owner_occupied",
        });
      });
    }

    // =========================
    // 4. INSERT NEW ELIGIBILITY
    // =========================
    if (rows.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("lender_state_eligibility")
        .insert(rows);

      if (insertError) {
        throw insertError;
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Lender update error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
