"use client";

import React, { useState } from "react";

type Props = {
  lenderId: string;
  initialName: string;
  initialChannels: string[];
  initialLegacyStates: string[];
  initialOwnerOccupiedStates: string[];
  initialNonOwnerOccupiedStates: string[];
};

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
];

const CHANNEL_OPTIONS = ["Retail", "Wholesale", "Correspondent"];

function getSelectedValues(e: React.ChangeEvent<HTMLSelectElement>) {
  return Array.from(e.target.selectedOptions).map((option) => option.value);
}

function normalizeStates(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim().toUpperCase())
        .filter(Boolean)
    )
  ).sort();
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
  const [channels, setChannels] = useState<string[]>(
    Array.isArray(initialChannels) ? initialChannels : []
  );
  const [ownerStates, setOwnerStates] = useState<string[]>(
    normalizeStates(initialOwnerOccupiedStates || [])
  );
  const [nonOwnerStates, setNonOwnerStates] = useState<string[]>(
    normalizeStates(initialNonOwnerOccupiedStates || [])
  );
  const [legacyStates, setLegacyStates] = useState<string[]>(
    normalizeStates(initialLegacyStates || [])
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setLoading(true);
    setMessage("");

    try {
      const mergedLegacyStates = normalizeStates([
        ...ownerStates,
        ...nonOwnerStates,
        ...legacyStates,
      ]);

      const res = await fetch(`/api/admin/lenders/${lenderId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          channels,
          states: mergedLegacyStates,
          ownerOccupiedStates: normalizeStates(ownerStates),
          nonOwnerOccupiedStates: normalizeStates(nonOwnerStates),
        }),
      });

      const result = await res.json().catch(() => null);

      if (!res.ok) {
        setMessage(result?.error ? `Error: ${result.error}` : "Error saving lender.");
        setLoading(false);
        return;
      }

      setLegacyStates(mergedLegacyStates);
      setMessage("Saved successfully.");
    } catch {
      setMessage("Error saving lender.");
    }

    setLoading(false);
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

      <div style={{ display: "grid", gap: 18 }}>
        <div>
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
            style={inputStyle}
            placeholder="Lender name"
          />
        </div>

        <div>
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
            style={multiStyle}
          >
            {CHANNEL_OPTIONS.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
          <div style={helpTextStyle}>
            Hold Ctrl on Windows or Command on Mac to select more than one.
          </div>
        </div>

        <div>
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
            value={ownerStates}
            onChange={(e) => setOwnerStates(getSelectedValues(e))}
            style={multiStyle}
          >
            {US_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>

        <div>
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
            value={nonOwnerStates}
            onChange={(e) => setNonOwnerStates(getSelectedValues(e))}
            style={multiStyle}
          >
            {US_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Legacy States Column
          </label>
          <select
            multiple
            value={legacyStates}
            onChange={(e) => setLegacyStates(getSelectedValues(e))}
            style={multiStyle}
          >
            {US_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          <div style={helpTextStyle}>
            This is kept in sync for backward compatibility and summary display.
          </div>
        </div>
      </div>

      <button onClick={save} style={btnStyle} disabled={loading}>
        {loading ? "Saving..." : "Save Changes"}
      </button>

      {message ? (
        <div
          style={{
            marginTop: 12,
            color: message.startsWith("Error") ? "#A33A2B" : "#1D6F42",
            fontWeight: 700,
          }}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 48,
  borderRadius: 12,
  border: "1px solid #C9D5E6",
  padding: "0 14px",
  fontSize: 16,
  color: "#263366",
  background: "#FFFFFF",
  boxSizing: "border-box",
};

const multiStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 140,
  borderRadius: 12,
  border: "1px solid #C9D5E6",
  padding: 10,
  fontSize: 16,
  color: "#263366",
  background: "#FFFFFF",
  boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
  marginTop: 20,
  padding: "14px 20px",
  background: "#0096C7",
  color: "#FFFFFF",
  border: "none",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 16,
};

const helpTextStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 13,
  color: "#6A7A94",
  lineHeight: 1.5,
};
