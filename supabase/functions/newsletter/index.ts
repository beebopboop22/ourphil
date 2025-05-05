// supabase/functions/newsletter/index.ts
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import Mustache from "https://esm.sh/mustache";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")!;
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
  return (json.events||[]).map((e:any)=>({
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
  unique.sort((a,b)=>new Date(a.datetime_local).getTime()-new Date(b.datetime_local).getTime());
  return unique.slice(0,3).map((e:any)=>({
    image: e.performers?.[0]?.image||null,
    name:  e.short_title,
    date:  new Date(e.datetime_local).toLocaleDateString("en-US",{month:"short",day:"numeric"}),
    link:  e.url,
  }));
}

serve(async (req) => {
  const url       = new URL(req.url);
  const isPreview = url.searchParams.get("preview")==="true";

  // load all data in parallel
  const [events, seasonal, groups, sports, concerts] = await Promise.all([
    fetchCustomEvents(),
    fetchSeasonal(),
    fetchGroups(),
    fetchPhillySports(),
    fetchSeatGeekConcerts(4),
  ]);

  // Mustache template
  const template = `
<html><head><meta charset="utf-8"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Barrio&display=swap');
    body,h1,h2,h3,p,a{font-family:'Barrio',cursive,Arial,sans-serif;}
    body{background:#f4f4f4;margin:0;padding:20px;}
    .container{max-width:800px;margin:0 auto;background:#fff;padding:20px;border-radius:8px;}
    .header{text-align:center;background:#BF3D35;padding:30px;border-radius:8px;}
    .logo{width:120px;} .header h1{font-size:36px;color:#fff;margin:10px 0;}
    .section{margin:30px 0;} .section h2{background:#28313E;color:#fff;padding:10px;border-radius:4px;text-align:center;}
    ul.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;padding:0;list-style:none;}
    ul.grid li{background:#fafafa;border:1px solid #ddd;border-radius:8px;text-align:center;}
    ul.grid img{width:100%;display:block;} .date{color:#777;margin:10px 0;font-size:.9em;}
    a.title{display:block;padding:0 10px 10px;color:#28313E;text-decoration:none;font-weight:bold;}
    .btn-red{display:block;width:100%;padding:10px;text-align:center;background:#BF3D35;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;}
    .voicemail{text-align:center;margin:30px 0;} .voicemail h3{color:#28313E;}
    .voicemail a{background:#BF3D35;color:#fff;padding:10px;text-decoration:none;border-radius:4px;}
    .footer{position:relative;background:#28313E;color:#fff;padding:20px;border-radius:8px;}
    .footer p{margin:0;} .footer-logo{position:absolute;bottom:10px;right:10px;width:100px;opacity:.8;}
  </style>
</head><body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" class="logo" alt="Our Philly"/>
      <h1>Dig Into Philly</h1>
    </div>

    <div class="section"><h2>UPCOMING TRADITIONS</h2>
      <ul class="grid">{{#events}}<li>
        {{#image}}<img src="{{image}}" alt="{{name}}"/>{{/image}}
        <div class="date">{{date}}</div>
        <a href="{{link}}" class="title">{{name}}</a>
      </li>{{/events}}</ul>
      <a href="${SITE_URL}/upcoming-events" class="btn-red">More Events →</a>
    </div>

    <div class="section"><h2>SEASONAL STUFF</h2>
      <ul class="grid">{{#seasonal}}<li>
        {{#image}}<img src="{{image}}" alt="{{name}}"/>{{/image}}
        <div class="date">{{date}}</div>
        <a href="${SITE_URL}/seasonal/{{slug}}" class="title">{{name}}</a>
      </li>{{/seasonal}}</ul>
      <a href="${SITE_URL}/upcoming-events" class="btn-red">See All Seasonal →</a>
    </div>

    <div class="section"><h2>GAMES THIS WEEK</h2>
      <ul class="grid">{{#sports}}<li>
        {{#image}}<img src="{{image}}" alt="{{name}}"/>{{/image}}
        <div class="date">{{date}}</div>
        <a href="{{link}}" class="title">{{name}}</a>
      </li>{{/sports}}</ul>
      <a href="${SITE_URL}/groups/type/sports-fans" class="btn-red">More Sports Fans →</a>
    </div>

    <div class="section"><h2>CONCERTS THIS WEEK</h2>
      <ul class="grid">{{#concerts}}<li>
        {{#image}}<img src="{{image}}" alt="{{name}}"/>{{/image}}
        <div class="date">{{date}}</div>
        <a href="{{link}}" class="title">{{name}}</a>
      </li>{{/concerts}}</ul>
      <a href="${SITE_URL}/upcoming-events" class="btn-red">More Concerts →</a>
    </div>

    <div class="section"><h2>POPULAR GROUPS</h2>
      <ul class="grid">{{#groups}}<li>
        {{#image}}<img src="{{image}}" alt="{{name}}"/>{{/image}}
        <a href="{{link}}" class="title">{{name}}</a>
      </li>{{/groups}}</ul>
      <a href="${SITE_URL}/groups" class="btn-red">Browse All Groups →</a>
    </div>

    <div class="voicemail">
      <h3>Philly’s Anonymous Voicemail</h3>
      <a href="${SITE_URL}/voicemail">Leave a Voicemail Now</a>
    </div>
  </div>

  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} Our Philly. All rights reserved.</p>
    <a href="https://www.ourphilly.org/unsubscribe?token={{unsub_token}}" class="btn-red">
      Unsubscribe
    </a>
    <img src="${LOGO_URL}" class="footer-logo" alt="Our Philly Logo"/>
  </div>
</body></html>
`;

  // ── preview: fetch sampleToken ─────────────────────────────────────────
  const { data: sample } = await supabase
    .from("newsletter_subscribers")
    .select("unsub_token")
    .limit(1);
  const sampleToken = sample?.[0]?.unsub_token ?? "";

  if (isPreview) {
    const html = Mustache.render(template, {
      events, seasonal, groups, sports, concerts,
      unsub_token: sampleToken
    });
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // ── real send: render per subscriber ────────────────────────────────────
  const { data: subs } = await supabase
    .from("newsletter_subscribers")
    .select("email, unsub_token");

  for (const { email, unsub_token } of subs ?? []) {
    const html = Mustache.render(template, { events, seasonal, groups, sports, concerts, unsub_token });
    await supabase.functions.invoke("send-email", {
      body: {
        to:      email,
        subject: `Dig Into Philly: ${new Date().toLocaleDateString()}`,
        html,
      },
    });
  }

  return new Response("📰 Sent!", { status: 200 });
});
