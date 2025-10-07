export function normalizeTaggableType(rawType) {
  if (!rawType) return ''
  const simplified = String(rawType)
    .split('::')
    .pop()
    .split('\\')
    .pop()
    .toLowerCase()

  const map = {
    group: 'groups',
    groups: 'groups',
    event: 'events',
    events: 'events',
    legacy_event: 'events',
    legacy_events: 'events',
    tradition: 'events',
    traditions: 'events',
    big_board_event: 'big_board_events',
    big_board_events: 'big_board_events',
    all_event: 'all_events',
    all_events: 'all_events',
    group_event: 'group_events',
    group_events: 'group_events',
    recurring_event: 'recurring_events',
    recurring_events: 'recurring_events',
  }

  return map[simplified] || simplified || ''
}
