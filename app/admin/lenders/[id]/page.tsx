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
  channel: string[] | null;
  states: string[] | null;
  created_at: string | null;
};

type LenderFileRow = {
  id: string;
  lender_id: string | null;
  original_filename: string | null;
  file_type: string | null;
  program_group: string | null;
  effective_date: string | null;
  notes: string | null;
  is_archived: boolean | null;
  created_at: string | null;
};

type LenderStateEligibilityRow = {
  state_code: string | null;
  eligibility_type: "owner_occupied" | "non_owner_occupied" | null;
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

export default async function LenderDetailPage({ params }: PageProps) {
  const signedIn = await isAdminSignedIn();

  if (!signedIn) {
    redirect("/admin/login");
  }

  const { id } = await params;

  const [{ data: lender, error: lenderError }, { data: files, error: filesError }, { data: stateEligibility, error: stateEligibilityError }] =
    await Promise.all([
      supabaseAdmin
        .from("lenders")
        .select("id, name, channel, states, created_at")
        .eq("id", id)
        .maybeSingle<LenderRow>(),
      supabaseAdmin
        .from("lender_files")
        .select(
          "id, lender_id, original_filename, file_type, program_group, effective_date, notes, is_archived, created_at"
        )
        .eq("lender_id", id)
        .order("created_at", { ascending: false })
        .returns<LenderFileRow[]>(),
      supabaseAdmin
        .from("lender_state_eligibility")
        .select("state_code, eligibility_type")
        .eq("lender_id", id)
        .returns<LenderStateEligibilityRow[]>(),
    ]);

  if (lenderError) {
    throw new Error(lenderError.message);
  }

  if (!lender) {
    notFound();
  }

  if (filesError) {
    throw new Error(filesError.message);
  }

  if (stateEligibilityError) {
    throw new Error(stateEligibilityError.message);
  }

  const activeFiles = (files ?? []).filter((file) => !file.is_archived);
  const archivedFiles = (files ?? []).filter((file) => Boolean(file.is_archived));

  const ownerOccupiedStates = Array.from(
    new Set(
      (stateEligibility ?? [])
        .filter((row) => row.eligibility_type === "owner_occupied")
        .map((row) => String(row.state_code ?? "").trim().toUpperCase())
        .filter(Boolean)
    )
  ).sort();

  const nonOwnerOccupiedStates = Array.from(
    new Set(
      (stateEligibility ?? [])
        .filter((row) => row.eligibility_type === "non_owner_occupied")
        .map((row) => String(row.state_code ?? "").trim().toUpperCase())
        .filter(Boolean)
    )
  ).sort();

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
              {lender.name || "Lender"}
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
              Edit lender identity, channels, owner-occupied footprint,
              non-owner-occupied footprint, and review active and archived
              lender documents from one place.
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
                lenderId={lender.id}
                initialName={lender.name || ""}
                initialChannels={Array.isArray(lender.channel) ? lender.channel : []}
                initialLegacyStates={Array.isArray(lender.states) ? lender.states : []}
                initialOwnerOccupiedStates={ownerOccupiedStates}
                initialNonOwnerOccupiedStates={nonOwnerOccupiedStates}
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
                tied to programs or files, delete carefully.
              </div>

              <form action={`/api/admin/lenders/${lender.id}`} method="post">
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
                  <strong>Name:</strong> {lender.name || "—"}
                </div>
                <div>
                  <strong>Channels:</strong>{" "}
                  {Array.isArray(lender.channel) && lender.channel.length > 0
                    ? lender.channel.join(", ")
                    : "—"}
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
                  <strong>Legacy States Column:</strong>{" "}
                  {Array.isArray(lender.states) && lender.states.length > 0
                    ? lender.states.join(", ")
                    : "—"}
                </div>
                <div>
                  <strong>Created:</strong> {formatDateTime(lender.created_at)}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 20 }}>
            <div style={cardStyle()}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18 }}>Active Documents</h2>

                <Link
                  href="/admin/files"
                  style={{
                    textDecoration: "none",
                    fontWeight: 800,
                    color: "#0096C7",
                  }}
                >
                  Upload / Replace Files
                </Link>
              </div>

              {activeFiles.length === 0 ? (
                <div
                  style={{
                    border: "1px solid #D9E1EC",
                    borderRadius: 16,
                    padding: 18,
                    color: "#6A7A94",
                  }}
                >
                  No active lender documents are currently linked to this lender.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {activeFiles.map((file) => (
                    <div
                      key={file.id}
                      style={{
                        border: "1px solid #D9E1EC",
                        borderRadius: 16,
                        padding: 18,
                        background: "#FBFCFE",
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: 8 }}>
                        {file.original_filename || "Unnamed file"}
                      </div>

                      <div style={{ color: "#4C5C76", lineHeight: 1.8 }}>
                        <div>
                          <strong>Type:</strong> {file.file_type || "—"}
                        </div>
                        <div>
                          <strong>Program / Group:</strong>{" "}
                          {file.program_group || "—"}
                        </div>
                        <div>
                          <strong>Effective Date:</strong>{" "}
                          {file.effective_date || "—"}
                        </div>
                        <div>
                          <strong>Notes:</strong> {file.notes || "—"}
                        </div>
                        <div>
                          <strong>Uploaded:</strong>{" "}
                          {formatDateTime(file.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={cardStyle()}>
              <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>
                Archived Backup Documents
              </h2>

              {archivedFiles.length === 0 ? (
                <div
                  style={{
                    border: "1px solid #D9E1EC",
                    borderRadius: 16,
                    padding: 18,
                    color: "#6A7A94",
                  }}
                >
                  No archived backup documents yet for this lender.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {archivedFiles.map((file) => (
                    <div
                      key={file.id}
                      style={{
                        border: "1px solid #D9E1EC",
                        borderRadius: 16,
                        padding: 18,
                        background: "#FBFCFE",
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: 8 }}>
                        {file.original_filename || "Unnamed file"}
                      </div>

                      <div style={{ color: "#4C5C76", lineHeight: 1.8 }}>
                        <div>
                          <strong>Type:</strong> {file.file_type || "—"}
                        </div>
                        <div>
                          <strong>Program / Group:</strong>{" "}
                          {file.program_group || "—"}
                        </div>
                        <div>
                          <strong>Effective Date:</strong>{" "}
                          {file.effective_date || "—"}
                        </div>
                        <div>
                          <strong>Notes:</strong> {file.notes || "—"}
                        </div>
                        <div>
                          <strong>Archived:</strong>{" "}
                          {formatDateTime(file.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
