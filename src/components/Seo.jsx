/* eslint-disable react/prop-types */
import { useEffect, useId, useMemo } from 'react';
import { useHeadManager } from './HeadProvider.jsx';

export default function Seo({
  title,
  description,
  canonicalUrl,
  ogImage,
  ogType = 'website',
  twitterCard = 'summary_large_image',
  jsonLd = null,
  siteName,
  twitterSite,
}) {
  const { setHead, clearHead } = useHeadManager();
  const id = useId();

  const payload = useMemo(
    () => ({
      title,
      description,
      canonicalUrl,
      ogImage,
      ogType,
      twitterCard,
      jsonLd,
      siteName,
      twitterSite,
    }),
    [title, description, canonicalUrl, ogImage, ogType, twitterCard, jsonLd, siteName, twitterSite],
  );

  useEffect(() => {
    setHead(id, payload);
    return () => {
      clearHead(id);
    };
  }, [id, payload, setHead, clearHead]);

  return null;
}

