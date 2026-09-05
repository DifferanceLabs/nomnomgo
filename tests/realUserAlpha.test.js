const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { readFileSync } = require('node:fs');
const crypto = require('node:crypto');
const { Buffer } = require('node:buffer');
const { PGlite } = require('@electric-sql/pglite');
const auth = require('../api/_alphaAuth');
const handler = require('../api/account');
const launch = require('../api/alpha-launch');
const secret = 'test-only-secret-not-used-outside-tests';
let db;
const originalFetch = global.fetch;
const originalEnv = { ...process.env };

async function rpc(email, action = 'load', data = {}, admin = false) {
  const response = await db.query('select public.nng_alpha($1, $2, $3, $4) as result', [email, admin, action, JSON.stringify(data)]);
  return response.rows[0].result;
}

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.users(email text primary key);
    create table public.apps(slug text primary key, status text not null);
    create table public.app_grants(user_email text references public.users(email), app_slug text references public.apps(slug), role text, granted_by text, unique(user_email, app_slug));
    insert into public.apps values ('nomnomgo', 'active');
    insert into public.users values ('owner@example.com');
    insert into public.app_grants values ('owner@example.com', 'nomnomgo', 'member', null);
    grant select, insert on public.users, public.app_grants to service_role;
    grant select on public.apps to service_role;
  `);
  await db.exec(readFileSync('supabase/migrations/001_real_user_alpha.sql', 'utf8'));
  process.env.DL_APP_LAUNCH_SECRET = secret;
  process.env.SUPABASE_URL = 'https://database.example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-service-key';
  process.env.NNG_ADMIN_EMAILS = 'owner@example.com';
  global.fetch = async (_url, options) => {
    const args = JSON.parse(options.body);
    return { ok: true, json: async () => rpc(args.p_email, args.p_action, args.p_data, args.p_admin) };
  };
});
after(async () => {
  global.fetch = originalFetch;
  for (const key of ['DL_APP_LAUNCH_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NNG_ADMIN_EMAILS']) {
    if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  }
  await db.close();
});

function responseRecorder() {
  return { headers: {}, statusCode: 200, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}
async function request(email, body, options = {}) {
  const res = responseRecorder();
  const cookie = email ? `${auth.COOKIE_NAME}=${auth.createSessionToken(secret, { email })}` : '';
  await handler({ method: body ? 'POST' : 'GET', headers: { host: 'nng.example.com', origin: 'https://nng.example.com',
    cookie, 'content-type': 'application/json', ...options.headers }, body, ...options.request }, res);
  return res;
}
function token(payload, jwt = false) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = jwt ? `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${encoded}` : encoded;
  return `${data}.${crypto.createHmac('sha256', secret).update(data).digest('base64url')}`;
}

test('DL launch formats bind the cookie to the verified email, rejecting malformed or identity-free tokens', async () => {
  for (const jwt of [false, true]) {
    const valid = token({ app_slug: 'nomnomgo', user_email: 'Owner@Example.com', expires_at: Date.now() + 60000 }, jwt);
    assert.deepEqual(auth.verifiedLaunchIdentity(valid, secret), { email: 'owner@example.com' });
    const res = responseRecorder();
    await launch({ method: 'POST', headers: { host: 'nng.example.com' }, body: { token: valid } }, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['Set-Cookie'], /HttpOnly.*SameSite=Lax.*Secure/);
    assert.deepEqual(auth.sessionIdentity({ headers: { cookie: res.headers['Set-Cookie'] } }), { email: 'owner@example.com' });
  }
  for (const payload of [null, {}, { app: 'nomnomgo', exp: 1 }, { app: 'other', exp: 9999999999, user_email: 'a@b.com' }]) {
    assert.equal(auth.verifiedLaunchIdentity(token(payload), secret), null);
  }
  const valid = token({ app: 'nomnomgo', exp: 9999999999, user_email: 'a@b.com' });
  assert.equal(auth.verifiedLaunchIdentity(`${valid}x`, secret), null);
  assert.equal(auth.verifiedLaunchIdentity({}, secret), null);
  assert.equal(auth.sessionIdentity({ headers: { cookie: `${auth.COOKIE_NAME}=%ZZ` } }), null);
  const malformed = responseRecorder();
  await launch({ method: 'POST', headers: { host: 'nng.example.com' }, body: 'null' }, malformed);
  assert.equal(malformed.statusCode, 401);
});

test('account API rejects anonymous sessions, forged ownership and cross-origin writes', async () => {
  assert.equal((await request(null)).statusCode, 401);
  assert.equal((await request('stranger@example.com')).statusCode, 403);
  assert.equal((await request('owner@example.com', { action: 'invite', email: 'test@example.com' }, { headers: { origin: 'https://evil.example.com' } })).statusCode, 403);
  assert.equal((await request('owner@example.com', { action: 'invite', email: 'bad' })).statusCode, 400);
  const owner = await request('owner@example.com');
  assert.equal(owner.statusCode, 200);
  assert.equal(owner.body.user.email, 'owner@example.com');
  assert.equal(owner.headers['Cache-Control'], 'no-store, max-age=0');
});

test('inviting an email grants only NomNomGo, is idempotent, and accepts when that account loads', async () => {
  const invite = await request('owner@example.com', { action: 'invite', email: 'Friend@Example.com' });
  assert.equal(invite.statusCode, 200);
  assert.equal((await request('owner@example.com', { action: 'invite', email: 'friend@example.com' })).statusCode, 200);
  assert.equal((await db.query('select * from public.nng_invitations')).rows.length, 1);
  const grants = (await db.query("select * from public.app_grants where user_email = 'friend@example.com'")).rows;
  assert.equal(grants.length, 1);
  assert.equal(grants[0].app_slug, 'nomnomgo');
  const friend = await request('friend@example.com');
  assert.equal(friend.statusCode, 200);
  assert.equal(friend.body.user.isAdmin, false);
  assert.notEqual(friend.body.user.id, (await request('owner@example.com')).body.user.id);
  assert.ok((await db.query('select accepted_at from public.nng_invitations')).rows[0].accepted_at);
});

test('personal cloud saves are isolated, persist across loads, and reject stale device revisions', async () => {
  const save = { action: 'save', key: 'nomNomGoSavedPlansV1', value: JSON.stringify([{ id: 'plan-1' }]), version: 0, email: 'friend@example.com', accountId: 'forged' };
  assert.equal((await request('owner@example.com', save)).statusCode, 200);
  assert.equal((await request('owner@example.com', save)).statusCode, 409);
  const loaded = (await request('owner@example.com')).body.state[save.key];
  assert.equal(loaded.value, save.value);
  assert.equal((await request('friend@example.com')).body.state[save.key], undefined);
  assert.equal((await request('owner@example.com', { ...save, version: 1, value: null })).statusCode, 200);
  assert.equal((await request('owner@example.com')).body.state[save.key].version, 2);
  assert.equal((await request('owner@example.com', { ...save, key: 'arbitrary' })).statusCode, 400);
  assert.equal((await request('owner@example.com', { ...save, value: 'invalid JSON' })).statusCode, 400);
});

test('admin metrics are server-authorized and access removal takes effect on existing sessions', async () => {
  assert.equal((await request('friend@example.com', { action: 'metrics', isAdmin: true })).statusCode, 403);
  const metrics = await request('owner@example.com', { action: 'metrics' });
  assert.equal(metrics.statusCode, 200);
  assert.equal(metrics.body.accounts, 2);
  assert.equal(metrics.body.invitations, 1);
  assert.equal(metrics.body.acceptedInvitations, 1);
  await db.exec("delete from public.app_grants where user_email = 'friend@example.com'");
  assert.equal((await request('friend@example.com')).statusCode, 403);
  assert.equal((await request('owner@example.com', { action: 'invite', email: 'friend@example.com' })).statusCode, 409);
});

test('daily invitation cap is enforced in the database', async () => {
  for (let i = 0; i < 9; i++) assert.equal((await request('owner@example.com', { action: 'invite', email: `daily${i}@example.com` })).statusCode, 200);
  assert.equal((await request('owner@example.com', { action: 'invite', email: 'overlimit@example.com' })).statusCode, 429);
  assert.equal((await db.query("select * from public.app_grants where user_email = 'overlimit@example.com'")).rows.length, 0);
});

test('global capacity counts pending invites and accounts without double counting', async () => {
  await db.exec("insert into public.nng_accounts(email) select 'capacity' || n || '@example.com' from generate_series(1, 489) n");
  const result = await rpc('daily0@example.com');
  assert.ok(result.user, 'A reserved invitation may join at capacity');
  assert.equal((await rpc('daily0@example.com', 'invite', { email: 'overflow@example.com' })).status, 429);
});

test('public database roles cannot execute the privileged account function or read tables', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query("select public.nng_alpha('owner@example.com', true, 'metrics')"), /permission denied/);
    await assert.rejects(db.query('select * from public.nng_accounts'), /permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.ok((await rpc('owner@example.com')).user);
  await db.exec('reset role');
});

test('account request limits and paused accounts are enforced independently of browser state', async () => {
  await db.exec("update public.nng_accounts set requests_in_window = 120 where email = 'daily0@example.com'");
  assert.equal((await rpc('daily0@example.com')).status, 429);
  await db.exec("update public.nng_accounts set request_window = now() - interval '2 minutes' where email = 'daily0@example.com'");
  assert.ok((await rpc('daily0@example.com')).user);
  await db.exec("update public.nng_accounts set enabled = false where email = 'daily0@example.com'");
  assert.equal((await rpc('daily0@example.com')).status, 403);
});

test('storage outages do not return successful account saves and logout clears the cookie', async () => {
  const savedFetch = global.fetch;
  global.fetch = async () => { throw new Error('private backend failure'); };
  const result = await request('owner@example.com');
  assert.equal(result.statusCode, 503);
  assert.doesNotMatch(result.body.error, /private backend failure/);
  global.fetch = savedFetch;
  const logout = await request(null, undefined, { request: { method: 'DELETE' } });
  assert.equal(logout.statusCode, 200);
  assert.match(logout.headers['Set-Cookie'], /Max-Age=0/);
});
