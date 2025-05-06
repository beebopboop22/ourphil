// supabase/functions/subscribe_newsletter/index.ts

import { serve } from "https://deno.land/std@0.131.0/http/server.ts";

const CONVERTKIT_API_KEY = Deno.env.get("CONVERTKIT_API_KEY")!;
const CONVERTKIT_FORM_ID = Deno.env.get("CONVERTKIT_FORM_ID")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const email = body.email;
  if (!email) {
    return new Response(JSON.stringify({ error: "Missing email" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const url = new URL(`https://api.convertkit.com/v3/forms/${CONVERTKIT_FORM_ID}/subscribe`);
  url.searchParams.set("api_key", CONVERTKIT_API_KEY);

  const ckRes  = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ email }),
  });
  const ckBody = await ckRes.json().catch(() => ({}));

  return new Response(JSON.stringify(ckBody), {
    status: ckRes.ok ? 200 : ckRes.status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
