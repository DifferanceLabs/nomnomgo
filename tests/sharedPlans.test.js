const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const auth = require('../api/_alphaAuth');
const handler = require('../api/account');
const { sharedData } = require('../api/_sharedValidation');
let db, plan, friendId;
const secret = 'local-shared-plan-test-secret';
const originalFetch = global.fetch;
const originalEnv = { ...process.env };
const errors = [];
const details = { title: 'Saturday lunch', intent: 'both', locationLabel: 'Downtown', dateStart: '2026-09-12', dateEnd: '2026-09-12', timeWindow: '12:00 America/Chicago', stops: [] };
async function rpc(fn, email, action, data = {}, admin = false) {
  return (await db.query(`select public.${fn}($1,$2,$3,$4) as result`, [email, admin, action, JSON.stringify(data)])).rows[0].result;
}
async function request(email, action, data = {}) {
  const result = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: action ? 'POST' : 'GET', headers: { host: 'nng.example.com', origin: 'https://nng.example.com', 'content-type': 'application/json', cookie: `${auth.COOKIE_NAME}=${auth.createSessionToken(secret, {email})}` }, body: action ? { action, ...data } : undefined }, result);
  return result;
}
async function ok(email, action, data) {
  const result = await request(email, action, data);
  assert.equal(result.statusCode, 200, JSON.stringify({ body: result.body, errors }));
  return result.body;
}
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public.users(email text primary key);
    create table public.apps(slug text primary key, status text not null);
    create table public.app_grants(user_email text references public.users(email), app_slug text references public.apps(slug), role text, granted_by text, unique(user_email,app_slug));
    insert into public.apps values ('nomnomgo','active');
    insert into public.users values ('owner@example.com'),('outsider@example.com');
    insert into public.app_grants values ('owner@example.com','nomnomgo','member',null),('outsider@example.com','nomnomgo','member',null);
    grant select, insert on public.users, public.app_grants to service_role; grant select on public.apps to service_role;`);
  for (const file of ['001_real_user_alpha.sql', '002_shared_alpha_plans.sql']) await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  process.env.DL_APP_LAUNCH_SECRET = secret;
  process.env.SUPABASE_URL = 'https://local-test.example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-test-key';
  process.env.NNG_ADMIN_EMAILS = 'owner@example.com';
  global.fetch = async (url, options) => {
    const args = JSON.parse(options.body);
    try {
      const result = await rpc(url.endsWith('/nng_shared') ? 'nng_shared' : 'nng_alpha', args.p_email, args.p_action, args.p_data, args.p_admin);
      return { ok: true, json: async () => result };
    } catch (error) { errors.push(error.message); throw error; }
  };
  await ok('owner@example.com'); await ok('outsider@example.com');
});
after(async () => {
  global.fetch = originalFetch;
  for (const key of ['DL_APP_LAUNCH_SECRET','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','NNG_ADMIN_EMAILS']) {
    if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  }
  await db.close();
});

test('shared creation is idempotent, server-owned and independent from personal saves', async () => {
  plan = (await ok('owner@example.com', 'plan.create', { sourceKey: 'draft-1', details, ownerId: 'forged' })).plan;
  assert.equal(plan.title, details.title);
  assert.equal(plan.participants[0].role, 'owner');
  assert.equal(plan.participants[0].rsvp, 'going');
  assert.equal((await ok('owner@example.com', 'plan.create', { sourceKey: 'draft-1', details })).plan.id, plan.id);
  assert.equal((await db.query('select * from public.nng_shared_plans')).rows.length, 1);
  assert.equal((await request('outsider@example.com','plan.get',{planId:plan.id})).statusCode, 404);
  assert.equal((await ok('outsider@example.com','plan.list')).plans.length, 0);
});
test('plan invitation grants alpha, survives fresh account load, and appears in the invitee plan list', async () => {
  plan = (await ok('owner@example.com','plan.invite',{planId:plan.id,email:'Friend@Example.com'})).plan;
  assert.equal(plan.participants[1].joined, false);
  friendId = (await ok('friend@example.com')).user.id;
  assert.equal((await ok('friend@example.com','plan.list')).plans[0].id, plan.id);
  plan = (await ok('friend@example.com','plan.get',{planId:plan.id})).plan;
  assert.equal(plan.participants.find((p) => p.userId === friendId).joined, true);
});
test('RSVP changes propagate between accounts and cannot write another member response', async () => {
  const staleRevision = plan.revision;
  const result = await ok('friend@example.com','plan.rsvp',{planId:plan.id,rsvp:'maybe',email:'owner@example.com',userId:plan.ownerId});
  assert.equal(result.plan.participants.find((p) => p.userId === friendId).rsvp, 'maybe');
  plan = (await ok('owner@example.com','plan.get',{planId:plan.id})).plan;
  assert.equal(plan.participants.find((p) => p.role === 'owner').rsvp, 'going');
  assert.equal(plan.participants.find((p) => p.userId === friendId).rsvp, 'maybe');
  assert.ok(plan.revision > staleRevision);
  assert.equal((await ok('friend@example.com','plan.rsvp',{planId:plan.id,rsvp:'maybe'})).plan.revision, plan.revision);
  await Promise.all([
    ok('friend@example.com','plan.rsvp',{planId:plan.id,rsvp:'going'}),
    ok('owner@example.com','plan.rsvp',{planId:plan.id,rsvp:'maybe'}),
  ]);
  plan = (await ok('owner@example.com','plan.get',{planId:plan.id})).plan;
  assert.equal(plan.participants.find((p) => p.userId === friendId).rsvp, 'going');
  assert.equal(plan.participants.find((p) => p.role === 'owner').rsvp, 'maybe');
});
let suggestionId;
test('participants suggest and cast only their own idempotent votes; organizer builds the shared itinerary', async () => {
  suggestionId = randomUUID();
  const body = {planId:plan.id,suggestionId,slot:'food',place:{title:'Taco spot',provider:'manual'}};
  plan = (await ok('friend@example.com','plan.suggest',body)).plan;
  await ok('friend@example.com','plan.suggest',body);
  assert.equal(plan.suggestions.length,1);
  assert.equal(plan.suggestions[0].createdBy,friendId);
  plan = (await ok('friend@example.com','plan.vote',{planId:plan.id,suggestionId,voted:true,email:'owner@example.com'})).plan;
  assert.equal(plan.suggestions[0].votes[0].userId,friendId);
  plan = (await ok('friend@example.com','plan.vote',{planId:plan.id,suggestionId,voted:true})).plan;
  assert.equal(plan.suggestions[0].votes.length,1);
  assert.equal((await request('friend@example.com','plan.pick',{planId:plan.id,suggestionId,revision:plan.revision})).statusCode,403);
  plan = (await ok('owner@example.com','plan.pick',{planId:plan.id,suggestionId,revision:plan.revision})).plan;
  assert.equal(plan.stops[0].place.title,'Taco spot');
  assert.equal(plan.stops[0].planId,plan.id);
});
test('stale owner edits fail, participants cannot lock, and locking freezes edits but still accepts RSVPs', async () => {
  assert.equal((await request('owner@example.com','plan.update',{planId:plan.id,revision:1,details:{...details,title:'Stale'}})).statusCode,409);
  assert.equal((await request('friend@example.com','plan.lock',{planId:plan.id,revision:plan.revision})).statusCode,403);
  plan = (await ok('owner@example.com','plan.lock',{planId:plan.id,revision:plan.revision})).plan;
  assert.equal(plan.status,'locked');
  assert.equal((await request('friend@example.com','plan.vote',{planId:plan.id,suggestionId,voted:false})).statusCode,409);
  assert.equal((await request('friend@example.com','plan.suggest',{planId:plan.id,suggestionId:randomUUID(),slot:'food',place:{title:'Other',provider:'manual'}})).statusCode,409);
  plan = (await ok('friend@example.com','plan.rsvp',{planId:plan.id,rsvp:'cant_make_it'})).plan;
  assert.equal(plan.participants.find((p) => p.userId === friendId).rsvp,'cant_make_it');
  assert.equal((await ok('owner@example.com','plan.get',{planId:plan.id})).plan.status,'locked');
});
test('members can invite existing alpha users without duplicate global invitations', async () => {
  plan = (await ok('friend@example.com','plan.invite',{planId:plan.id,email:'outsider@example.com'})).plan;
  assert.equal(plan.participants.length,3);
  assert.equal((await ok('outsider@example.com','plan.get',{planId:plan.id})).plan.id,plan.id);
  assert.equal((await db.query('select * from public.nng_invitations')).rows.length,1);
  plan = (await ok('owner@example.com','plan.get',{planId:plan.id})).plan;
});
test('owner can reopen, edit, reorder and remove stops without changing members or votes', async () => {
  plan = (await ok('owner@example.com','plan.reopen',{planId:plan.id,revision:plan.revision})).plan;
  plan = (await ok('owner@example.com','plan.update',{planId:plan.id,revision:plan.revision,details:{...details,title:'Lunch together',stops:[],participants:[],status:'locked'}})).plan;
  assert.equal(plan.title,'Lunch together'); assert.equal(plan.stops.length,1); assert.equal(plan.participants.length,3); assert.equal(plan.status,'planning');
  const secondId = randomUUID();
  plan = (await ok('owner@example.com','plan.suggest',{planId:plan.id,suggestionId:secondId,slot:'activity',place:{title:'Park',provider:'manual'}})).plan;
  plan = (await ok('owner@example.com','plan.pick',{planId:plan.id,suggestionId:secondId,revision:plan.revision})).plan;
  plan = (await ok('owner@example.com','plan.moveStop',{planId:plan.id,stopId:secondId,direction:-1,revision:plan.revision})).plan;
  assert.equal(plan.stops[0].place.title,'Park'); assert.equal(plan.stops[0].position,0);
  plan = (await ok('owner@example.com','plan.removeStop',{planId:plan.id,stopId:secondId,revision:plan.revision})).plan;
  assert.equal(plan.stops[0].place.title,'Taco spot');
});
test('removing a member revokes read and mutation access and removes their votes, without revoking other apps', async () => {
  plan = (await ok('owner@example.com','plan.removeMember',{planId:plan.id,email:'friend@example.com',revision:plan.revision})).plan;
  assert.equal(plan.participants.length,2); assert.equal(plan.suggestions[0].votes.length,0);
  assert.equal((await request('friend@example.com','plan.get',{planId:plan.id})).statusCode,404);
  assert.equal((await request('friend@example.com','plan.rsvp',{planId:plan.id,rsvp:'going'})).statusCode,404);
  assert.equal((await ok('friend@example.com','plan.list')).plans.length,0);
  assert.ok((await ok('friend@example.com')).user);
});
test('admin metrics count actual shared records, and API/database roles cannot bypass permissions', async () => {
  const metrics = await ok('owner@example.com','plan.metrics');
  assert.equal(metrics.sharedPlans,1); assert.equal(metrics.planInvitations,2); assert.ok(metrics.rsvpChanges >= 3);
  assert.equal((await request('outsider@example.com','plan.metrics',{isAdmin:true})).statusCode,403);
  for (const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select public.nng_shared_view($1)',[plan.id]), /permission denied/);
    await assert.rejects(db.query("select public.nng_shared('owner@example.com',true,'plan.metrics')"), /permission denied/);
    await assert.rejects(db.query('select * from public.nng_shared_members'), /permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.ok((await rpc('nng_shared','owner@example.com','plan.get',{planId:plan.id},true)).plan);
  await db.exec('reset role');
});
test('shared input validation drops ownership fields and rejects invalid dates, URLs and RSVP values', () => {
  assert.throws(() => sharedData('plan.create',{sourceKey:'x',details:{...details,dateStart:'2026-02-30'}}));
  assert.throws(() => sharedData('plan.rsvp',{planId:plan.id,rsvp:'admin'}));
  assert.throws(() => sharedData('plan.suggest',{planId:plan.id,suggestionId:randomUUID(),slot:'food',place:{title:'x',provider:'manual',sourceUrl:'javascript:alert(1)'}}));
  assert.deepEqual(Object.keys(sharedData('plan.rsvp',{planId:plan.id,rsvp:'going',email:'fake@example.com',userId:'fake'})).sort(),['planId','rsvp']);
});

test('revoked alpha access cannot be restored by a member forging an admin-target flag', async () => {
  await db.exec("delete from public.app_grants where user_email = 'outsider@example.com'");
  assert.equal((await request('outsider@example.com','plan.get',{planId:plan.id})).statusCode,403);
  assert.equal((await request('owner@example.com','invite',{email:'outsider@example.com',targetAdmin:true})).statusCode,409);
});

test('a participant can invite the configured operator even when the DL operator uses its admin bypass', async () => {
  const own = (await ok('friend@example.com','plan.create',{sourceKey:'friend-plan',details})).plan;
  await db.exec("delete from public.app_grants where user_email = 'owner@example.com'");
  const invited = (await ok('friend@example.com','plan.invite',{planId:own.id,email:'owner@example.com'})).plan;
  assert.equal(invited.participants.length,2);
  assert.equal((await ok('owner@example.com','plan.get',{planId:own.id})).plan.id,own.id);
});
