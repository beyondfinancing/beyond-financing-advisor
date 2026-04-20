import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import LendersClient from "./LendersClient";

type LenderRow = {
  id: string;
  name: string | null;
  channel: unknown;
  states: unknown;
  created_at: string | null;
};

type LenderStateEligibilityRow = {
  lender_id: string | null;
  state_code: string | null;
  owner_occupied_allowed: boolean | null;
  non_owner_occupied_allowed: boolean | null;
};

type LenderSummary = {
  id: string;
  name: string | null;
  channel: string[];
  states: string[];
  created_at: string | null;
  owner_occupied_states: string[];
  non_owner_occupied_states: string[];
};

function pageShellStyle(): CSSProperties {
  return {
    minHeight: "100vh",
    background: "#F3F6FB",
    color: "#263366",
    fontFamily: "Arial, Helvetica, sans-serif",
  };
}

function cardStyle(): CSSProperties {
  return {
    background: "#FFFFFF",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 10px 28px rgba(38,51,102,0.06)",
  };
}

function badgeStyle(): CSSProperties {
  return {
    display: "inline-block",
    padding: "8px 14px",
    borderRadius: 999,
    background: "#E8EEF8",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.4,
    marginBottom: 14,
  };
}

function normalizeState(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
      )
    );
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return Array.from(
          new Set(
            parsed
              .map((item) => String(item ?? "").trim())
              .filter(Boolean)
          )
        );
      }
    } catch {
      return Array.from(
        new Set(
          trimmed
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        )
      );
    }
  }

  return [];
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
      channel: normalizeStringArray(row.channel),
      states: normalizeStringArray(row.states).map((state) => state.toUpperCase()),
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
            flexWrap: "wrap",
            alignItems: "flex-start",
            marginBottom: 28,
          }}
        >
          <div>
            <div style={badgeStyle()}>LENDER MANAGEMENT</div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(40px, 8vw, 64px)",
                lineHeight: 1.03,
              }}
            >
              Manage Lenders
            </h1>

            <p
              style={{
                margin: "16px 0 0",
                maxWidth: 920,
                fontSize: 18,
                lineHeight: 1.65,
                color: "#52627A",
              }}
            >
              Create lenders here. Click any lender to open its dedicated detail
              page for editing, deletion, and state-footprint management.
            </p>
          </div>

          <Link
            href="/admin"
            style={{
              textDecoration: "none",
              background: "#263366",
              color: "#FFFFFF",
              borderRadius: 14,
              padding: "16px 22px",
              fontWeight: 800,
            }}
          >
            Back to Admin Home
          </Link>
        </div>

        <div style={cardStyle()}>
          <LendersClient initialLenders={initialLenders} />
        </div>
      </div>
    </main>
  );
}
