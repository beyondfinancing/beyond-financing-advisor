"use client";

import { useState } from "react";

export default function LendersPage() {
  const [form, setForm] = useState({
    name: "",
    channel: "",
    states: ""
  });

  const createLender = async () => {
    const response = await fetch("/api/admin/lenders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        states: form.states.split(",").map(s => s.trim())
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data?.error || "Failed to create lender.");
      return;
    }

    alert("Lender created");

    setForm({
      name: "",
      channel: "",
      states: ""
    });
  };

  return (
    <main style={{ padding: 40 }}>
      <h1>Create Lender</h1>

      <div style={{ display: "grid", gap: 12, maxWidth: 500 }}>
        <input
          placeholder="Lender Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <input
          placeholder="Channel (Retail, Wholesale, Correspondent)"
          value={form.channel}
          onChange={(e) => setForm({ ...form, channel: e.target.value })}
        />

        <input
          placeholder="States (comma separated, ex: MA, NH, FL)"
          value={form.states}
          onChange={(e) => setForm({ ...form, states: e.target.value })}
        />

        <button onClick={createLender}>Create</button>
      </div>
    </main>
  );
}
