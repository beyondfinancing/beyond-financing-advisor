import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { signInAdminSession } from "@/lib/admin-auth";

type EligibilityType = "owner_occupied" | "non_owner_occupied";

type CreateLenderBody = {
  name?: string;
  channel?: string[];
  states?: string[];
  ownerOccupiedStates?: string[];
  nonOwnerOccupiedStates?: string[];
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function normalizeChannelArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    )
  );
}

function mergeStatesForLegacyColumn(
  ownerOccupiedStates: string[],
  nonOwnerOccupiedStates: string[],
  fallbackStates: string[]
): string[] {
  const merged = Array.from(
    new Set([
      ...ownerOccupiedStates,
      ...nonOwnerOccupiedStates,
      ...fallbackStates,
    ])
  );

  return merged.sort();
}

async function requireAdminApi() {
  const ok = await signInAdminSession();
  return ok;
}

export async function POST(req: Request) {
  const isAdmin = await requireAdminApi();

  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as CreateLenderBody;

    const name = String(body.name ?? "").trim();
    const channel = normalizeChannelArray(body.channel);
    const fallbackStates = normalizeStringArray(body.states);
    const ownerOccupiedStates = normalizeStringArray(body.ownerOccupiedStates);
    const nonOwnerOccupiedStates = normalizeStringArray(body.nonOwnerOccupiedStates);

    if (!name) {
      return NextResponse.json(
        { error: "Lender name is required." },
        { status: 400 }
      );
    }

    if (channel.length === 0) {
      return NextResponse.json(
        { error: "Select at least one channel." },
        { status: 400 }
      );
    }

    const mergedStates = mergeStatesForLegacyColumn(
      ownerOccupiedStates,
      nonOwnerOccupiedStates,
      fallbackStates
    );

    const { data: lender, error: lenderError } = await supabaseAdmin
      .from("lenders")
      .insert({
        name,
        channel,
        states: mergedStates,
      })
      .select("id, name, channel, states, created_at")
      .single();

    if (lenderError || !lender) {
      return NextResponse.json(
        { error: lenderError?.message || "Failed to create lender." },
        { status: 500 }
      );
    }

    const stateEligibilityRows: {
      lender_id: string;
      state_code: string;
      eligibility_type: EligibilityType;
    }[] = [
      ...ownerOccupiedStates.map((state_code) => ({
        lender_id: lender.id,
        state_code,
        eligibility_type: "owner_occupied" as const,
      })),
      ...nonOwnerOccupiedStates.map((state_code) => ({
        lender_id: lender.id,
        state_code,
        eligibility_type: "non_owner_occupied" as const,
      })),
    ];

    if (stateEligibilityRows.length > 0) {
      const { error: eligibilityError } = await supabaseAdmin
        .from("lender_state_eligibility")
        .insert(stateEligibilityRows);

      if (eligibilityError) {
        await supabaseAdmin.from("lenders").delete().eq("id", lender.id);

        return NextResponse.json(
          {
            error:
              eligibilityError.message ||
              "Failed to save lender state eligibility.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      lender: {
        ...lender,
        owner_occupied_states: ownerOccupiedStates,
        non_owner_occupied_states: nonOwnerOccupiedStates,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
