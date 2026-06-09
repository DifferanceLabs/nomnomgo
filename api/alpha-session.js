const {
  COOKIE_NAME,
  getSecret,
  parseCookies,
  setNoStore,
  verifySessionToken,
} = require('./_alphaAuth');

module.exports = function alphaSession(req, res) {
  setNoStore(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ access: false });
    return;
  }

  const secret = getSecret();
  if (!secret) {
    res.status(503).json({ access: false });
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const hasAccess = verifySessionToken(cookies[COOKIE_NAME], secret);
  res.status(hasAccess ? 200 : 401).json({ access: hasAccess });
};
