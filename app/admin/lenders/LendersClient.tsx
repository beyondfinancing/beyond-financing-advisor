"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ChannelType = "retail" | "wholesale" | "correspondent";

type LenderListItem = {
  id: string;
  name: string;
  channels: string[];
  ownerOccupiedStates: string[];
  nonOwnerOccupiedStates: string[];
  createdAt?: string | null;
};

const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const CHANNEL_OPTIONS: { value: ChannelType; label: string }[] = [
  { value: "retail", label: "Retail" },
  { value: "wholesale", label: "Wholesale" },
  { value: "correspondent", label: "Correspondent" },
];

function formatDate(value?: string | null) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
}

function readMultiSelectValues(
  event: React.ChangeEvent<HTMLSelectElement>
): string[] {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

function sortStates(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function badgeStyle(): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    background: "#E9EEF8",
    color: "#263366",
    fontWeight: 700,
    fontSize: 14,
  };
}

function cardStyle(): React.CSSProperties {
  return {
    background: "#FFFFFF",
    border: "1px solid #D8E1EF",
    borderRadius: 28,
    padding: 22,
    boxShadow: "0 8px 30px rgba(38,51,102,0.06)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: 16,
    border: "1px solid #C7D7EB",
    padding: "14px 16px",
    fontSize: 16,
    outline: "none",
    background: "#FFFFFF",
    color: "#263366",
    minWidth: 0,
    boxSizing: "border-box",
  };
}

function multiSelectStyle(): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: 16,
    border: "1px solid #C7D7EB",
    padding: "12px 14px",
    fontSize: 16,
    outline: "none",
    background: "#FFFFFF",
    color: "#263366",
    minHeight: 120,
    boxSizing: "border-box",
  };
}

function primaryButtonStyle(disabled = false): React.CSSProperties {
  return {
    width: "100%",
    border: "none",
    borderRadius: 16,
    background: "#2D3C7A",
    color: "#FFFFFF",
    padding: "16px 18px",
    fontSize: 16,
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

type CreateLenderPayload = {
  name: string;
  channels: string[];
  ownerOccupiedStates: string[];
  nonOwnerOccupiedStates: string[];
};

export default function ManageLendersPage() {
  const [lenders, setLenders] = useState<LenderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLenders, setLoadingLenders] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [ownerOccupiedStates, setOwnerOccupiedStates] = useState<string[]>([]);
  const [nonOwnerOccupiedStates, setNonOwnerOccupiedStates] = useState<string[]>([]);

  const totalLenders = lenders.length;

  const previewCombinedStates = useMemo(() => {
    return sortStates([...ownerOccupiedStates, ...nonOwnerOccupiedStates]);
  }, [ownerOccupiedStates, nonOwnerOccupiedStates]);

  async function loadLenders() {
    setLoadingLenders(true);
    setError("");

    try {
      const response = await fetch("/api/admin/lenders", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load lenders.");
      }

      setLenders(Array.isArray(data?.lenders) ? data.lenders : []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load lenders.";
      setError(message);
    } finally {
      setLoadingLenders(false);
    }
  }

  async function createLender(event: React.FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const trimmedName = name.trim();

      if (!trimmedName) {
        throw new Error("Please enter a lender name.");
      }

      if (channels.length === 0) {
        throw new Error("Please select at least one channel.");
      }

      if (
        ownerOccupiedStates.length === 0 &&
        nonOwnerOccupiedStates.length === 0
      ) {
        throw new Error(
          "Please select at least one owner-occupied state or non-owner-occupied state."
        );
      }

      const payload: CreateLenderPayload = {
        name: trimmedName,
        channels: sortStates(channels),
        ownerOccupiedStates: sortStates(ownerOccupiedStates),
        nonOwnerOccupiedStates: sortStates(nonOwnerOccupiedStates),
      };

      const response = await fetch("/api/admin/lenders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to create lender.");
      }

      setSuccess("Lender created successfully.");
      setName("");
      setChannels([]);
      setOwnerOccupiedStates([]);
      setNonOwnerOccupiedStates([]);

      await loadLenders();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create lender.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useState(() => {
    void loadLenders();
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F3F6FB",
        padding: "34px 36px 48px",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#263366",
      }}
    >
      <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                padding: "8px 14px",
                borderRadius: 999,
                background: "#E9EEF8",
                color: "#263366",
                fontWeight: 800,
                fontSize: 14,
                marginBottom: 14,
              }}
            >
              LENDER MANAGEMENT
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(42px, 7vw, 66px)",
                lineHeight: 1.02,
              }}
            >
              Manage Lenders
            </h1>

            <p
              style={{
                margin: "14px 0 0",
                maxWidth: 980,
                color: "#556987",
                fontSize: 18,
                lineHeight: 1.55,
              }}
            >
              Create lenders here. Click any lender to open its dedicated detail
              page for editing, deletion, file tracking, and future overlay logic.
            </p>
          </div>

          <Link
            href="/admin"
            style={{
              color: "#263366",
              fontWeight: 800,
              fontSize: 16,
              textDecoration: "none",
            }}
          >
            Back to Admin Home
          </Link>
        </div>

        {error ? (
          <div
            style={{
              marginBottom: 18,
              borderRadius: 18,
              border: "1px solid #F3B0AA",
              background: "#FDECEC",
              color: "#A53B31",
              padding: "14px 16px",
            }}
          >
            {error}
          </div>
        ) : null}

        {success ? (
          <div
            style={{
              marginBottom: 18,
              borderRadius: 18,
              border: "1px solid #91D3A2",
              background: "#EAF8EE",
              color: "#1E7A3C",
              padding: "14px 16px",
            }}
          >
            {success}
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
          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: 18 }}>
              Create Lender
            </h2>

            <p
              style={{
                marginTop: 0,
                color: "#556987",
                fontSize: 16,
                lineHeight: 1.6,
              }}
            >
              Use one lender record per institution. Add all active channels under
              that one lender.
            </p>

            <form onSubmit={createLender}>
              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="lender-name"
                  style={{
                    display: "block",
                    fontWeight: 800,
                    marginBottom: 8,
                    fontSize: 16,
                  }}
                >
                  Lender Name
                </label>
                <input
                  id="lender-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Example: UWM"
                  style={inputStyle()}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label
                  htmlFor="channels"
                  style={{
                    display: "block",
                    fontWeight: 800,
                    marginBottom: 8,
                    fontSize: 16,
                  }}
                >
                  Channels
                </label>
                <select
                  id="channels"
                  multiple
                  value={channels}
                  onChange={(e) => setChannels(readMultiSelectValues(e))}
                  style={multiSelectStyle()}
                >
                  {CHANNEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    marginTop: 8,
                    color: "#6A7D98",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  Hold Ctrl on Windows or Command on Mac to select more than one.
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="owner-occupied-states"
                  style={{
                    display: "block",
                    fontWeight: 800,
                    marginBottom: 8,
                    fontSize: 16,
                  }}
                >
                  Owner-Occupied States
                </label>
                <select
                  id="owner-occupied-states"
                  multiple
                  value={ownerOccupiedStates}
                  onChange={(e) =>
                    setOwnerOccupiedStates(readMultiSelectValues(e))
                  }
                  style={multiSelectStyle()}
                >
                  {ALL_STATES.map((state) => (
                    <option key={`oo-${state}`} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label
                  htmlFor="non-owner-occupied-states"
                  style={{
                    display: "block",
                    fontWeight: 800,
                    marginBottom: 8,
                    fontSize: 16,
                  }}
                >
                  Non-Owner-Occupied States
                </label>
                <select
                  id="non-owner-occupied-states"
                  multiple
                  value={nonOwnerOccupiedStates}
                  onChange={(e) =>
                    setNonOwnerOccupiedStates(readMultiSelectValues(e))
                  }
                  style={multiSelectStyle()}
                >
                  {ALL_STATES.map((state) => (
                    <option key={`noo-${state}`} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  marginBottom: 18,
                  color: "#6A7D98",
                  fontSize: 14,
                  lineHeight: 1.55,
                }}
              >
                This allows the qualification engine to distinguish lenders that
                are licensed for owner-occupied files versus non-owner-occupied
                files by state.
              </div>

              {previewCombinedStates.length > 0 ? (
                <div
                  style={{
                    marginBottom: 18,
                    borderRadius: 16,
                    border: "1px solid #D8E1EF",
                    background: "#F8FBFF",
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      marginBottom: 10,
                      fontSize: 15,
                    }}
                  >
                    Combined State Footprint Preview
                  </div>
                  <div
                    style={{
                      color: "#556987",
                      lineHeight: 1.6,
                      fontSize: 15,
                    }}
                  >
                    {previewCombinedStates.join(", ")}
                  </div>
                </div>
              ) : null}

              <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
                {loading ? "Creating..." : "Create Lender"}
              </button>
            </form>
          </section>

          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18 }}>
              Current Lenders
            </h2>

            <div
              style={{
                color: "#556987",
                fontSize: 16,
                marginBottom: 18,
              }}
            >
              Total lenders: {totalLenders}
            </div>

            {loadingLenders ? (
              <div
                style={{
                  borderRadius: 20,
                  border: "1px solid #D8E1EF",
                  background: "#F8FBFF",
                  padding: 18,
                  color: "#556987",
                }}
              >
                Loading lenders...
              </div>
            ) : lenders.length === 0 ? (
              <div
                style={{
                  borderRadius: 20,
                  border: "1px solid #D8E1EF",
                  background: "#F8FBFF",
                  padding: 18,
                  color: "#556987",
                }}
              >
                No lenders found yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {lenders.map((lender) => {
                  const combinedStates = sortStates([
                    ...safeArray(lender.ownerOccupiedStates),
                    ...safeArray(lender.nonOwnerOccupiedStates),
                  ]);

                  return (
                    <div
                      key={lender.id}
                      style={{
                        border: "1px solid #D8E1EF",
                        borderRadius: 24,
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
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 900,
                              marginBottom: 10,
                            }}
                          >
                            {lender.name}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                              marginBottom: 12,
                            }}
                          >
                            {safeArray(lender.channels).map((channel) => (
                              <span key={`${lender.id}-${channel}`} style={badgeStyle()}>
                                {channel.charAt(0).toUpperCase() + channel.slice(1)}
                              </span>
                            ))}
                          </div>

                          <div
                            style={{
                              color: "#556987",
                              lineHeight: 1.6,
                              fontSize: 16,
                              marginBottom: 8,
                            }}
                          >
                            <strong style={{ color: "#263366" }}>States:</strong>{" "}
                            {combinedStates.length > 0 ? combinedStates.join(", ") : "—"}
                          </div>

                          <div
                            style={{
                              color: "#556987",
                              lineHeight: 1.6,
                              fontSize: 15,
                            }}
                          >
                            <strong style={{ color: "#263366" }}>
                              Owner-Occupied:
                            </strong>{" "}
                            {safeArray(lender.ownerOccupiedStates).length > 0
                              ? sortStates(lender.ownerOccupiedStates).join(", ")
                              : "—"}
                          </div>

                          <div
                            style={{
                              color: "#556987",
                              lineHeight: 1.6,
                              fontSize: 15,
                            }}
                          >
                            <strong style={{ color: "#263366" }}>
                              Non-Owner-Occupied:
                            </strong>{" "}
                            {safeArray(lender.nonOwnerOccupiedStates).length > 0
                              ? sortStates(lender.nonOwnerOccupiedStates).join(", ")
                              : "—"}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 10,
                            minWidth: 180,
                          }}
                        >
                          <div
                            style={{
                              color: "#556987",
                              fontSize: 15,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatDate(lender.createdAt)}
                          </div>

                          <Link
                            href={`/admin/lenders/${lender.id}`}
                            style={{
                              color: "#0096C7",
                              fontSize: 16,
                              fontWeight: 900,
                              textDecoration: "none",
                            }}
                          >
                            Open Lender →
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function safeArray(value?: string[] | null): string[] {
  return Array.isArray(value) ? value : [];
}
