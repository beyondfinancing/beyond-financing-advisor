"use client";

import { useEffect, useState } from "react";

export default function ProgramsPage() {
  const [lenders, setLenders] = useState<any[]>([]);
  const [form, setForm] = useState({
    lender_id: "",
    name: "",
    min_credit: "",
    max_ltv: "",
    max_dti: "",
    occupancy: "",
    notes: ""
  });

  useEffect(() => {
    fetch("/api/lenders")
      .then(res => res.json())
      .then(data => setLenders(data.lenders));
  }, []);

  const createProgram = async () => {
    const response = await fetch("/api/admin/programs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...form,
        min_credit: Number(form.min_credit),
        max_ltv: Number(form.max_ltv),
        max_dti: Number(form.max_dti)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Error");
      return;
    }

    alert("Program created");
  };

  return (
    <main style={{ padding: 40 }}>
      <h1>Create Program</h1>

      <select onChange={(e) => setForm({ ...form, lender_id: e.target.value })}>
        <option>Select Lender</option>
        {lenders.map(l => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>

      <input placeholder="Program Name (DSCR, FHA, etc)"
        onChange={(e) => setForm({ ...form, name: e.target.value })} />

      <input placeholder="Min Credit"
        onChange={(e) => setForm({ ...form, min_credit: e.target.value })} />

      <input placeholder="Max LTV"
        onChange={(e) => setForm({ ...form, max_ltv: e.target.value })} />

      <input placeholder="Max DTI"
        onChange={(e) => setForm({ ...form, max_dti: e.target.value })} />

      <input placeholder="Occupancy"
        onChange={(e) => setForm({ ...form, occupancy: e.target.value })} />

      <input placeholder="Notes"
        onChange={(e) => setForm({ ...form, notes: e.target.value })} />

      <button onClick={createProgram}>Create Program</button>
    </main>
  );
}
