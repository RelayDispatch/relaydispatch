import { supabase } from "./supabase";

/** 
 * Returns true if a cached Supabase auth token exists in localStorage.
 * Used for fast synchronous checks, though the asynchronous AuthProvider is the source of truth.
 */
export function isAuthenticated(): boolean {
  const sessionKey = Object.keys(localStorage).find(key => key.startsWith("sb-") && key.endsWith("-auth-token"));
  return !!sessionKey;
}

/** Legacy support - noop in Supabase auth */
export function setAuthenticated(): void {
  // No-op, managed by Supabase Auth flow
}

/** Legacy support - signs out of Supabase */
export function clearAuthenticated(): void {
  supabase.auth.signOut();
}

/** Exposes helper to retrieve the current active user JWT session */
export async function getSessionToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
