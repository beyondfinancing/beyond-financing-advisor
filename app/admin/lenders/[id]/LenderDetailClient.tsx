"use client";

import React, { useMemo, useState } from "react";

type Props = {
  lenderId: string;
  initialName: string;
  initialChannels: string[];
  initialLegacyStates: string[];
  initialOwnerOccupiedStates: string[];
  initialNonOwnerOccupiedStates: string[];
};

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
  "IA",
  "ID",
  "IL",
  "IN",
  "KS",
  "KY",
  "LA",
  "MA",
  "MD",
  "ME",
  "MI",
  "MN",
  "MO",
  "MS",
  "MT",
  "NC",
  "ND",
  "NE",
  "NH",
  "NJ",
  "NM",
  "NV",
  "NY",
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
  "VA",
  "VT",
  "WA",
  "WI",
  "WV",
  "WY",
  "DC",
];

const CHANNEL_OPTIONS = ["Retail", "Wholesale", "Correspondent"];

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid #C8D3E3",
    fontSize: 16,
    outline: "none",
    boxSizing: "border-box",
    minWidth: 0,
    background: "#FFFFFF",
    color: "#263366",
  };
}

function multiSelectStyle(height = 140): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #C8D3E3",
    fontSize: 16,
    outline: "none",
    boxSizing: "border-box",
    minWidth: 0,
    background: "#FFFFFF",
    color: "#263366",
    minHeight: height,
  };
}

function primaryButtonStyle(disabled = false): React.CSSProperties {
  return {
    width: "100%",
    background: "#0096C7",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 14,
    padding: "16px 20px",
    fontWeight: 800,
    fontSize: 18,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

function getSelectedValues(event: React.ChangeEvent<HTMLSelectElement>): string[] {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

export default function LenderDetailClient({
  lenderId,
  initialName,
  initialChannels,
  initialLegacyStates,
  initialOwnerOccupiedStates,
  initialNonOwnerOccupiedStates,
}: Props) {
  const [name, setName] = useState(initialName);
  const [channels, setChannels] = useState<string[]>(initialChannels);
  const [ownerOccupiedStates, setOwnerOccupiedStates] = useState<string[]>(
    initialOwnerOccupiedStates
  );
  const [nonOwnerOccupiedStates, setNonOwnerOccupiedStates] = useState<string[]>(
    initialNonOwnerOccupiedStates
  );
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const legacyStatesText = useMemo(() => {
    if (!initialLegacyStates?.length) return "—";
    return initialLegacyStates.join(", ");
  }, [initialLegacyStates]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(`/api/admin/lenders/${lenderId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          channels,
          ownerOccupiedStates,
          nonOwnerOccupiedStates,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save lender changes.");
      }

      setSuccessMessage("Lender details updated successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected error saving lender."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2
        style={{
          margin: "0 0 18px",
          fontSize: 18,
        }}
      >
        Edit Lender
      </h2>

      {successMessage ? (
        <div
          style={{
            marginBottom: 16,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid #9BD3AE",
            background: "#ECF9F0",
            color: "#1F6B3B",
            lineHeight: 1.6,
          }}
        >
          {successMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div
          style={{
            marginBottom: 16,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid #F0B4AF",
            background: "#FFF3F1",
            color: "#A33A2B",
            lineHeight: 1.6,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      <form onSubmit={handleSave}>
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Lender Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle()}
            placeholder="Lender name"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Channels
          </label>
          <select
            multiple
            value={channels}
            onChange={(e) => setChannels(getSelectedValues(e))}
            style={multiSelectStyle(130)}
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
              fontSize: 14,
              color: "#66758F",
              lineHeight: 1.5,
            }}
          >
            Hold Ctrl on Windows or Command on Mac to select more than one.
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Owner-Occupied States
          </label>
          <select
            multiple
            value={ownerOccupiedStates}
            onChange={(e) => setOwnerOccupiedStates(getSelectedValues(e))}
            style={multiSelectStyle(190)}
          >
            {US_STATES.map((state) => (
              <option key={`owner-${state}`} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Non-Owner-Occupied States
          </label>
          <select
            multiple
            value={nonOwnerOccupiedStates}
            onChange={(e) => setNonOwnerOccupiedStates(getSelectedValues(e))}
            style={multiSelectStyle(190)}
          >
            {US_STATES.map((state) => (
              <option key={`nonowner-${state}`} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            marginBottom: 18,
            fontSize: 14,
            color: "#66758F",
            lineHeight: 1.6,
          }}
        >
          This keeps lender eligibility structured for future matching logic.
          The legacy states column remains visible below for reference during
          transition.
        </div>

        <button type="submit" disabled={saving} style={primaryButtonStyle(saving)}>
          {saving ? "Saving Changes..." : "Save Changes"}
        </button>
      </form>

      <div
        style={{
          marginTop: 18,
          padding: "14px 16px",
          borderRadius: 14,
          border: "1px solid #D9E1EC",
          background: "#F8FAFD",
          color: "#5A6A84",
          lineHeight: 1.7,
        }}
      >
        <strong>Legacy States Column:</strong> {legacyStatesText}
      </div>
    </div>
  );
}
