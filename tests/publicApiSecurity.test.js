const test = require('node:test');
const assert = require('node:assert/strict');
const expand = require('../api/expand-route-url');

function response() {
  return { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('route expansion rejects unsafe initial URLs without making an outbound request', async () => {
  const original = global.fetch;
  global.fetch = async () => { throw new Error('Outbound fetch must not run'); };
  try {
    for (const url of ['http://maps.google.com/maps', 'https://maps.google.com:8443/maps', 'https://user:password@maps.google.com/maps', 'https://maps.google.com.attacker.invalid/maps', 'file://google.com/a', 'https://google.com/' + 'x'.repeat(4096)]) {
      const res = response();
      await expand({ method: 'GET', query: { url } }, res);
      assert.equal(res.statusCode, 400, url.slice(0, 80));
      assert.equal(res.headers['Cache-Control'], 'no-store, max-age=0');
    }
  } finally { global.fetch = original; }
});

test('each redirect is revalidated, shares a bounded timeout and releases its response body', async () => {
  const original = global.fetch;
  try {
    for (const location of ['http://maps.google.com/maps', 'https://maps.google.com:8443/maps', 'https://google.com@attacker.invalid/', 'https://127.0.0.1/']) {
      let calls = 0; let cancelled = false;
      global.fetch = async (_url, options) => {
        calls += 1;
        assert.equal(options.redirect, 'manual');
        assert.ok(options.signal instanceof AbortSignal);
        return { status: 302, headers: new Headers({ location }), body: { cancel: async () => { cancelled = true; } } };
      };
      const res = response();
      await expand({ method: 'GET', query: { url: 'https://maps.app.goo.gl/test' } }, res);
      assert.equal(res.statusCode, 400); assert.equal(calls, 1); assert.equal(cancelled, true);
    }
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url, signal: options.signal });
      return { status: calls.length === 1 ? 302 : 200, headers: new Headers(calls.length === 1 ? { location: 'https://www.google.com/maps/test' } : {}), body: { cancel: async () => {} } };
    };
    const res = response();
    await expand({ method: 'GET', query: { url: 'https://maps.app.goo.gl/test' } }, res);
    assert.equal(res.statusCode, 200); assert.equal(res.body.url, 'https://www.google.com/maps/test');
    assert.equal(calls[0].signal, calls[1].signal);
  } finally { global.fetch = original; }
});
