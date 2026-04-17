import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

type LenderRow = {
  id: string;
  name: string | null;
  channel: string | null;
  states: string[] | null;
  created_at: string | null;
};

type LenderDocumentRow = {
  id: string;
  lender_id: string;
  document_type: string | null;
  status: string | null;
  effective_date: string | null;
  notes: string | null;
  original_filename: string | null;
  stored_filename: string | null;
  storage_path: string | null;
  uploaded_at: string | null;
};

const CHANNEL_OPTIONS = ["Retail", "Wholesale", "Correspondent"];

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
];

function cardStyle(): CSSProperties {
  return {
    background: "#FFFFFF",
    border: "1px solid #D9E1EC",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 10px 28px rgba(38,51,102,0.06)",
  };
}

function inputStyle(): CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid #C8D3E3",
    fontSize: 16,
    outline: "none",
    boxSizing: "border-box",
    background: "#FFFFFF",
    color: "#263366",
  };
}

function textareaStyle(): CSSProperties {
  return {
    ...inputStyle(),
    minHeight: 110,
    resize: "vertical",
  };
}

function selectMultiStyle(height = 150): CSSProperties {
  return {
    ...inputStyle(),
    minHeight: height,
    padding: 12,
  };
}

function buttonPrimaryStyle(): CSSProperties {
  return {
    background: "#263366",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    padding: "14px 18px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  };
}

function buttonSecondaryStyle(): CSSProperties {
  return {
    background: "#0096C7",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    padding: "14px 18px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  };
}

function buttonDangerStyle(): CSSProperties {
  return {
    background: "#C62828",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    padding: "14px 18px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  };
}

function badgeStyle(): CSSProperties {
  return {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#E8EEF8",
    color: "#263366",
    fontSize: 12,
    fontWeight: 700,
  };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function splitChannels(channel: string | null): string[] {
  if (!channel) return [];
  return channel
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default async function AdminLenderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  if (!(await isAdminSignedIn())) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const query = await searchParams;

  const { data: lender, error: lenderError } = await supabaseAdmin
    .from("lenders")
    .select("*")
    .eq("id", id)
    .single<LenderRow>();

  if (lenderError || !lender) {
    notFound();
  }

  const { data: activeDocuments } = await supabaseAdmin
    .from("lender_documents")
    .select("*")
    .eq("lender_id", id)
    .eq("status", "active")
    .order("uploaded_at", { ascending: false })
    .returns<LenderDocumentRow[]>();

  const { data: archivedDocuments } = await supabaseAdmin
    .from("lender_documents")
    .select("*")
    .eq("lender_id", id)
    .eq("status", "archived")
    .order("uploaded_at", { ascending: false })
    .limit(10)
    .returns<LenderDocumentRow[]>();

  const selectedChannels = splitChannels(lender.channel);
  const selectedStates = lender.states || [];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F1F3F8",
        color: "#263366",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "flex-start",
            marginBottom: 22,
          }}
        >
          <div>
            <div style={{ ...badgeStyle(), marginBottom: 12 }}>
              LENDER DETAIL
            </div>

            <h1
              style={{
                margin: "0 0 10px",
                fontSize: "clamp(34px, 6vw, 56px)",
                lineHeight: 1.1,
              }}
            >
              {lender.name || "Unnamed Lender"}
            </h1>

            <p
              style={{
                margin: 0,
                color: "#5A6A84",
                lineHeight: 1.7,
                fontSize: 18,
                maxWidth: 860,
              }}
            >
              Edit lender identity, channels, state footprint, and review active
              and archived lender documents from one place.
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/admin/files"
              style={{
                ...buttonSecondaryStyle(),
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Manage Files
            </Link>

            <Link
              href="/admin/lenders"
              style={{
                ...buttonPrimaryStyle(),
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Back to Lenders
            </Link>
          </div>
        </div>

        {query.success && (
          <div
            style={{
              marginBottom: 18,
              background: "#EDF7ED",
              border: "1px solid #B7D7B9",
              color: "#1F5E2A",
              borderRadius: 14,
              padding: 14,
              lineHeight: 1.6,
            }}
          >
            {query.success}
          </div>
        )}

        {query.error && (
          <div
            style={{
              marginBottom: 18,
              background: "#FFF4F2",
              border: "1px solid #F3C5BC",
              color: "#8A3B2F",
              borderRadius: 14,
              padding: 14,
              lineHeight: 1.6,
            }}
          >
            {query.error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(340px, 440px) minmax(0, 1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 20 }}>
            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Edit Lender</h2>

              <form
                action="/api/admin/lenders"
                method="POST"
                style={{ display: "grid", gap: 14 }}
              >
                <input type="hidden" name="action" value="update" />
                <input type="hidden" name="id" value={lender.id} />

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Lender Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={lender.name || ""}
                    style={inputStyle()}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    Channels
                  </label>
                  <select
                    name="channels"
                    multiple
                    defaultValue={selectedChannels}
                    style={selectMultiStyle(128)}
                  >
                    {CHANNEL_OPTIONS.map((channel) => (
                      <option key={channel} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </select>
                  <div
                    style={{
                      marginTop: 8,
                      color: "#6A7890",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    Hold Ctrl on Windows or Command on Mac to select more than
                    one.
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
                    States
                  </label>
                  <select
                    name="states"
                    multiple
                    defaultValue={selectedStates}
                    style={selectMultiStyle(180)}
                  >
                    {US_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  <div
                    style={{
                      marginTop: 8,
                      color: "#6A7890",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    This keeps the lender coverage structured for future matching
                    logic.
                  </div>
                </div>

                <button type="submit" style={buttonSecondaryStyle()}>
                  Save Changes
                </button>
              </form>
            </section>

            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Delete Lender</h2>
              <div
                style={{
                  background: "#FFF4F2",
                  border: "1px solid #F3C5BC",
                  color: "#8A3B2F",
                  borderRadius: 14,
                  padding: 14,
                  lineHeight: 1.7,
                  marginBottom: 16,
                }}
              >
                Deleting this lender removes the lender record. If the lender is
                tied to programs or files, delete carefully.
              </div>

              <form action="/api/admin/lenders" method="POST">
                <input type="hidden" name="action" value="delete" />
                <input type="hidden" name="id" value={lender.id} />
                <button type="submit" style={buttonDangerStyle()}>
                  Delete Lender
                </button>
              </form>
            </section>

            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Lender Snapshot</h2>

              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <strong>Name:</strong> {lender.name || "—"}
                </div>
                <div>
                  <strong>Channels:</strong>{" "}
                  {selectedChannels.length ? selectedChannels.join(", ") : "—"}
                </div>
                <div>
                  <strong>States:</strong>{" "}
                  {selectedStates.length ? selectedStates.join(", ") : "—"}
                </div>
                <div>
                  <strong>Created:</strong> {formatDate(lender.created_at)}
                </div>
              </div>
            </section>
          </div>

          <div style={{ display: "grid", gap: 20 }}>
            <section style={cardStyle()}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18 }}>Active Documents</h2>

                <Link
                  href={`/admin/files?lenderId=${lender.id}`}
                  style={{
                    color: "#0096C7",
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  Upload / Replace Files
                </Link>
              </div>

              {!activeDocuments || activeDocuments.length === 0 ? (
                <div
                  style={{
                    border: "1px solid #D9E1EC",
                    borderRadius: 16,
                    padding: 16,
                    color: "#70819A",
                    lineHeight: 1.7,
                    background: "#F8FAFC",
                  }}
                >
                  No active lender documents are currently linked to this lender.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {activeDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        border: "1px solid #D9E1EC",
                        borderRadius: 16,
                        background: "#F8FAFC",
                        padding: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          marginBottom: 10,
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 16 }}>
                          {doc.document_type || "Unclassified Document"}
                        </div>
                        <div style={{ color: "#5A6A84" }}>
                          Uploaded: {formatDate(doc.uploaded_at)}
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 6, color: "#4B5C78" }}>
                        <div>
                          <strong>Effective Date:</strong>{" "}
                          {formatDate(doc.effective_date)}
                        </div>
                        <div>
                          <strong>Original Filename:</strong>{" "}
                          {doc.original_filename || "—"}
                        </div>
                        <div>
                          <strong>Stored Filename:</strong>{" "}
                          {doc.stored_filename || "—"}
                        </div>
                        <div>
                          <strong>Notes:</strong> {doc.notes || "—"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={cardStyle()}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Archived Backup Documents</h2>

              {!archivedDocuments || archivedDocuments.length === 0 ? (
                <div
                  style={{
                    border: "1px solid #D9E1EC",
                    borderRadius: 16,
                    padding: 16,
                    color: "#70819A",
                    lineHeight: 1.7,
                    background: "#F8FAFC",
                  }}
                >
                  No archived backup documents yet for this lender.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {archivedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        border: "1px solid #D9E1EC",
                        borderRadius: 16,
                        background: "#FFFFFF",
                        padding: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          marginBottom: 10,
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>
                          {doc.document_type || "Unclassified Document"}
                        </div>
                        <div style={{ color: "#5A6A84" }}>
                          Archived upload: {formatDate(doc.uploaded_at)}
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 6, color: "#4B5C78" }}>
                        <div>
                          <strong>Effective Date:</strong>{" "}
                          {formatDate(doc.effective_date)}
                        </div>
                        <div>
                          <strong>Original Filename:</strong>{" "}
                          {doc.original_filename || "—"}
                        </div>
                        <div>
                          <strong>Stored Filename:</strong>{" "}
                          {doc.stored_filename || "—"}
                        </div>
                        <div>
                          <strong>Notes:</strong> {doc.notes || "—"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
