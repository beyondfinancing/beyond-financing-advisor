"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

type LenderRow = {
  id: string;
  name: string | null;
  channel: string[] | null;
  states: string[] | null;
  created_at: string | null;
};

type Props = {
  initialLenders: LenderRow[];
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

const CHANNEL_OPTIONS = ["Retail", "Wholesale", "Correspondent"];

function dedupe(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function chipStyle(background: string, color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 700,
    background,
    color,
    marginRight: 8,
    marginBottom: 8,
  };
}

export default function LendersClient({ initialLenders }: Props) {
  const [lenders, setLenders] = useState<LenderRow[]>(initialLenders);

  const [name, setName] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [ownerOccupiedStates, setOwnerOccupiedStates] = useState<string[]>([]);
  const [nonOwnerOccupiedStates, setNonOwnerOccupiedStates] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const totalStatesSelected = useMemo(() => {
    return dedupe([...ownerOccupiedStates, ...nonOwnerOccupiedStates]).length;
  }, [ownerOccupiedStates, nonOwnerOccupiedStates]);

  function getMultiSelectValues(event: React.ChangeEvent<HTMLSelectElement>) {
    return Array.from(event.target.selectedOptions).map((option) => option.value);
  }

  async function handleCreateLender(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const payload = {
        name: name.trim(),
        channels,
        ownerOccupiedStates,
        nonOwnerOccupiedStates,
      };

      const response = await fetch("/api/admin/lenders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to create lender.");
      }

      const createdLender = data?.lender as LenderRow | undefined;

      if (createdLender) {
        setLenders((prev) => [createdLender, ...prev]);
      }

      setName("");
      setChannels([]);
      setOwnerOccupiedStates([]);
      setNonOwnerOccupiedStates([]);
      setSuccessMessage("Lender created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lender.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F4F7FB",
        padding: "32px 20px 60px",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#263366",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "8px 14px",
              borderRadius: 999,
              background: "#E9EEF8",
              color: "#263366",
              fontWeight: 700,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            LENDER MANAGEMENT
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 20,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "clamp(42px, 7vw, 64px)",
                  lineHeight: 1.02,
                  margin: "0 0 14px 0",
                  color: "#263366",
                }}
              >
                Manage Lenders
              </h1>

              <p
                style={{
                  fontSize: 18,
                  lineHeight: 1.65,
                  maxWidth: 920,
                  margin: 0,
                  color: "#526581",
                }}
              >
                Create lenders here. Click any lender to open its dedicated detail page for editing,
                deletion, file tracking, and future overlay logic.
              </p>
            </div>

            <Link
              href="/admin"
              style={{
                color: "#263366",
                fontWeight: 700,
                textDecoration: "none",
                fontSize: 16,
                paddingTop: 8,
              }}
            >
              Back to Admin Home
            </Link>
          </div>
        </div>

        {successMessage ? (
          <div
            style={{
              background: "#EAF8EE",
              border: "1px solid #8FD1A3",
              color: "#166534",
              borderRadius: 18,
              padding: "14px 16px",
              marginBottom: 18,
              fontWeight: 700,
            }}
          >
            {successMessage}
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              background: "#FCECEC",
              border: "1px solid #F2B8B5",
              color: "#B42318",
              borderRadius: 18,
              padding: "14px 16px",
              marginBottom: 18,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "380px minmax(0, 1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          <section
            style={{
              background: "#FFFFFF",
              border: "1px solid #D9E1EC",
              borderRadius: 24,
              padding: 22,
              boxShadow: "0 10px 28px rgba(38,51,102,0.06)",
            }}
          >
            <h2 style={{ margin: "0 0 18px 0", fontSize: 18 }}>Create Lender</h2>

            <p style={{ margin: "0 0 22px 0", color: "#526581", lineHeight: 1.6 }}>
              Use one lender record per institution. Add all active channels under that one lender.
            </p>

            <form onSubmit={handleCreateLender}>
              <label style={labelStyle}>Lender Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Example: UWM"
                style={inputStyle}
              />

              <label style={{ ...labelStyle, marginTop: 18 }}>Channels</label>
              <select
                multiple
                value={channels}
                onChange={(e) => setChannels(getMultiSelectValues(e))}
                style={multiSelectStyle}
              >
                {CHANNEL_OPTIONS.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
              <div style={helperTextStyle}>
                Hold Ctrl on Windows or Command on Mac to select more than one.
              </div>

              <label style={{ ...labelStyle, marginTop: 18 }}>Owner-Occupied States</label>
              <select
                multiple
                value={ownerOccupiedStates}
                onChange={(e) => setOwnerOccupiedStates(getMultiSelectValues(e))}
                style={multiSelectStyle}
              >
                {US_STATES.map((state) => (
                  <option key={`owner-${state}`} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <div style={helperTextStyle}>
                States where this lender can do owner-occupied lending.
              </div>

              <label style={{ ...labelStyle, marginTop: 18 }}>Non-Owner-Occupied States</label>
              <select
                multiple
                value={nonOwnerOccupiedStates}
                onChange={(e) => setNonOwnerOccupiedStates(getMultiSelectValues(e))}
                style={multiSelectStyle}
              >
                {US_STATES.map((state) => (
                  <option key={`non-owner-${state}`} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <div style={helperTextStyle}>
                States where this lender can do non-owner-occupied lending.
              </div>

              <div
                style={{
                  marginTop: 14,
                  padding: "12px 14px",
                  borderRadius: 16,
                  background: "#F7FAFF",
                  border: "1px solid #D9E1EC",
                  color: "#526581",
                  lineHeight: 1.6,
                  fontSize: 14,
                }}
              >
                Total unique states selected: <strong>{totalStatesSelected}</strong>
              </div>

              <button
                type="submit"
                disabled={saving}
                style={{
                  width: "100%",
                  marginTop: 18,
                  border: "none",
                  borderRadius: 16,
                  background: "#263366",
                  color: "#FFFFFF",
                  padding: "16px 18px",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Creating..." : "Create Lender"}
              </button>
            </form>
          </section>

          <section
            style={{
              background: "#FFFFFF",
              border: "1px solid #D9E1EC",
              borderRadius: 24,
              padding: 22,
              boxShadow: "0 10px 28px rgba(38,51,102,0.06)",
            }}
          >
            <h2 style={{ margin: "0 0 8px 0", fontSize: 18 }}>Current Lenders</h2>
            <div style={{ color: "#526581", marginBottom: 22 }}>
              Total lenders: {lenders.length}
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              {lenders.map((lender) => (
                <div
                  key={lender.id}
                  style={{
                    border: "1px solid #D9E1EC",
                    borderRadius: 22,
                    padding: 18,
                    background: "#FFFFFF",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 20,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          color: "#263366",
                          marginBottom: 10,
                        }}
                      >
                        {lender.name || "Unnamed Lender"}
                      </div>

                      <div style={{ marginBottom: 10 }}>
                        {(lender.channel || []).map((item) => (
                          <span
                            key={`${lender.id}-${item}`}
                            style={chipStyle("#EEF3FF", "#263366")}
                          >
                            {item}
                          </span>
                        ))}
                      </div>

                      <div style={{ color: "#526581", fontSize: 16 }}>
                        States: {(lender.states || []).join(", ") || "—"}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", minWidth: 180 }}>
                      <div style={{ color: "#526581", marginBottom: 10 }}>
                        {formatDate(lender.created_at)}
                      </div>

                      <Link
                        href={`/admin/lenders/${lender.id}`}
                        style={{
                          color: "#0096C7",
                          fontWeight: 800,
                          textDecoration: "none",
                          fontSize: 16,
                        }}
                      >
                        Open Lender →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}

              {lenders.length === 0 ? (
                <div
                  style={{
                    border: "1px dashed #C8D3E2",
                    borderRadius: 18,
                    padding: 20,
                    color: "#526581",
                  }}
                >
                  No lenders created yet.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 15,
  fontWeight: 800,
  color: "#263366",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 56,
  borderRadius: 16,
  border: "1px solid #C8D3E2",
  background: "#FFFFFF",
  padding: "0 16px",
  fontSize: 16,
  color: "#263366",
  outline: "none",
};

const multiSelectStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 118,
  borderRadius: 16,
  border: "1px solid #C8D3E2",
  background: "#FFFFFF",
  padding: 12,
  fontSize: 16,
  color: "#263366",
  outline: "none",
};

const helperTextStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#6B7A90",
  fontSize: 14,
  lineHeight: 1.5,
};
