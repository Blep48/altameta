import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

// Public registration endpoint. Authentication and password hashing are delegated
// to Supabase Auth; service credentials never leave this function.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 2048) return json({ error: "Request too large" }, 413);
    const body = JSON.parse(raw);
    const username =
      typeof body.username === "string"
        ? body.username.trim().toLowerCase()
        : "";
    const password = body.password;
    if (!/^[a-z0-9_]{3,20}$/.test(username))
      return json(
        { error: "Username must have 3–20 letters, numbers or underscores" },
        400,
      );
    if (
      typeof password !== "string" ||
      password.length < 8 ||
      new TextEncoder().encode(password).length > 72
    )
      return json(
        {
          error:
            "Password must have at least 8 characters and no more than 72 bytes",
        },
        400,
      );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const ip =
      req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
      "unknown";
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(ip),
    );
    const bucket = Array.from(new Uint8Array(hash), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    for (const [key, limit] of [
      [`ip:${bucket}`, 20],
      ["global", 300],
    ] as const) {
      const { data, error } = await admin.rpc("consume_demo_signup", {
        bucket_key: key,
        max_attempts: limit,
      });
      if (error)
        return json({ error: "Registration temporarily unavailable" }, 503);
      if (!data)
        return json(
          { error: "Too many attempts. Please try again later." },
          429,
        );
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: `${username}@users.altameta.invalid`,
      password,
      email_confirm: true,
      app_metadata: { demo_username: username },
    });
    if (error || !data.user)
      return json(
        { error: "Username unavailable or password rejected. Try another." },
        400,
      );
    const { error: insertError } = await admin
      .from("demo_accounts")
      .insert({ user_id: data.user.id, username });
    if (insertError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return json(
        { error: "Unable to create account. Please try again." },
        503,
      );
    }
    return json({ ok: true }, 201);
  } catch {
    return json({ error: "Invalid registration request" }, 400);
  }
});
