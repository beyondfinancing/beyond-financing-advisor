import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminApi } from "@/lib/admin-auth";

type EligibilityType = "owner_occupied" | "non_owner_occupied";

function normalizeStringArray(values: FormDataEntryValue[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function normalizeChannels(values: FormDataEntryValue[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function mergeStatesForLegacyColumn(
  ownerOccupiedStates: string[],
  nonOwnerOccupiedStates: string[]
): string[] {
  return Array.from(new Set([...ownerOccupiedStates, ...nonOwnerOccupiedStates])).sort();
}

async function replaceStateEligibilityRows(args: {
  lenderId: string;
  ownerOccupiedStates: string[];
  nonOwnerOccupiedStates: string[];
}) {
  const { lenderId, ownerOccupiedStates, nonOwnerOccupiedStates } = args;

  const { error: deleteError } = await supabaseAdmin
    .from("lender_state_eligibility")
    .delete()
    .eq("lender_id", lenderId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const rows: Array<{
    lender_id: string;
    state_code: string;
    eligibility_type: EligibilityType;
    is_active: boolean;
  }> = [];

  ownerOccupiedStates.forEach((state) => {
    rows.push({
      lender_id: lenderId,
      state_code: state,
      eligibility_type: "owner_occupied",
      is_active: true,
    });
  });

  nonOwnerOccupiedStates.forEach((state) => {
    rows.push({
      lender_id: lenderId,
      state_code: state,
      eligibility_type: "non_owner_occupied",
      is_active: true,
    });
  });

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await supabaseAdmin
    .from("lender_state_eligibility")
    .insert(rows);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminApi(req);

    const contentType = req.headers.get("content-type") || "";

    let name = "";
    let channels: string[] = [];
    let ownerOccupiedStates: string[] = [];
    let nonOwnerOccupiedStates: string[] = [];

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();

      name = String(formData.get("name") || "").trim();
      channels = normalizeChannels(formData.getAll("channels"));
      ownerOccupiedStates = normalizeStringArray(formData.getAll("ownerOccupiedStates"));
      nonOwnerOccupiedStates = normalizeStringArray(formData.getAll("nonOwnerOccupiedStates"));
    } else {
      const body = (await req.json()) as {
        name?: string;
        channels?: string[];
        ownerOccupiedStates?: string[];
        nonOwnerOccupiedStates?: string[];
      };

      name = String(body.name || "").trim();
      channels = Array.isArray(body.channels)
        ? normalizeChannels(body.channels)
        : [];
      ownerOccupiedStates = Array.isArray(body.ownerOccupiedStates)
        ? normalizeStringArray(body.ownerOccupiedStates)
        : [];
      nonOwnerOccupiedStates = Array.isArray(body.nonOwnerOccupiedStates)
        ? normalizeStringArray(body.nonOwnerOccupiedStates)
        : [];
    }

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Lender name is required." },
        { status: 400 }
      );
    }

    if (channels.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one channel is required." },
        { status: 400 }
      );
    }

    const mergedStates = mergeStatesForLegacyColumn(
      ownerOccupiedStates,
      nonOwnerOccupiedStates
    );

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("lenders")
      .insert({
        name,
        channel: channels,
        states: mergedStates,
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    if (!inserted?.id) {
      return NextResponse.json(
        { success: false, error: "Lender was created but no ID was returned." },
        { status: 500 }
      );
    }

    await replaceStateEligibilityRows({
      lenderId: inserted.id,
      ownerOccupiedStates,
      nonOwnerOccupiedStates,
    });

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      return NextResponse.redirect(new URL("/admin/lenders", req.url), 303);
    }

    return NextResponse.json({
      success: true,
      lender_id: inserted.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected lender creation failure.";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
