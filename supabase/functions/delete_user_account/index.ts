// supabase/functions/delete_user_account/index.ts
// @ts-nocheck

import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// these headers will be applied to every response
const CORS_HEADERS = {
  "Access-Control-Allow-Origin":      "*",
  "Access-Control-Allow-Methods":     "POST, OPTIONS",
  "Access-Control-Allow-Headers":     "Authorization, Content-Type, apikey, x-client-info",
};

serve(async (req) => {
  // handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // now handle the real POST
  try {
    // extract the JWT from the Authorization header
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) throw new Error("Missing Authorization");

    // verify JWT and get user
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) throw userError ?? new Error("Not authenticated");

    // delete the user (admin API)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    // optionally clean up your own tables here…
    // await supabaseAdmin.from("favorites").delete().eq("user_id", user.id);

    return new Response(
      JSON.stringify({ message: "User deleted successfully" }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
