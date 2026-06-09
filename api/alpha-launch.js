const {
  createSessionToken,
  getSecret,
  readRequestBody,
  serializeSessionCookie,
  setNoStore,
  verifyLaunchToken,
} = require('./_alphaAuth');

module.exports = async function alphaLaunch(req, res) {
  setNoStore(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ access: false });
    return;
  }

  const secret = getSecret();
  if (!secret) {
    res.status(503).json({ access: false });
    return;
  }

  let body;
  try {
    body = await readRequestBody(req);
  } catch {
    res.status(400).json({ access: false });
    return;
  }

  const token = typeof body.token === 'string' ? body.token : '';
  if (!verifyLaunchToken(token, secret)) {
    res.status(401).json({ access: false });
    return;
  }

  const sessionToken = createSessionToken(secret);
  res.setHeader('Set-Cookie', serializeSessionCookie(sessionToken, req));
  res.status(200).json({ access: true });
};
