"use client"

/**
 * Owner PWA — backend access layer.
 *
 * Auth is the Medusa admin identity ("user" actor via emailpass), exactly
 * like the dashboard signs in. The JWT lives in localStorage (private,
 * single-owner device assumption — see docs) and rides as a Bearer token
 * on every /admin call below. Nothing here touches the storefront's
 * customer session.
 */

import { sdk } from "@lib/config"

const TOKEN_KEY = "lollies-app-token"

export const backendUrl = () =>
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Private-mode Safari etc: the app still works for the session.
  }
}

export class AppAuthError extends Error {}

export async function appLogin(email: string, password: string): Promise<string> {
  // sdk.auth.login("user", "emailpass") is the dashboard flow; a customer
  // account signed in here gets a token the /admin routes reject, which the
  // verify step below turns into a clean "owner account required" message.
  const token = (await sdk.auth.login("user", "emailpass", {
    email: email.trim().toLowerCase(),
    password,
  })) as unknown as string
  setToken(token)
  try {
    await appFetch("/admin/phone/summary")
  } catch (e) {
    setToken(null)
    if (e instanceof AppAuthError) {
      throw new Error("That account can't open the owner app — use an admin login.")
    }
    throw e
  }
  return token
}

export async function appLogout() {
  setToken(null)
  try {
    await sdk.auth.logout()
  } catch {
    // Logout is best-effort; the token is already dropped.
  }
}

export async function appFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${backendUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (res.status === 401) {
    setToken(null)
    throw new AppAuthError("Session expired — sign in again.")
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(
      (body as any)?.message ?? `Request failed (${res.status}).`
    )
  }
  return res.json() as Promise<T>
}
