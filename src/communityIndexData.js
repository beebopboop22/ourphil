export const COMMUNITY_REGIONS = [
  {
    key: 'west-philly',
    name: 'West Philly',
    slug: 'community-index/west-philly',
    seoTitle: 'West Philly Community Index – Traditions & Groups',
    seoDescription:
      'Discover West Philly traditions, neighborhood groups, and community photos. Explore the stories, events, and crews that keep West Philadelphia moving forward.',
    heroDescription:
      'From Baltimore Avenue to Parkside, West Philly blends long-running traditions with new ideas. Use this index to track the crews, rituals, and upcoming happenings shaping the neighborhood.',
    areaAliases: [
      'West Philly',
      'West Philadelphia',
      'University City',
      'Cedar Park',
      'Spruce Hill',
      'Cobbs Creek',
      'Parkside',
      'West',
    ],
  },
  {
    key: 'south-philly',
    name: 'South Philly',
    slug: 'community-index/south-philly',
    seoTitle: 'South Philly Community Index – Traditions & Groups',
    seoDescription:
      'Explore South Philly block traditions, sports leagues, mutual aid crews, and grassroots events. See what is coming up across the rowhouse blocks and waterfront.',
    heroDescription:
      'South Philly runs on block parties, rec leagues, and long-time traditions. This page pulls together the organizers, events, and photos that keep the neighborhood buzzing.',
    areaAliases: [
      'South Philly',
      'South Philadelphia',
      'Pennsport',
      'Passyunk',
      'East Passyunk',
      'Whitman',
      'Italian Market',
      'South',
    ],
  },
  {
    key: 'north-philly',
    name: 'North Philly',
    slug: 'community-index/north-philly',
    seoTitle: 'North Philly Community Index – Traditions & Groups',
    seoDescription:
      'Track North Philly community events, neighborhood groups, and historic traditions. From Broad Street to the Fairhill cultural corridor, see what is next.',
    heroDescription:
      'North Philly is packed with culture—from jazz halls and faith institutions to youth programs and block associations. This index highlights who is organizing what right now.',
    areaAliases: [
      'North Philly',
      'North Philadelphia',
      'Broad & Erie',
      'Fairhill',
      'Strawberry Mansion',
      'Temple',
      'Allegheny West',
      'North',
    ],
  },
  {
    key: 'northeast',
    name: 'Northeast Philly',
    slug: 'community-index/northeast',
    seoTitle: 'Northeast Philly Community Index – Traditions & Groups',
    seoDescription:
      'See the latest Northeast Philly festivals, civic groups, and neighborhood photo highlights. Follow what is happening across the Far and Lower Northeast.',
    heroDescription:
      'The Northeast is home to massive cultural festivals, civic associations, and volunteer crews that keep parks and commercial corridors thriving. Browse the active groups and upcoming events here.',
    areaAliases: [
      'Northeast Philly',
      'Northeast Philadelphia',
      'Far Northeast',
      'Lower Northeast',
      'Mayfair',
      'Frankford',
      'Bustleton',
      'Northeast',
    ],
  },
  {
    key: 'northwest',
    name: 'Northwest Philly',
    slug: 'community-index/northwest',
    seoTitle: 'Northwest Philly Community Index – Traditions & Groups',
    seoDescription:
      'Connect with Northwest Philly hikes, festivals, and mutual aid crews. Explore Germantown, Mount Airy, Roxborough, and Manayunk happenings.',
    heroDescription:
      'Northwest Philly brings together creek cleanups, jazz nights, and hillside festivals. Use this page to find the organizers and traditions that anchor the Wissahickon-side neighborhoods.',
    areaAliases: [
      'Northwest Philly',
      'Northwest Philadelphia',
      'Germantown',
      'Mount Airy',
      'Mt. Airy',
      'Manayunk',
      'Roxborough',
      'Chestnut Hill',
      'Northwest',
    ],
  },
  {
    key: 'southwest',
    name: 'Southwest Philly',
    slug: 'community-index/southwest',
    seoTitle: 'Southwest Philly Community Index – Traditions & Groups',
    seoDescription:
      'Browse Southwest Philly gatherings, immigrant-led groups, and local photos. Track what is next in Kingsessing, Elmwood, and beyond.',
    heroDescription:
      'Southwest Philly’s block stewards, refugee leaders, and rec center teams power countless projects. This index surfaces the groups and traditions keeping the neighborhood moving.',
    areaAliases: [
      'Southwest Philly',
      'Southwest Philadelphia',
      'Kingsessing',
      'Elmwood',
      'Bartram',
      'Southwest',
    ],
  },
  {
    key: 'river-wards',
    name: 'River Wards',
    slug: 'community-index/river-wards',
    seoTitle: 'River Wards Community Index – Traditions & Groups',
    seoDescription:
      'Follow River Wards cleanups, art nights, and neighborhood groups. See what is ahead across Fishtown, Kensington, Port Richmond, and Northern Liberties.',
    heroDescription:
      'The River Wards are constantly building—from volunteer cleanups to gallery walks and community fridges. Catch the latest happenings and crews here.',
    areaAliases: [
      'River Wards',
      'Fishtown',
      'Kensington',
      'Port Richmond',
      'Northern Liberties',
      'Olde Richmond',
    ],
  },
  {
    key: 'center-city',
    name: 'Center City',
    slug: 'community-index/center-city',
    seoTitle: 'Center City Community Index – Traditions & Groups',
    seoDescription:
      'Find Center City civic groups, downtown traditions, and neighborhood photo highlights. Explore everything from Rittenhouse gatherings to Old City art nights.',
    heroDescription:
      'Center City is more than office towers—it is museums, civic associations, resident councils, and street festivals. See who is organizing and what is coming up downtown.',
    areaAliases: [
      'Center City',
      'Downtown Philly',
      'Downtown Philadelphia',
      'Rittenhouse',
      'Old City',
      'Washington Square',
      'Logan Square',
    ],
  },
]

export const COMMUNITY_REGION_MAP = COMMUNITY_REGIONS.reduce((acc, region) => {
  acc[region.key] = region
  acc[region.slug] = region
  return acc
}, {})
