"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function TeamResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!token) {
      setStatus("Missing reset token.");
      return;
    }

    if (password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const res = await fetch("/api/team-auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(data?.error || "Password reset failed.");
        return;
      }

      setStatus("Password updated successfully. Return to /team and sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#F3F6FB", padding: 24 }}>
      <div
        style={{
          maxWidth: 520,
          margin: "40px auto",
          background: "#fff",
          borderRadius: 20,
          padding: 24,
          boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <h1 style={{ marginTop: 0, color: "#263366" }}>Reset Team Password</h1>

        <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
          New Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            border: "1px solid #CBD5E1",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 16,
          }}
        />

        <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>
          Confirm Password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={{
            width: "100%",
            border: "1px solid #CBD5E1",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 16,
          }}
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            background: "#263366",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "12px 16px",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Updating..." : "Update Password"}
        </button>

        {status ? (
          <div style={{ marginTop: 16, lineHeight: 1.6, color: "#334155" }}>
            {status}
          </div>
        ) : null}
      </div>
    </main>
  );
}
