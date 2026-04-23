"use client";

import React, { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/app/components/SiteHeader";
import { SiteLanguage } from "@/app/components/site-header-translations";

type TeamRole =
  | "Loan Officer"
  | "Loan Officer Assistant"
  | "Processor"
  | "Production Manager"
  | "Branch Manager"
  | "Real Estate Agent";

type TeamUser = {
  id: string;
  name: string;
  email: string;
  nmls: string;
  role: TeamRole;
  calendly?: string;
  assistant_email?: string;
  phone?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
};

type FormState = {
  name: string;
  email: string;
  nmls: string;
  role: TeamRole;
  calendly: string;
  assistantEmail: string;
  phone: string;
  isActive: boolean;
};

const ROLE_OPTIONS: TeamRole[] = [
  "Loan Officer",
  "Loan Officer Assistant",
  "Processor",
  "Production Manager",
  "Branch Manager",
  "Real Estate Agent",
];

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  nmls: "",
  role: "Loan Officer",
  calendly: "",
  assistantEmail: "",
  phone: "",
  isActive: true,
};

const APPROVED_ADMIN_EMAIL = "pansini@beyondfinancing.com";

function formatPhoneDisplay(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 10)}`;
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function getLicenseLabel(role?: string) {
  return role === "Real Estate Agent" ? "MLS" : "NMLS";
}

function getLicensePlaceholder(role: TeamRole) {
  return role === "Real Estate Agent" ? "MLS Number" : "NMLS Number";
}

function isFinley(user?: Pick<TeamUser, "name" | "email"> | null) {
  const name = String(user?.name || "").trim().toLowerCase();
  const email = String(user?.email || "").trim().toLowerCase();

  return (
    name === "finley beyond" ||
    email === "finley@beyondintelligence.io" ||
    email === "finley@beyondfinancing.com"
  );
}

function getAssistantDisplay(user: TeamUser) {
  if (isFinley(user)) return "Assistant: Not applicable";
  return `Assistant: ${user.assistant_email || "—"}`;
}

export default function AdminPage() {
  const [language, setLanguage] = useState<SiteLanguage>("en");
  const [authLoading, setAuthLoading] = useState(true);
  const [activeUser, setActiveUser] = useState<AuthUser | null>(null);
  const [authorized, setAuthorized] = useState(false);

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string>("");
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const response = await fetch("/api/team-auth/me", { cache: "no-store" });

        if (!response.ok) {
          setAuthorized(false);
          return;
        }

        const data = await response.json();

        if (data?.authenticated && data?.user) {
          const user = data.user as AuthUser;
          setActiveUser(user);

          const isApprovedAdmin =
            String(user.email || "").trim().toLowerCase() ===
            APPROVED_ADMIN_EMAIL;

          setAuthorized(isApprovedAdmin);
        } else {
          setAuthorized(false);
        }
      } catch {
        setAuthorized(false);
      } finally {
        setAuthLoading(false);
      }
    };

    void loadAuth();
  }, []);

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to load admin users.");
      }

      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load admin users."
      );
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (authorized) {
      void loadUsers();
    }
  }, [authorized]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) => {
      const licenseLabel = getLicenseLabel(user.role);

      const haystack = [
        user.name,
        user.email,
        user.nmls,
        licenseLabel,
        user.role,
        user.phone,
        user.assistant_email,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [users, searchQuery]);

  const setCreateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setCreateForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "role" && value === "Real Estate Agent") {
        next.assistantEmail = "";
        next.calendly = "";
      }

      if (key === "name" || key === "email") {
        const proposed = {
          name: key === "name" ? String(value) : prev.name,
          email: key === "email" ? String(value) : prev.email,
        };

        if (isFinley(proposed)) {
          next.email = "finley@beyondintelligence.io";
          next.assistantEmail = "";
          next.phone = next.phone || "857.615.0836";
          next.role = "Loan Officer Assistant";
          next.nmls = next.nmls || "2394496FB";
        }
      }

      return next;
    });
  };

  const setEditField = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setEditForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "role" && value === "Real Estate Agent") {
        next.assistantEmail = "";
        next.calendly = "";
      }

      if (key === "name" || key === "email") {
        const proposed = {
          name: key === "name" ? String(value) : prev.name,
          email: key === "email" ? String(value) : prev.email,
        };

        if (isFinley(proposed)) {
          next.email = "finley@beyondintelligence.io";
          next.assistantEmail = "";
          next.phone = next.phone || "857.615.0836";
          next.role = "Loan Officer Assistant";
          next.nmls = next.nmls || "2394496FB";
        }
      }

      return next;
    });
  };

  const beginEdit = (user: TeamUser) => {
    setEditingId(user.id);
    setEditForm({
      name: user.name || "",
      email: isFinley(user) ? "finley@beyondintelligence.io" : user.email || "",
      nmls: user.nmls || "",
      role: user.role,
      calendly: user.calendly || "",
      assistantEmail: isFinley(user) ? "" : user.assistant_email || "",
      phone: user.phone || "",
      isActive: Boolean(user.is_active ?? true),
    });
    setStatusMessage("");
    setErrorMessage("");
  };

  const cancelEdit = () => {
    setEditingId("");
    setEditForm(EMPTY_FORM);
  };

  const createUser = async () => {
    try {
      setIsSaving(true);
      setStatusMessage("");
      setErrorMessage("");

      const payload: FormState = {
        ...createForm,
        email: isFinley(createForm)
          ? "finley@beyondintelligence.io"
          : createForm.email,
        assistantEmail: isFinley(createForm) ? "" : createForm.assistantEmail,
      };

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to create user.");
      }

      setCreateForm(EMPTY_FORM);
      setStatusMessage("Team user created successfully.");
      await loadUsers();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create user."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editingId) return;

    try {
      setIsSaving(true);
      setStatusMessage("");
      setErrorMessage("");

      const payload: FormState = {
        ...editForm,
        email: isFinley(editForm)
          ? "finley@beyondintelligence.io"
          : editForm.email,
        assistantEmail: isFinley(editForm) ? "" : editForm.assistantEmail,
      };

      const response = await fetch(`/api/admin/users/${editingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to update user.");
      }

      setEditingId("");
      setEditForm(EMPTY_FORM);
      setStatusMessage("Team user updated successfully.");
      await loadUsers();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update user."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteUser = async (id: string, name: string) => {
    const confirmed = window.confirm(`Delete ${name}?`);
    if (!confirmed) return;

    try {
      setIsSaving(true);
      setStatusMessage("");
      setErrorMessage("");

      const response = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to delete user.");
      }

      if (editingId === id) {
        setEditingId("");
        setEditForm(EMPTY_FORM);
      }

      setStatusMessage("Team user deleted successfully.");
      await loadUsers();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to delete user."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return (
      <main style={styles.page}>
        <style>{responsiveCss}</style>
        <div className="bf-wrap" style={styles.wrap}>
          <SiteHeader
            variant="admin"
            language={language}
            onLanguageChange={setLanguage}
          />
          <section style={styles.hero}>
            <div style={styles.heroBadge}>ADMIN COMMAND</div>
            <h1 style={styles.heroTitle}>Beyond Intelligence™ Admin Command</h1>
            <p style={styles.heroText}>Loading protected admin access...</p>
          </section>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main style={styles.page}>
        <style>{responsiveCss}</style>
        <div className="bf-wrap" style={styles.wrap}>
          <SiteHeader
            variant="admin"
            language={language}
            onLanguageChange={setLanguage}
          />

          <section style={styles.hero}>
            <div style={styles.heroBadge}>ADMIN COMMAND</div>
            <h1 style={styles.heroTitle}>Beyond Intelligence™ Admin Command</h1>
            <p style={styles.heroText}>
              This area is currently reserved for the approved administrator only.
            </p>
          </section>

          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Access Restricted</h2>
            <p style={styles.sectionText}>
              At this time, only the approved administrator account may enter the
              Admin Command Page.
            </p>

            <div style={styles.actionRow}>
              <a href="/" style={styles.primaryLinkButton}>
                Back to Homepage
              </a>
              <a href="/team" style={styles.secondaryLinkButton}>
                Back to Team Workspace
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <style>{responsiveCss}</style>

      <div className="bf-wrap" style={styles.wrap}>
        <SiteHeader
          variant="admin"
          language={language}
          onLanguageChange={setLanguage}
        />

        <section style={styles.hero}>
          <div className="bf-admin-hero-grid" style={styles.heroGrid}>
            <div>
              <div style={styles.heroBadge}>ADMIN COMMAND</div>
              <h1 style={styles.heroTitle}>Beyond Intelligence™ Admin Command</h1>
              <p style={styles.heroText}>
                Manage team users, operational roles, notification routing, and
                the people layer that powers borrower, team, and workflow
                intelligence.
              </p>
            </div>

            <div style={styles.heroPanel}>
              <div style={styles.heroPanelTitle}>SIGNED IN</div>
              <div style={styles.heroPanelText}>
                {activeUser?.name || "Authorized User"}
                <br />
                {activeUser?.role || "Administrative Role"}
                <br />
                {activeUser?.email || ""}
              </div>
            </div>
          </div>
        </section>

        <div className="bf-admin-grid" style={styles.mainGrid}>
          <section style={styles.card}>
            <div style={styles.sectionEyebrow}>CREATE USER</div>
            <h2 style={styles.sectionTitle}>Add team profile</h2>

            <div className="bf-form-grid" style={styles.formGrid}>
              <input
                style={styles.input}
                placeholder="Full Name"
                value={createForm.name}
                onChange={(e) => setCreateField("name", e.target.value)}
              />
              <input
                style={styles.input}
                placeholder="Email"
                value={createForm.email}
                onChange={(e) => setCreateField("email", e.target.value)}
              />
              <input
                style={styles.input}
                placeholder={getLicensePlaceholder(createForm.role)}
                value={createForm.nmls}
                onChange={(e) => setCreateField("nmls", e.target.value)}
              />
              <select
                style={styles.input}
                value={createForm.role}
                onChange={(e) =>
                  setCreateField("role", e.target.value as TeamRole)
                }
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <input
                style={styles.input}
                placeholder={
                  createForm.role === "Real Estate Agent"
                    ? "Website / Profile URL"
                    : "Calendly URL"
                }
                value={createForm.calendly}
                onChange={(e) => setCreateField("calendly", e.target.value)}
                disabled={createForm.role === "Real Estate Agent"}
              />
              <input
                style={styles.input}
                placeholder={
                  isFinley(createForm)
                    ? "Assistant Not Applicable"
                    : createForm.role === "Real Estate Agent"
                    ? "Assistant Not Required"
                    : "Assistant Email"
                }
                value={createForm.assistantEmail}
                onChange={(e) =>
                  setCreateField("assistantEmail", e.target.value)
                }
                disabled={
                  isFinley(createForm) || createForm.role === "Real Estate Agent"
                }
              />
              <input
                style={styles.input}
                placeholder="Phone"
                value={createForm.phone}
                onChange={(e) =>
                  setCreateField("phone", formatPhoneDisplay(e.target.value))
                }
              />
              <label style={styles.checkboxCard}>
                <input
                  type="checkbox"
                  checked={createForm.isActive}
                  onChange={(e) => setCreateField("isActive", e.target.checked)}
                />
                <span>Active User</span>
              </label>
            </div>

            <button
              type="button"
              style={styles.primaryButtonWide}
              onClick={createUser}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Create Team User"}
            </button>

            {statusMessage ? (
              <div style={styles.statusBox}>{statusMessage}</div>
            ) : null}
            {errorMessage ? (
              <div style={styles.errorBox}>{errorMessage}</div>
            ) : null}
          </section>

          <section style={styles.card}>
            <div style={styles.sectionEyebrow}>TEAM DIRECTORY</div>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Manage users</h2>
              <input
                style={styles.searchInput}
                placeholder="Search by name, email, role, NMLS, MLS, or phone"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {usersLoading ? (
              <div style={styles.placeholderBox}>Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div style={styles.placeholderBox}>No users found.</div>
            ) : (
              <div style={styles.userList}>
                {filteredUsers.map((user) => {
                  const isEditing = editingId === user.id;
                  const licenseLabel = getLicenseLabel(user.role);

                  return (
                    <div key={user.id} style={styles.userCard}>
                      {!isEditing ? (
                        <div style={styles.userCardTop}>
                          <div>
                            <div style={styles.userName}>{user.name}</div>
                            <div style={styles.userMeta}>
                              {user.role} · {user.email}
                            </div>
                            <div style={styles.userMeta}>
                              {licenseLabel}: {user.nmls || "—"} · Phone:{" "}
                              {user.phone || "—"}
                            </div>
                            <div style={styles.userMeta}>
                              {getAssistantDisplay(user)}
                            </div>
                            <div style={styles.userMeta}>
                              Active: {user.is_active ? "Yes" : "No"} · Created:{" "}
                              {formatDate(user.created_at)}
                            </div>
                          </div>

                          <div style={styles.userCardActions}>
                            <button
                              type="button"
                              style={styles.smallOutlineButton}
                              onClick={() => beginEdit(user)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              style={styles.smallDangerButton}
                              onClick={() => void deleteUser(user.id, user.name)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="bf-form-grid" style={styles.formGrid}>
                            <input
                              style={styles.input}
                              placeholder="Full Name"
                              value={editForm.name}
                              onChange={(e) => setEditField("name", e.target.value)}
                            />
                            <input
                              style={styles.input}
                              placeholder="Email"
                              value={editForm.email}
                              onChange={(e) => setEditField("email", e.target.value)}
                            />
                            <input
                              style={styles.input}
                              placeholder={getLicensePlaceholder(editForm.role)}
                              value={editForm.nmls}
                              onChange={(e) => setEditField("nmls", e.target.value)}
                            />
                            <select
                              style={styles.input}
                              value={editForm.role}
                              onChange={(e) =>
                                setEditField("role", e.target.value as TeamRole)
                              }
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                            <input
                              style={styles.input}
                              placeholder={
                                editForm.role === "Real Estate Agent"
                                  ? "Website / Profile URL"
                                  : "Calendly URL"
                              }
                              value={editForm.calendly}
                              onChange={(e) =>
                                setEditField("calendly", e.target.value)
                              }
                              disabled={editForm.role === "Real Estate Agent"}
                            />
                            <input
                              style={styles.input}
                              placeholder={
                                isFinley(editForm)
                                  ? "Assistant Not Applicable"
                                  : editForm.role === "Real Estate Agent"
                                  ? "Assistant Not Required"
                                  : "Assistant Email"
                              }
                              value={editForm.assistantEmail}
                              onChange={(e) =>
                                setEditField("assistantEmail", e.target.value)
                              }
                              disabled={
                                isFinley(editForm) ||
                                editForm.role === "Real Estate Agent"
                              }
                            />
                            <input
                              style={styles.input}
                              placeholder="Phone"
                              value={editForm.phone}
                              onChange={(e) =>
                                setEditField(
                                  "phone",
                                  formatPhoneDisplay(e.target.value)
                                )
                              }
                            />
                            <label style={styles.checkboxCard}>
                              <input
                                type="checkbox"
                                checked={editForm.isActive}
                                onChange={(e) =>
                                  setEditField("isActive", e.target.checked)
                                }
                              />
                              <span>Active User</span>
                            </label>
                          </div>

                          <div style={styles.actionRow}>
                            <button
                              type="button"
                              style={styles.primaryButton}
                              onClick={saveEdit}
                              disabled={isSaving}
                            >
                              {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                            <button
                              type="button"
                              style={styles.secondaryButton}
                              onClick={cancelEdit}
                              disabled={isSaving}
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

const responsiveCss = `
  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
  }

  @media (max-width: 1200px) {
    .bf-admin-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 900px) {
    .bf-form-grid {
      grid-template-columns: 1fr !important;
    }

    .bf-admin-hero-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 760px) {
    .bf-wrap {
      padding: 18px 12px 32px !important;
    }
  }
`;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, #f8fbff 0%, #f3f6fb 45%, #eef2f7 100%)",
    color: "#1F2937",
    fontFamily: "Inter, Arial, Helvetica, sans-serif",
  },
  wrap: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "24px 18px 48px",
  },
  hero: {
    background: "linear-gradient(135deg, #263366 0%, #0096C7 100%)",
    borderRadius: 30,
    padding: 28,
    color: "#ffffff",
    boxShadow: "0 18px 40px rgba(38,51,102,0.18)",
    marginBottom: 20,
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 22,
    alignItems: "start",
  },
  heroBadge: {
    display: "inline-block",
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.12)",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 18,
  },
  heroTitle: {
    margin: 0,
    fontSize: 54,
    lineHeight: 0.96,
    fontWeight: 900,
  },
  heroText: {
    marginTop: 20,
    marginBottom: 0,
    maxWidth: 840,
    fontSize: 16,
    lineHeight: 1.75,
    color: "rgba(255,255,255,0.94)",
  },
  heroPanel: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 24,
    padding: 20,
  },
  heroPanelTitle: {
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  heroPanelText: {
    color: "rgba(255,255,255,0.94)",
    lineHeight: 1.8,
    fontSize: 15,
    fontWeight: 700,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "0.95fr 1.25fr",
    gap: 18,
    alignItems: "start",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
    border: "1px solid #E5ECF5",
  },
  sectionEyebrow: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0284C7",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.08,
    color: "#2D3B78",
    fontWeight: 900,
  },
  sectionText: {
    marginTop: 12,
    marginBottom: 0,
    color: "#526581",
    fontSize: 15,
    lineHeight: 1.75,
    maxWidth: 920,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  input: {
    width: "100%",
    minHeight: 46,
    borderRadius: 18,
    border: "1px solid #BFD0EA",
    backgroundColor: "#ffffff",
    padding: "12px 14px",
    outline: "none",
    color: "#243F7C",
    fontSize: 14,
    fontWeight: 700,
  },
  searchInput: {
    minWidth: 320,
    flex: "0 1 420px",
    minHeight: 46,
    borderRadius: 18,
    border: "1px solid #BFD0EA",
    backgroundColor: "#ffffff",
    padding: "12px 14px",
    outline: "none",
    color: "#243F7C",
    fontSize: 14,
    fontWeight: 700,
  },
  checkboxCard: {
    minHeight: 46,
    borderRadius: 18,
    border: "1px solid #BFD0EA",
    backgroundColor: "#ffffff",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#243F7C",
    fontWeight: 800,
  },
  primaryButtonWide: {
    marginTop: 16,
    width: "100%",
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: "#1EA6E0",
    border: "1px solid #1EA6E0",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  actionRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },
  primaryButton: {
    minHeight: 46,
    padding: "10px 18px",
    borderRadius: 18,
    backgroundColor: "#5CB2D8",
    border: "1px solid #5CB2D8",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  secondaryButton: {
    minHeight: 46,
    padding: "10px 18px",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    border: "1px solid #AFC5E4",
    color: "#60749B",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  primaryLinkButton: {
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 16,
    backgroundColor: "#263366",
    color: "#ffffff",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 14,
  },
  secondaryLinkButton: {
    textDecoration: "none",
    textAlign: "center",
    borderRadius: 16,
    border: "1px solid #263366",
    backgroundColor: "#ffffff",
    color: "#263366",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 14,
  },
  statusBox: {
    marginTop: 14,
    borderRadius: 16,
    border: "1px solid #D5E0F1",
    backgroundColor: "#F8FAFE",
    color: "#5A71A0",
    padding: 14,
    lineHeight: 1.6,
    fontSize: 13,
    fontWeight: 800,
  },
  errorBox: {
    marginTop: 14,
    borderRadius: 16,
    border: "1px solid #F6C8C8",
    backgroundColor: "#FFF6F6",
    color: "#B24D4D",
    padding: 14,
    lineHeight: 1.6,
    fontSize: 13,
    fontWeight: 800,
  },
  placeholderBox: {
    borderRadius: 18,
    border: "1px dashed #CBD5E1",
    backgroundColor: "#F8FAFC",
    color: "#475569",
    padding: 16,
    lineHeight: 1.7,
    fontSize: 14,
  },
  userList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  userCard: {
    borderRadius: 22,
    border: "1px solid #D7E2F0",
    backgroundColor: "#ffffff",
    padding: 16,
  },
  userCardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  userName: {
    fontSize: 20,
    fontWeight: 900,
    color: "#2D3B78",
    marginBottom: 6,
  },
  userMeta: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 1.6,
  },
  userCardActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  smallOutlineButton: {
    minHeight: 40,
    padding: "8px 14px",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    border: "1px solid #AFC5E4",
    color: "#60749B",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
  },
  smallDangerButton: {
    minHeight: 40,
    padding: "8px 14px",
    borderRadius: 14,
    backgroundColor: "#FFF6F6",
    border: "1px solid #F1B7B7",
    color: "#B24D4D",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
  },
};
