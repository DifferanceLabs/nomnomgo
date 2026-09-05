// A bounded, cached geographic lookup. Clients cannot submit arbitrary Overpass queries.
const cache = new Map();
const pending = new Map();
const TTL = 30 * 60 * 1000;

module.exports = async function localAreas(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const { kind, lat, lng } = req.query || {};
  if (!['freeway', 'neighborhood'].includes(kind) || typeof lat !== 'string' || typeof lng !== 'string'
    || !lat.trim() || !lng.trim() || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))
    || Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180) {
    return res.status(400).json({ error: 'invalid_area' });
  }
  // Round to roughly a city block so nearby requests share a cache entry.
  const latitude = Number(lat).toFixed(2);
  const longitude = Number(lng).toFixed(2);
  const key = `${kind}:${latitude}:${longitude}`;
  const saved = cache.get(key);
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800');
  if (saved && saved.expires > Date.now()) return res.status(200).json(saved.data);
  try {
    if (!pending.has(key)) {
      const query = kind === 'freeway'
        ? `way["highway"="motorway"](around:25000,${latitude},${longitude});out tags geom;`
        : `nwr["place"~"^(suburb|quarter|neighbourhood)$"]["name"](around:15000,${latitude},${longitude});out tags center;`;
      const request = (async () => {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'NomNomGo/1.0 (+https://nomnomgo.differancelabs.com)' },
          body: `data=${encodeURIComponent(`[out:json][timeout:20];${query}`)}`,
          signal: AbortSignal.timeout(25000),
        });
        if (!response.ok) throw new Error('Area provider unavailable');
        const data = await response.json();
        if (data.remark || !Array.isArray(data.elements)) throw new Error('Incomplete area response');
        const result = { elements: data.elements };
        if (cache.size >= 60) cache.delete(cache.keys().next().value);
        cache.set(key, { expires: Date.now() + TTL, data: result });
        return result;
      })();
      pending.set(key, request);
      // Clean up independently of whichever request first awaited this lookup.
      void request.finally(() => pending.delete(key)).catch(() => {});
    }
    return res.status(200).json(await pending.get(key));
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'areas_unavailable' });
  }
};
