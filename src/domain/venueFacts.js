// Only name an experience supported by a provider category, amenity, or affirmative description.
const experiences = [
  ['bowling', 'Go bowling', ['bowling_alley']],
  ['cinema', 'Catch a movie', ['movie_theater']],
  ['interactive', 'Explore the interactive exhibits', [], /\b(?:interactive|hands-on) exhibits?\b/i],
  [
    'onsite_museum',
    'Visit the on-site museum',
    [],
    /\b(?:with|features?|includes?|houses?|and|&) (?:a |an |the )?(?:[\w-]+ ){0,2}museum\b/i,
  ],
  [
    'public_art',
    'Explore the outdoor art',
    ['sculpture_garden'],
    /\b(?:sculpture gardens?|outdoor sculptures?|public art installations?)\b/i,
  ],
  [
    'exhibits',
    'Explore the exhibits',
    ['museum', 'art_museum', 'art_gallery', 'planetarium', 'science_museum'],
  ],
  ['games', 'Play games', ['video_arcade', 'amusement_center', 'amusement_park']],
  ['mini_golf', 'Play miniature golf', ['miniature_golf_course']],
  ['karting', 'Go kart racing', ['go_karting_venue']],
  ['paintball', 'Play paintball', ['paintball_center']],
  ['escape', 'Try an escape room', ['escape_room']],
  ['animals', 'See the animals', ['aquarium', 'zoo', 'wildlife_park']],
  [
    'performance',
    'Live performance venue · check showtimes',
    [
      'concert_hall',
      'performing_arts_theater',
      'opera_house',
      'live_music_venue',
      'comedy_club',
      'amphitheatre',
    ],
  ],
  ['trail', 'Walk the trails', ['hiking_area'], /\b(?:hiking|walking|nature|paved|woodland|scenic) trails?\b/i],
  ['garden', 'Visit the gardens', ['botanical_garden', 'arboretum'], /\b(?:botanical gardens?|arboretum)\b/i],
  ['play', 'Visit the playground', ['playground'], /\b(?:playground|splash pad)\b/i],
  [
    'water',
    'Visit the swimming area',
    ['swimming_pool', 'water_park'],
    /\b(?:swimming beach|swimming area|water slides?)\b/i,
  ],
  ['beach', 'Visit the beach', ['beach']],
  ['view', 'Visit the observation deck', ['observation_deck'], /\b(?:observation deck|viewing platform)\b/i],
  [
    'tour',
    'Take a guided tour',
    [],
    /\b(?:offers?|offering|features?|with|hosts?) (?:daily |regular )?guided tours?\b/i,
  ],
  [
    'sports',
    'Play sports',
    [
      'ice_skating_rink',
      'golf_course',
      'tennis_court',
      'skateboard_park',
      'sports_complex',
      'rock_climbing_gym',
    ],
  ],
  ['shopping', 'Browse the shops', ['shopping_mall', 'market']],
];
const labels = Object.fromEntries(experiences.map(([code, label]) => [code, label]));
Object.assign(labels, {
  meal: 'Stop for a meal',
  coffee: 'Stop for coffee',
  bakery: 'Visit the bakery',
  dessert: 'Stop for dessert',
  event: 'Attend the scheduled event',
});

function venueFacts(slot, place) {
  const types = new Set([place.primaryType, ...(place.types || [])]);
  const sentences = String(place.editorialSummary?.text || '')
    .slice(0, 500)
    .split(/[.!?;]/)
    .filter(
      (line) =>
        !/\b(no|without|closed|closing|former|planned|proposed|removed|unavailable|temporarily)\b/i.test(line),
    );
  let features = [];
  if (slot === 'activity') {
    if (place.eventStartMs) features.push('event');
    for (const [code, , categories, pattern] of experiences) {
      if (categories.includes(place.primaryType)) features.unshift(code);
      else if (
        categories.some((type) => types.has(type)) ||
        (pattern && sentences.some((line) => pattern.test(line)))
      )
        features.push(code);
    }
    if (place.liveMusic === true && !features.includes('performance')) features.push('performance');
  } else {
    if (types.has('cafe') || types.has('coffee_shop')) features.push('coffee');
    if (types.has('bakery')) features.push('bakery');
    if (types.has('ice_cream_shop') || types.has('dessert_shop')) features.push('dessert');
    if ([...types].some((t) => typeof t === 'string' && /(^|_)restaurant$/.test(t)) || place.dineIn === true)
      features.push('meal');
  }
  if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') features = [];
  const reviews = Math.max(0, Number(place.ratingCount ?? place.userRatingCount) || 0);
  const stars = reviews >= 5 ? Math.min(5, Math.max(0, Number(place.rating) || 0)) : 0;
  const confidence = reviews >= 100 ? 2 : reviews >= 10 ? 1 : 0;
  const quality = features.length
    ? 2 + (stars >= 4 && confidence ? 1 : 0) + (stars >= 4.5 && confidence === 2 ? 1 : 0)
    : 0;
  return { features, quality, stars, confidence };
}
module.exports = { venueFacts, labels };
