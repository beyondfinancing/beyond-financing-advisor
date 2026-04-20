import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import LenderDetailClient from "./LenderDetailClient";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type LenderRow = {
  id: string;
  name: string | null;
  channel: unknown;
  states: unknown;
  created_at: string | null;
  notes: string | null;
  product_assignments: unknown;
  custom_product_types: unknown;
};

type LenderStateEligibilityRow = {
  lender_id: string | null;
  state_code: string | null;
  owner_occupied_allowed: boolean | null;
  non_owner_occupied_allowed: boolean | null;
  second_home_allowed: boolean | null;
  heloc_allowed: boolean | null;
  notes: string | null;
};

type ProductAssignmentInput = {
  productId: string;
  productName: string;
  categories: string[];
};

type CustomProductTypeInput = {
  id: string;
  name: string;
  category: string | null;
};

function cardStyle(): CSSProperties {
  return {
    background: "#FFFFFF",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 10px 28px rgba(38,51,102,0.06)",
  };
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
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

function normalizeProductAssignments(value: unknown): ProductAssignmentInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;

      return {
        productId: String(row.productId ?? row.product_id ?? "").trim(),
        productName: String(row.productName ?? row.product_name ?? "").trim(),
        categories: normalizeStringArray(row.categories),
      };
    })
    .filter((item) => item.productId && item.productName);
}

function normalizeCustomProductTypes(value: unknown): CustomProductTypeInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const rawCategory = row.category;

      return {
        id: String(row.id ?? "").trim(),
        name: String(row.name ?? "").trim(),
        category:
          rawCategory === null || rawCategory === undefined
            ? null
            : String(rawCategory).trim() || null,
      };
    })
    .filter((item) => item.id && item.name);
}

export default async function LenderDetailPage({ params }: PageProps) {
  const signedIn = await isAdminSignedIn();

  if (!signedIn) {
    redirect("/admin/login");
  }

  const { id } = await params;

  const [
    { data: lender, error: lenderError },
    { data: stateEligibility, error: stateEligibilityError },
  ] = await Promise.all([
    supabaseAdmin
      .from("lenders")
      .select(
        "id, name, channel, states, created_at, notes, product_assignments, custom_product_types"
      )
      .eq("id", id)
      .maybeSingle(),
    supabaseAdmin
      .from("lender_state_eligibility")
      .select(
        "lender_id, state_code, owner_occupied_allowed, non_owner_occupied_allowed, second_home_allowed, heloc_allowed, notes"
      )
      .eq("lender_id", id),
  ]);

  if (lenderError) {
    throw new Error(`Failed to load lender: ${lenderError.message}`);
  }

  if (!lender) {
    notFound();
  }

  if (stateEligibilityError) {
    throw new Error(
      `Failed to load lender state eligibility: ${stateEligibilityError.message}`
    );
  }

  const lenderRow = lender as LenderRow;
  const eligibilityRows = (stateEligibility ?? []) as LenderStateEligibilityRow[];

  const ownerOccupiedStates = Array.from(
    new Set(
      eligibilityRows
        .filter((row) => Boolean(row.owner_occupied_allowed))
        .map((row) => normalizeState(row.state_code))
        .filter(Boolean)
    )
  ).sort();

  const nonOwnerOccupiedStates = Array.from(
    new Set(
      eligibilityRows
        .filter((row) => Boolean(row.non_owner_occupied_allowed))
        .map((row) => normalizeState(row.state_code))
        .filter(Boolean)
    )
  ).sort();

  const secondHomeStates = Array.from(
    new Set(
      eligibilityRows
        .filter((row) => Boolean(row.second_home_allowed))
        .map((row) => normalizeState(row.state_code))
        .filter(Boolean)
    )
  ).sort();

  const helocStates = Array.from(
    new Set(
      eligibilityRows
        .filter((row) => Boolean(row.heloc_allowed))
        .map((row) => normalizeState(row.state_code))
        .filter(Boolean)
    )
  ).sort();

  const channels = normalizeStringArray(lenderRow.channel);
  const legacyStates = normalizeStringArray(lenderRow.states).map((state) =>
    state.toUpperCase()
  );
  const notes = String(lenderRow.notes ?? "").trim();
  const productAssignments = normalizeProductAssignments(
    lenderRow.product_assignments
  );
  const customProductTypes = normalizeCustomProductTypes(
    lenderRow.custom_product_types
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F3F6FB",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
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
            <div
              style={{
                display: "inline-block",
                padding: "8px 14px",
                borderRadius: 999,
                background: "#E8EEF8",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 0.4,
                marginBottom: 14,
              }}
            >
              LENDER DETAIL
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(40px, 8vw, 64px)",
                lineHeight: 1.03,
              }}
            >
              {lenderRow.name || "Lender"}
            </h1>

            <p
              style={{
                margin: "16px 0 0",
                maxWidth: 900,
                fontSize: 18,
                lineHeight: 1.65,
                color: "#52627A",
              }}
            >
              Edit lender identity, channels, owner-occupied footprint, and
              non-owner-occupied footprint from one place.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/admin/files"
              style={{
                textDecoration: "none",
                background: "#0096C7",
                color: "#FFFFFF",
                borderRadius: 14,
                padding: "16px 22px",
                fontWeight: 800,
              }}
            >
              Manage Files
            </Link>

            <Link
              href="/admin/lenders"
              style={{
                textDecoration: "none",
                background: "#263366",
                color: "#FFFFFF",
                borderRadius: 14,
                padding: "16px 22px",
                fontWeight: 800,
              }}
            >
              Back to Lenders
            </Link>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 440px) minmax(320px, 1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 20 }}>
            <div style={cardStyle()}>
              <LenderDetailClient
                lenderId={lenderRow.id}
                initialName={lenderRow.name || ""}
                initialChannels={channels}
                initialLegacyStates={legacyStates}
                initialOwnerOccupiedStates={ownerOccupiedStates}
                initialNonOwnerOccupiedStates={nonOwnerOccupiedStates}
                initialNotes={notes}
                initialProductAssignments={productAssignments}
                initialCustomProductTypes={customProductTypes}
              />
            </div>

            <div style={cardStyle()}>
              <h2
                style={{
                  margin: "0 0 18px",
                  fontSize: 18,
                }}
              >
                Delete Lender
              </h2>

              <div
                style={{
                  border: "1px solid #F2B8AE",
                  background: "#FFF5F3",
                  color: "#A33A2B",
                  borderRadius: 16,
                  padding: 18,
                  lineHeight: 1.65,
                  marginBottom: 18,
                }}
              >
                Deleting this lender removes the lender record. If the lender is
                tied to programs, delete carefully.
              </div>

              <form action={`/api/admin/lenders/${lenderRow.id}`} method="post">
                <input type="hidden" name="_method" value="DELETE" />
                <button
                  type="submit"
                  style={{
                    background: "#D92D20",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: 14,
                    padding: "14px 20px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Delete Lender
                </button>
              </form>
            </div>

            <div style={cardStyle()}>
              <h2
                style={{
                  margin: "0 0 14px",
                  fontSize: 18,
                }}
              >
                Lender Snapshot
              </h2>

              <div style={{ lineHeight: 1.9, color: "#4C5C76" }}>
                <div>
                  <strong>Name:</strong> {lenderRow.name || "—"}
                </div>
                <div>
                  <strong>Channels:</strong>{" "}
                  {channels.length > 0 ? channels.join(", ") : "Not set"}
                </div>
                <div>
                  <strong>Owner-Occupied States:</strong>{" "}
                  {ownerOccupiedStates.length > 0
                    ? ownerOccupiedStates.join(", ")
                    : "—"}
                </div>
                <div>
                  <strong>Non-Owner-Occupied States:</strong>{" "}
                  {nonOwnerOccupiedStates.length > 0
                    ? nonOwnerOccupiedStates.join(", ")
                    : "—"}
                </div>
                <div>
                  <strong>Second-Home States:</strong>{" "}
                  {secondHomeStates.length > 0 ? secondHomeStates.join(", ") : "—"}
                </div>
                <div>
                  <strong>HELOC States:</strong>{" "}
                  {helocStates.length > 0 ? helocStates.join(", ") : "—"}
                </div>
                <div>
                  <strong>Legacy States Column:</strong>{" "}
                  {legacyStates.length > 0 ? legacyStates.join(", ") : "—"}
                </div>
                <div>
                  <strong>Notes:</strong> {notes || "—"}
                </div>
                <div>
                  <strong>Product Assignments:</strong> {productAssignments.length}
                </div>
                <div>
                  <strong>Custom Product Types:</strong> {customProductTypes.length}
                </div>
                <div>
                  <strong>Created:</strong> {formatDateTime(lenderRow.created_at)}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 20 }}>
            <div style={cardStyle()}>
              <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>
                State Eligibility Summary
              </h2>

              <div
                style={{
                  border: "1px solid #D9E1EC",
                  borderRadius: 16,
                  padding: 18,
                  background: "#FBFCFE",
                  color: "#4C5C76",
                  lineHeight: 1.8,
                }}
              >
                <div>
                  <strong>Owner-Occupied:</strong>{" "}
                  {ownerOccupiedStates.length > 0
                    ? ownerOccupiedStates.join(", ")
                    : "—"}
                </div>
                <div>
                  <strong>Non-Owner-Occupied:</strong>{" "}
                  {nonOwnerOccupiedStates.length > 0
                    ? nonOwnerOccupiedStates.join(", ")
                    : "—"}
                </div>
                <div>
                  <strong>Second-Home:</strong>{" "}
                  {secondHomeStates.length > 0 ? secondHomeStates.join(", ") : "—"}
                </div>
                <div>
                  <strong>HELOC / Second-Lien:</strong>{" "}
                  {helocStates.length > 0 ? helocStates.join(", ") : "—"}
                </div>
              </div>
            </div>

            <div style={cardStyle()}>
              <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>
                Product Assignment Summary
              </h2>

              <div
                style={{
                  border: "1px solid #D9E1EC",
                  borderRadius: 16,
                  padding: 18,
                  background: "#FBFCFE",
                  color: "#4C5C76",
                  lineHeight: 1.8,
                }}
              >
                {productAssignments.length === 0 && customProductTypes.length === 0 ? (
                  <div>No product assignment data saved yet.</div>
                ) : (
                  <>
                    <div>
                      <strong>Assigned Products:</strong>{" "}
                      {productAssignments.length > 0
                        ? productAssignments.map((item) => item.productName).join(", ")
                        : "—"}
                    </div>
                    <div>
                      <strong>Custom Product Types:</strong>{" "}
                      {customProductTypes.length > 0
                        ? customProductTypes.map((item) => item.name).join(", ")
                        : "—"}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={cardStyle()}>
              <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>
                Lender Files
              </h2>

              <div
                style={{
                  border: "1px solid #D9E1EC",
                  borderRadius: 16,
                  padding: 18,
                  color: "#6A7A94",
                  lineHeight: 1.7,
                }}
              >
                File management is available from the main file center. This
                detail page is currently focused on lender identity, state
                eligibility, notes, and product assignments.
              </div>

              <div style={{ marginTop: 16 }}>
                <Link
                  href="/admin/files"
                  style={{
                    textDecoration: "none",
                    fontWeight: 800,
                    color: "#0096C7",
                  }}
                >
                  Go to File Center
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
