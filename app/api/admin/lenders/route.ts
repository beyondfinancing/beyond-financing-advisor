import { NextResponse } from "next/server";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

type CreateLenderBody = {
  name?: string;
  channels?: string[];
  ownerOccupiedStates?: string[];
  nonOwnerOccupiedStates?: string[];
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

function normalizeName(value: unknown): string {
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
  return Array.from(
    new Set(
      normalizeStringArray(value)
        .map((state) => state.toUpperCase())
        .filter((state) => US_STATES.includes(state))
    )
  );
}

export async function GET() {
  const signedIn = await isAdminSignedIn();

  if (!signedIn) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("lenders")
    .select(`
      id,
      name,
      channel,
      states,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    lenders: data ?? [],
  });
}

export async function POST(req: Request) {
  const signedIn = await isAdminSignedIn();

  if (!signedIn) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as CreateLenderBody;

    const name = normalizeName(body.name);
    const channels = normalizeStringArray(body.channels);
    const ownerOccupiedStates = normalizeStateArray(body.ownerOccupiedStates);
    const nonOwnerOccupiedStates = normalizeStateArray(body.nonOwnerOccupiedStates);

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Lender name is required." },
        { status: 400 }
      );
    }

    if (channels.length === 0) {
      return NextResponse.json(
        { success: false, error: "Select at least one channel." },
        { status: 400 }
      );
    }

    if (ownerOccupiedStates.length === 0 && nonOwnerOccupiedStates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Select at least one owner-occupied or non-owner-occupied state.",
        },
        { status: 400 }
      );
    }

    const combinedStates = Array.from(
      new Set([...ownerOccupiedStates, ...nonOwnerOccupiedStates])
    );

    const { data: lender, error: lenderError } = await supabaseAdmin
      .from("lenders")
      .insert({
        name,
        channel: channels,
        states: combinedStates,
      })
      .select("id, name, channel, states, created_at")
      .single();

    if (lenderError || !lender) {
      return NextResponse.json(
        { success: false, error: lenderError?.message || "Failed to create lender." },
        { status: 500 }
      );
    }

    const eligibilityRows = [
      ...ownerOccupiedStates.map((state_code) => ({
        lender_id: lender.id,
        state_code,
        occupancy_type: "owner_occupied",
        is_active: true,
        notes: null as string | null,
      })),
      ...nonOwnerOccupiedStates.map((state_code) => ({
        lender_id: lender.id,
        state_code,
        occupancy_type: "non_owner_occupied",
        is_active: true,
        notes: null as string | null,
      })),
    ];

    if (eligibilityRows.length > 0) {
      const { error: eligibilityError } = await supabaseAdmin
        .from("lender_state_eligibility")
        .insert(eligibilityRows);

      if (eligibilityError) {
        await supabaseAdmin.from("lenders").delete().eq("id", lender.id);

        return NextResponse.json(
          {
            success: false,
            error: `Lender was not saved because state eligibility insert failed: ${eligibilityError.message}`,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      lender,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
