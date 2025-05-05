// supabase/functions/unsubscribe/index.ts
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  const url = new URL(req.url);

  // Allow GET or POST on /unsubscribe without any auth header
  if ((req.method === "GET" || req.method === "POST") && url.pathname.endsWith("/unsubscribe")) {
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response("Missing token", { status: 400 });
    }

    const { error } = await supabase
      .from("newsletter_subscribers")
      .delete()
      .eq("unsub_token", token);

    if (error) {
      return new Response("Unsubscribe failed", { status: 500 });
    }

    return new Response(
      `<html>
         <body style="font-family:sans-serif; text-align:center; padding:2rem;">
           <h1>Unsubscribed</h1>
           <p>You’ve been removed from our newsletter.</p>
         </body>
       </html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }

  // All other routes/methods return 404
  return new Response("Not found", { status: 404 });
});
