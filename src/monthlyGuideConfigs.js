export const MONTHLY_GUIDE_ORDER = ['family', 'artsCulture', 'foodDrink', 'fitnessWellness', 'music', 'showRollCall'];

export const MONTHLY_GUIDE_CONFIGS = {
  family: {
    key: 'family',
    navLabel: 'Family-Friendly',
    pathSegment: 'family-friendly-events-in-philadelphia',
    tagSlugs: ['family', 'kids'],
    viewRegex: /^family-friendly-events-in-philadelphia-([a-z-]+)-(\d{4})$/i,
    fallbackDescription:
      'Discover kid-friendly things to do in Philadelphia: free and low-cost events, indoor/outdoor picks, and family fun updated monthly.',
    seoTitle: monthLabel => `Family-Friendly Events in Philadelphia – ${monthLabel}`,
    seoTitleFallback: 'Family-Friendly Events in Philadelphia – Our Philly',
    seoDescription: monthLabel =>
      `Discover kid-friendly things to do in Philadelphia this ${monthLabel}: free & low-cost events, indoor/outdoor picks, and what\'s on this weekend & today.`,
    jsonLdName: monthLabel => `Family-Friendly Events in Philadelphia – ${monthLabel}`,
    hero: {
      heading: monthLabel => `Family-Friendly Events in Philadelphia – ${monthLabel}`,
      withCount: (count, monthLabel) =>
        `Discover ${count} kid-friendly festivals, storytimes, and hands-on adventures happening across Philadelphia in ${monthLabel}.`,
      withoutCount: monthLabel =>
        `Discover kid-friendly festivals, storytimes, and hands-on adventures happening across Philadelphia in ${monthLabel}.`,
      tagLine: "We pulled every event tagged family or kids so you can plan this month's outings.",
    },
    weekend: {
      summary: 'Family events happening Friday through Sunday in Philadelphia.',
      intro: 'Family-friendly events this weekend include: ',
      empty: "We don't have any tagged family-friendly events for this weekend yet—check back soon.",
    },
    today: {
      heading: 'Family-friendly events today',
      summary: 'Quick ideas for kid-approved fun happening today.',
      intro: 'Family-friendly events today include: ',
      empty: "No tagged family-friendly events are listed for today—browse the calendar below for more options.",
    },
    monthEmpty: monthLabel =>
      `No tagged family or kids events are listed for ${monthLabel} yet. Check back soon or submit one!`,
    loadingText: 'Loading family-friendly events…',
    concludingText:
      'Our Philly helps families discover kid-friendly events and traditions across Philadelphia, updated monthly.',
    faq: {
      monthlyQuestion: monthLabel => `What are the best family-friendly events in Philadelphia in ${monthLabel}?`,
      monthlyAnswerWithEvents: (count, monthLabel) =>
        `Our Philly curates ${count} kid-friendly events across Philadelphia for ${monthLabel}, highlighting markets, museums, storytimes, and community festivals tagged family or kids.`,
      monthlyAnswerWithoutEvents: monthLabel =>
        `Our Philly tracks kid-friendly events across Philadelphia for ${monthLabel}, highlighting markets, museums, storytimes, and community festivals tagged family or kids.`,
      weekendQuestion: 'Are there family-friendly events in Philadelphia this weekend?',
      weekendAnswerWithEvents: names => `Family-friendly events this weekend include ${names}.`,
      weekendAnswerWithoutEvents:
        'We are updating this weekend’s kid-friendly lineup—check back soon or explore our This Weekend in Philadelphia guide for fresh picks.',
      todayQuestion: 'What family-friendly events are happening in Philadelphia today?',
      todayAnswerWithEvents: names => `Family-friendly events today include ${names}.`,
      todayAnswerWithoutEvents:
        'No tagged family-friendly events are listed for today yet—browse the full monthly calendar for more ideas.',
      updatedQuestion: 'How often is the Our Philly family-friendly guide updated?',
      updatedAnswer: updatedStamp =>
        `We refresh this guide as new events are published and last updated it on ${updatedStamp}. Bookmark it to catch new kid-friendly things to do each week.`,
    },
    errorLogMessage: 'Error loading family-friendly events',
  },
  artsCulture: {
    key: 'artsCulture',
    navLabel: 'Arts & Culture',
    pathSegment: 'arts-culture-events-in-philadelphia',
    tagSlugs: ['arts', 'markets'],
    viewRegex: /^arts-culture-events-in-philadelphia-([a-z-]+)-(\d{4})$/i,
    fallbackDescription:
      'Discover arts and culture events in Philadelphia: gallery openings, creative markets, performances, and more each month.',
    seoTitle: monthLabel => `Arts & Culture Events in Philadelphia – ${monthLabel}`,
    seoTitleFallback: 'Arts & Culture Events in Philadelphia – Our Philly',
    seoDescription: monthLabel =>
      `Discover arts and culture events in Philadelphia this ${monthLabel}: gallery openings, creative markets, performances, and what\'s on this weekend & today.`,
    jsonLdName: monthLabel => `Arts & Culture Events in Philadelphia – ${monthLabel}`,
    hero: {
      heading: monthLabel => `Arts & Culture Events in Philadelphia – ${monthLabel}`,
      withCount: (count, monthLabel) =>
        `Discover ${count} arts and culture happenings across Philadelphia in ${monthLabel}, from gallery openings to creative markets.`,
      withoutCount: monthLabel =>
        `Discover arts and culture happenings across Philadelphia in ${monthLabel}, from gallery openings to creative markets.`,
      tagLine: "We pulled every event tagged arts or markets so you can plan this month's cultural outings.",
    },
    weekend: {
      summary: 'Arts and culture highlights happening Friday through Sunday in Philadelphia.',
      intro: 'Arts & culture events this weekend include: ',
      empty: "We don't have any tagged arts or markets events for this weekend yet—check back soon.",
    },
    today: {
      heading: 'Arts & culture events today',
      summary: 'Quick inspiration for creative outings happening today.',
      intro: 'Arts & culture events today include: ',
      empty: "No tagged arts or markets events are listed for today—browse the calendar below for more options.",
    },
    monthEmpty: monthLabel =>
      `No tagged arts or markets events are listed for ${monthLabel} yet. Check back soon or submit one!`,
    loadingText: 'Loading arts & culture events…',
    concludingText:
      'Our Philly spotlights arts and culture events across Philadelphia so you can find exhibits, performances, and markets each month.',
    faq: {
      monthlyQuestion: monthLabel => `What are the best arts & culture events in Philadelphia in ${monthLabel}?`,
      monthlyAnswerWithEvents: (count, monthLabel) =>
        `Our Philly curates ${count} arts and culture events across Philadelphia for ${monthLabel}, including gallery openings, creative markets, and museum nights tagged arts or markets.`,
      monthlyAnswerWithoutEvents: monthLabel =>
        `Our Philly tracks arts and culture events across Philadelphia for ${monthLabel}, including gallery openings, creative markets, and museum nights tagged arts or markets.`,
      weekendQuestion: 'Which arts & culture events are happening in Philadelphia this weekend?',
      weekendAnswerWithEvents: names => `Arts & culture events this weekend include ${names}.`,
      weekendAnswerWithoutEvents:
        'We’re updating this weekend’s arts & culture lineup—check back soon or explore our This Weekend in Philadelphia guide for more inspiration.',
      todayQuestion: 'Are there arts & culture events in Philadelphia today?',
      todayAnswerWithEvents: names => `Arts & culture events today include ${names}.`,
      todayAnswerWithoutEvents:
        'No tagged arts or markets events are listed for today yet—browse the full monthly calendar for more ideas.',
      updatedQuestion: 'How often is the Our Philly arts & culture guide updated?',
      updatedAnswer: updatedStamp =>
        `We refresh this guide as new events are published and last updated it on ${updatedStamp}. Bookmark it to catch new arts and culture happenings each week.`,
    },
    errorLogMessage: 'Error loading arts & culture events',
  },
  foodDrink: {
    key: 'foodDrink',
    navLabel: 'Food & Drink',
    pathSegment: 'food-drink-events-in-philadelphia',
    tagSlugs: ['nomnomslurp'],
    viewRegex: /^food-drink-events-in-philadelphia-([a-z-]+)-(\d{4})$/i,
    fallbackDescription:
      'Discover food and drink events in Philadelphia: tastings, pop-ups, happy hours, and more each month.',
    seoTitle: monthLabel => `Food & Drink Events in Philadelphia – ${monthLabel}`,
    seoTitleFallback: 'Food & Drink Events in Philadelphia – Our Philly',
    seoDescription: monthLabel =>
      `Discover food and drink events in Philadelphia this ${monthLabel}: tastings, pop-ups, happy hours, and what\'s on this weekend & today.`,
    jsonLdName: monthLabel => `Food & Drink Events in Philadelphia – ${monthLabel}`,
    hero: {
      heading: monthLabel => `Food & Drink Events in Philadelphia – ${monthLabel}`,
      withCount: (count, monthLabel) =>
        `Discover ${count} food and drink events happening across Philadelphia in ${monthLabel}, from tastings to pop-up dinners.`,
      withoutCount: monthLabel =>
        `Discover food and drink events happening across Philadelphia in ${monthLabel}, from tastings to pop-up dinners.`,
      tagLine: "We pulled every event tagged nomnomslurp so you can plan this month's culinary adventures.",
    },
    weekend: {
      summary: 'Food and drink happenings Friday through Sunday in Philadelphia.',
      intro: 'Food & drink events this weekend include: ',
      empty: "We don't have any tagged food or drink events for this weekend yet—check back soon.",
    },
    today: {
      heading: 'Food & drink events today',
      summary: 'Tastings, pop-ups, and happy hours happening today.',
      intro: 'Food & drink events today include: ',
      empty: "No tagged food & drink events are listed for today—browse the calendar below for more bites.",
    },
    monthEmpty: monthLabel =>
      `No tagged food & drink events are listed for ${monthLabel} yet. Check back soon or submit one!`,
    loadingText: 'Loading food & drink events…',
    concludingText:
      'Our Philly highlights food and drink experiences around Philadelphia so you can find tastings, pop-ups, and culinary festivals each month.',
    faq: {
      monthlyQuestion: monthLabel => `What are the best food & drink events in Philadelphia in ${monthLabel}?`,
      monthlyAnswerWithEvents: (count, monthLabel) =>
        `Our Philly curates ${count} food and drink events across Philadelphia for ${monthLabel}, covering tastings, pop-ups, brewery events, and culinary festivals tagged nomnomslurp.`,
      monthlyAnswerWithoutEvents: monthLabel =>
        `Our Philly tracks food and drink events across Philadelphia for ${monthLabel}, covering tastings, pop-ups, brewery events, and culinary festivals tagged nomnomslurp.`,
      weekendQuestion: 'Which food & drink events are happening in Philadelphia this weekend?',
      weekendAnswerWithEvents: names => `Food & drink events this weekend include ${names}.`,
      weekendAnswerWithoutEvents:
        'We’re updating this weekend’s food & drink lineup—check back soon or explore our This Weekend in Philadelphia guide for more delicious ideas.',
      todayQuestion: 'Are there food & drink events in Philadelphia today?',
      todayAnswerWithEvents: names => `Food & drink events today include ${names}.`,
      todayAnswerWithoutEvents:
        'No tagged food & drink events are listed for today yet—browse the full monthly calendar for more bites.',
      updatedQuestion: 'How often is the Our Philly food & drink guide updated?',
      updatedAnswer: updatedStamp =>
        `We refresh this guide as new events are published and last updated it on ${updatedStamp}. Bookmark it to catch new food and drink happenings each week.`,
    },
    errorLogMessage: 'Error loading food & drink events',
  },
  fitnessWellness: {
    key: 'fitnessWellness',
    navLabel: 'Fitness & Wellness',
    pathSegment: 'fitness-events-in-philadelphia',
    tagSlugs: ['fitness'],
    viewRegex: /^fitness-events-in-philadelphia-([a-z-]+)-(\d{4})$/i,
    fallbackDescription:
      'Discover fitness and wellness events in Philadelphia: group workouts, outdoor classes, mindful meetups, and more each month.',
    seoTitle: monthLabel => `Fitness & Wellness Events in Philadelphia – ${monthLabel}`,
    seoTitleFallback: 'Fitness & Wellness Events in Philadelphia – Our Philly',
    seoDescription: monthLabel =>
      `Discover fitness and wellness events in Philadelphia this ${monthLabel}: group workouts, outdoor classes, mindful meetups, and what\'s on this weekend & today.`,
    jsonLdName: monthLabel => `Fitness & Wellness Events in Philadelphia – ${monthLabel}`,
    hero: {
      heading: monthLabel => `Fitness & Wellness Events in Philadelphia – ${monthLabel}`,
      withCount: (count, monthLabel) =>
        `Discover ${count} fitness and wellness events across Philadelphia in ${monthLabel}, from group workouts to mindful meetups.`,
      withoutCount: monthLabel =>
        `Discover fitness and wellness events across Philadelphia in ${monthLabel}, from group workouts to mindful meetups.`,
      tagLine: "We pulled every event tagged fitness so you can plan this month's workouts and wellness time.",
    },
    weekend: {
      summary: 'Fitness and wellness sessions happening Friday through Sunday in Philadelphia.',
      intro: 'Fitness & wellness events this weekend include: ',
      empty: "We don't have any tagged fitness events for this weekend yet—check back soon.",
    },
    today: {
      heading: 'Fitness & wellness events today',
      summary: 'Workouts and wellness sessions happening today.',
      intro: 'Fitness & wellness events today include: ',
      empty: "No tagged fitness events are listed for today—browse the calendar below for more options.",
    },
    monthEmpty: monthLabel =>
      `No tagged fitness events are listed for ${monthLabel} yet. Check back soon or submit one!`,
    loadingText: 'Loading fitness & wellness events…',
    concludingText:
      'Our Philly spotlights fitness and wellness gatherings across Philadelphia so you can stay active with fresh events every month.',
    faq: {
      monthlyQuestion: monthLabel => `What are the best fitness & wellness events in Philadelphia in ${monthLabel}?`,
      monthlyAnswerWithEvents: (count, monthLabel) =>
        `Our Philly curates ${count} fitness and wellness events across Philadelphia for ${monthLabel}, covering workouts, outdoor classes, and wellness meetups tagged fitness.`,
      monthlyAnswerWithoutEvents: monthLabel =>
        `Our Philly tracks fitness and wellness events across Philadelphia for ${monthLabel}, covering workouts, outdoor classes, and wellness meetups tagged fitness.`,
      weekendQuestion: 'Which fitness & wellness events are happening in Philadelphia this weekend?',
      weekendAnswerWithEvents: names => `Fitness & wellness events this weekend include ${names}.`,
      weekendAnswerWithoutEvents:
        'We’re updating this weekend’s fitness & wellness lineup—check back soon or explore our This Weekend in Philadelphia guide for more active ideas.',
      todayQuestion: 'Are there fitness & wellness events in Philadelphia today?',
      todayAnswerWithEvents: names => `Fitness & wellness events today include ${names}.`,
      todayAnswerWithoutEvents:
        'No tagged fitness events are listed for today yet—browse the full monthly calendar for more ideas.',
      updatedQuestion: 'How often is the Our Philly fitness & wellness guide updated?',
      updatedAnswer: updatedStamp =>
        `We refresh this guide as new events are published and last updated it on ${updatedStamp}. Bookmark it to catch new workouts and wellness happenings each week.`,
    },
    errorLogMessage: 'Error loading fitness & wellness events',
  },
  music: {
    key: 'music',
    navLabel: 'Music',
    pathSegment: 'music-events-in-philadelphia',
    tagSlugs: ['music'],
    viewRegex: /^music-events-in-philadelphia-([a-z-]+)-(\d{4})$/i,
    fallbackDescription:
      'Discover music events in Philadelphia: concerts, festivals, jam sessions, and more each month.',
    seoTitle: monthLabel => `Music Events in Philadelphia – ${monthLabel}`,
    seoTitleFallback: 'Music Events in Philadelphia – Our Philly',
    seoDescription: monthLabel =>
      `Discover music events in Philadelphia this ${monthLabel}: concerts, festivals, jam sessions, and what\'s on this weekend & today.`,
    jsonLdName: monthLabel => `Music Events in Philadelphia – ${monthLabel}`,
    hero: {
      heading: monthLabel => `Music Events in Philadelphia – ${monthLabel}`,
      withCount: (count, monthLabel) =>
        `Discover ${count} concerts and music events happening across Philadelphia in ${monthLabel}, from intimate gigs to big-stage shows.`,
      withoutCount: monthLabel =>
        `Discover concerts and music events happening across Philadelphia in ${monthLabel}, from intimate gigs to big-stage shows.`,
      tagLine: "We pulled every event tagged music so you can plan this month's shows.",
    },
    weekend: {
      summary: 'Concerts and music events happening Friday through Sunday in Philadelphia.',
      intro: 'Music events this weekend include: ',
      empty: "We don't have any tagged music events for this weekend yet—check back soon.",
    },
    today: {
      heading: 'Music events today',
      summary: 'Live music picks happening today.',
      intro: 'Music events today include: ',
      empty: "No tagged music events are listed for today—browse the calendar below for more shows.",
    },
    monthEmpty: monthLabel =>
      `No tagged music events are listed for ${monthLabel} yet. Check back soon or submit one!`,
    loadingText: 'Loading music events…',
    concludingText:
      'Our Philly highlights concerts and music events across Philadelphia so you never miss a show.',
    faq: {
      monthlyQuestion: monthLabel => `What are the best music events in Philadelphia in ${monthLabel}?`,
      monthlyAnswerWithEvents: (count, monthLabel) =>
        `Our Philly curates ${count} music events across Philadelphia for ${monthLabel}, covering concerts, festivals, and jam sessions tagged music.`,
      monthlyAnswerWithoutEvents: monthLabel =>
        `Our Philly tracks music events across Philadelphia for ${monthLabel}, covering concerts, festivals, and jam sessions tagged music.`,
      weekendQuestion: 'Which music events are happening in Philadelphia this weekend?',
      weekendAnswerWithEvents: names => `Music events this weekend include ${names}.`,
      weekendAnswerWithoutEvents:
        'We’re updating this weekend’s music lineup—check back soon or explore our This Weekend in Philadelphia guide for more concerts.',
      todayQuestion: 'Are there music events in Philadelphia today?',
      todayAnswerWithEvents: names => `Music events today include ${names}.`,
      todayAnswerWithoutEvents:
        'No tagged music events are listed for today yet—browse the full monthly calendar for more shows.',
      updatedQuestion: 'How often is the Our Philly music guide updated?',
      updatedAnswer: updatedStamp =>
        `We refresh this guide as new events are published and last updated it on ${updatedStamp}. Bookmark it to catch new concerts each week.`,
    },
    errorLogMessage: 'Error loading music events',
  },
  showRollCall: {
    key: 'showRollCall',
    navLabel: 'Show Roll Call',
    pathSegment: 'philadelphia-show-roll-call',
    tagSlugs: [],
    viewRegex: /^philadelphia-show-roll-call-([a-z-]+)-(\d{4})$/i,
    fallbackDescription:
      'Track every concert hitting Philadelphia this month with our always-updated show roll call.',
    seoTitle: monthLabel => `Philadelphia Show Roll Call – ${monthLabel}`,
    seoTitleFallback: 'Philadelphia Show Roll Call – Our Philly',
    seoDescription: monthLabel =>
      `Browse every concert happening in Philadelphia this ${monthLabel}: venue listings, ticket links, and what\'s on this weekend & today.`,
    jsonLdName: monthLabel => `Philadelphia Show Roll Call – ${monthLabel}`,
    hero: {
      heading: monthLabel => `Philadelphia Show Roll Call – ${monthLabel}`,
      withCount: (count, monthLabel) =>
        `Browse ${count} concerts and live shows happening across Philadelphia in ${monthLabel}.`,
      withoutCount: monthLabel =>
        `Browse concerts and live shows happening across Philadelphia in ${monthLabel}.`,
      tagLine: 'We pulled every show we can find so you can plan your month of music.',
    },
    weekend: {
      summary: 'Concerts and shows happening Friday through Sunday in Philadelphia.',
      intro: 'Shows this weekend include: ',
      empty: "We don't have any shows listed for this weekend yet—check back soon.",
    },
    today: {
      heading: 'Shows happening today',
      summary: 'Quick look at tonight’s concerts across Philly.',
      intro: 'Shows today include: ',
      empty: "No shows are listed for today—browse the full roll call below for more concerts.",
    },
    monthEmpty: monthLabel =>
      `No shows are listed for ${monthLabel} yet. Check back soon or submit one!`,
    loadingText: 'Loading shows…',
    concludingText:
      'Our Philly tracks concerts and live shows across Philadelphia so you never miss a lineup.',
    faq: {
      monthlyQuestion: monthLabel => `What concerts are happening in Philadelphia in ${monthLabel}?`,
      monthlyAnswerWithEvents: (count, monthLabel) =>
        `Our Philly’s show roll call tracks ${count} concerts and live performances happening across Philadelphia in ${monthLabel}, pulling listings from venue calendars and ticketing pages.`,
      monthlyAnswerWithoutEvents: monthLabel =>
        `Our Philly’s show roll call tracks concerts and live performances happening across Philadelphia in ${monthLabel}, pulling listings from venue calendars and ticketing pages.`,
      weekendQuestion: 'Which concerts are happening in Philadelphia this weekend?',
      weekendAnswerWithEvents: names => `Concerts this weekend include ${names}.`,
      weekendAnswerWithoutEvents:
        'We’re gathering this weekend’s shows—check back soon or browse the monthly roll call below.',
      todayQuestion: 'What concerts are happening in Philadelphia today?',
      todayAnswerWithEvents: names => `Concerts today include ${names}.`,
      todayAnswerWithoutEvents:
        'No shows are listed for today yet—check back later or explore the monthly roll call for more concerts.',
      updatedQuestion: 'How often is the Philadelphia show roll call updated?',
      updatedAnswer: updatedStamp =>
        `We refresh this show roll call as new concerts are added and last updated it on ${updatedStamp}. Check back each week for the latest listings.`,
    },
    errorLogMessage: 'Error loading show roll call events',
    filterByTags: false,
    allowedSources: ['all_events'],
    showTicketsButton: true,
  },
};

