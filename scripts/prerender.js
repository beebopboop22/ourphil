import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import RRuleModule from 'rrule'
import { getDetailPathForItem } from '../src/utils/eventDetailPaths.js'
import {
  PHILLY_TIME_ZONE,
  formatLongWeekday,
  formatMonthDay,
  getZonedDate,
  parseISODate,
} from '../src/utils/dateUtils.js'
const { RRule } = RRuleModule

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const DIST_PRERENDER_DIR = path.join(ROOT_DIR, 'dist', 'prerender')

const DEFAULT_HOST = 'https://ourphilly.org'
const REMOVAL_SCRIPT = "window.addEventListener('ourphilly:hydrated',function(){var el=document.getElementById('prerender-content');if(el){el.remove();}});"

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('⚠️  Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment. Skipping prerender.')
  process.exit(0)
}

const SITE_HOST = process.env.SITE_HOST || DEFAULT_HOST

function toAbsoluteUrl(pathname = '/') {
  try {
    const url = new URL(pathname, SITE_HOST)
    return url.toString()
  } catch (err) {
    return `${SITE_HOST.replace(/\/$/, '')}/${String(pathname).replace(/^\//, '')}`
  }
}

function formatTimeLabel(time) {
  if (!time) return ''
  const [hoursStr, minutesStr = '00'] = time.split(':')
  let hours = Number.parseInt(hoursStr, 10)
  if (Number.isNaN(hours)) return ''
  const suffix = hours >= 12 ? 'p.m.' : 'a.m.'
  hours = hours % 12 || 12
  return `${hours}:${minutesStr.padStart(2, '0')} ${suffix}`
}

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => HTML_ESCAPE_MAP[char] || char)
}

function renderParagraphs(text) {
  if (!text) return ''
  const parts = String(text)
    .split(/\n+/)
    .map(chunk => chunk.trim())
    .filter(Boolean)
  if (!parts.length) return ''
  return parts
    .map(paragraph => `<p class="mt-3 text-lg text-slate-700 leading-relaxed">${escapeHtml(paragraph)}</p>`)
    .join('')
}

function renderHighlightList(items = []) {
  if (!items.length) return ''
  const inner = items
    .map(item => `<li class="leading-relaxed">${escapeHtml(item)}</li>`)
    .join('')
  return `<ul class="mt-4 grid gap-2 list-disc list-inside text-base text-slate-700">${inner}</ul>`
}

function parseDate(dateStr) {
  if (!dateStr) return null
  const parsed = parseISODate(dateStr, PHILLY_TIME_ZONE)
  return parsed ?? null
}

function formatDateRange({ startDate, endDate, startTime, endTime }) {
  const start = parseDate(startDate)
  const end = parseDate(endDate)
  if (!start && !end) return ''

  const startLabel = start
    ? `${formatLongWeekday(start, PHILLY_TIME_ZONE)}, ${formatMonthDay(start, PHILLY_TIME_ZONE)}`
    : ''
  const endLabel =
    end && (!start || end.getTime() !== start.getTime())
      ? `${formatLongWeekday(end, PHILLY_TIME_ZONE)}, ${formatMonthDay(end, PHILLY_TIME_ZONE)}`
      : null

  const timeParts = []
  if (startTime) timeParts.push(`Starts ${formatTimeLabel(startTime)}`)
  if (endTime) timeParts.push(`Ends ${formatTimeLabel(endTime)}`)

  const windowLabel = endLabel ? `${startLabel} – ${endLabel}` : startLabel
  const timing = timeParts.length ? ` (${timeParts.join(' · ')})` : ''
  return `${windowLabel}${timing}`.trim()
}

function buildEventSchema(event, canonicalUrl) {
  const start = event.startDate ? new Date(`${event.startDate}T${event.startTime || '00:00'}:00`) : null
  const end = event.endDate ? new Date(`${event.endDate}T${event.endTime || '00:00'}:00`) : null

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description || event.summary || '',
    url: canonicalUrl,
  }

  if (event.address) {
    schema.location = {
      '@type': 'Place',
      name: event.venueName || event.address,
      address: event.address,
    }
  } else if (event.venueName) {
    schema.location = {
      '@type': 'Place',
      name: event.venueName,
    }
  }

  if (start && !Number.isNaN(start.valueOf())) {
    schema.startDate = start.toISOString()
  }

  if (end && !Number.isNaN(end.valueOf())) {
    schema.endDate = end.toISOString()
  }

  if (event.link) {
    schema.offers = {
      '@type': 'Offer',
      url: event.link,
      availability: 'https://schema.org/InStock',
    }
  }

  return schema
}

function renderEventArticle(event) {
  const dateRange = formatDateRange(event)
  const headline = `<h1 class="mt-2 text-4xl font-semibold text-slate-900">${escapeHtml(event.title)}</h1>`
  const dateLine = dateRange ? `<p class="mt-3 text-lg text-slate-600">${escapeHtml(dateRange)}</p>` : ''
  const defaultParagraph =
    '<p class="mt-4 text-lg text-slate-700">Discover everything happening in Philadelphia with Our Philly&#39;s curated event coverage.</p>'
  const paragraphs =
    renderParagraphs(event.description) ||
    renderParagraphs(event.summary) ||
    defaultParagraph

  const highlights = []
  if (event.venueName) {
    highlights.push(`Hosted at ${event.venueName}`)
  }
  if (event.address) {
    highlights.push(`Location: ${event.address}`)
  }
  if (event.link) {
    highlights.push(`Official site: ${event.link}`)
  }

  const highlightList = renderHighlightList(highlights)
  const planningCopy =
    '<section class="mt-8 border-t border-slate-200 pt-6">' +
    '<h2 class="text-2xl font-semibold text-slate-900">Plan your visit</h2>' +
    '<p class="mt-3 text-base text-slate-700 leading-relaxed">Our Philly tracks thousands of local happenings across music, nightlife, culture, family fun, and seasonal traditions. This guide is part of our SEO initiative unlocking more than 5.5 million monthly searches for Philadelphia plans.</p>' +
    '</section>'

  return (
    '<article class="max-w-3xl mx-auto px-6 py-12">' +
    '<header>' +
    '<p class="text-sm uppercase tracking-wide text-indigo-600">Philadelphia Event Guide</p>' +
    headline +
    dateLine +
    '</header>' +
    paragraphs +
    highlightList +
    planningCopy +
    '</article>'
  )
}

function renderOverviewPage({ title, intro, sections }) {
  const sectionHtml = sections
    .map(section => {
      const points = renderHighlightList(section.points || [])
      return (
        '<section>' +
        `<h2 class="text-2xl font-semibold text-slate-900">${escapeHtml(section.title)}</h2>` +
        `<p class="mt-3 text-base text-slate-700 leading-relaxed">${escapeHtml(section.body)}</p>` +
        points +
        '</section>'
      )
    })
    .join('')

  return (
    '<article class="max-w-4xl mx-auto px-6 py-12">' +
    '<header>' +
    `<h1 class="text-4xl font-semibold text-slate-900">${escapeHtml(title)}</h1>` +
    `<p class="mt-4 text-lg text-slate-700 leading-relaxed">${escapeHtml(intro)}</p>` +
    '</header>' +
    `<div class="mt-8 space-y-10">${sectionHtml}</div>` +
    '</article>'
  )
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

function resolveOutputPath(routePath) {
  if (!routePath || routePath === '/') {
    return path.join(DIST_PRERENDER_DIR, 'index.html')
  }
  const normalized = routePath.replace(/^\/+/, '').replace(/\/+$/, '')
  return path.join(DIST_PRERENDER_DIR, normalized, 'index.html')
}

function collectManifestAssets(manifest) {
  const entry = manifest['src/main.jsx']
  if (!entry) {
    throw new Error('Could not find src/main.jsx in manifest.json. Ensure vite build ran first.')
  }

  const cssFiles = new Set(entry.css || [])
  const modulePreloads = new Set()

  function walkImports(importIds = []) {
    for (const id of importIds) {
      const meta = manifest[id]
      if (!meta) continue
      if (meta.file) modulePreloads.add(meta.file)
      ;(meta.css || []).forEach(file => cssFiles.add(file))
      if (meta.imports) walkImports(meta.imports)
    }
  }

  walkImports(entry.imports || [])

  return {
    entryFile: entry.file,
    cssFiles: Array.from(cssFiles),
    preloadFiles: Array.from(modulePreloads),
  }
}

function renderDocument({ title, description, canonicalPath, main, jsonLd }, assets) {
  const canonicalUrl = toAbsoluteUrl(canonicalPath || '/')
  const headParts = [
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title>`,
  ]

  if (description) {
    const safeDescription = escapeHtml(description)
    headParts.push(`<meta name="description" content="${safeDescription}" />`)
    headParts.push(`<meta property="og:description" content="${safeDescription}" />`)
    headParts.push(`<meta name="twitter:description" content="${safeDescription}" />`)
  }

  const safeTitle = escapeHtml(title)
  headParts.push(`<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`)
  headParts.push(`<meta property="og:title" content="${safeTitle}" />`)
  headParts.push(`<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`)
  headParts.push('<meta property="og:type" content="website" />')
  headParts.push('<meta name="twitter:card" content="summary_large_image" />')

  assets.cssFiles.forEach(file => {
    headParts.push(`<link rel="stylesheet" href="/${file}" />`)
  })

  assets.preloadFiles.forEach(file => {
    headParts.push(`<link rel="modulepreload" href="/${file}" />`)
  })

  const jsonLdTag = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\u003C')}</script>`
    : ''

  const bodyHtml =
    `<body class="bg-slate-50">` +
    '<div id="root"></div>' +
    `<main id="prerender-content" class="min-h-screen bg-white shadow-sm">${main}</main>` +
    `<script>${REMOVAL_SCRIPT}</script>` +
    jsonLdTag +
    `<script type="module" src="/${assets.entryFile}"></script>` +
    '</body>'

  return `<!DOCTYPE html><html lang="en"><head>${headParts.join('')}</head>${bodyHtml}</html>`
}

async function writePrerenderPage(routePath, html) {
  const outPath = resolveOutputPath(routePath)
  await ensureDir(outPath)
  await fs.writeFile(outPath, html, 'utf8')
}

function normalizeEventRow(row, overrides = {}) {
  return {
    title: (row.title || row.name || row['E Name'] || '').trim(),
    description: row.description || row['E Description'] || '',
    summary: row.summary || '',
    startDate: row.start_date || row.startDate || row.Dates || overrides.startDate || null,
    endDate: row.end_date || row.endDate || row['End Date'] || overrides.endDate || null,
    startTime: row.start_time || row.startTime || row['Start Time'] || overrides.startTime || null,
    endTime: row.end_time || row.endTime || row['End Time'] || overrides.endTime || null,
    address: row.address || overrides.address || '',
    link: row.link || row['Event Website'] || overrides.link || '',
    venueName: row.venues?.name || row.venue?.name || overrides.venueName || '',
  }
}

async function loadData(client) {
  const [allEventsRes, legacyEventsRes, bigBoardRes, seasonalRes, groupEventsRes, recurringRes, tagsRes] = await Promise.all([
    client
      .from('all_events')
      .select('id, slug, name, description, start_date, end_date, start_time, end_time, link, address, venues:venue_id (slug, name)')
      .limit(5000),
    client
      .from('events')
      .select('id, slug, "E Name", "E Description", Dates, "End Date", "Start Time", "End Time", "Event Website"')
      .limit(5000),
    client
      .from('big_board_events')
      .select('id, slug, title, description, start_date, end_date, start_time, end_time, link, address')
      .limit(5000),
    client
      .from('seasonal_events')
      .select('id, slug, title, description, start_date, end_date, link, address')
      .limit(2000),
    client
      .from('group_events')
      .select('id, slug, title, description, start_date, end_date, start_time, end_time, address, groups:group_id (slug, name)')
      .limit(5000),
    client
      .from('recurring_events')
      .select('id, slug, name, description, address, link, start_date, end_date, start_time, end_time, rrule, next_start_date')
      .eq('is_active', true)
      .limit(2000),
    client
      .from('tags')
      .select('id, slug, name, description')
      .limit(2000),
  ])

  return {
    allEvents: allEventsRes.data || [],
    legacyEvents: legacyEventsRes.data || [],
    bigBoardEvents: bigBoardRes.data || [],
    seasonalEvents: seasonalRes.data || [],
    groupEvents: groupEventsRes.data || [],
    recurringEvents: recurringRes.data || [],
    tags: tagsRes.data || [],
  }
}

function ensureLeadingSlash(value) {
  if (!value) return '/'
  return value.startsWith('/') ? value : `/${value}`
}

function computeRecurringPaths(recurring) {
  const basePath = getDetailPathForItem({
    slug: recurring.slug,
    source_table: 'recurring_events',
  })
  const paths = new Set()
  if (basePath) paths.add(basePath)

  const nextOccurrence = recurring.next_start_date || recurring.start_date
  if (nextOccurrence) {
    const datedPath = getDetailPathForItem({
      slug: recurring.slug,
      source_table: 'recurring_events',
      next_start_date: recurring.next_start_date,
      start_date: recurring.start_date,
      id: `${recurring.id}::${nextOccurrence}`,
    })
    if (datedPath) paths.add(datedPath)
  }

  if (recurring.rrule && recurring.start_date) {
    try {
      const options = RRule.parseString(recurring.rrule)
      options.dtstart = new Date(`${recurring.start_date}T${recurring.start_time || '00:00'}:00`)
      if (recurring.end_date) {
        options.until = new Date(`${recurring.end_date}T23:59:59`)
      }
      const rule = new RRule(options)
      const now = getZonedDate(new Date(), PHILLY_TIME_ZONE)
      const upcoming = rule.after(now, true)
      if (upcoming) {
        const iso = upcoming.toISOString().slice(0, 10)
        const datedPath = ensureLeadingSlash(`/series/${recurring.slug}/${iso}`)
        paths.add(datedPath)
      }
    } catch (err) {
      // ignore malformed rrule entries
    }
  }

  return Array.from(paths)
}

async function generatePages(data, assets) {
  const written = new Set()

  async function writeUnique(pathname, html) {
    if (!pathname) return
    const normalized = pathname.replace(/\/$/, '') || '/'
    if (written.has(normalized)) return
    written.add(normalized)
    await writePrerenderPage(normalized, html)
  }

  for (const event of data.allEvents) {
    const pathName = getDetailPathForItem({
      slug: event.slug,
      venues: event.venues,
    })
    if (!pathName) continue
    const normalized = normalizeEventRow(event, {
      venueName: event.venues?.name,
    })
    const title = `${normalized.title} | Philadelphia Events Guide`
    const description = normalized.description
      ? `${normalized.title} in Philadelphia: ${normalized.description.replace(/\s+/g, ' ').slice(0, 150)}`
      : `${normalized.title} in Philadelphia on Our Philly.`
    const html = renderDocument(
      {
        title,
        description,
        canonicalPath: pathName,
        main: renderEventArticle(normalized),
        jsonLd: buildEventSchema(normalized, toAbsoluteUrl(pathName)),
      },
      assets
    )
    await writeUnique(pathName, html)
  }

  for (const legacy of data.legacyEvents) {
    const pathName = getDetailPathForItem({
      slug: legacy.slug,
      source_table: 'events',
    })
    if (!pathName) continue
    const normalized = normalizeEventRow(legacy)
    const title = `${normalized.title} | Philadelphia Traditions`
    const description = normalized.description
      ? `${normalized.title}: ${normalized.description.replace(/\s+/g, ' ').slice(0, 150)}`
      : `${normalized.title} is a Philadelphia tradition featured on Our Philly.`
    const html = renderDocument(
      {
        title,
        description,
        canonicalPath: pathName,
        main: renderEventArticle(normalized),
        jsonLd: buildEventSchema(normalized, toAbsoluteUrl(pathName)),
      },
      assets
    )
    await writeUnique(pathName, html)
  }

  for (const big of data.bigBoardEvents) {
    const pathName = getDetailPathForItem({
      slug: big.slug,
      source_table: 'big_board_events',
    })
    if (!pathName) continue
    const normalized = normalizeEventRow(big)
    const title = `${normalized.title} | Community Events in Philadelphia`
    const description = normalized.description
      ? `${normalized.title}: ${normalized.description.replace(/\s+/g, ' ').slice(0, 150)}`
      : `${normalized.title} is a featured event on Our Philly's Big Board.`
    const html = renderDocument(
      {
        title,
        description,
        canonicalPath: pathName,
        main: renderEventArticle(normalized),
        jsonLd: buildEventSchema(normalized, toAbsoluteUrl(pathName)),
      },
      assets
    )
    await writeUnique(pathName, html)
  }

  for (const seasonal of data.seasonalEvents) {
    const pathName = getDetailPathForItem({
      slug: seasonal.slug,
      source_table: 'seasonal_events',
    })
    if (!pathName) continue
    const normalized = normalizeEventRow(seasonal)
    const title = `${normalized.title} | Seasonal Events in Philadelphia`
    const description = normalized.description
      ? `${normalized.title}: ${normalized.description.replace(/\s+/g, ' ').slice(0, 150)}`
      : `${normalized.title} is part of Philadelphia's seasonal celebrations.`
    const html = renderDocument(
      {
        title,
        description,
        canonicalPath: pathName,
        main: renderEventArticle(normalized),
        jsonLd: buildEventSchema(normalized, toAbsoluteUrl(pathName)),
      },
      assets
    )
    await writeUnique(pathName, html)
  }

  for (const groupEvent of data.groupEvents) {
    const pathName = getDetailPathForItem({
      slug: groupEvent.slug,
      groups: groupEvent.groups,
      source_table: 'group_events',
      id: groupEvent.id,
    })
    if (!pathName) continue
    const normalized = normalizeEventRow(groupEvent, {
      venueName: groupEvent.groups?.name,
    })
    const title = `${normalized.title} | Our Philly Groups`
    const description = normalized.description
      ? `${normalized.title}: ${normalized.description.replace(/\s+/g, ' ').slice(0, 150)}`
      : `${normalized.title} is a group event featured on Our Philly.`
    const html = renderDocument(
      {
        title,
        description,
        canonicalPath: pathName,
        main: renderEventArticle(normalized),
        jsonLd: buildEventSchema(normalized, toAbsoluteUrl(pathName)),
      },
      assets
    )
    await writeUnique(pathName, html)
  }

  for (const recurring of data.recurringEvents) {
    const paths = computeRecurringPaths(recurring)
    if (!paths.length) continue
    const normalized = normalizeEventRow(recurring)
    const title = `${normalized.title} | Recurring Events in Philadelphia`
    const description = normalized.description
      ? `${normalized.title}: ${normalized.description.replace(/\s+/g, ' ').slice(0, 150)}`
      : `${normalized.title} is a recurring Philadelphia event curated by Our Philly.`
    const schema = buildEventSchema(normalized, toAbsoluteUrl(paths[0]))
    for (const pathName of paths) {
      const html = renderDocument(
        {
          title,
          description,
          canonicalPath: pathName,
          main: renderEventArticle(normalized),
          jsonLd: schema,
        },
        assets
      )
      await writeUnique(pathName, html)
    }
  }

  const tagIntro =
    'Use Our Philly to explore curated plans across music, nightlife, culture, family fun, and seasonal celebrations. Each tag highlights active communities and experiences in Philadelphia.'

  for (const tag of data.tags) {
    if (!tag.slug) continue
    const pathName = ensureLeadingSlash(`/tags/${tag.slug}`)
    const title = `${tag.name || tag.slug} Events in Philadelphia | Our Philly`
    const description = tag.description
      ? `${tag.name || tag.slug}: ${tag.description.replace(/\s+/g, ' ').slice(0, 150)}`
      : `Explore ${tag.name || tag.slug} events and activities happening in Philadelphia.`
    const main = renderOverviewPage({
      title: `${tag.name || tag.slug} Events in Philadelphia`,
      intro: tag.description || tagIntro,
      sections: [
        {
          title: 'Why this topic matters',
          body:
            'Keyword research shows strong demand for this category with meaningful search volume and low-to-medium competition. Publishing up-to-date guides helps capture that traffic and serve locals with better recommendations.',
          points: [
            'Blend flagship happenings with hidden-gem experiences.',
            'Highlight neighborhood context so visitors know where to go.',
            'Link to trusted partners and ticketing resources.',
          ],
        },
        {
          title: 'How Our Philly curates coverage',
          body:
            'We vet each listing for quality, timeliness, and accessibility. Group leaders and venues collaborate with our editorial team to keep information accurate.',
          points: [
            'Daily database of thousands of Philadelphia events.',
            'Filters for family-friendly, nightlife, concerts, and more.',
            'Recurring series tracking powered by RRULE scheduling.',
          ],
        },
      ],
    })
    const html = renderDocument(
      {
        title,
        description,
        canonicalPath: pathName,
        main,
      },
      assets
    )
    await writeUnique(pathName, html)
  }

  const overviewSections = [
    {
      path: '/',
      title: 'Philadelphia Event Plans & Things to Do',
      description:
        'Plan your week in Philadelphia with the largest independent calendar of concerts, nightlife, culture, and community happenings.',
      sections: [
        {
          title: 'Traffic opportunity snapshot',
          body:
            'Our SEO analysis surfaced 3,873 keywords totaling more than 5.5 million monthly searches. By targeting high-intent phrases, Our Philly can realistically add 85,000 monthly visits.',
          points: [
            '329 high-opportunity keywords above 1,000 searches each.',
            'Primary focus areas: general events, music, nightlife.',
            'Seasonal spikes for holidays, festivals, and family outings.',
          ],
        },
        {
          title: 'Editorial approach',
          body:
            'We blend human-curated picks with data-driven recurrence tracking so readers always see what is happening next.',
          points: [
            'Weekend highlights updated every Thursday morning.',
            'Dedicated landing pages for arts, food & drink, and fitness.',
            'Neighborhood guides tailored to locals and visitors alike.',
          ],
        },
      ],
    },
    {
      path: '/philadelphia-events/',
      title: 'Upcoming Philadelphia Events Calendar',
      description:
        'Browse festivals, concerts, sports, and cultural experiences with daily updates from Our Philly.',
      sections: [
        {
          title: 'Keyword segments to target',
          body:
            'General events and activities drive the highest search volume with a mix of competition levels, making comprehensive coverage essential.',
          points: [
            'Family-friendly experiences and seasonal highlights.',
            'Music and nightlife calendars refreshed weekly.',
            "Venue spotlights for Convention Center, Penn's Landing, and FDR Park.",
          ],
        },
        {
          title: 'Projected results',
          body:
            'Realistic ranking improvements deliver 22,000+ monthly visits in this segment alone.',
          points: [
            'Long-tail keyword clusters cover 820 ultra-specific searches.',
            'Guide updates aligned with Google Discover best practices.',
            'Structured data and canonical tags for every landing page.',
          ],
        },
      ],
    },
    {
      path: '/this-weekend-in-philadelphia/',
      title: 'This Weekend in Philadelphia',
      description:
        'Your cheat sheet for what to do in Philly this weekend: festivals, concerts, pop-ups, and hidden gems curated by Our Philly editors.',
      sections: [
        {
          title: 'Weekend coverage pillars',
          body:
            'Our Philly refreshes weekend picks every Thursday night with real-time updates for weather shifts and sold-out shows.',
          points: [
            'Balance headline events with neighborhood discoveries.',
            'Callouts for free and low-cost plans.',
            'Links to reservation and ticketing partners.',
          ],
        },
        {
          title: 'SEO rationale',
          body:
            'Weekly intent keywords convert highly on Google when paired with engaging descriptions and schema markup.',
          points: [
            'Targets 50,000+ monthly searches for “things to do in Philadelphia this weekend.”',
            'Supports Discover and Top Stories eligibility.',
            'Pairs with newsletter segments for repeat traffic.',
          ],
        },
      ],
    },
  ]

  for (const section of overviewSections) {
    const html = renderDocument(
      {
        title: `${section.title} | Our Philly`,
        description: section.description,
        canonicalPath: section.path,
        main: renderOverviewPage(section),
      },
      assets
    )
    await writeUnique(section.path, html)
  }
}

async function main() {
  const manifestPath = path.join(ROOT_DIR, 'dist', 'manifest.json')
  let manifest
  try {
    const content = await fs.readFile(manifestPath, 'utf8')
    manifest = JSON.parse(content)
  } catch (err) {
    console.error('⚠️  Could not read dist/manifest.json. Run `vite build` before prerendering.')
    process.exit(1)
  }

  await fs.rm(DIST_PRERENDER_DIR, { recursive: true, force: true })
  await fs.mkdir(DIST_PRERENDER_DIR, { recursive: true })

  const assets = collectManifestAssets(manifest)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const data = await loadData(supabase)
  await generatePages(data, assets)
  const totalRows = Object.values(data).reduce((sum, arr) => sum + arr.length, 0)
  console.log(`✅ Prerendered ${totalRows} source rows`)
}

main().catch(err => {
  console.error('❌ Prerender failed:', err)
  process.exit(1)
})
