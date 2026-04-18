"use client";

import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";

type LenderSummary = {
  id: string;
  name: string | null;
  channel: string[] | null;
  states: string[] | null;
  created_at: string | null;
  owner_occupied_states?: string[] | null;
  non_owner_occupied_states?: string[] | null;
};

type LendersClientProps = {
  initialLenders: LenderSummary[];
};

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
];

const CHANNEL_OPTIONS = ["Retail", "Wholesale", "Correspondent"];

function normalizeArray(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function readMultiSelectValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions).map((option) => option.value);
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

function inputStyle(): CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid #C8D3E3",
    fontSize: 16,
    outline: "none",
    minWidth: 0,
    boxSizing: "border-box",
    background: "#FFFFFF",
    color: "#263366",
  };
}

function labelStyle(): CSSProperties {
  return {
    display: "block",
    fontWeight: 700,
    marginBottom: 8,
    color: "#263366",
  };
}

function primaryButtonStyle(disabled = false): CSSProperties {
  return {
    background: "#263366",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 14,
    padding: "14px 18px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    width: "100%",
  };
}

function secondaryPillStyle(): CSSProperties {
  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#E8EEF8",
    color: "#263366",
    fontSize: 13,
    fontWeight: 700,
    marginRight: 8,
    marginBottom: 8,
  };
}

export default function LendersClient({ initialLenders }: LendersClientProps) {
  const [lenders, setLenders] = useState<LenderSummary[]>(initialLenders);
  const [name, setName] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [ownerOccupiedStates, setOwnerOccupiedStates] = useState<string[]>([]);
  const [nonOwnerOccupiedStates, setNonOwnerOccupiedStates] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const totalLenders = useMemo(() => lenders.length, [lenders]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin/lenders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          channels,
          ownerOccupiedStates,
          nonOwnerOccupiedStates,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        lender?: {
          id: string;
          name: string | null;
          channel: string[] | null;
          states: string[] | null;
          created_at: string | null;
        };
        lender_state_eligibility?: {
          owner_occupied_states?: string[];
          non_owner_occupied_states?: string[];
        };
      };

      if (!response.ok || !data.success || !data.lender) {
        throw new Error(data.error || "Failed to create lender.");
      }

      const nextLender: LenderSummary = {
        ...data.lender,
        owner_occupied_states:
          data.lender_state_eligibility?.owner_occupied_states || [],
        non_owner_occupied_states:
          data.lender_state_eligibility?.non_owner_occupied_states || [],
      };

      setLenders((prev) => [nextLender, ...prev]);
      setName("");
      setChannels([]);
      setOwnerOccupiedStates([]);
      setNonOwnerOccupiedStates([]);
      setSuccessMessage("Lender created successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected lender creation error."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(320px, 380px) minmax(420px, 1fr)",
        gap: 20,
        alignItems: "start",
      }}
    >
      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 20 }}>
          Create Lender
        </h2>

        <p style={{ color: "#5A6A84", lineHeight: 1.7, marginTop: 0 }}>
          Use one lender record per institution. Add all active channels under that
          one lender.
        </p>

        {successMessage ? (
          <div
            style={{
              marginBottom: 16,
              background: "#E8F7EE",
              border: "1px solid #86D19C",
              color: "#157347",
              borderRadius: 14,
              padding: "12px 14px",
            }}
          >
            {successMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div
            style={{
              marginBottom: 16,
              background: "#FDECEC",
              border: "1px solid #F5A4A4",
              color: "#B42318",
              borderRadius: 14,
              padding: "12px 14px",
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle()}>Lender Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Example: UWM"
              style={inputStyle()}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle()}>Channels</label>
            <select
              multiple
              value={channels}
              onChange={(e) => setChannels(readMultiSelectValues(e.target))}
              style={{
                ...inputStyle(),
                minHeight: 118,
                paddingTop: 12,
                paddingBottom: 12,
              }}
            >
              {CHANNEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <div style={{ color: "#6B7B94", fontSize: 13, marginTop: 8 }}>
              Hold Ctrl on Windows or Command on Mac to select more than one.
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle()}>Owner-Occupied States</label>
            <select
              multiple
              value={ownerOccupiedStates}
              onChange={(e) =>
                setOwnerOccupiedStates(dedupe(readMultiSelectValues(e.target)))
              }
              style={{
                ...inputStyle(),
                minHeight: 190,
                paddingTop: 12,
                paddingBottom: 12,
              }}
            >
              {US_STATES.map((state) => (
                <option key={`oo-${state}`} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle()}>Non-Owner-Occupied States</label>
            <select
              multiple
              value={nonOwnerOccupiedStates}
              onChange={(e) =>
                setNonOwnerOccupiedStates(dedupe(readMultiSelectValues(e.target)))
              }
              style={{
                ...inputStyle(),
                minHeight: 190,
                paddingTop: 12,
                paddingBottom: 12,
              }}
            >
              {US_STATES.map((state) => (
                <option key={`noo-${state}`} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          <div style={{ color: "#6B7B94", fontSize: 14, lineHeight: 1.7, marginBottom: 18 }}>
            This keeps lender coverage structured for future matching logic.
          </div>

          <button type="submit" disabled={submitting || !name.trim()} style={primaryButtonStyle(submitting || !name.trim())}>
            {submitting ? "Creating..." : "Create Lender"}
          </button>
        </form>
      </section>

      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 20 }}>
          Current Lenders
        </h2>

        <div style={{ color: "#5A6A84", marginBottom: 18 }}>
          Total lenders: {totalLenders}
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          {lenders.map((lender) => {
            const lenderChannels = normalizeArray(lender.channel);
            const ownerStates = normalizeArray(lender.owner_occupied_states);
            const nonOwnerStates = normalizeArray(lender.non_owner_occupied_states);
            const legacyStates = normalizeArray(lender.states);

            return (
              <div
                key={lender.id}
                style={{
                  border: "1px solid #D9E1EC",
                  borderRadius: 20,
                  padding: 18,
                  background: "#FFFFFF",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: "#263366",
                        marginBottom: 8,
                      }}
                    >
                      {lender.name || "Unnamed Lender"}
                    </div>

                    <div>
                      {lenderChannels.length > 0 ? (
                        lenderChannels.map((channel) => (
                          <span key={`${lender.id}-${channel}`} style={secondaryPillStyle()}>
                            {channel}
                          </span>
                        ))
                      ) : (
                        <span style={secondaryPillStyle()}>No channel saved</span>
                      )}
                    </div>
                  </div>

                  <div style={{ color: "#6B7B94", whiteSpace: "nowrap" }}>
                    {formatDate(lender.created_at)}
                  </div>
                </div>

                {ownerStates.length > 0 ? (
                  <div style={{ color: "#4B5C78", lineHeight: 1.8, marginBottom: 6 }}>
                    <strong>Owner-Occupied States:</strong> {ownerStates.join(", ")}
                  </div>
                ) : null}

                {nonOwnerStates.length > 0 ? (
                  <div style={{ color: "#4B5C78", lineHeight: 1.8, marginBottom: 6 }}>
                    <strong>Non-Owner-Occupied States:</strong> {nonOwnerStates.join(", ")}
                  </div>
                ) : null}

                {ownerStates.length === 0 && nonOwnerStates.length === 0 ? (
                  <div style={{ color: "#4B5C78", lineHeight: 1.8 }}>
                    <strong>States:</strong>{" "}
                    {legacyStates.length > 0 ? legacyStates.join(", ") : "None saved"}
                  </div>
                ) : null}

                <div style={{ marginTop: 10 }}>
                  <a
                    href={`/admin/lenders/${lender.id}`}
                    style={{
                      color: "#0096C7",
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    Open Lender →
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
