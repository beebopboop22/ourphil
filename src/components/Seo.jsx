import { useEffect, useRef } from 'react'
import { useHeadManager } from './HeadProvider'

const TWITTER_CARD_TYPE = 'summary_large_image'
const DEFAULT_OG_TYPE = 'website'

const buildKey = (prefix, suffix) => `${prefix}:${suffix}`

const Seo = ({
  title,
  description,
  canonicalUrl,
  ogImage,
  ogType = DEFAULT_OG_TYPE,
  jsonLd,
}) => {
  const { upsertElement, removeElement, setTitle, removeTitle } = useHeadManager()
  const instanceIdRef = useRef(Symbol('seo'))

  useEffect(() => {
    const owner = instanceIdRef.current
    if (title) {
      setTitle(owner, title)
    } else {
      removeTitle(owner)
    }

    return () => {
      removeTitle(owner)
    }
  }, [title, setTitle, removeTitle])

  useEffect(() => {
    const owner = instanceIdRef.current
    const keys = []
    const register = (key, type, props, textContent) => {
      if (!props && textContent === undefined) return
      upsertElement({ key, owner, type, props, textContent })
      keys.push(key)
    }

    if (description) {
      register(buildKey('meta', 'description'), 'meta', {
        name: 'description',
        content: description,
      })
    }

    if (canonicalUrl) {
      register(buildKey('link', 'canonical'), 'link', {
        rel: 'canonical',
        href: canonicalUrl,
      })
    }

    const ogTitle = title || ''
    if (ogTitle) {
      register(buildKey('meta', 'og:title'), 'meta', {
        property: 'og:title',
        content: ogTitle,
      })
      register(buildKey('meta', 'twitter:title'), 'meta', {
        name: 'twitter:title',
        content: ogTitle,
      })
    }

    if (description) {
      register(buildKey('meta', 'og:description'), 'meta', {
        property: 'og:description',
        content: description,
      })
      register(buildKey('meta', 'twitter:description'), 'meta', {
        name: 'twitter:description',
        content: description,
      })
    }

    const resolvedUrl =
      canonicalUrl ||
      (typeof globalThis !== 'undefined' && globalThis.location
        ? globalThis.location.href
        : undefined)
    if (resolvedUrl) {
      register(buildKey('meta', 'og:url'), 'meta', {
        property: 'og:url',
        content: resolvedUrl,
      })
    }

    if (ogImage) {
      register(buildKey('meta', 'og:image'), 'meta', {
        property: 'og:image',
        content: ogImage,
      })
      register(buildKey('meta', 'twitter:image'), 'meta', {
        name: 'twitter:image',
        content: ogImage,
      })
    }

    register(buildKey('meta', 'og:type'), 'meta', {
      property: 'og:type',
      content: ogType || DEFAULT_OG_TYPE,
    })

    register(buildKey('meta', 'twitter:card'), 'meta', {
      name: 'twitter:card',
      content: TWITTER_CARD_TYPE,
    })

    if (jsonLd) {
      const scriptKey = buildKey('script', 'ld+json')
      const jsonContent = JSON.stringify(jsonLd, null, 2)
      register(scriptKey, 'script', { type: 'application/ld+json' }, jsonContent)
    } else {
      removeElement({ key: buildKey('script', 'ld+json'), owner })
    }

    return () => {
      keys.forEach((key) => removeElement({ key, owner }))
    }
  }, [
    title,
    description,
    canonicalUrl,
    ogImage,
    ogType,
    jsonLd,
    upsertElement,
    removeElement,
  ])

  return null
}

export default Seo
