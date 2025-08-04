// functions/send-digest/index.ts
// @ts-nocheck

/** Run every day at 00:20 UTC (8:20 pm Eastern) */
export const config = {
  schedule: "20 0 * * *"
};

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.184.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RRule } from "npm:rrule@2.8.1";

// ─── Env ─────────────────────────────────────────────────────
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SENDGRID_API_KEY     = Deno.env.get("SENDGRID_API_KEY")!;

// ─── Supabase client ────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// ─── Palette ────────────────────────────────────────────────
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
  const { data: subs, error: subsErr } = await supabase
    .from("user_subscriptions")
    .select("user_id, tags(id, name, slug)")
    .order("user_id", { ascending: true });
  if (subsErr) throw subsErr;

  // group by user
  const users: Record<string, { tags: any[] }> = {};
  subs.forEach(({ user_id, tags }) => {
    if (!users[user_id]) users[user_id] = { tags: [] };
    users[user_id].tags.push(tags);
  });

  const today = new Date().toISOString().split("T")[0];

  for (const [userId, { tags }] of Object.entries(users)) {
    const { data: uData, error: uErr } = await supabase.auth.admin.getUserById(userId);
    if (uErr || !uData?.user?.email) continue;
    const email = uData.user.email;

    // also fetch ALL tags so we can show unsubscribed
    const { data: allTags = [] } = await supabase
      .from("tags")
      .select("id,name,slug")
      .order("name", { ascending: true });
  const unsubscribed = allTags.filter(t => !tags.some(st => st.id === t.id));

    // ── Load user's saved events (My Plans) ───────────────
    const { data: favRows = [] } = await supabase
      .from('event_favorites')
      .select('event_id,event_int_id,event_uuid,source_table')
      .eq('user_id', userId);
    const favByTable: Record<string, string[]> = {};
    favRows.forEach(r => {
      const tbl = r.source_table;
      let id;
      if (tbl === 'all_events')      id = r.event_int_id;
      else if (tbl === 'events')     id = r.event_id;
      else                           id = r.event_uuid;
      if (!id) return;
      favByTable[tbl] = favByTable[tbl] || [];
      favByTable[tbl].push(id);
    });

    const today0 = new Date();
    today0.setHours(0,0,0,0);

    async function loadFav(
      table: string,
      selectCols: string,
      normalize: (r: any) => { title: string; slug: string; rawDate: string | null }
    ) {
      const ids = favByTable[table] || [];
      if (!ids.length) return [] as any[];
      const { data } = await supabase
        .from(table)
        .select(selectCols)
        .in('id', ids);
      return (data || []).map(normalize);
    }

    const favBB = await loadFav(
      'big_board_events',
      'id,title,slug,start_date',
      r => ({ title: r.title, slug: `big-board/${r.slug}`, rawDate: r.start_date })
    );
    const favAE = await loadFav(
      'all_events',
      'id,name AS title,slug,start_date,venues:venue_id(slug)',
      r => ({ title: r.title, slug: `${r.venues.slug}/${r.slug}`, rawDate: r.start_date })
    );
    const favEv = await loadFav(
      'events',
      'id,slug,"E Name" AS title,Dates',
      r => {
        const [m,d,y] = r.Dates.split('/').map(Number);
        const iso = new Date(y, m-1, d).toISOString().split('T')[0];
        return { title: r.title, slug: `events/${r.slug}`, rawDate: iso };
      }
    );
    const favGE = await loadFav(
      'group_events',
      'id,title,start_date,groups:group_id(slug)',
      r => ({
        title: r.title,
        slug: r.groups?.slug ? `groups/${r.groups.slug}/events/${r.id}` : '',
        rawDate: r.start_date
      })
    );
    const favRecRaw = favByTable['recurring_events'] || [];
    let favRec: any[] = [];
    if (favRecRaw.length) {
      const { data: recRows = [] } = await supabase
        .from('recurring_events')
        .select('id,name AS title,slug,start_date,start_time,end_date,rrule')
        .in('id', favRecRaw);
      favRec = (recRows || []).map(r => {
        try {
          const opts = RRule.parseString(r.rrule);
          opts.dtstart = new Date(`${r.start_date}T${r.start_time}`);
          if (r.end_date) opts.until = new Date(`${r.end_date}T23:59:59`);
          const rule = new RRule(opts);
          const next = rule.after(today0, true);
          if (!next) return null;
          const iso = next.toISOString().split('T')[0];
          return { title: r.title, slug: `series/${r.slug}/${iso}`, rawDate: iso };
        } catch {
          return null;
        }
      }).filter(Boolean);
    }

    const plans = [...favBB, ...favAE, ...favEv, ...favGE, ...favRec]
      .filter(e => e.rawDate && e.slug)
      .filter(e => e.rawDate >= today)
      .sort((a,b) => (a.rawDate! < b.rawDate! ? -1 : 1))
      .slice(0,10)
      .map(e => {
        const dt = new Date(e.rawDate!);
        const disp = dt.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric'
        });
        const url = `https://ourphilly.org/${e.slug}`;
        const gcal =
          `https://www.google.com/calendar/render?action=TEMPLATE` +
          `&text=${encodeURIComponent(e.title)}` +
          `&dates=${e.rawDate!.replace(/-/g,'')}/${e.rawDate!.replace(/-/g,'')}` +
          `&details=${encodeURIComponent('Details: '+url)}`;
        return { title: e.title, date: disp, url, gcal };
      });

    // ── Load upcoming traditions ───────────────────────────
    const { data: trRows = [] } = await supabase
      .from('events')
      .select('"E Name" AS title, slug, Dates')
      .order('Dates', { ascending: true });
    const traditions = (trRows || [])
      .map(r => {
        const [m,d,y] = r.Dates.split('/').map(Number);
        const iso = new Date(y, m-1, d).toISOString().split('T')[0];
        return { title: r.title, slug: `events/${r.slug}`, rawDate: iso };
      })
      .filter(r => r.rawDate >= today)
      .slice(0,5)
      .map(e => {
        const dt = new Date(e.rawDate);
        const disp = dt.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric'
        });
        const url = `https://ourphilly.org/${e.slug}`;
        const gcal =
          `https://www.google.com/calendar/render?action=TEMPLATE` +
          `&text=${encodeURIComponent(e.title)}` +
          `&dates=${e.rawDate.replace(/-/g,'')}/${e.rawDate.replace(/-/g,'')}` +
          `&details=${encodeURIComponent('Details: '+url)}`;
        return { title: e.title, date: disp, url, gcal };
      });

    // build each tag section
    const sections = await Promise.all(
      tags.map(async (tag, i) => {
        const color = colors[i % colors.length];
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
          if (error) return [];
          return (data || []).map(normalize);
        }

        const bb = await load(
          "big_board_events",
          "title, slug, start_date",
          "start_date",
          r => ({ title: r.title, slug: `big-board/${r.slug}`, rawDate: r.start_date })
        );
        const ae = await load(
          "all_events",
          "name AS title, slug, start_date, venues:venue_id (slug)",
          "start_date",
          r => ({ title: r.title, slug: `${r.venues.slug}/${r.slug}`, rawDate: r.start_date })
        );
        const ev = await load(
          "events",
          `"E Name" AS title, slug, Dates`,
          "Dates",
          r => {
            const [m,d,y] = r.Dates.split("/").map(Number);
            const iso = new Date(y, m-1, d).toISOString().split("T")[0];
            return { title: r.title, slug: `events/${r.slug}`, rawDate: iso };
          }
        );
        const ge = await load(
          "group_events",
          "id,title,start_date,groups:group_id(slug)",
          "start_date",
          r => ({
            title: r.title,
            slug: r.groups?.slug ? `groups/${r.groups.slug}/events/${r.id}` : '',
            rawDate: r.start_date,
          })
        );
        const recIds = byTable["recurring_events"] || [];
        let re: any[] = [];
        if (recIds.length) {
          const { data: recRows = [] } = await supabase
            .from("recurring_events")
            .select("id,name AS title,slug,start_date,start_time,end_date,rrule")
            .in("id", recIds);
          re = (recRows || []).map(r => {
            try {
              const opts = RRule.parseString(r.rrule);
              opts.dtstart = new Date(`${r.start_date}T${r.start_time}`);
              if (r.end_date) opts.until = new Date(`${r.end_date}T23:59:59`);
              const rule = new RRule(opts);
              const next = rule.after(today0, true);
              if (!next) return null;
              const iso = next.toISOString().split("T")[0];
              return { title: r.title, slug: `series/${r.slug}/${iso}`, rawDate: iso };
            } catch { return null; }
          }).filter(Boolean);
        }

        const merged = [...bb, ...ae, ...ev, ...ge, ...re]
          .sort((a,b) => a.rawDate.localeCompare(b.rawDate))
          .slice(0,10)
          .map(e => {
            const dt = new Date(e.rawDate);
            const disp = dt.toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric"
            });
            const url = `https://ourphilly.org/${e.slug}`;
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

    // build html
    const html = `
<html>
  <body style="font-family:sans-serif;margin:0;padding:0;color:#333;">
    <header style="text-align:center;padding:1rem;background:#fafafa;">
      <a href="https://ourphilly.org" style="display:block;margin:0 auto .5rem;">
        <img src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/ourphilly.png"
             width="140" alt="Our Philly" />
      </a>
      <h1 style="margin:.5rem 0;font-size:1.5rem;">Your Daily Community Digest</h1>
    </header>

    <section style="padding:1rem;background:#fff6f4;text-align:center;">
      <p style="max-width:600px;margin:0 auto 1rem;line-height:1.5;">
        Welcome to <strong>Our Philly</strong> — the only place you need to find every event
        happening across Philadelphia. Pick the topics you love, and we’ll send you a daily
        roundup of exactly those events.
      </p>
      <a href="https://ourphilly.org/signup"
         style="display:inline-block;margin-bottom:1rem;padding:.6rem 1.2rem;
                background:#bf3d35;color:#fff;text-decoration:none;border-radius:4px;
                font-weight:bold;">
        Sign up for your custom digest
      </a>
      <p style="font-size:.9rem;color:#555;margin:0;">
        Already subscribed? Forward this to a friend so they don’t miss out!
      </p>
    </section>

    <section style="padding:1rem;background:#fff;border-top:4px solid #eee;">
      <h2 style="margin:0 0 .5rem;color:#0D9488;">My Plans</h2>
      ${plans.length
        ? '<ul style="padding-left:1.2rem;margin:0 0 1rem;">' +
          plans.map(e => `
            <li style="margin-bottom:.6rem;line-height:1.4;">
              <strong>${e.title}</strong> — ${e.date}<br/>
              <a href="${e.url}">View event →</a> &nbsp;|&nbsp;
              <a href="${e.gcal}">Add to calendar</a>
            </li>
          `).join('') +
          '</ul>'
        : `<p style="font-style:italic;color:#666;margin:0 0 1rem;">You haven’t saved any events yet. Add some on <a href="https://ourphilly.org">Our Philly</a>!</p>`
      }
    </section>

    <section style="padding:1rem;background:#fff;border-top:4px solid #eee;">
      <h2 style="margin:0 0 .5rem;color:#3B82F6;">What’s Ahead: Philly Traditions</h2>
      ${traditions.length
        ? '<ul style="padding-left:1.2rem;margin:0 0 1rem;">' +
          traditions.map(e => `
            <li style="margin-bottom:.6rem;line-height:1.4;">
              <strong>${e.title}</strong> — ${e.date}<br/>
              <a href="${e.url}">View event →</a> &nbsp;|&nbsp;
              <a href="${e.gcal}">Add to calendar</a>
            </li>
          `).join('') +
          '</ul>'
        : `<p style="font-style:italic;color:#666;margin:0 0 1rem;">No upcoming traditions.</p>`
      }
    </section>

    <!-- your active tags -->
    <nav style="text-align:center;padding:.75rem;background:#fff;">
      ${sections.map(s => `
        <a href="#${s.slug}"
           style="display:inline-block;margin:.2rem .3rem;padding:.4rem .8rem;
                  background:${s.color};color:#fff;border-radius:9999px;
                  text-decoration:none;font-size:.85rem;">
          #${s.name}
        </a>
      `).join("")}
    </nav>

    <!-- all other tags, gray -->
    <nav style="text-align:center;padding:.5rem;background:#f5f5f5;">
      ${unsubscribed.map(t => `
        <span style="display:inline-block;margin:.2rem .3rem;padding:.4rem .8rem;
                     background:#e0e0e0;color:#666;border-radius:9999px;
                     font-size:.85rem;">
          #${t.name}
        </span>
      `).join("")}
    </nav>

    ${sections.map(s => `
      <section id="${s.slug}"
               style="padding:1rem;border-top:4px solid ${s.color};
                      background:#fff;margin-top:1rem;">
        <h2 style="color:${s.color};margin-bottom:.5rem;">#${s.name}</h2>
        ${s.events.length
          ? '<ul style="padding-left:1.2rem;margin:0 0 1rem;">' +
            s.events.map(e => `
              <li style="margin-bottom:.6rem;line-height:1.4;">
                <strong>${e.title}</strong> — ${e.date}<br/>
                <a href="${e.url}">View event →</a> &nbsp;|&nbsp;
                <a href="${e.gcal}">Add to calendar</a>
              </li>
            `).join("") +
            '</ul>'
          : `<p style="font-style:italic;color:#666;margin:0 0 1rem;">
               No upcoming events for #${s.name}.
             </p>`
        }
      </section>
    `).join("")}

    <footer style="text-align:center;padding:1rem;font-size:.8rem;color:#999;">
      You’re receiving this because you subscribe to tags on Our Philly.<br/>
      <a href="https://ourphilly.org/profile" style="color:#999;text-decoration:underline;">
        Manage your subscriptions
      </a>
    </footer>
  </body>
</html>
`.trim();

    await sendEmail(email, "Your Our Philly daily digest", html);
  }

  return new Response(JSON.stringify({ status: "sent" }), { status: 200 });
});
