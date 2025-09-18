// scripts/generate-sitemap.js
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { indexToMonthSlug } from '../src/utils/dateUtils.js'

// Load .env into process.env
dotenv.config()

// ── CONFIG ───────────────────────────────────────────────────────────────
const SUPABASE_URL      = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('⚠️  Missing SUPABASE_URL or SUPABASE_ANON_KEY/SUPABASE_KEY in your environment.')
  process.exit(1)
}

const HOST  = 'https://ourphilly.org'
const TODAY = new Date().toISOString().slice(0,10)
const now = new Date()
const currentYear = now.getFullYear()
const currentMonthIndex = now.getMonth() + 1
const currentMonthSlug = indexToMonthSlug(currentMonthIndex)
const monthlyPath = currentMonthSlug
  ? `/philadelphia-events-${currentMonthSlug}-${currentYear}/`
  : '/philadelphia-events/'

// Always‐on static routes
const staticPages = [
  { path: '/',        priority: '1.0', changefreq: 'daily'   },
  { path: '/groups',  priority: '0.6', changefreq: 'weekly'  },
  { path: '/contact', priority: '0.6', changefreq: 'monthly' },
  { path: '/traditions-faq', priority: '0.6', changefreq: 'monthly' },
  { path: '/this-weekend-in-philadelphia/', priority: '0.8', changefreq: 'weekly' },
  { path: monthlyPath, priority: '0.7', changefreq: 'monthly' },
]

async function buildSitemap() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  // 1) all_events ➔ /venue-slug/event-slug
  const { data: allEvents = [], error: aeErr } = await supabase
    .from('all_events')
    .select('slug, venues:venue_id (slug)')
  if (aeErr) throw aeErr

  // 2) legacy “events” ➔ /events/event-slug
  const { data: legacyEvents = [], error: evErr } = await supabase
    .from('events')
    .select('slug')
  if (evErr) throw evErr

  // 3) big_board_events ➔ /big-board/event-slug
  const { data: bigs = [], error: bbErr } = await supabase
    .from('big_board_events')
    .select('slug')
  if (bbErr) throw bbErr

  // 4) tags ➔ /tags/tag-name
  const { data: tags = [], error: tagErr } = await supabase
    .from('tags')
    .select('name')
  if (tagErr) throw tagErr

  // Build an array of XML fragments
  const xmlParts = []

  // XML header + opening tag
  xmlParts.push(
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`
  )

  // static pages
  for (let page of staticPages) {
    xmlParts.push(
      `  <url>`,
      `    <loc>${HOST}${page.path}</loc>`,
      `    <lastmod>${TODAY}</lastmod>`,
      `    <changefreq>${page.changefreq}</changefreq>`,
      `    <priority>${page.priority}</priority>`,
      `  </url>`
    )
  }

  // all_events
  for (let ev of allEvents) {
    if (!ev.venues?.slug) continue
    xmlParts.push(
      `  <url>`,
      `    <loc>${HOST}/${ev.venues.slug}/${ev.slug}</loc>`,
      `    <lastmod>${TODAY}</lastmod>`,
      `    <changefreq>weekly</changefreq>`,
      `    <priority>0.7</priority>`,
      `  </url>`
    )
  }

  // legacy events
  for (let ev of legacyEvents) {
    xmlParts.push(
      `  <url>`,
      `    <loc>${HOST}/events/${ev.slug}</loc>`,
      `    <lastmod>${TODAY}</lastmod>`,
      `    <changefreq>weekly</changefreq>`,
      `    <priority>0.7</priority>`,
      `  </url>`
    )
  }

  // big-board events
  for (let b of bigs) {
    xmlParts.push(
      `  <url>`,
      `    <loc>${HOST}/big-board/${b.slug}</loc>`,
      `    <lastmod>${TODAY}</lastmod>`,
      `    <changefreq>weekly</changefreq>`,
      `    <priority>0.7</priority>`,
      `  </url>`
    )
  }

  // tags
  for (let t of tags) {
    xmlParts.push(
      `  <url>`,
      `    <loc>${HOST}/tags/${t.name.toLowerCase()}</loc>`,
      `    <lastmod>${TODAY}</lastmod>`,
      `    <changefreq>weekly</changefreq>`,
      `    <priority>0.6</priority>`,
      `  </url>`
    )
  }

  // closing tag
  xmlParts.push(`</urlset>`)

  // join with real newlines
  const xml = xmlParts.join('\n')

  // write to public/sitemap.xml
  const outPath = path.resolve(process.cwd(), 'public', 'sitemap.xml')
  fs.writeFileSync(outPath, xml, 'utf8')
  console.log(`✅ sitemap.xml generated at ${outPath}`)
}

buildSitemap().catch(err => {
  console.error('❌ sitemap generation failed:', err)
  process.exit(1)
})
