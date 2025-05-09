// supabase/functions/newsletter/index.ts
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import Mustache from "https://esm.sh/mustache";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEATGEEK_CLIENT_ID        = Deno.env.get("SEATGEEK_CLIENT_ID")!;
const SEATGEEK_CLIENT_SECRET    = Deno.env.get("SEATGEEK_CLIENT_SECRET")!;
const SITE_URL                  = Deno.env.get("SITE_URL") ?? "https://www.ourphilly.org";
const LOGO_URL                  = Deno.env.get("LOGO_URL")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 1) fetch next‑7‑day custom events
async function fetchCustomEvents() {
  const today = new Date();
  const weekOut = new Date(today);
  weekOut.setDate(today.getDate() + 7);

  const { data: rows } = await supabase
    .from("events")
    .select(`name:"E Name", rawDate:"Dates", link:"E Link", image:"E Image"`);

  return (rows ?? [])
    .filter(r => typeof r.rawDate === "string")
    .map(r => {
      const [m,d,y] = r.rawDate.split("/");
      const dateObj = new Date(`${y}-${m}-${d}`);
      return { ...r, dateObj };
    })
    .filter(r => r.dateObj >= today && r.dateObj <= weekOut)
    .sort((a,b) => a.dateObj.getTime() - b.dateObj.getTime())
    .slice(0,5)
    .map(r => ({
      image: r.image,
      name:  r.name,
      date:  r.dateObj.toLocaleDateString("en-US",{month:"short",day:"numeric"}),
      link:  r.link,
    }));
}

// 2) fetch seasonal
async function fetchSeasonal() {
  const todayYMD = new Date().toISOString().slice(0,10);
  const { data } = await supabase
    .from("seasonal_events")
    .select(`name, date:start_date, slug, image:image_url`)
    .gte("end_date", todayYMD)
    .order("start_date",{ascending:true})
    .limit(4);

  return (data ?? []).map(e => {
    const dt = new Date(e.date);
    return {
      name:  e.name,
      slug:  e.slug,
      image: e.image,
      date:  dt.toLocaleDateString("en-US",{month:"short",day:"numeric"}),
    };
  });
}

// 3) fetch groups
async function fetchGroups() {
  const { data } = await supabase
    .from("groups")
    .select(`name:"Name", link:"Link", image:imag`)
    .order("Votes",{ascending:false})
    .limit(4);
  return data ?? [];
}

// 4a) SeatGeek concerts
async function fetchSeatGeekConcerts(perPage = 4) {
  const todayIso = new Date().toISOString();
  const url = new URL("https://api.seatgeek.com/2/events");
  url.searchParams.set("client_id",     SEATGEEK_CLIENT_ID);
  url.searchParams.set("client_secret", SEATGEEK_CLIENT_SECRET);
  url.searchParams.set("type",          "concert");
  url.searchParams.set("datetime_local.gte", todayIso);
  url.searchParams.set("lat",   "39.9526");
  url.searchParams.set("lon",   "-75.1652");
  url.searchParams.set("range", "30mi");
  url.searchParams.set("per_page", perPage.toString());

  const res = await fetch(url.toString());
  const json = await res.json();
  return (json.events||[]).map((e: any) => ({
    image: e.performers?.[0]?.image||null,
    name:  e.title,
    date:  new Date(e.datetime_local).toLocaleDateString("en-US",{month:"short",day:"numeric"}),
    link:  e.url,
  }));
}

// 4b) SeatGeek sports
async function fetchPhillySports(perPage = 20) {
  const slugs = ['philadelphia-phillies','philadelphia-76ers','philadelphia-eagles','philadelphia-flyers','philadelphia-union'];
  let all: any[] = [];
  for (const slug of slugs) {
    const url = new URL("https://api.seatgeek.com/2/events");
    url.searchParams.set("client_id",     SEATGEEK_CLIENT_ID);
    url.searchParams.set("client_secret", SEATGEEK_CLIENT_SECRET);
    url.searchParams.set("performers.slug", slug);
    url.searchParams.set("sort", "datetime_local.asc");
    url.searchParams.set("per_page", perPage.toString());
    const res = await fetch(url.toString());
    const json = await res.json();
    all.push(...(json.events||[]));
  }
  const unique = Array.from(new Map(all.map(e=>[e.id,e])).values());
  unique.sort((a,b)=>new Date(a.datetime_local).getTime() - new Date(b.datetime_local).getTime());
  return unique.slice(0,3).map((e: any) => ({
    image: e.performers?.[0]?.image||null,
    name:  e.short_title,
    date:  new Date(e.datetime_local).toLocaleDateString("en-US",{month:"short",day:"numeric"}),
    link:  e.url,
  }));
}

// helper to chunk an array into rows of N
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// our new table‐based email layout
const template = `
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:20px;background-color:#f4f4f4;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:8px;overflow:hidden;">
        <tr><td align="center" style="background:#BF3D35;padding:30px;">
          <img src="${LOGO_URL}" width="120" alt="Our Philly" style="display:block;border:0;outline:none;text-decoration:none;"/>
          <h1 style="color:#fff;font-size:36px;margin:10px 0;font-family:Arial,sans-serif;">Dig Into Philly</h1>
        </td></tr>
        {{#sections}}
        <tr><td style="padding:20px;">
          <h2 style="background:#28313E;color:#fff;padding:10px;border-radius:4px;text-align:center;margin:0 0 15px;font-size:18px;">{{title}}</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            {{#rows}}
            <tr>
              {{#.}}
              <td width="25%" valign="top" align="center" style="padding:10px;">
                {{#image}}<img src="{{image}}" alt="{{name}}" width="120" style="display:block;border:0;width:100%;max-width:120px;height:auto;"/>{{/image}}
                {{#date}}<div style="font-size:12px;color:#777;margin:8px 0;">{{date}}</div>{{/date}}
                <a href="{{link}}" style="color:#28313E;text-decoration:none;font-weight:bold;font-size:14px;">{{name}}</a>
              </td>
              {{/.}}
            </tr>
            {{/rows}}
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:15px;">
            <tr><td align="center">
              <a href="{{cta.url}}" style="display:inline-block;padding:10px 20px;background:#BF3D35;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;font-size:14px;">{{cta.text}}</a>
            </td></tr>
          </table>
        </td></tr>
        {{/sections}}
        <tr><td align="center" style="padding:20px;">
          <h3 style="color:#28313E;font-size:18px;margin:0 0 10px;">Philly’s Anonymous Voicemail</h3>
          <a href="${SITE_URL}/voicemail" style="display:inline-block;padding:10px 20px;background:#BF3D35;color:#fff;text-decoration:none;border-radius:4px;font-size:14px;">Leave a Voicemail</a>
        </td></tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin-top:20px;">
        <tr><td align="center" style="background:#28313E;color:#fff;padding:20px;border-radius:8px;font-size:12px;">
          &copy; ${new Date().getFullYear()} Our Philly. All rights reserved.<br/>
          <a href="${SITE_URL}/unsubscribe?token={{unsub_token}}" class="btn-red">
  Unsubscribe</a>
          <img src="${LOGO_URL}" width="100" alt="Our Philly Logo" style="display:block;margin:10px auto 0;opacity:.8;border:0;"/>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

serve(async (req) => {
  const url       = new URL(req.url);
  const isPreview = url.searchParams.get("preview") === "true";

  // load all data in parallel
  const [events, seasonal, groups, sports, concerts] = await Promise.all([
    fetchCustomEvents(),
    fetchSeasonal(),
    fetchGroups(),
    fetchPhillySports(),
    fetchSeatGeekConcerts(4),
  ]);

  // chunk into rows of 4
  const sections = [
    {
      title: 'UPCOMING TRADITIONS',
      rows: chunk(events, 4),
      cta: { url: `${SITE_URL}/upcoming-events`, text: 'More Events →' }
    },
    {
      title: 'SEASONAL STUFF',
      rows: chunk(seasonal, 4),
      cta: { url: `${SITE_URL}/upcoming-events`, text: 'See All Seasonal →' }
    },
    {
      title: 'GAMES THIS WEEK',
      rows: chunk(sports, 4),
      cta: { url: `${SITE_URL}/groups/type/sports-fans`, text: 'More Sports Fans →' }
    },
    {
      title: 'CONCERTS THIS WEEK',
      rows: chunk(concerts, 4),
      cta: { url: `${SITE_URL}/upcoming-events`, text: 'More Concerts →' }
    },
    {
      title: 'POPULAR GROUPS',
      rows: chunk(groups, 4),
      cta: { url: `${SITE_URL}/groups`, text: 'Browse All Groups →' }
    },
  ];

  // get one sample token
  const { data: sample } = await supabase
    .from("newsletter_subscribers")
    .select("unsub_token")
    .limit(1);
  const sampleToken = sample?.[0]?.unsub_token ?? "";

  if (isPreview) {
    const html = Mustache.render(template, { sections, unsub_token: sampleToken });
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // send to each subscriber
  const { data: subs } = await supabase
    .from("newsletter_subscribers")
    .select("email, unsub_token");
  for (const { email, unsub_token } of subs ?? []) {
    const html = Mustache.render(template, { sections, unsub_token });
    await supabase.functions.invoke("send-email", {
      body: { to: email, subject: `Dig Into Philly: ${new Date().toLocaleDateString()}`, html }
    });
  }

  return new Response("📰 Sent!", { status: 200 });
});
