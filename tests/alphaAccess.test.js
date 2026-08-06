const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DIFFERANCE_NOMNOMGO_LAUNCH_URL,
  LAUNCH_TOKEN_PARAM,
  responseGrantsAlphaAccess,
} = require('../.route-import-test-build/alphaAccess');

function mockResponse({ access = true, contentType = 'application/json; charset=utf-8', ok = true, throws = false } = {}) {
  return {
    ok,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? contentType : null;
      },
    },
    async json() {
      if (throws) throw new Error('invalid json');
      return { access };
    },
  };
}

test('uses the protected Differance Labs launcher for NomNomGo', () => {
  assert.equal(
    DIFFERANCE_NOMNOMGO_LAUNCH_URL,
    'https://differancelabs.com/api/apps/launch?app=nomnomgo',
  );
  assert.equal(LAUNCH_TOKEN_PARAM, 'dl_launch_token');
});

test('accepts only an explicit successful JSON access response', async () => {
  assert.equal(await responseGrantsAlphaAccess(mockResponse()), true);
  assert.equal(await responseGrantsAlphaAccess(mockResponse({ access: false })), false);
  assert.equal(await responseGrantsAlphaAccess(mockResponse({ ok: false })), false);
  assert.equal(await responseGrantsAlphaAccess(mockResponse({ contentType: 'text/html' })), false);
  assert.equal(await responseGrantsAlphaAccess(mockResponse({ throws: true })), false);
});
