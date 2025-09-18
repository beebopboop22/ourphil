// scripts/generate-sitemap.js
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  PHILLY_TIME_ZONE,
  formatMonthYear,
  getZonedDate,
  indexToMonthSlug,
} from '../src/utils/dateUtils.js'

// Load .env into process.env
dotenv.config()

// ── CONFIG ───────────────────────────────────────────────────────────────
const SUPABASE_URL      = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('⚠️  Missing SUPABASE_URL or SUPABASE_ANON_KEY/SUPABASE_KEY in your environment.')
  process.exit(1)
}

const HOST = 'https://ourphilly.org'

const zonedNow = getZonedDate(new Date(), PHILLY_TIME_ZONE)
const TODAY = zonedNow.toISOString().slice(0, 10)
const currentMonthSlug = indexToMonthSlug(zonedNow.getMonth() + 1)
const currentYear = zonedNow.getFullYear()
const currentMonthlyPath = currentMonthSlug
  ? `/philadelphia-events-${currentMonthSlug}-${currentYear}/`
  : null
const currentMonthlyLabel = formatMonthYear(zonedNow, PHILLY_TIME_ZONE)

// Always‐on static routes
const staticPages = [
  { path: '/',        priority: '1.0', changefreq: 'daily'   },
  { path: '/groups',  priority: '0.6', changefreq: 'weekly'  },
  { path: '/contact', priority: '0.6', changefreq: 'monthly' },
  { path: '/traditions-faq', priority: '0.6', changefreq: 'monthly' },
  { path: '/this-weekend-in-philadelphia/', priority: '0.8', changefreq: 'weekly' },
]

if (currentMonthlyPath) {
  staticPages.push({
    path: currentMonthlyPath,
    priority: '0.8',
    changefreq: 'monthly',
  })
}

if (currentMonthlyPath && currentMonthlyLabel) {
  console.log(
    `ℹ️ Including monthly page for ${currentMonthlyLabel}: ${HOST}${currentMonthlyPath.slice(1)}`
  )
}

const ensureTrailingSlash = url => (url.endsWith('/') ? url : `${url}/`)

function toAbsoluteUrl(value) {
  if (!value) {
    return ensureTrailingSlash(HOST)
  }

  const trimmed = value.trim()
  const hasProtocol = /^https?:\/\//i.test(trimmed)
  if (hasProtocol) {
    return ensureTrailingSlash(trimmed)
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return ensureTrailingSlash(`${HOST}${withLeadingSlash}`)
}

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
  const seenUrls = new Set()

  function addUrlEntry({ loc, changefreq, priority, lastmod = TODAY }) {
    const absoluteUrl = toAbsoluteUrl(loc)
    if (seenUrls.has(absoluteUrl)) return
    seenUrls.add(absoluteUrl)

    xmlParts.push(
      `  <url>`,
      `    <loc>${absoluteUrl}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      `  </url>`
    )
  }

  // XML header + opening tag
  xmlParts.push(
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`
  )

  // static pages
  for (let page of staticPages) {
    addUrlEntry({
      loc: page.path,
      changefreq: page.changefreq,
      priority: page.priority,
    })
  }

  // all_events
  for (let ev of allEvents) {
    if (!ev.venues?.slug) continue
    addUrlEntry({
      loc: `/${ev.venues.slug}/${ev.slug}`,
      changefreq: 'weekly',
      priority: '0.7',
    })
  }

  // legacy events
  for (let ev of legacyEvents) {
    addUrlEntry({
      loc: `/events/${ev.slug}`,
      changefreq: 'weekly',
      priority: '0.7',
    })
  }

  // big-board events
  for (let b of bigs) {
    addUrlEntry({
      loc: `/big-board/${b.slug}`,
      changefreq: 'weekly',
      priority: '0.7',
    })
  }

  // tags
  for (let t of tags) {
    addUrlEntry({
      loc: `/tags/${t.name.toLowerCase()}`,
      changefreq: 'weekly',
      priority: '0.6',
    })
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
