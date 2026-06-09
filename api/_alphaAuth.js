const crypto = require('crypto');

const APP_SLUG = 'nomnomgo';
const COOKIE_NAME = 'nomnomgo_alpha_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function getSecret() {
  return process.env.DL_APP_LAUNCH_SECRET || '';
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest();
}

function signBase64Url(value, secret) {
  return sign(value, secret)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function timingSafeEqualString(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function readJsonPayload(encodedPayload) {
  return JSON.parse(base64UrlDecode(encodedPayload));
}

function expirySeconds(payload) {
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
  return payload.exp > 100000000000 ? Math.floor(payload.exp / 1000) : Math.floor(payload.exp);
}

function payloadAppSlug(payload) {
  return payload.app || payload.app_slug || payload.appSlug || payload.slug;
}

function verifyLaunchToken(token, secret) {
  if (!token || !secret) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [encodedHeader, encodedPayload, signature] = parts;
  const signedValue = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = signBase64Url(signedValue, secret);

  if (!timingSafeEqualString(signature, expectedSignature)) return false;

  let header;
  let payload;
  try {
    header = readJsonPayload(encodedHeader);
    payload = readJsonPayload(encodedPayload);
  } catch {
    return false;
  }

  if (header.alg !== 'HS256') return false;
  if (payloadAppSlug(payload) !== APP_SLUG) return false;

  const expiresAt = expirySeconds(payload);
  if (!expiresAt) return false;

  return expiresAt > Math.floor(Date.now() / 1000);
}

function createSessionToken(secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    app: APP_SLUG,
    kind: 'nomnomgo-alpha-session',
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${signBase64Url(encodedPayload, secret)}`;
}

function verifySessionToken(token, secret) {
  if (!token || !secret) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [encodedPayload, signature] = parts;
  const expectedSignature = signBase64Url(encodedPayload, secret);

  if (!timingSafeEqualString(signature, expectedSignature)) return false;

  let payload;
  try {
    payload = readJsonPayload(encodedPayload);
  } catch {
    return false;
  }

  if (payload.kind !== 'nomnomgo-alpha-session') return false;
  if (payloadAppSlug(payload) !== APP_SLUG) return false;

  const expiresAt = expirySeconds(payload);
  if (!expiresAt) return false;

  return expiresAt > Math.floor(Date.now() / 1000);
}

function parseCookies(cookieHeader) {
  return String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) return cookies;
      const name = part.slice(0, separatorIndex);
      const value = part.slice(separatorIndex + 1);
      cookies[name] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function isLocalHost(hostHeader) {
  const hostname = String(hostHeader || '').split(':')[0].toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1';
}

function serializeSessionCookie(value, req) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];

  if (!isLocalHost(req.headers.host)) parts.push('Secure');

  return parts.join('; ');
}

function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

function readRequestBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 8192) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

module.exports = {
  COOKIE_NAME,
  createSessionToken,
  getSecret,
  parseCookies,
  readRequestBody,
  serializeSessionCookie,
  setNoStore,
  verifyLaunchToken,
  verifySessionToken,
};
