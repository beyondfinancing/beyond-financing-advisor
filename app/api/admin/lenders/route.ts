import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type EligibilityType = "owner_occupied" | "non_owner_occupied";

type LenderInsertRow = {
  name: string;
  channel: string[] | null;
  states: string[] | null;
};

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
];

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => normalizeString(item).toUpperCase())
        .filter(Boolean)
    )
  );
}

function normalizeChannelArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => normalizeString(item))
        .filter(Boolean)
    )
  );
}

function keepValidStates(states: string[]): string[] {
  return states.filter((state) => US_STATES.includes(state));
}

function buildEligibilityRows(args: {
  lenderId: string;
  ownerOccupiedStates: string[];
  nonOwnerOccupiedStates: string[];
}) {
  const { lenderId, ownerOccupiedStates, nonOwnerOccupiedStates } = args;

  const ownerRows = ownerOccupiedStates.map((state_code) => ({
    lender_id: lenderId,
    state_code,
    eligibility_type: "owner_occupied" as EligibilityType,
    is_active: true,
  }));

  const nonOwnerRows = nonOwnerOccupiedStates.map((state_code) => ({
    lender_id: lenderId,
    state_code,
    eligibility_type: "non_owner_occupied" as EligibilityType,
    is_active: true,
  }));

  return [...ownerRows, ...nonOwnerRows];
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { success: false, error: "Expected application/json request body." },
        { status: 400 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;

    const lenderName = normalizeString(body.name);
    const channels = normalizeChannelArray(body.channels);
    const ownerOccupiedStates = keepValidStates(
      normalizeStringArray(body.ownerOccupiedStates)
    );
    const nonOwnerOccupiedStates = keepValidStates(
      normalizeStringArray(body.nonOwnerOccupiedStates)
    );

    const combinedStates = Array.from(
      new Set([...ownerOccupiedStates, ...nonOwnerOccupiedStates])
    );

    if (!lenderName) {
      return NextResponse.json(
        { success: false, error: "Lender name is required." },
        { status: 400 }
      );
    }

    const lenderPayload: LenderInsertRow = {
      name: lenderName,
      channel: channels.length > 0 ? channels : null,
      states: combinedStates.length > 0 ? combinedStates : null,
    };

    const { data: insertedLender, error: lenderError } = await supabaseAdmin
      .from("lenders")
      .insert(lenderPayload)
      .select("id, name, channel, states, created_at")
      .single();

    if (lenderError || !insertedLender) {
      return NextResponse.json(
        {
          success: false,
          error: lenderError?.message || "Failed to create lender.",
        },
        { status: 500 }
      );
    }

    const eligibilityRows = buildEligibilityRows({
      lenderId: insertedLender.id,
      ownerOccupiedStates,
      nonOwnerOccupiedStates,
    });

    if (eligibilityRows.length > 0) {
      const { error: eligibilityError } = await supabaseAdmin
        .from("lender_state_eligibility")
        .insert(eligibilityRows);

      if (eligibilityError) {
        await supabaseAdmin.from("lenders").delete().eq("id", insertedLender.id);

        return NextResponse.json(
          {
            success: false,
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
      lender: insertedLender,
      lender_state_eligibility: {
        owner_occupied_states: ownerOccupiedStates,
        non_owner_occupied_states: nonOwnerOccupiedStates,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected lender creation error.",
      },
      { status: 500 }
    );
  }
}
