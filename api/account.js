const { sessionIdentity, setNoStore } = require('./_alphaAuth');
const { accountRpc, isAccountAdmin } = require('./_accountStore');
const { sharedData, ACTIONS } = require('./_sharedValidation');

const KEYS = new Set([
  'thingsNearbyGooglePlacesMemoryV1', 'nomNomGoSavedPlansV1', 'nomNomGoBetaPlansV1',
  'nomNomGoActiveBetaPlanV1', 'nomNomGoPlanningSessionsV1', 'nomNomGoActivePlanningSessionV1',
  'nomNomGoUsageMeterV1',
]);

async function bodyOf(req) {
  let raw;
  if (req.body !== undefined) raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  else {
    raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw) > 1500000) throw new Error('Too large');
    }
  }
  if (Buffer.byteLength(raw) > 1500000) throw new Error('Too large');
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid body');
  return value;
}

module.exports = async function account(req, res) {
  setNoStore(res);
  res.setHeader('Vary', 'Cookie');
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  // Cookie-authenticated mutations must originate from this app, including logout.
  if (req.method !== 'GET') {
    let origin;
    try { origin = new URL(req.headers.origin); } catch { /* Reject missing origins. */ }
    if (!origin || origin.host !== req.headers.host || !['https:', 'http:'].includes(origin.protocol)) {
      return res.status(403).json({ error: 'Open NomNomGo to perform this action.' });
    }
  }
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', 'nomnomgo_alpha_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    return res.status(200).json({ ok: true });
  }
  const identity = sessionIdentity(req);
  if (!identity) return res.status(401).json({ error: 'Please sign in again through Differance Labs.' });
  let body = {};
  if (req.method === 'POST') {
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      return res.status(415).json({ error: 'JSON required.' });
    }
    try { body = await bodyOf(req); } catch { return res.status(400).json({ error: 'Invalid or oversized request.' }); }
  }
  const action = req.method === 'GET' ? 'load' : body.action;
  if (!['load', 'save', 'invite', 'metrics'].includes(action) && !ACTIONS.has(action)) return res.status(400).json({ error: 'Unknown action.' });
  const admin = isAccountAdmin(identity.email);
  if (['metrics', 'plan.metrics'].includes(action) && !admin) return res.status(403).json({ error: 'Admin access required.' });
  let data = {};
  if (ACTIONS.has(action)) {
    try { data = sharedData(action, body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
  }
  if (action === 'save') {
    if (!KEYS.has(body.key) || !Number.isSafeInteger(body.version) || body.version < 0
      || !(body.value === null || typeof body.value === 'string')) {
      return res.status(400).json({ error: 'Invalid save.' });
    }
    try { if (body.value !== null) JSON.parse(body.value); } catch { return res.status(400).json({ error: 'Invalid saved data.' }); }
    data = { key: body.key, value: body.value, version: body.version };
  }
  if (action === 'invite') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter the email address used for Google sign-in.' });
    }
    data = { email };
  }
  if (action === 'invite' || action === 'plan.invite') data.targetAdmin = isAccountAdmin(data.email);
  try {
    const result = await accountRpc({ p_email: identity.email, p_admin: admin, p_action: action, p_data: data });
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    return res.status(200).json(result);
  } catch {
    return res.status(503).json({ error: 'Account storage is unavailable. We could not confirm this request. Refresh before retrying.' });
  }
};
