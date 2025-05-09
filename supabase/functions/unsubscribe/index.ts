// supabase/functions/unsubscribe/index.ts
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  const url = new URL(req.url);

  // only handle GET or POST to /unsubscribe
  if ((req.method === "GET" || req.method === "POST") && url.pathname.endsWith("/unsubscribe")) {
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response("Missing token", { status: 400 });
    }

    // delete the subscriber row by token
    const { error } = await supabase
      .from("newsletter_subscribers")
      .delete()
      .eq("unsub_token", token);

    if (error) {
      console.error("Unsubscribe error:", error);
      return new Response("Unsubscribe failed", { status: 500 });
    }

    // success page (ASCII only)
    const html = `<html>
  <head><meta charset="utf-8"><title>Unsubscribe - Our Philly</title></head>
  <body style="font-family: sans-serif; text-align: center; padding: 2rem;">
    <h1>Unsubscribed</h1>
    <p>You've been removed from our newsletter.</p>
  </body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response("Not found", { status: 404 });
});
