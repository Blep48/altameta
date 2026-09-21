import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://uhazmkzewagtalbyzgcj.supabase.co";
export const SUPABASE_KEY = "sb_publishable_Onsx-GUCZWzWmb93TsMbwQ_5hfJJCw3";
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const usernameEmail = (username: string) =>
  `${username.trim().toLowerCase()}@users.altameta.invalid`;

export async function register(username: string, password: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/demo-register`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Registration failed");
}
