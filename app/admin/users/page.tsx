"use client";

import { useState } from "react";

export default function UsersPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "Loan Officer",
    nmls: "",
  });

  const createUser = async () => {
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data?.error || "Failed to create user.");
      return;
    }

    alert("User created");
    setForm({
      name: "",
      email: "",
      role: "Loan Officer",
      nmls: "",
    });
  };

  return (
    <main style={{ padding: 40 }}>
      <h1>Create User</h1>

      <div style={{ display: "grid", gap: 12, maxWidth: 500 }}>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <input
          placeholder="NMLS"
          value={form.nmls}
          onChange={(e) => setForm({ ...form, nmls: e.target.value })}
        />

        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option>Loan Officer</option>
          <option>Loan Officer Assistant</option>
          <option>Processor</option>
          <option>Real Estate Agent</option>
        </select>

        <button onClick={createUser}>Create</button>
      </div>
    </main>
  );
}
