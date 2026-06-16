const ALLOWED_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'google.com',
  'www.google.com',
  'maps.google.com',
]);

function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

function isAllowedHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return ALLOWED_HOSTS.has(host) || host.endsWith('.google.com');
}

function readUrlParam(req) {
  const value = req.query?.url;
  return Array.isArray(value) ? value[0] : value;
}

module.exports = async function expandRouteUrl(req, res) {
  setNoStore(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  let current;
  try {
    current = new URL(String(readUrlParam(req) || ''));
  } catch {
    res.status(400).json({ error: 'invalid_url' });
    return;
  }

  if (!isAllowedHost(current.hostname)) {
    res.status(400).json({ error: 'unsupported_url' });
    return;
  }

  try {
    for (let hop = 0; hop < 5; hop += 1) {
      const response = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
      });

      const location = response.headers.get('location');
      if (!location || response.status < 300 || response.status >= 400) break;

      const next = new URL(location, current);
      if (!isAllowedHost(next.hostname)) {
        res.status(400).json({ error: 'unsupported_redirect' });
        return;
      }
      current = next;
    }

    res.status(200).json({ url: current.toString() });
  } catch {
    res.status(502).json({ error: 'expand_failed' });
  }
};
