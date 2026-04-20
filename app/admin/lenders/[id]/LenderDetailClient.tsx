"use client";

import React, { useMemo, useState } from "react";

type ProductAssignmentInput = {
  productId: string;
  productName: string;
  categories: string[];
};

type ExclusiveProductInput = {
  id: string;
  name: string;
  category: string | null;
};

type Props = {
  lenderId: string;
  initialName: string;
  initialChannels: string[];
  initialLegacyStates: string[];
  initialOwnerOccupiedStates: string[];
  initialNonOwnerOccupiedStates: string[];
  initialNotes?: string;
  initialProductAssignments?: ProductAssignmentInput[];
  initialCustomProductTypes?: ExclusiveProductInput[];
};

type ProductDefinition = {
  id: string;
  name: string;
  category: string;
};

const CHANNEL_OPTIONS = ["Retail", "Wholesale", "Correspondent"];

const STATE_OPTIONS = [
  "AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","IA","ID","IL","IN",
  "KS","KY","LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ",
  "NM","NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA",
  "WI","WV","WY",
];

const BUILT_IN_PRODUCTS: ProductDefinition[] = [
  { id: "conventional", name: "Conventional", category: "agency" },

  { id: "fha", name: "FHA", category: "government" },
  { id: "va", name: "VA", category: "government" },
  { id: "usda", name: "USDA", category: "government" },

  { id: "heloc", name: "HELOC", category: "equity" },

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

function normalizeStringArray(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeStateArray(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim().toUpperCase())
        .filter(Boolean)
    )
  ).sort();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function prettyCategoryLabel(category: string | null | undefined) {
  if (!category) return "Uncategorized";

  const map: Record<string, string> = {
    agency: "Agency Products",
    government: "Government Products",
    equity: "Second Lien / Equity Products",
    non_qm: "Non-QM Products",
    exclusive: "Exclusive Products",
    custom: "Exclusive Products",
  };

  return map[category] || category;
}

function getSelectedValues(event: React.ChangeEvent<HTMLSelectElement>) {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

async function saveLenderDetail(
  lenderId: string,
  payload: Record<string, unknown>
) {
  const url = `/api/admin/lenders/${lenderId}`;
  const methods = ["PUT", "PATCH"];
  let lastError = "Failed to save lender.";

  for (const method of methods) {
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");
      const data = isJson ? await response.json() : null;

      if (response.ok) return data;

      lastError = String(
        data?.error || data?.message || `Request failed with ${method}.`
      );
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : `Request failed with ${method}.`;
    }
  }

  throw new Error(lastError);
}

export default function LenderDetailClient({
  lenderId,
  initialName,
  initialChannels,
  initialLegacyStates,
  initialOwnerOccupiedStates,
  initialNonOwnerOccupiedStates,
  initialNotes = "",
  initialProductAssignments = [],
  initialCustomProductTypes = [],
}: Props) {
  const [name, setName] = useState(initialName);
  const [channels, setChannels] = useState<string[]>(
    normalizeStringArray(initialChannels)
  );
  const [ownerOccupiedStates, setOwnerOccupiedStates] = useState<string[]>(
    normalizeStateArray(initialOwnerOccupiedStates)
  );
  const [nonOwnerOccupiedStates, setNonOwnerOccupiedStates] = useState<string[]>(
    normalizeStateArray(initialNonOwnerOccupiedStates)
  );
  const [legacyStates, setLegacyStates] = useState<string[]>(
    normalizeStateArray(initialLegacyStates)
  );
  const [notes, setNotes] = useState(initialNotes);

  const [productAssignments, setProductAssignments] = useState<
    ProductAssignmentInput[]
  >(
    initialProductAssignments.map((item) => ({
      productId: String(item.productId ?? "").trim(),
      productName: String(item.productName ?? "").trim(),
      categories: normalizeStringArray(item.categories || []),
    }))
  );

  const [exclusiveProducts, setExclusiveProducts] = useState<
    ExclusiveProductInput[]
  >(
    initialCustomProductTypes.map((item) => ({
      id: String(item.id ?? "").trim(),
      name: String(item.name ?? "").trim(),
      category:
        item.category === null || item.category === undefined
          ? null
          : String(item.category).trim() || null,
    }))
  );

  const [exclusiveProductName, setExclusiveProductName] = useState("");
  const [exclusiveProductCategory, setExclusiveProductCategory] =
    useState<string>("non_qm");

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const assignmentMap = useMemo(() => {
    const map = new Map<string, ProductAssignmentInput>();
    for (const item of productAssignments) {
      map.set(item.productId, item);
    }
    return map;
  }, [productAssignments]);

  const totalUniqueStates = useMemo(() => {
    return Array.from(
      new Set([...ownerOccupiedStates, ...nonOwnerOccupiedStates])
    ).length;
  }, [ownerOccupiedStates, nonOwnerOccupiedStates]);

  function syncLegacyStates(ownerStates: string[], nonOwnerStates: string[]) {
    return normalizeStateArray([...ownerStates, ...nonOwnerStates]);
  }

  function handleOwnerOccupiedChange(
    event: React.ChangeEvent<HTMLSelectElement>
  ) {
    const nextOwner = normalizeStateArray(getSelectedValues(event));
    setOwnerOccupiedStates(nextOwner);
    setLegacyStates(syncLegacyStates(nextOwner, nonOwnerOccupiedStates));
  }

  function handleNonOwnerOccupiedChange(
    event: React.ChangeEvent<HTMLSelectElement>
  ) {
    const nextNonOwner = normalizeStateArray(getSelectedValues(event));
    setNonOwnerOccupiedStates(nextNonOwner);
    setLegacyStates(syncLegacyStates(ownerOccupiedStates, nextNonOwner));
  }

  function handleChannelsChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setChannels(normalizeStringArray(getSelectedValues(event)));
  }

  function toggleBuiltInProduct(product: ProductDefinition) {
    setProductAssignments((prev) => {
      const exists = prev.some((item) => item.productId === product.id);

      if (exists) {
        return prev.filter((item) => item.productId !== product.id);
      }

      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          categories: [product.category],
        },
      ];
    });
  }

  function addExclusiveProduct() {
    const trimmedName = exclusiveProductName.trim();

    if (!trimmedName) {
      setErrorMessage("Exclusive product name is required.");
      setSuccessMessage("");
      return;
    }

    const idBase = slugify(trimmedName);
    if (!idBase) {
      setErrorMessage("Enter a valid exclusive product name.");
      setSuccessMessage("");
      return;
    }

    const nextId = `exclusive_${idBase}`;

    const existsInExclusive = exclusiveProducts.some((item) => item.id === nextId);
    const existsInBuiltIn = BUILT_IN_PRODUCTS.some((item) => item.id === nextId);

    if (existsInExclusive || existsInBuiltIn) {
      setErrorMessage("An exclusive product with this name already exists.");
      setSuccessMessage("");
      return;
    }

    const nextExclusive: ExclusiveProductInput = {
      id: nextId,
      name: trimmedName,
      category: exclusiveProductCategory || "exclusive",
    };

    setExclusiveProducts((prev) => [...prev, nextExclusive]);
    setProductAssignments((prev) => [
      ...prev,
      {
        productId: nextExclusive.id,
        productName: nextExclusive.name,
        categories: [nextExclusive.category || "exclusive"],
      },
    ]);

    setExclusiveProductName("");
    setExclusiveProductCategory("non_qm");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function toggleExclusiveProductAssignment(item: ExclusiveProductInput) {
    setProductAssignments((prev) => {
      const exists = prev.some((entry) => entry.productId === item.id);

      if (exists) {
        return prev.filter((entry) => entry.productId !== item.id);
      }

      return [
        ...prev,
        {
          productId: item.id,
          productName: item.name,
          categories: [item.category || "exclusive"],
        },
      ];
    });
  }

  function removeExclusiveProduct(item: ExclusiveProductInput) {
    setExclusiveProducts((prev) => prev.filter((entry) => entry.id !== item.id));
    setProductAssignments((prev) =>
      prev.filter((entry) => entry.productId !== item.id)
    );
  }

  async function handleSave() {
    setSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const normalizedOwner = normalizeStateArray(ownerOccupiedStates);
      const normalizedNonOwner = normalizeStateArray(nonOwnerOccupiedStates);
      const normalizedLegacy = syncLegacyStates(
        normalizedOwner,
        normalizedNonOwner
      );

      const payload = {
        name: name.trim(),
        channels: normalizeStringArray(channels),
        ownerOccupiedStates: normalizedOwner,
        nonOwnerOccupiedStates: normalizedNonOwner,
        states: normalizedLegacy,
        notes: notes.trim(),
        productAssignments: productAssignments.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          categories: normalizeStringArray(item.categories),
        })),
        customProductTypes: exclusiveProducts.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
        })),
      };

      await saveLenderDetail(lenderId, payload);

      setOwnerOccupiedStates(normalizedOwner);
      setNonOwnerOccupiedStates(normalizedNonOwner);
      setLegacyStates(normalizedLegacy);
      setChannels(normalizeStringArray(channels));
      setSuccessMessage("Saved successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save lender."
      );
    } finally {
      setSaving(false);
    }
  }

  const groupedBuiltInProducts = useMemo(() => {
    const groups: Record<string, ProductDefinition[]> = {
      agency: [],
      government: [],
      equity: [],
      non_qm: [],
    };

    for (const product of BUILT_IN_PRODUCTS) {
      groups[product.category] = groups[product.category] || [];
      groups[product.category].push(product);
    }

    return groups;
  }, []);

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <section>
        <h2 style={sectionTitleStyle}>Edit Lender</h2>

        <label style={labelStyle}>Lender Name</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Lender Name"
          style={inputStyle}
        />

        <label style={{ ...labelStyle, marginTop: 18 }}>Channels</label>
        <select
          multiple
          value={channels}
          onChange={handleChannelsChange}
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

        <label style={{ ...labelStyle, marginTop: 18 }}>
          Owner-Occupied States
        </label>
        <select
          multiple
          value={ownerOccupiedStates}
          onChange={handleOwnerOccupiedChange}
          style={multiSelectStyle}
        >
          {STATE_OPTIONS.map((state) => (
            <option key={`owner-${state}`} value={state}>
              {state}
            </option>
          ))}
        </select>
        <div style={helperTextStyle}>
          States where this lender can do owner-occupied lending.
        </div>

        <label style={{ ...labelStyle, marginTop: 18 }}>
          Non-Owner-Occupied States
        </label>
        <select
          multiple
          value={nonOwnerOccupiedStates}
          onChange={handleNonOwnerOccupiedChange}
          style={multiSelectStyle}
        >
          {STATE_OPTIONS.map((state) => (
            <option key={`nonowner-${state}`} value={state}>
              {state}
            </option>
          ))}
        </select>
        <div style={helperTextStyle}>
          States where this lender can do non-owner-occupied lending.
        </div>

        <div style={metricBoxStyle}>
          <strong>Total unique states selected:</strong> {totalUniqueStates}
        </div>

        <label style={{ ...labelStyle, marginTop: 18 }}>Notes</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Internal notes, overlays, relationship details, or lender-specific comments."
          rows={5}
          style={textareaStyle}
        />
      </section>

      <section>
        <div style={pillLabelStyle}>Shared Agency Products</div>
        <div style={productGridStyle}>
          {groupedBuiltInProducts.agency.map((product) => {
            const checked = assignmentMap.has(product.id);

            return (
              <label key={product.id} style={productCardStyle}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleBuiltInProduct(product)}
                />
                <span style={productNameStyle}>{product.name}</span>
              </label>
            );
          })}
        </div>

        <div style={{ ...pillLabelStyle, marginTop: 18 }}>
          Shared Government Products
        </div>
        <div style={productGridStyle}>
          {groupedBuiltInProducts.government.map((product) => {
            const checked = assignmentMap.has(product.id);

            return (
              <label key={product.id} style={productCardStyle}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleBuiltInProduct(product)}
                />
                <span style={productNameStyle}>{product.name}</span>
              </label>
            );
          })}
        </div>

        <div style={{ ...pillLabelStyle, marginTop: 18 }}>
          Shared Second Lien / Equity Products
        </div>
        <div style={productGridStyle}>
          {groupedBuiltInProducts.equity.map((product) => {
            const checked = assignmentMap.has(product.id);

            return (
              <label key={product.id} style={productCardStyle}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleBuiltInProduct(product)}
                />
                <span style={productNameStyle}>{product.name}</span>
              </label>
            );
          })}
        </div>

        <div style={{ ...pillLabelStyle, marginTop: 18 }}>
          Shared Non-QM Products
        </div>
        <div style={productGridStyle}>
          {groupedBuiltInProducts.non_qm.map((product) => {
            const checked = assignmentMap.has(product.id);

            return (
              <label key={product.id} style={productCardStyle}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleBuiltInProduct(product)}
                />
                <span style={productNameStyle}>{product.name}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section style={customBoxStyle}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "#263366" }}>
          Add Exclusive Product
        </h3>

        <input
          value={exclusiveProductName}
          onChange={(event) => setExclusiveProductName(event.target.value)}
          placeholder="Example: Dual Core"
          style={inputStyle}
        />

        <label style={{ ...labelStyle, marginTop: 16 }}>Category</label>
        <select
          value={exclusiveProductCategory}
          onChange={(event) => setExclusiveProductCategory(event.target.value)}
          style={inputStyle}
        >
          <option value="non_qm">Non-QM</option>
          <option value="agency">Agency</option>
          <option value="government">Government</option>
          <option value="equity">Second Lien / Equity</option>
          <option value="exclusive">Exclusive</option>
        </select>

        <button
          type="button"
          onClick={addExclusiveProduct}
          style={secondaryButtonStyle}
        >
          Add Exclusive Product
        </button>

        <div style={{ ...helperTextStyle, marginTop: 12 }}>
          Exclusive products belong to this lender only. If a product later
          becomes reusable across multiple lenders, it should be promoted into
          the shared product catalog.
        </div>

        {exclusiveProducts.length > 0 && (
          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            {exclusiveProducts.map((item) => {
              const assigned = assignmentMap.has(item.id);

              return (
                <div key={item.id} style={customItemStyle}>
                  <div>
                    <div style={{ fontWeight: 800, color: "#263366" }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 13, color: "#6A7A94" }}>
                      {prettyCategoryLabel(item.category)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => toggleExclusiveProductAssignment(item)}
                      style={miniOutlineButtonStyle}
                    >
                      {assigned ? "Unassign" : "Assign"}
                    </button>

                    <button
                      type="button"
                      onClick={() => removeExclusiveProduct(item)}
                      style={miniDangerButtonStyle}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <label style={labelStyle}>Legacy States Column</label>
        <select
          multiple
          value={legacyStates}
          disabled
          style={{
            ...multiSelectStyle,
            background: "#F8FBFF",
            borderColor: "#CFE0F2",
          }}
        >
          {legacyStates.map((state) => (
            <option key={`legacy-${state}`} value={state}>
              {state}
            </option>
          ))}
        </select>
        <div style={helperTextStyle}>
          This is kept in sync for backward compatibility and summary display.
        </div>
      </section>

      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            ...primaryButtonStyle,
            opacity: saving ? 0.7 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        {successMessage ? (
          <div style={successTextStyle}>{successMessage}</div>
        ) : null}

        {errorMessage ? <div style={errorTextStyle}>{errorMessage}</div> : null}
      </div>
    </div>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 18px",
  fontSize: 18,
  color: "#263366",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontSize: 14,
  fontWeight: 800,
  color: "#263366",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #C9D8E8",
  borderRadius: 16,
  padding: "14px 16px",
  fontSize: 15,
  color: "#263366",
  background: "#FFFFFF",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #C9D8E8",
  borderRadius: 16,
  padding: "14px 16px",
  fontSize: 15,
  color: "#263366",
  background: "#FFFFFF",
  resize: "vertical",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const multiSelectStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 110,
  boxSizing: "border-box",
  border: "1px solid #C9D8E8",
  borderRadius: 16,
  padding: 10,
  fontSize: 15,
  color: "#263366",
  background: "#FFFFFF",
};

const helperTextStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 13,
  lineHeight: 1.6,
  color: "#6A7A94",
};

const metricBoxStyle: React.CSSProperties = {
  marginTop: 16,
  padding: "14px 16px",
  borderRadius: 16,
  background: "#F8FBFF",
  border: "1px solid #D9E1EC",
  color: "#52627A",
};

const pillLabelStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 12px",
  borderRadius: 999,
  background: "#EEF3FA",
  color: "#263366",
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 12,
};

const productGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const productCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  padding: "14px 16px",
  border: "1px solid #D9E1EC",
  borderRadius: 18,
  background: "#FFFFFF",
  cursor: "pointer",
};

const productNameStyle: React.CSSProperties = {
  fontWeight: 800,
  color: "#263366",
  fontSize: 15,
};

const customBoxStyle: React.CSSProperties = {
  border: "1px solid #D9E1EC",
  borderRadius: 20,
  padding: 16,
  background: "#FBFCFE",
};

const customItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
  alignItems: "center",
  border: "1px solid #D9E1EC",
  borderRadius: 16,
  padding: "14px 16px",
  background: "#FFFFFF",
};

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: 18,
  padding: "16px 20px",
  background: "#2D3B7A",
  color: "#FFFFFF",
  fontSize: 16,
  fontWeight: 800,
};

const secondaryButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 14,
  border: "1px solid #2D3B7A",
  borderRadius: 16,
  padding: "14px 16px",
  background: "#FFFFFF",
  color: "#2D3B7A",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
};

const miniOutlineButtonStyle: React.CSSProperties = {
  border: "1px solid #2D3B7A",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#FFFFFF",
  color: "#2D3B7A",
  fontWeight: 800,
  cursor: "pointer",
};

const miniDangerButtonStyle: React.CSSProperties = {
  border: "1px solid #D92D20",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#FFFFFF",
  color: "#D92D20",
  fontWeight: 800,
  cursor: "pointer",
};

const successTextStyle: React.CSSProperties = {
  marginTop: 12,
  color: "#15803D",
  fontWeight: 700,
};

const errorTextStyle: React.CSSProperties = {
  marginTop: 12,
  color: "#B42318",
  fontWeight: 700,
};
