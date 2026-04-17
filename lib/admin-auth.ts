import { cookies } from "next/headers";

const ADMIN_COOKIE_NAME = "bi_admin_session";
const ADMIN_COOKIE_VALUE = "verified-admin";

export const ADMIN_EMAIL = "pansini@beyondfinancing.com";
export const ADMIN_PASSWORD = "BeyondAdmin#2026";

export function getAdminEmail(): string {
  return (process.env.ADMIN_EMAIL || ADMIN_EMAIL).trim().toLowerCase();
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || ADMIN_PASSWORD;
}

export function isSecureCookie(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function isAdminSignedIn(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return session === ADMIN_COOKIE_VALUE;
}

export async function signInAdminSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_COOKIE_NAME, ADMIN_COOKIE_VALUE, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}

export function validateAdminCredentials(
  email: string,
  password: string
): boolean {
  return (
    email.trim().toLowerCase() === getAdminEmail() &&
    password === getAdminPassword()
  );
}
