/* eslint-env node */
/* eslint-disable no-console */
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
import getDetailPathForItem from '../src/utils/eventDetailPaths.js'
import { CATEGORY_ORDER } from '../src/utils/monthlyCategoryConfig.js'

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

  CATEGORY_ORDER.forEach(cat => {
    staticPages.push({
      path: `/${cat.slug}-events-in-philadelphia-${currentMonthSlug}-${currentYear}/`,
      priority: '0.8',
      changefreq: 'weekly',
    })
  })
}

staticPages.push({
  path: '/all-guides/',
  priority: '0.7',
  changefreq: 'weekly',
})

if (currentMonthlyPath && currentMonthlyLabel) {
  console.log(
    `ℹ️ Including monthly page for ${currentMonthlyLabel}: ${HOST}${currentMonthlyPath.slice(1)}`
  )
}

function toAbsoluteUrl(value) {
  if (!value) {
    return `${HOST}/`
  }

  const trimmed = value.trim()
  if (!trimmed) return `${HOST}/`

  if (/^https?:\/\//i.test(trimmed)) {
    const normalized = trimmed.replace(/\/+$/, '')
    return normalized || `${HOST}/`
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  if (withLeadingSlash === '/') return `${HOST}/`
  return `${HOST}${withLeadingSlash}`
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

  // 4) seasonal events ➔ /seasonal/event-slug
  const { data: seasonal = [], error: seasonalErr } = await supabase
    .from('seasonal_events')
    .select('slug')
  if (seasonalErr) throw seasonalErr

  // 5) group events ➔ /groups/group-slug/events/event-id
  const { data: groupEvents = [], error: groupErr } = await supabase
    .from('group_events')
    .select('id, slug, group_id, groups:group_id (slug)')
  if (groupErr) throw groupErr

  // 6) recurring events ➔ /series/:slug[/date]
  const { data: recurringEvents = [], error: recErr } = await supabase
    .from('recurring_events')
    .select('slug, start_date, next_start_date, end_date, rrule')
    .eq('is_active', true)
  if (recErr) throw recErr

  // 7) tags ➔ /tags/tag-name
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
    const loc = getDetailPathForItem({
      ...ev,
      venue_slug: ev.venues?.slug,
      venues: ev.venues,
    })
    if (!loc) continue
    addUrlEntry({
      loc,
      changefreq: 'weekly',
      priority: '0.7',
    })
  }

  // legacy events
  for (let ev of legacyEvents) {
    const loc = getDetailPathForItem(ev)
    if (!loc) continue
    addUrlEntry({
      loc,
      changefreq: 'weekly',
      priority: '0.7',
    })
  }

  // big-board events
  for (let b of bigs) {
    const loc = getDetailPathForItem({ ...b, isBigBoard: true })
    if (!loc) continue
    addUrlEntry({
      loc,
      changefreq: 'weekly',
      priority: '0.7',
    })
  }

  // seasonal events
  for (let s of seasonal) {
    const loc = getDetailPathForItem({ ...s, isSeasonal: true })
    if (!loc) continue
    addUrlEntry({
      loc,
      changefreq: 'weekly',
      priority: '0.6',
    })
  }

  // group events
  for (let g of groupEvents) {
    const loc = getDetailPathForItem({
      ...g,
      group_slug: g.groups?.slug,
      isGroupEvent: true,
    })
    if (!loc) continue
    addUrlEntry({
      loc,
      changefreq: 'weekly',
      priority: '0.6',
    })
  }

  // recurring series
  for (let r of recurringEvents) {
    const loc = getDetailPathForItem({
      ...r,
      isRecurring: true,
    })
    if (!loc) continue
    addUrlEntry({
      loc,
      changefreq: 'weekly',
      priority: '0.6',
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
