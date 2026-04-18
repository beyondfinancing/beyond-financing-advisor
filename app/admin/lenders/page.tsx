import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import LendersClient from "./LendersClient";

type LenderRow = {
  id: string;
  name: string | null;
  channel: string[] | null;
  states: string[] | null;
  created_at: string | null;
};

type LenderStateEligibilityRow = {
  lender_id: string;
  state_code: string | null;
  owner_occupied_allowed: boolean | null;
  non_owner_occupied_allowed: boolean | null;
};

type LenderSummary = {
  id: string;
  name: string | null;
  channel: string[] | null;
  states: string[] | null;
  created_at: string | null;
  owner_occupied_states: string[];
  non_owner_occupied_states: string[];
};

function pageShellStyle(): CSSProperties {
  return {
    minHeight: "100vh",
    background: "#F1F3F8",
    color: "#263366",
    fontFamily: "Arial, Helvetica, sans-serif",
  };
}

function badgeStyle(): CSSProperties {
  return {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    background: "#E8EEF8",
    color: "#263366",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 10,
  };
}

function normalizeState(value: string | null): string {
  return String(value ?? "").trim().toUpperCase();
}

export default async function AdminLendersPage() {
  const signedIn = await isAdminSignedIn();

  if (!signedIn) {
    redirect("/admin/login");
  }

  const { data: lendersData, error: lendersError } = await supabaseAdmin
    .from("lenders")
    .select("id, name, channel, states, created_at")
    .order("created_at", { ascending: false });

  if (lendersError) {
    throw new Error(lendersError.message);
  }

  const lenderRows = ((lendersData ?? []) as LenderRow[]).filter((row) => row?.id);
  const lenderIds = lenderRows.map((row) => row.id);

  let stateEligibilityRows: LenderStateEligibilityRow[] = [];

  if (lenderIds.length > 0) {
    const { data: eligibilityData, error: eligibilityError } = await supabaseAdmin
      .from("lender_state_eligibility")
      .select(
        "lender_id, state_code, owner_occupied_allowed, non_owner_occupied_allowed"
      )
      .in("lender_id", lenderIds);

    if (eligibilityError) {
      throw new Error(eligibilityError.message);
    }

    stateEligibilityRows = (eligibilityData ?? []) as LenderStateEligibilityRow[];
  }

  const eligibilityMap = new Map<
    string,
    {
      owner_occupied_states: string[];
      non_owner_occupied_states: string[];
    }
  >();

  for (const row of stateEligibilityRows) {
    const lenderId = String(row.lender_id ?? "").trim();
    const stateCode = normalizeState(row.state_code);

    if (!lenderId || !stateCode) continue;

    const current = eligibilityMap.get(lenderId) || {
      owner_occupied_states: [],
      non_owner_occupied_states: [],
    };

    if (row.owner_occupied_allowed) {
      current.owner_occupied_states.push(stateCode);
    }

    if (row.non_owner_occupied_allowed) {
      current.non_owner_occupied_states.push(stateCode);
    }

    eligibilityMap.set(lenderId, current);
  }

  const initialLenders: LenderSummary[] = lenderRows.map((row) => {
    const eligibility = eligibilityMap.get(row.id);

    return {
      id: row.id,
      name: row.name,
      channel: Array.isArray(row.channel) ? row.channel : [],
      states: Array.isArray(row.states) ? row.states : [],
      created_at: row.created_at,
      owner_occupied_states: Array.from(
        new Set((eligibility?.owner_occupied_states ?? []).filter(Boolean))
      ).sort(),
      non_owner_occupied_states: Array.from(
        new Set((eligibility?.non_owner_occupied_states ?? []).filter(Boolean))
      ).sort(),
    };
  });

  return (
    <main style={pageShellStyle()}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 32 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div style={{ flex: "1 1 520px", minWidth: 0 }}>
            <div style={badgeStyle()}>LENDER MANAGEMENT</div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(40px, 6vw, 64px)",
                lineHeight: 1.05,
              }}
            >
              Manage Lenders
            </h1>

            <p
              style={{
                marginTop: 16,
                color: "#5A6A84",
                fontSize: 18,
                lineHeight: 1.6,
                maxWidth: 980,
              }}
            >
              Create lenders here. Click any lender to open its dedicated detail
              page for editing, deletion, and state-footprint management.
            </p>
          </div>

          <div style={{ paddingTop: 8 }}>
            <Link
              href="/admin"
              style={{
                color: "#263366",
                fontWeight: 700,
                textDecoration: "none",
                fontSize: 16,
              }}
            >
              Back to Admin Home
            </Link>
          </div>
        </div>

        <LendersClient initialLenders={initialLenders} />
      </div>
    </main>
  );
}
