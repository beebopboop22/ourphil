// functions/send-digest/index.ts
// @ts-nocheck

/** Run every day at 00:20 UTC, which is 8:20 pm Eastern (EDT) */
export const config = {
  schedule: "20 0 * * *"
};


import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.184.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Env ─────────────────────────────────────────────────────
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SENDGRID_API_KEY     = Deno.env.get("SENDGRID_API_KEY")!;

// ─── Supabase client ────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// ─── A darker, high-contrast palette ────────────────────────
const colors = [
  "#22C55E", // green-500
  "#0D9488", // teal-600
  "#DB2777", // pink-600
  "#3B82F6", // blue-500
  "#F97316", // orange-500
  "#EAB308", // yellow-500
  "#8B5CF6", // purple-500
  "#EF4444", // red-500
];

// ─── SendGrid helper ────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  console.log(`→ sendEmail to=${to}`);
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: "no-reply@ourphilly.org", name: "Our Philly" },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("✖ SendGrid error", res.status, body);
    throw new Error(`SendGrid error: ${res.status}`);
  }
}

// ─── Edge function ──────────────────────────────────────────
serve(async (_req) => {
  try {
    console.log("⌛ send-digest: fetching subscriptions");
    const { data: subs, error: subsErr } = await supabase
      .from("user_subscriptions")
      .select("user_id, tags(id, name, slug)")
      .order("user_id", { ascending: true });
    if (subsErr) throw subsErr;
    console.log(`🔖 fetched ${subs.length} subscriptions`);

    // group by user
    const users: Record<string, { tags: any[] }> = {};
    subs.forEach(({ user_id, tags }) => {
      if (!users[user_id]) users[user_id] = { tags: [] };
      users[user_id].tags.push(tags);
    });
    console.log("👥 grouped into", Object.keys(users).length, "users");

    const today = new Date().toISOString().split("T")[0]; // “YYYY-MM-DD”

    for (const [userId, { tags }] of Object.entries(users)) {
      console.log(`\n📬 preparing digest for user ${userId}`);
      const { data: uData, error: uErr } = await supabase.auth.admin.getUserById(userId);
      if (uErr || !uData?.user?.email) {
        console.warn("⚠️ missing email for", userId);
        continue;
      }
      const email = uData.user.email;

      // build each tag section
      const sections = await Promise.all(
        tags.map(async (tag, i) => {
          const color = colors[i % colors.length];
          console.log(`  • loading events for #${tag.slug}`);

          // fetch taggings
          const { data: tgs } = await supabase
            .from("taggings")
            .select("taggable_type, taggable_id")
            .eq("tag_id", tag.id);

          const byTable: Record<string, string[]> = {};
          tgs.forEach(({ taggable_type, taggable_id }) => {
            byTable[taggable_type] = byTable[taggable_type] || [];
            byTable[taggable_type].push(taggable_id);
          });

          // helper to load & normalize
          async function load(
            table: string,
            selectCols: string,
            dateCol: string,
            normalize: (r: any) => { title: string; slug: string; rawDate: string }
          ) {
            const ids = byTable[table] || [];
            if (!ids.length) return [];
            const { data, error } = await supabase
              .from(table)
              .select(selectCols)
              .in("id", ids)
              .gte(dateCol, today)
              .order(dateCol, { ascending: true })
              .limit(20);
            if (error) {
              console.error(`✖ [${table}]`, error);
              return [];
            }
            return (data || []).map(normalize);
          }

          const bb = await load(
            "big_board_events",
            "title, slug, start_date",
            "start_date",
            r => ({ title: r.title, slug: r.slug, rawDate: r.start_date })
          );

          const ae = await load(
            "all_events",
            "name AS title, slug, start_date",
            "start_date",
            r => ({ title: r.title, slug: r.slug, rawDate: r.start_date })
          );

          const ev = await load(
            "events",
            `"E Name" AS title, slug, Dates`,
            "Dates",
            r => {
              const [m, d, y] = (r.Dates||"").split("/").map(Number);
              const iso = new Date(y, m - 1, d).toISOString().split("T")[0];
              return { title: r.title, slug: r.slug, rawDate: iso };
            }
          );

          // merge, sort, limit
          const merged = [...bb, ...ae, ...ev]
            .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
            .slice(0, 10)
            .map(e => {
              const dt = new Date(e.rawDate);
              const disp = dt.toLocaleDateString("en-US", {
                weekday: "long",
                month:   "long",
                day:     "numeric",
              });
              const url  = `https://ourphilly.org/${e.slug}`;
              const gcal =
                `https://www.google.com/calendar/render?action=TEMPLATE` +
                `&text=${encodeURIComponent(e.title)}` +
                `&dates=${e.rawDate.replace(/-/g,"")}/${e.rawDate.replace(/-/g,"")}` +
                `&details=${encodeURIComponent("Details: "+url)}`;
              return { title: e.title, date: disp, url, gcal };
            });

          return { name: tag.name, slug: tag.slug, color, events: merged };
        })
      );

      // render HTML
      const html = `
<html>
  <body style="font-family:sans-serif;margin:0;padding:0;color:#333;">
    <header style="text-align:center;padding:1rem;background:#fafafa;">
      <a href="https://ourphilly.org" style="display:inline-block">
        <img src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/ourphilly.png"
             width="140" alt="Our Philly" style="margin:0 auto;display:block;" />
      </a>
      <h1 style="margin:.5rem 0 1rem;">Your Weekly Community Digest</h1>
    </header>

    <nav style="text-align:center;padding:.5rem;background:#fff;">
      ${sections.map(s => `
        <a href="#${s.slug}"
           style="
             display:inline-block;
             margin:.2rem .3rem;
             padding:.4rem .8rem;
             background:${s.color};
             color:#fff;
             border-radius:9999px;
             text-decoration:none;
             font-size:.9rem;
           ">
          #${s.name}
        </a>
      `).join("")}
    </nav>

    ${sections.map(s => `
      <section id="${s.slug}" style="padding:1rem;border-top:4px solid ${s.color};background:#fff;margin-top:1rem;">
        <h2 style="color:${s.color};margin-bottom:.5rem;">#${s.name}</h2>
        <p style="margin:0 0 1rem;">
          <a href="https://ourphilly.org"
             style="font-size:.9rem;color:${s.color};text-decoration:none;font-weight:bold;">
            Have an event we’re missing? Add it →
          </a>
        </p>
        ${s.events.length
          ? `<ul style="padding-left:1.2rem;margin:0 0 1rem;">` +
              s.events.map(e => `
                <li style="margin-bottom:.6rem;">
                  <strong>${e.title}</strong> — ${e.date}
                  <br/>
                  <a href="${e.url}">View event →</a>
                  &nbsp;|&nbsp;
                  <a href="${e.gcal}">Add to calendar</a>
                </li>
              `).join("") +
            `</ul>`
          : `<p style="font-style:italic;color:#666;">No upcoming events for #${s.name}.</p>`
        }
      </section>
    `).join("")}

    <footer style="text-align:center;padding:1rem;font-size:.8rem;color:#999;">
      You’re receiving this because you subscribe to tags on Our Philly.  
      <a href="https://ourphilly.org/profile" style="color:#999;text-decoration:underline;">
        Manage your subscriptions
      </a>
    </footer>
  </body>
</html>`.trim();

      // send
      await sendEmail(email, "Your Our Philly weekly digest", html);
      console.log(`→ sent to ${email}`);
    }

    console.log("✅ send-digest: all emails sent");
    return new Response(JSON.stringify({ status: "sent" }), { status: 200 });
  } catch (err) {
    console.error("❌ send-digest error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
