const { Buffer } = require('node:buffer');
const OpenAI = require('openai');
const { config, rpc } = require('./worker');
const { accountAdminEmails, isAccountAdmin } = require('../../api/_accountStore');
const { venueFacts } = require('../../src/domain/venueFacts');

function reviewPlaces(value) {
  if (!Array.isArray(value) || !value.length || value.length > 6) return null;
  const ids = new Set();
  for (const p of value) {
    if (
      !p ||
      !['activity', 'food'].includes(p.slot) ||
      typeof p.id !== 'string' ||
      !/^[A-Za-z0-9_-]{5,200}$/.test(p.id) ||
      ids.has(p.id)
    )
      return null;
    ids.add(p.id);
  }
  return value.map(({ id, slot }) => ({ id, slot })).sort((a, b) => a.id.localeCompare(b.id));
}

async function details(id, key) {
  const response = await fetch(
    'https://places.googleapis.com/v1/places/' + encodeURIComponent(id) + '?languageCode=en',
    {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'id,types,primaryType,businessStatus,rating,userRatingCount,editorialSummary,liveMusic,dineIn',
      },
      signal: AbortSignal.timeout(4500),
    },
  );
  if (!response.ok) return null;
  const place = await response.json();
  return place.id === id ? place : null;
}
const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['reviews'],
  properties: {
    reviews: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ref', 'grade', 'feature'],
        properties: {
          ref: { type: 'integer' },
          grade: { type: 'string', enum: ['skip', 'suitable', 'standout'] },
          feature: { type: 'string' },
        },
      },
    },
  },
};
const instructions =
  'Grade each venue as a dedicated outing stop. Use only listed experiences and visitor signals. Skip empty features. A park or landmark needs a concrete draw. Prefer distinctive experiences to incidental amenities. Popularity alone is insufficient. Return each ref once. Copy its most specific supported feature or an empty string for skip.';

function verify(response, rows) {
  if (
    response.status !== 'completed' ||
    !Array.isArray(response.output) ||
    response.output.some((item) => item.content?.some((c) => c.type === 'refusal'))
  )
    return null;
  let data;
  try {
    data = JSON.parse(response.output_text);
  } catch {
    return null;
  }
  if (!Array.isArray(data?.reviews) || Object.keys(data).length !== 1 || data.reviews.length !== rows.length)
    return null;
  const seen = new Set(),
    result = [];
  for (const review of data.reviews) {
    if (
      !review ||
      Object.keys(review).length !== 3 ||
      !Number.isInteger(review.ref) ||
      !rows[review.ref] ||
      seen.has(review.ref)
    )
      return null;
    const row = rows[review.ref];
    seen.add(review.ref);
    if (review.grade === 'skip' && review.feature === '')
      result.push({ id: row.id, slot: row.slot, quality: 0, feature: '' });
    else if (['suitable', 'standout'].includes(review.grade) && row.facts.features.includes(review.feature))
      result.push({
        id: row.id,
        slot: row.slot,
        quality: review.grade === 'standout' ? 6 : 3,
        feature: review.feature,
      });
    else return null;
  }
  return result;
}

function enabled(env, c) {
  return (
    c.enabled &&
    env.NNG_AI_VENUE_REVIEW !== 'false' &&
    !!(env.GOOGLE_PLACES_SERVER_KEY || env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY) &&
    c.global &&
    c.perUser &&
    c.timeout &&
    c.output &&
    c.input &&
    c.attempts &&
    Date.parse(c.since) <= Date.now()
  );
}

async function processReview(
  id = null,
  env = process.env,
  db = rpc,
  lookup = details,
  factory = () => new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0 }),
) {
  const c = config(env);
  if (!enabled(env, c)) return { state: 'disabled', result: [] };
  const job = await db('nng_review_claim', {
    p_admin_emails: accountAdminEmails(env),
    p_id: id,
    p_since: c.since,
    p_only: c.only,
    p_user_cap: c.perUser,
    p_global_cap: c.global,
  });
  if (!job) return { state: 'idle', result: [] };
  const start = Date.now();
  let state = 'unavailable',
    result = [],
    input = 0,
    output = 0;
  try {
    const places = reviewPlaces(job.places);
    if (!places) throw new Error('Invalid batch');
    const resolved = await Promise.allSettled(
      places.map((p) => lookup(p.id, env.GOOGLE_PLACES_SERVER_KEY || env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY)),
    );
    const rows = places.flatMap((p, i) => {
      const entry = resolved[i];
      if (entry.status !== 'fulfilled' || !entry.value) return [];
      const place = entry.value;
      const setting =
        p.slot === 'activity' &&
        ['park', 'national_park', 'historical_landmark', 'monument', 'tourist_attraction'].includes(
          place.primaryType,
        )
          ? place.primaryType
          : p.slot;
      return [{ ...p, setting, facts: venueFacts(p.slot, place) }];
    });
    if (rows.length) {
      const facts = rows.map(({ setting, facts }, ref) => ({
        ref,
        setting,
        features: facts.features,
        stars: facts.stars,
        reviewBand: ['few', 'several', 'many'][facts.confidence],
      }));
      const body = {
        model: env.OPENAI_MODEL,
        store: false,
        instructions,
        input: JSON.stringify(facts),
        max_output_tokens: c.output,
        text: { format: { type: 'json_schema', name: 'venue_review', strict: true, schema } },
      };
      if (Buffer.byteLength(JSON.stringify(body)) + 128 <= c.input) {
        const response = await factory().responses.create(body, {
          timeout: Math.min(10000, c.timeout),
          maxRetries: 0,
        });
        input = response.usage?.input_tokens || 0;
        output = response.usage?.output_tokens || 0;
        const validated = verify(response, rows);
        state = validated ? 'done' : 'invalid';
        result = validated || [];
      } else state = 'input_limit';
    }
  } catch {
    state = 'unavailable';
  }
  const ms = Date.now() - start;
  const saved = await db('nng_review_finish', {
    p_id: job.id,
    p_state: state,
    p_result: result,
    p_ms: ms,
    p_input: input,
    p_output: output,
  });
  console.info('nng_venue_review', { state, latencyMs: ms, inputTokens: input, outputTokens: output });
  return saved ? { state, result } : { state: 'expired', result: [] };
}

async function requestReview(email, places) {
  const c = config(process.env);
  if (!enabled(process.env, c)) return { result: [] };
  const row = await rpc('nng_review_enqueue', {
    p_email: email,
    p_admin: isAccountAdmin(email),
    p_places: places,
    p_only: c.only,
    p_user_cap: c.perUser,
    p_global_cap: c.global,
  });
  if (row.error || row.state !== 'ready') return row.error ? row : { result: row.result || [] };
  return processReview(row.id);
}
module.exports = { reviewPlaces, verify, processReview, requestReview };
