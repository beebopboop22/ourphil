export const CATEGORY_CONFIG = {
  'family-friendly': {
    slug: 'family-friendly',
    label: 'Family-Friendly',
    description: 'family-friendly',
    tags: ['family', 'kids'],
  },
  'arts-culture': {
    slug: 'arts-culture',
    label: 'Arts & Culture',
    description: 'arts and culture',
    tags: ['arts', 'markets'],
  },
  'food-drink': {
    slug: 'food-drink',
    label: 'Food & Drink',
    description: 'food and drink',
    tags: ['nomnomslurp'],
  },
  fitness: {
    slug: 'fitness',
    label: 'Fitness & Wellness',
    description: 'fitness and wellness',
    tags: ['fitness'],
  },
  music: {
    slug: 'music',
    label: 'Music',
    description: 'music',
    tags: ['music'],
  },
};

export const CATEGORY_ORDER = [
  CATEGORY_CONFIG['family-friendly'],
  CATEGORY_CONFIG['arts-culture'],
  CATEGORY_CONFIG['food-drink'],
  CATEGORY_CONFIG.fitness,
  CATEGORY_CONFIG.music,
];

export const CATEGORY_SLUGS = Object.keys(CATEGORY_CONFIG);

export function isValidCategorySlug(slug) {
  if (!slug) return false;
  return Boolean(CATEGORY_CONFIG[slug.toLowerCase()]);
}

export function getCategoryConfig(slug) {
  if (!slug) return null;
  return CATEGORY_CONFIG[slug.toLowerCase()] || null;
}
