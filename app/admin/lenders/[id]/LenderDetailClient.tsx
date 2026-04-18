"use client";

import React, { useEffect, useState } from "react";

type Props = {
  lenderId: string;
  lenderName: string;
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

export default function LenderDetailClient({ lenderId, lenderName }: Props) {
  const [ownerStates, setOwnerStates] = useState<string[]>([]);
  const [nonOwnerStates, setNonOwnerStates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadStates();
  }, []);

  async function loadStates() {
    const res = await fetch(`/api/admin/lenders/${lenderId}`);
    const data = await res.json();

    const owner: string[] = [];
    const nonOwner: string[] = [];

    (data?.stateEligibility || []).forEach((row: any) => {
      if (row.eligibility_type === "owner_occupied") {
        owner.push(row.state_code);
      }
      if (row.eligibility_type === "non_owner_occupied") {
        nonOwner.push(row.state_code);
      }
    });

    setOwnerStates(owner);
    setNonOwnerStates(nonOwner);
  }

  function getValues(e: React.ChangeEvent<HTMLSelectElement>) {
    return Array.from(e.target.selectedOptions).map(o => o.value);
  }

  async function save() {
    setLoading(true);
    setMessage("");

    const res = await fetch(`/api/admin/lenders/${lenderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerOccupiedStates: ownerStates,
        nonOwnerOccupiedStates: nonOwnerStates
      })
    });

    if (res.ok) {
      setMessage("Saved successfully");
    } else {
      setMessage("Error saving");
    }

    setLoading(false);
  }

  return (
    <div style={{ marginTop: 20 }}>
      <h2>State Eligibility</h2>

      <div style={{ display: "grid", gap: 20 }}>
        {/* OWNER OCC */}
        <div>
          <strong>Owner-Occupied States</strong>
          <select
            multiple
            value={ownerStates}
            onChange={(e) => setOwnerStates(getValues(e))}
            style={multiStyle}
          >
            {US_STATES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* NON OWNER */}
        <div>
          <strong>Non-Owner-Occupied States</strong>
          <select
            multiple
            value={nonOwnerStates}
            onChange={(e) => setNonOwnerStates(getValues(e))}
            style={multiStyle}
          >
            {US_STATES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <button onClick={save} style={btnStyle}>
        {loading ? "Saving..." : "Save Changes"}
      </button>

      {message && <div style={{ marginTop: 10 }}>{message}</div>}
    </div>
  );
}

const multiStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 120,
  borderRadius: 12,
  border: "1px solid #ccc",
  padding: 10,
  marginTop: 6
};

const btnStyle: React.CSSProperties = {
  marginTop: 20,
  padding: "12px 20px",
  background: "#263366",
  color: "white",
  border: "none",
  borderRadius: 10,
  cursor: "pointer"
};
