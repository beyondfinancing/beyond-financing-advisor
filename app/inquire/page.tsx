"use client";

import React, { useState } from "react";

export default function InquirePage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    nmls: "",
    notes: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate() {
    if (!form.name.trim()) return "Full name is required.";
    if (!form.email.trim()) return "Email is required.";
    if (!form.phone.trim()) return "Phone number is required.";
    if (!form.nmls.trim()) return "NMLS # is required.";

    return "";
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");

    try {
      await fetch("/api/inquire", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      setSuccess("Request submitted. We will contact you shortly.");
      setForm({
        name: "",
        email: "",
        phone: "",
        nmls: "",
        notes: "",
      });
    } catch {
      setError("Unable to submit request.");
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <h1 style={styles.title}>
          Request Access to Beyond Intelligence™
        </h1>

        <p style={styles.subtitle}>
          This system is designed for mortgage professionals who want a structured,
          scalable approach to borrower advisory and execution.
        </p>

        <div style={styles.card}>
          <input
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            style={styles.input}
          />

          <input
            placeholder="Email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            style={styles.input}
          />

          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            style={styles.input}
          />

          <input
            placeholder="NMLS #"
            value={form.nmls}
            onChange={(e) => handleChange("nmls", e.target.value)}
            style={styles.input}
          />

          <textarea
            placeholder="What caught your attention or how do you see yourself using this system?"
            value={form.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            style={styles.textarea}
          />

          <button onClick={handleSubmit} style={styles.button}>
            Request Access
          </button>

          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}
        </div>
      </div>
    </main>
  );
}

const styles: any = {
  page: {
    minHeight: "100vh",
    background: "#F3F6FB",
    fontFamily: "Inter",
  },
  wrap: {
    maxWidth: 700,
    margin: "0 auto",
    padding: "40px 20px",
  },
  title: {
    fontSize: 32,
    fontWeight: 900,
    marginBottom: 10,
  },
  subtitle: {
    marginBottom: 20,
    color: "#64748B",
  },
  card: {
    background: "#fff",
    padding: 20,
    borderRadius: 20,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  input: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #CBD5E1",
  },
  textarea: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #CBD5E1",
    minHeight: 100,
  },
  button: {
    background: "#263366",
    color: "#fff",
    padding: 14,
    borderRadius: 12,
    fontWeight: 900,
    border: "none",
  },
  error: {
    color: "red",
  },
  success: {
    color: "green",
  },
};
