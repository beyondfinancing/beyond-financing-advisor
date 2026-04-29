"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

type ProductAssignmentSelection = {
  product_type_id: string;
  owner_occupied_allowed: boolean;
  non_owner_occupied_allowed: boolean;
};

type LenderRow = {
  id: string;
  name: string | null;
  channel: string[] | null;
  states: string[] | null;
  created_at: string | null;
  owner_occupied_states?: string[] | null;
  non_owner_occupied_states?: string[] | null;
};

type LoanProductType = {
  id: string;
  name: string;
  category: string | null;
};

type Props = {
  initialLenders: LenderRow[];
};

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
];

const CHANNEL_OPTIONS = ["Retail", "Wholesale", "Correspondent"];

const DEFAULT_PRODUCT_TYPES: LoanProductType[] = [
  { id: "conventional", name: "Conventional", category: "agency" },
  { id: "fha", name: "FHA", category: "government" },
  { id: "va", name: "VA", category: "government" },
  { id: "usda", name: "USDA", category: "government" },
  { id: "itin", name: "ITIN", category: "non_qm" },
  { id: "bank_statement", name: "Bank Statement", category: "non_qm" },
  { id: "stated_income", name: "Stated Income", category: "non_qm" },
  { id: "dscr", name: "DSCR", category: "non_qm" },
  { id: "pnl", name: "P&L", category: "non_qm" },
  { id: "1099", name: "1099", category: "non_qm" },
  { id: "asset_depletion", name: "Asset Depletion", category: "non_qm" },
  { id: "foreign_national", name: "Foreign National", category: "non_qm" },
  { id: "interest_only", name: "Interest Only", category: "non_qm" },
  { id: "jumbo_non_qm", name: "Jumbo Non-QM", category: "non_qm" },
];

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

function productCardStyle(enabled: boolean): React.CSSProperties {
  return {
    border: enabled ? "1px solid #0096C7" : "1px solid #D9E1EC",
    background: enabled ? "#F3FBFE" : "#FFFFFF",
    borderRadius: 16,
    padding: 14,
  };
}

function normalizeCustomProductId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function LendersClient({ initialLenders }: Props) {
  const [lenders, setLenders] = useState<LenderRow[]>(initialLenders);

  const [name, setName] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [ownerOccupiedStates, setOwnerOccupiedStates] = useState<string[]>([]);
  const [nonOwnerOccupiedStates, setNonOwnerOccupiedStates] = useState<string[]>([]);

  // Phase 7.1b — AUS Methods Accepted (create flow).
  // Pre-populate with sensible default DU + LPA. Most wholesale lenders
  // accept these two and reject Manual Underwriting.
  const [ausMethods, setAusMethods] = useState<string[]>(["du", "lpa"]);

  function toggleAusMethod(method: "du" | "lpa" | "manual", checked: boolean) {
    setAusMethods((prev) => {
      const set = new Set(prev);
      if (checked) {
        set.add(method);
      } else {
        set.delete(method);
      }
      return Array.from(set).sort();
    });
  }

  const [loanProductTypes, setLoanProductTypes] =
    useState<LoanProductType[]>(DEFAULT_PRODUCT_TYPES);

  const [productAssignments, setProductAssignments] = useState<
    ProductAssignmentSelection[]
  >([]);

  const [customProductName, setCustomProductName] = useState("");
  const [customProductCategory, setCustomProductCategory] =
    useState<"agency" | "government" | "non_qm" | "other">("non_qm");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const totalStatesSelected = useMemo(() => {
    return dedupe([...ownerOccupiedStates, ...nonOwnerOccupiedStates]).length;
  }, [ownerOccupiedStates, nonOwnerOccupiedStates]);

  const groupedProductTypes = useMemo(() => {
    return {
      agency: loanProductTypes.filter((item) => item.category === "agency"),
      government: loanProductTypes.filter((item) => item.category === "government"),
      non_qm: loanProductTypes.filter((item) => item.category === "non_qm"),
      other: loanProductTypes.filter(
        (item) =>
          item.category !== "agency" &&
          item.category !== "government" &&
          item.category !== "non_qm"
      ),
    };
  }, [loanProductTypes]);

  function getMultiSelectValues(event: React.ChangeEvent<HTMLSelectElement>) {
    return Array.from(event.target.selectedOptions).map((option) => option.value);
  }

  function getAssignment(productTypeId: string) {
    return (
      productAssignments.find((item) => item.product_type_id === productTypeId) || null
    );
  }

  function isProductSelected(productTypeId: string) {
    return productAssignments.some((item) => item.product_type_id === productTypeId);
  }

  function toggleProduct(productTypeId: string, checked: boolean) {
    setProductAssignments((prev) => {
      if (checked) {
        if (prev.some((item) => item.product_type_id === productTypeId)) return prev;
        return [
          ...prev,
          {
            product_type_id: productTypeId,
            owner_occupied_allowed: false,
            non_owner_occupied_allowed: false,
          },
        ];
      }

      return prev.filter((item) => item.product_type_id !== productTypeId);
    });
  }

  function updateAssignmentFlag(
    productTypeId: string,
    field: "owner_occupied_allowed" | "non_owner_occupied_allowed",
    value: boolean
  ) {
    setProductAssignments((prev) =>
      prev.map((item) =>
        item.product_type_id === productTypeId
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  function addCustomProduct() {
    setError("");
    setSuccessMessage("");

    const trimmedName = customProductName.trim();
    if (!trimmedName) {
      setError("Please enter a custom loan product name.");
      return;
    }

    const normalizedId = normalizeCustomProductId(trimmedName);
    if (!normalizedId) {
      setError("Unable to create a valid custom product ID from that name.");
      return;
    }

    const alreadyExists = loanProductTypes.some(
      (item) => item.id === normalizedId || item.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (alreadyExists) {
      setError("That product already exists in the current list.");
      return;
    }

    const newProduct: LoanProductType = {
      id: normalizedId,
      name: trimmedName,
      category: customProductCategory,
    };

    setLoanProductTypes((prev) => [...prev, newProduct]);
    setProductAssignments((prev) => [
      ...prev,
      {
        product_type_id: newProduct.id,
        owner_occupied_allowed: false,
        non_owner_occupied_allowed: false,
      },
    ]);
    setCustomProductName("");
    setCustomProductCategory("non_qm");
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
        productAssignments,
        customProductTypes: loanProductTypes.filter(
          (item) => !DEFAULT_PRODUCT_TYPES.some((base) => base.id === item.id)
        ),
        ausMethods,
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
      setProductAssignments([]);
      setCustomProductName("");
      setCustomProductCategory("non_qm");
      setAusMethods(["du", "lpa"]);
      setSuccessMessage("Lender created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lender.");
    } finally {
      setSaving(false);
    }
  }

  function renderProductSection(
    title: string,
    items: LoanProductType[],
    accentBackground: string
  ) {
    if (items.length === 0) return null;

    return (
      <div style={{ marginTop: 20 }}>
        <div
          style={{
            ...chipStyle(accentBackground, "#263366"),
            marginBottom: 12,
          }}
        >
          {title}
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {items.map((product) => {
            const selected = isProductSelected(product.id);
            const assignment = getAssignment(product.id);

            return (
              <div key={product.id} style={productCardStyle(selected)}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontWeight: 800,
                    color: "#263366",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => toggleProduct(product.id, e.target.checked)}
                  />
                  <span>{product.name}</span>
                </label>

                {selected ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                      marginTop: 12,
                    }}
                  >
                    <label
                      style={{
                        border: "1px solid #D9E1EC",
                        borderRadius: 12,
                        padding: "10px 12px",
                        background: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(assignment?.owner_occupied_allowed)}
                        onChange={(e) =>
                          updateAssignmentFlag(
                            product.id,
                            "owner_occupied_allowed",
                            e.target.checked
                          )
                        }
                      />
                      Owner-Occupied
                    </label>

                    <label
                      style={{
                        border: "1px solid #D9E1EC",
                        borderRadius: 12,
                        padding: "10px 12px",
                        background: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(assignment?.non_owner_occupied_allowed)}
                        onChange={(e) =>
                          updateAssignmentFlag(
                            product.id,
                            "non_owner_occupied_allowed",
                            e.target.checked
                          )
                        }
                      />
                      Non-Owner-Occupied
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
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
                deletion, file tracking, product controls, and future overlay logic.
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
            gridTemplateColumns: "420px minmax(0, 1fr)",
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
              Use one lender record per institution. Add all active channels, state footprint,
              and product capabilities under that one lender.
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

              {/* Phase 7.1b — AUS Methods Accepted (create flow).
                  Mirrors the same card on the lender detail page. Most
                  wholesale lenders accept DU and LPA and do not accept
                  Manual Underwriting. The matcher (Phase 7.5) will use
                  this column to filter (lender × program) pairings. */}
              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  borderRadius: 18,
                  border: "1px solid #D9E1EC",
                  background: "#FFFFFF",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: 16,
                    color: "#263366",
                  }}
                >
                  AUS Methods Accepted
                </h3>
                <div
                  style={{
                    ...helperTextStyle,
                    marginTop: 0,
                    marginBottom: 12,
                  }}
                >
                  Check every underwriting method this wholesale lender
                  will fund. Most accept DU + LPA but not Manual UW.
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontWeight: 800,
                    color: "#263366",
                    cursor: "pointer",
                    padding: "8px 0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={ausMethods.includes("du")}
                    onChange={(e) => toggleAusMethod("du", e.target.checked)}
                  />
                  <span>DU — Fannie Mae Desktop Underwriter</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontWeight: 800,
                    color: "#263366",
                    cursor: "pointer",
                    padding: "8px 0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={ausMethods.includes("lpa")}
                    onChange={(e) => toggleAusMethod("lpa", e.target.checked)}
                  />
                  <span>LPA — Freddie Mac Loan Product Advisor</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontWeight: 800,
                    color: "#263366",
                    cursor: "pointer",
                    padding: "8px 0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={ausMethods.includes("manual")}
                    onChange={(e) => toggleAusMethod("manual", e.target.checked)}
                  />
                  <span>Manual Underwriting</span>
                </label>
              </div>

              {renderProductSection(
                "Agency Products",
                groupedProductTypes.agency,
                "#EEF6FF"
              )}

              {renderProductSection(
                "Government Products",
                groupedProductTypes.government,
                "#EEFDF3"
              )}

              {renderProductSection(
                "Non-QM Products",
                groupedProductTypes.non_qm,
                "#FFF7ED"
              )}

              {renderProductSection(
                "Other Products",
                groupedProductTypes.other,
                "#F5F3FF"
              )}

              <div
                style={{
                  marginTop: 22,
                  border: "1px solid #D9E1EC",
                  borderRadius: 18,
                  background: "#FAFCFF",
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    color: "#263366",
                    marginBottom: 12,
                  }}
                >
                  Add Custom Product Type
                </div>

                <input
                  value={customProductName}
                  onChange={(e) => setCustomProductName(e.target.value)}
                  placeholder="Example: 1-Year Tax Return Only"
                  style={inputStyle}
                />

                <label style={{ ...labelStyle, marginTop: 14 }}>Category</label>
                <select
                  value={customProductCategory}
                  onChange={(e) =>
                    setCustomProductCategory(
                      e.target.value as "agency" | "government" | "non_qm" | "other"
                    )
                  }
                  style={singleSelectStyle}
                >
                  <option value="agency">Agency</option>
                  <option value="government">Government</option>
                  <option value="non_qm">Non-QM</option>
                  <option value="other">Other</option>
                </select>

                <button
                  type="button"
                  onClick={addCustomProduct}
                  style={{
                    marginTop: 14,
                    width: "100%",
                    border: "1px solid #263366",
                    borderRadius: 14,
                    background: "#FFFFFF",
                    color: "#263366",
                    padding: "14px 16px",
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  Add Custom Product
                </button>

                <div style={{ ...helperTextStyle, marginTop: 10 }}>
                  Custom products added here can be selected immediately for this lender and can
                  later be promoted into reusable platform-wide options through the admin API.
                </div>
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

                      <div style={{ color: "#526581", fontSize: 16, marginBottom: 8 }}>
                        All States: {(lender.states || []).join(", ") || "—"}
                      </div>

                      <div style={{ color: "#526581", fontSize: 15, marginBottom: 6 }}>
                        <strong>Owner-Occupied:</strong>{" "}
                        {(lender.owner_occupied_states || []).join(", ") || "—"}
                      </div>

                      <div style={{ color: "#526581", fontSize: 15 }}>
                        <strong>Non-Owner-Occupied:</strong>{" "}
                        {(lender.non_owner_occupied_states || []).join(", ") || "—"}
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
  boxSizing: "border-box",
};

const singleSelectStyle: React.CSSProperties = {
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
  boxSizing: "border-box",
};

const helperTextStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#6B7A90",
  fontSize: 14,
  lineHeight: 1.5,
};
