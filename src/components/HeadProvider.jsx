/* eslint-disable react/prop-types, react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const DEFAULT_SEO = {
  title: 'Our Philly – Philadelphia Events & Traditions',
  description: 'Discover concerts, festivals, markets, and family-friendly traditions across Philadelphia with Our Philly.',
  canonicalUrl: 'https://ourphilly.org/',
  ogImage: 'https://ourphilly.org/og-image.png',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  siteName: 'Our Philly',
  twitterSite: '@ourphilly',
};

const HeadContext = createContext(null);

function ensureMetaByName(name) {
  if (typeof document === 'undefined') return null;
  let tag = document.head.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  return tag;
}

function ensureMetaByProperty(property) {
  if (typeof document === 'undefined') return null;
  let tag = document.head.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  return tag;
}

function ensureLink(rel) {
  if (typeof document === 'undefined') return null;
  let link = document.head.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    document.head.appendChild(link);
  }
  return link;
}

function setAttr(node, attr, value) {
  if (!node) return;
  if (value) {
    node.setAttribute(attr, value);
  } else {
    node.removeAttribute(attr);
  }
}

function updateJsonLd(jsonLd) {
  if (typeof document === 'undefined') return;
  const scriptId = 'managed-jsonld';
  let script = document.head.querySelector(`#${scriptId}`);
  if (!jsonLd) {
    if (script && script.parentNode) {
      script.parentNode.removeChild(script);
    }
    return;
  }

  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = scriptId;
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(jsonLd);
}

function applyHead(values, fallback) {
  if (typeof document === 'undefined') return;

  const merged = { ...fallback, ...(values || {}) };
  const {
    title,
    description,
    canonicalUrl,
    ogImage,
    ogType,
    twitterCard,
    siteName,
    twitterSite,
    jsonLd,
  } = merged;

  if (title) {
    document.title = title;
  }

  const descTag = ensureMetaByName('description');
  setAttr(descTag, 'content', description);

  const canonicalTag = ensureLink('canonical');
  setAttr(canonicalTag, 'href', canonicalUrl);

  const ogTitle = ensureMetaByProperty('og:title');
  setAttr(ogTitle, 'content', title);

  const ogDescription = ensureMetaByProperty('og:description');
  setAttr(ogDescription, 'content', description);

  const ogUrl = ensureMetaByProperty('og:url');
  setAttr(ogUrl, 'content', canonicalUrl);

  const ogTypeTag = ensureMetaByProperty('og:type');
  setAttr(ogTypeTag, 'content', ogType);

  const ogImageTag = ensureMetaByProperty('og:image');
  setAttr(ogImageTag, 'content', ogImage);

  const ogSiteName = ensureMetaByProperty('og:site_name');
  setAttr(ogSiteName, 'content', siteName);

  const twitterCardTag = ensureMetaByName('twitter:card');
  setAttr(twitterCardTag, 'content', twitterCard);

  const twitterTitleTag = ensureMetaByName('twitter:title');
  setAttr(twitterTitleTag, 'content', title);

  const twitterDescriptionTag = ensureMetaByName('twitter:description');
  setAttr(twitterDescriptionTag, 'content', description);

  const twitterImageTag = ensureMetaByName('twitter:image');
  setAttr(twitterImageTag, 'content', ogImage);

  const twitterSiteTag = ensureMetaByName('twitter:site');
  setAttr(twitterSiteTag, 'content', twitterSite);

  updateJsonLd(jsonLd);
}

export function HeadProvider({ children, defaultSeo = DEFAULT_SEO }) {
  const [currentEntry, setCurrentEntry] = useState(null);

  const setHead = useCallback((id, values) => {
    setCurrentEntry({ id, values });
  }, []);

  const clearHead = useCallback(id => {
    setCurrentEntry(prev => {
      if (prev && prev.id === id) {
        return null;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    applyHead(currentEntry?.values ?? null, defaultSeo);
  }, [currentEntry, defaultSeo]);

  const contextValue = useMemo(
    () => ({ setHead, clearHead, defaultSeo }),
    [setHead, clearHead, defaultSeo],
  );

  return <HeadContext.Provider value={contextValue}>{children}</HeadContext.Provider>;
}

export function useHeadManager() {
  const ctx = useContext(HeadContext);
  if (!ctx) {
    throw new Error('useHeadManager must be used within a HeadProvider');
  }
  return ctx;
}

