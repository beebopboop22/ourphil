// supabase/functions/send-email/index.ts
// @ts-nocheck


import { serve } from "https://deno.land/std@0.131.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;   // Your Resend API key, e.g. re_xxx
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL")!;      // A verified “From” address, e.g. no‑reply@ourphilly.org

serve(async (req) => {
  // Debug: uncomment to verify the secret is loaded
  // console.log("RESEND_API_KEY starts with:", RESEND_API_KEY.slice(0, 4));

  let payload;
  try {
    payload = await req.json();
  } catch (err) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { to, subject, html } = payload;
  if (!to || !subject || !html) {
    return new Response("Missing to, subject or html", { status: 400 });
  }

  // Send via Resend
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Resend error:", data);
    return new Response(JSON.stringify(data), { status: 500 });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
