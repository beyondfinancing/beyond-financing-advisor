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

type SharedProductCategory =
  | "agency"
  | "government"
  | "second_lien"
  | "non_qm"
  | string;

type SharedProductType = {
  id: string;
  name: string;
  category: SharedProductCategory;
};

type Props = {
  lenderId: string;
  initialName: string;
  initialChannels: string[];
  initialLegacyStates: string[];
  initialOwnerOccupiedStates: string[];
  initialNonOwnerOccupiedStates: string[];
  initialSecondHomeStates?: string[];
  initialHelocStates?: string[];
  initialNotes?: string;
  initialProductAssignments?: ProductAssignmentInput[];
  initialCustomProductTypes?: ExclusiveProductInput[];
};

const CHANNEL_OPTIONS = ["Retail", "Wholesale", "Correspondent"];

const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","IA","ID","IL","IN",
  "KS","KY","LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ",
  "NM","NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA",
  "WI","WV","WY",
];

const SHARED_PRODUCT_TYPES: SharedProductType[] = [
  { id: "conventional", name: "Conventional", category: "agency" },

  { id: "fha", name: "FHA", category: "government" },
  { id: "va", name: "VA", category: "government" },
  { id: "usda", name: "USDA", category: "government" },

  { id: "heloc", name: "HELOC", category: "second_lien" },

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

function normalizeStringArray(value: string[]) {
  return Array.from(
    new Set((value || []).map((x) => String(x ?? "").trim()).filter(Boolean))
  );
}

function normalizeStateArray(value: string[]) {
  return Array.from(
    new Set(
      (value || [])
        .map((x) => String(x ?? "").trim().toUpperCase())
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

function sectionLabel(category: string) {
  if (category === "agency") return "Shared Agency Products";
  if (category === "government") return "Shared Government Products";
  if (category === "second_lien") return "Shared Second Lien / Equity Products";
  if (category === "non_qm") return "Shared Non-QM Products";
  return "Shared Other Products";
}

function exclusiveCategoryLabel(category: string | null) {
  if (category === "agency") return "Agency Products";
  if (category === "government") return "Government Products";
  if (category === "second_lien") return "Second Lien / Equity Products";
  if (category === "non_qm") return "Non-QM Products";
  return "Other Products";
}

export default function LenderDetailClient({
  lenderId,
  initialName,
  initialChannels,
  initialLegacyStates,
  initialOwnerOccupiedStates,
  initialNonOwnerOccupiedStates,
  initialSecondHomeStates = [],
  initialHelocStates = [],
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
  const [secondHomeStates, setSecondHomeStates] = useState<string[]>(
    normalizeStateArray(initialSecondHomeStates)
  );
  const [helocStates, setHelocStates] = useState<string[]>(
    normalizeStateArray(initialHelocStates)
  );
  const [notes, setNotes] = useState(initialNotes);

  const [exclusiveProducts, setExclusiveProducts] = useState<ExclusiveProductInput[]>(
    (initialCustomProductTypes || []).map((item) => ({
      id: String(item.id ?? "").trim(),
      name: String(item.name ?? "").trim(),
      category:
        item.category === null || item.category === undefined
          ? null
          : String(item.category).trim() || null,
    }))
  );

  const [exclusiveName, setExclusiveName] = useState("");
  const [exclusiveCategory, setExclusiveCategory] = useState("non_qm");

  const exclusiveIdSet = useMemo(() => {
    return new Set(exclusiveProducts.map((item) => item.id));
  }, [exclusiveProducts]);

  const [sharedAssignedProductIds, setSharedAssignedProductIds] = useState<string[]>(
    normalizeStringArray(
      (initialProductAssignments || [])
        .filter((item) => !exclusiveIdSet.has(item.productId))
        .map((item) => item.productId)
    )
  );

  const groupedSharedProducts = useMemo(() => {
    const groups = new Map<string, SharedProductType[]>();

    for (const product of SHARED_PRODUCT_TYPES) {
      const key = product.category || "other";
      const existing = groups.get(key) || [];
      existing.push(product);
      groups.set(key, existing);
    }

    return Array.from(groups.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
  }, []);

  const mergedLegacyStates = useMemo(() => {
    return normalizeStateArray([
      ...ownerOccupiedStates,
      ...nonOwnerOccupiedStates,
      ...secondHomeStates,
      ...helocStates,
      ...initialLegacyStates,
    ]);
  }, [
    ownerOccupiedStates,
    nonOwnerOccupiedStates,
    secondHomeStates,
    helocStates,
    initialLegacyStates,
  ]);

  const uniqueStateCount = useMemo(() => {
    return new Set([
      ...ownerOccupiedStates,
      ...nonOwnerOccupiedStates,
      ...secondHomeStates,
      ...helocStates,
    ]).size;
  }, [ownerOccupiedStates, nonOwnerOccupiedStates, secondHomeStates, helocStates]);

  const sharedAssignments = useMemo<ProductAssignmentInput[]>(() => {
    return SHARED_PRODUCT_TYPES
      .filter((product) => sharedAssignedProductIds.includes(product.id))
      .map((product) => ({
        productId: product.id,
        productName: product.name,
        categories: [product.category],
      }));
  }, [sharedAssignedProductIds]);

  const allAssignments = useMemo<ProductAssignmentInput[]>(() => {
    const exclusiveAssignments = exclusiveProducts.map((product) => ({
      productId: product.id,
      productName: product.name,
      categories: [product.category || "non_qm"],
    }));

    return [...sharedAssignments, ...exclusiveAssignments];
  }, [sharedAssignments, exclusiveProducts]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  function handleMultiSelect(
    event: React.ChangeEvent<HTMLSelectElement>,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    const selected = Array.from(event.target.selectedOptions).map(
      (option) => option.value
    );
    setter(normalizeStateArray(selected));
  }

  function handleChannelSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    const selected = Array.from(event.target.selectedOptions).map(
      (option) => option.value
    );
    setChannels(normalizeStringArray(selected));
  }

  function toggleSharedProduct(productId: string) {
    setSharedAssignedProductIds((current) => {
      if (current.includes(productId)) {
        return current.filter((id) => id !== productId);
      }
      return [...current, productId];
    });
  }

  function addExclusiveProduct() {
    const cleanName = exclusiveName.trim();
    if (!cleanName) return;

    const existsShared = SHARED_PRODUCT_TYPES.some(
      (product) => product.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (existsShared) {
      setMessage(
        `A shared product named "${cleanName}" already exists. Assign it from the shared product list instead.`
      );
      setMessageType("error");
      return;
    }

    const existsExclusive = exclusiveProducts.some(
      (product) => product.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (existsExclusive) {
      setMessage(`Exclusive product "${cleanName}" already exists for this lender.`);
      setMessageType("error");
      return;
    }

    const normalizedId = `exclusive_${slugify(cleanName)}`;
    if (!normalizedId.replace("exclusive_", "").trim()) {
      setMessage("Please enter a valid exclusive product name.");
      setMessageType("error");
      return;
    }

    setExclusiveProducts((current) => [
      ...current,
      {
        id: normalizedId,
        name: cleanName,
        category: exclusiveCategory,
      },
    ]);

    setExclusiveName("");
    setMessage("");
    setMessageType("");
  }

  function removeExclusiveProduct(idToRemove: string) {
    setExclusiveProducts((current) =>
      current.filter((item) => item.id !== idToRemove)
    );
  }

  async function promoteExclusiveProduct(product: ExclusiveProductInput) {
    setSaving(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch("/api/admin/products/promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lenderId,
          productName: product.name,
          category: product.category || "non_qm",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Could not promote product.");
      }

      setExclusiveProducts((current) =>
        current.filter((item) => item.id !== product.id)
      );

      if (data?.promoted?.sharedProductId) {
        setSharedAssignedProductIds((current) =>
          normalizeStringArray([...current, String(data.promoted.sharedProductId)])
        );
      }

      setMessage(`Promoted "${product.name}" to shared product catalog.`);
      setMessageType("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not promote product.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function saveAll() {
    setSaving(true);
    setMessage("");
    setMessageType("");

    try {
      const payload = {
        name: name.trim(),
        channels: normalizeStringArray(channels),
        states: mergedLegacyStates,
        ownerOccupiedStates: normalizeStateArray(ownerOccupiedStates),
        nonOwnerOccupiedStates: normalizeStateArray(nonOwnerOccupiedStates),
        secondHomeStates: normalizeStateArray(secondHomeStates),
        helocStates: normalizeStateArray(helocStates),
        notes: notes.trim(),
        productAssignments: allAssignments.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          categories: normalizeStringArray(item.categories),
        })),
        customProductTypes: exclusiveProducts.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
        })),
        sharedAssignedProductIds: normalizeStringArray(sharedAssignedProductIds),
        exclusiveProducts: exclusiveProducts.map((item) => ({
          name: item.name,
          category: item.category || "non_qm",
        })),
      };

      const response = await fetch(`/api/admin/lenders/${lenderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Request failed with PATCH.");
      }

      setMessage("Saved successfully.");
      setMessageType("success");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Request failed with PATCH."
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div>
        <h2 style={{ margin: "0 0 18px", fontSize: 18, color: "#263366" }}>
          Edit Lender
        </h2>

        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={labelStyle}>Lender Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Channels</label>
            <select
              multiple
              value={channels}
              onChange={handleChannelSelect}
              style={multiSelectStyle}
            >
              {CHANNEL_OPTIONS.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
            <div style={helperStyle}>
              Hold Ctrl on Windows or Command on Mac to select more than one.
            </div>
          </div>

          <div>
            <label style={labelStyle}>Owner-Occupied States</label>
            <select
              multiple
              value={ownerOccupiedStates}
              onChange={(e) => handleMultiSelect(e, setOwnerOccupiedStates)}
              style={multiSelectStyle}
            >
              {ALL_STATES.map((state) => (
                <option key={`owner-${state}`} value={state}>
                  {state}
                </option>
              ))}
            </select>
            <div style={helperStyle}>
              States where this lender can do owner-occupied lending.
            </div>
          </div>

          <div>
            <label style={labelStyle}>Non-Owner-Occupied States</label>
            <select
              multiple
              value={nonOwnerOccupiedStates}
              onChange={(e) => handleMultiSelect(e, setNonOwnerOccupiedStates)}
              style={multiSelectStyle}
            >
              {ALL_STATES.map((state) => (
                <option key={`nonowner-${state}`} value={state}>
                  {state}
                </option>
              ))}
            </select>
            <div style={helperStyle}>
              States where this lender can do non-owner-occupied lending.
            </div>
          </div>

          <div>
            <label style={labelStyle}>Second-Home States</label>
            <select
              multiple
              value={secondHomeStates}
              onChange={(e) => handleMultiSelect(e, setSecondHomeStates)}
              style={multiSelectStyle}
            >
              {ALL_STATES.map((state) => (
                <option key={`secondhome-${state}`} value={state}>
                  {state}
                </option>
              ))}
            </select>
            <div style={helperStyle}>
              States where this lender can do second-home lending.
            </div>
          </div>

          <div>
            <label style={labelStyle}>HELOC / Second-Lien States</label>
            <select
              multiple
              value={helocStates}
              onChange={(e) => handleMultiSelect(e, setHelocStates)}
              style={multiSelectStyle}
            >
              {ALL_STATES.map((state) => (
                <option key={`heloc-${state}`} value={state}>
                  {state}
                </option>
              ))}
            </select>
            <div style={helperStyle}>
              States where this lender can originate HELOC or second-lien products.
            </div>
          </div>

          <div
            style={{
              border: "1px solid #D9E1EC",
              borderRadius: 16,
              padding: "14px 16px",
              fontWeight: 700,
              color: "#52627A",
              background: "#F9FBFE",
            }}
          >
            Total unique states selected: {uniqueStateCount}
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Internal notes, overlays, relationship details, or lender-specific comments."
              style={textareaStyle}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 18 }}>
        {groupedSharedProducts.map(([category, products]) => (
          <div key={category} style={{ display: "grid", gap: 10 }}>
            <div style={sectionPillStyle}>{sectionLabel(category)}</div>

            {products.map((product) => {
              const checked = sharedAssignedProductIds.includes(product.id);

              return (
                <label key={product.id} style={productRowStyle}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSharedProduct(product.id)}
                  />
                  <span style={{ fontWeight: 800, color: "#263366" }}>
                    {product.name}
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>

      <div
        style={{
          border: "1px solid #D9E1EC",
          borderRadius: 22,
          padding: 18,
          display: "grid",
          gap: 14,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, color: "#263366" }}>
          Add Exclusive Product
        </h3>

        <input
          value={exclusiveName}
          onChange={(e) => setExclusiveName(e.target.value)}
          placeholder="Example: Dual Core"
          style={inputStyle}
        />

        <div>
          <label style={labelStyle}>Category</label>
          <select
            value={exclusiveCategory}
            onChange={(e) => setExclusiveCategory(e.target.value)}
            style={inputStyle}
          >
            <option value="non_qm">Non-QM</option>
            <option value="agency">Agency</option>
            <option value="government">Government</option>
            <option value="second_lien">Second Lien / Equity</option>
          </select>
        </div>

        <button type="button" onClick={addExclusiveProduct} style={secondaryButtonStyle}>
          Add Exclusive Product
        </button>

        <div style={helperStyle}>
          Exclusive products belong to this lender only. If a product later becomes reusable across multiple lenders, it should be promoted into the shared product catalog.
        </div>

        {exclusiveProducts.length > 0 && (
          <div style={{ display: "grid", gap: 12 }}>
            {exclusiveProducts.map((product) => (
              <div key={product.id} style={exclusiveCardStyle}>
                <div>
                  <div style={{ fontWeight: 800, color: "#263366", fontSize: 16 }}>
                    {product.name}
                  </div>
                  <div style={{ color: "#6A7A94", fontSize: 14 }}>
                    {exclusiveCategoryLabel(product.category)}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginTop: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => promoteExclusiveProduct(product)}
                    style={smallBlueButtonStyle}
                  >
                    Promote to Shared
                  </button>

                  <button
                    type="button"
                    onClick={() => removeExclusiveProduct(product.id)}
                    style={smallDangerButtonStyle}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label style={labelStyle}>Legacy States Column</label>
        <select
          multiple
          value={mergedLegacyStates}
          disabled
          style={{
            ...multiSelectStyle,
            background: "#F8FBFF",
            color: "#7A8AA6",
            cursor: "not-allowed",
          }}
        >
          {mergedLegacyStates.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
        <div style={helperStyle}>
          This is kept in sync for backward compatibility and summary display.
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={saveAll}
          disabled={saving}
          style={{
            ...primaryButtonStyle,
            opacity: saving ? 0.7 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        {message ? (
          <div
            style={{
              marginTop: 12,
              color: messageType === "error" ? "#C43221" : "#14803C",
              fontWeight: 800,
            }}
          >
            {message}
          </div>
        ) : null}
      </div>

      <style jsx>{`
        input,
        textarea,
        select,
        button {
          font-family: Arial, Helvetica, sans-serif;
        }
      `}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 800,
  color: "#263366",
  marginBottom: 8,
};

const helperStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
  color: "#6A7A94",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #BED0E6",
  borderRadius: 18,
  background: "#FFFFFF",
  color: "#263366",
  padding: "14px 16px",
  fontSize: 16,
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #BED0E6",
  borderRadius: 18,
  background: "#FFFFFF",
  color: "#263366",
  padding: "14px 16px",
  fontSize: 16,
  outline: "none",
  resize: "vertical",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const multiSelectStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 110,
  boxSizing: "border-box",
  border: "1px solid #BED0E6",
  borderRadius: 18,
  background: "#FFFFFF",
  color: "#263366",
  padding: 12,
  fontSize: 16,
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#2E3E86",
  color: "#FFFFFF",
  border: "none",
  borderRadius: 18,
  padding: "16px 20px",
  fontWeight: 800,
  fontSize: 16,
  cursor: "pointer",
  width: "100%",
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "#FFFFFF",
  color: "#2E3E86",
  border: "2px solid #2E3E86",
  borderRadius: 18,
  padding: "14px 18px",
  fontWeight: 800,
  fontSize: 16,
  cursor: "pointer",
};

const sectionPillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 14px",
  borderRadius: 999,
  background: "#EEF3FB",
  color: "#2E3E86",
  fontWeight: 800,
  fontSize: 14,
  width: "fit-content",
};

const productRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "16px 18px",
  border: "1px solid #D9E1EC",
  borderRadius: 18,
  background: "#FFFFFF",
  cursor: "pointer",
};

const exclusiveCardStyle: React.CSSProperties = {
  border: "1px solid #D9E1EC",
  borderRadius: 18,
  padding: 16,
  background: "#FFFFFF",
};

const smallBlueButtonStyle: React.CSSProperties = {
  background: "#0096C7",
  color: "#FFFFFF",
  border: "none",
  borderRadius: 14,
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const smallDangerButtonStyle: React.CSSProperties = {
  background: "#FFFFFF",
  color: "#DC2626",
  border: "2px solid #F87171",
  borderRadius: 14,
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};
