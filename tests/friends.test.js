const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const auth = require('../api/_alphaAuth');
const handler = require('../api/account');
let db, owner, newcomer, other, sharedPlan;
const secret = 'fictional-friend-test-secret';
const savedEnv = { ...process.env };
const savedFetch = global.fetch;
const details = {title:'Friends test',intent:'both',locationLabel:'Park',dateStart:'2026-09-12',dateEnd:'2026-09-12',timeWindow:'Noon',stops:[]};
async function rpc(fn, email, action, data = {}, admin = false) {
  return (await db.query(`select public.${fn}($1,$2,$3,$4) as result`, [email,admin,action,JSON.stringify(data)])).rows[0].result;
}
async function request(email, action, data = {}) {
  const res = {code:200,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await handler({method:action?'POST':'GET',headers:{host:'nng.example.com',origin:'https://nng.example.com','content-type':'application/json',cookie:`${auth.COOKIE_NAME}=${auth.createSessionToken(secret,{email})}`},body:action?{action,...data}:undefined},res);
  return res;
}
async function ok(email, action, data) {
  const result = await request(email,action,data);
  assert.equal(result.code,200,JSON.stringify(result.body));
  return result.body;
}
const friends = async (email) => (await ok(email,'friend.list')).friends;
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public.users(email text primary key);
    create table public.apps(slug text primary key,status text);
    create table public.app_grants(user_email text references public.users(email),app_slug text references public.apps(slug),role text,granted_by text,unique(user_email,app_slug));
    insert into public.apps values ('nomnomgo','active');
    insert into public.users values ('owner@example.com'),('other@example.com');
    insert into public.app_grants values ('owner@example.com','nomnomgo','member',null),('other@example.com','nomnomgo','member',null);
    grant select,insert on public.users,public.app_grants to service_role; grant select on public.apps to service_role;`);
  for (const file of ['001_real_user_alpha.sql','002_shared_alpha_plans.sql']) await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
  process.env.DL_APP_LAUNCH_SECRET=secret;
  process.env.SUPABASE_URL='https://fictional.example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY='fictional-key';
  process.env.NNG_ADMIN_EMAILS='owner@example.com';
  global.fetch=async (url,options) => {
    const fn = new URL(url).pathname.split('/').pop();
    assert.ok(['nng_alpha','nng_shared','nng_friends'].includes(fn));
    const args = JSON.parse(options.body);
    const result = await rpc(fn,args.p_email,args.p_action,args.p_data,args.p_admin);
    return {ok:true,json:async()=>result};
  };
  owner=(await ok('owner@example.com')).user;
  other=(await ok('other@example.com')).user;
  await ok('owner@example.com','invite',{email:'prior@example.com'});
  await ok('prior@example.com');
  await db.exec(readFileSync('supabase/migrations/003_invitation_friendships.sql','utf8'));
});
after(async () => {
  global.fetch=savedFetch;
  for (const key of ['DL_APP_LAUNCH_SECRET','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','NNG_ADMIN_EMAILS']) {
    if (savedEnv[key]===undefined) delete process.env[key]; else process.env[key]=savedEnv[key];
  }
  await db.close();
});
test('migration backfills accepted invitations as private mutual friendships', async () => {
  assert.deepEqual((await friends('owner@example.com')).map(f=>f.email),['prior@example.com']);
  const reverse=await friends('prior@example.com');
  assert.equal(reverse[0].id,owner.id);
  assert.deepEqual(Object.keys(reverse[0]).sort(),['connectedAt','email','id']);
  assert.deepEqual(await friends('other@example.com'),[]);
});
test('pending invitation stays pending until matching verified account first loads, independent of delivery channel', async () => {
  await ok('owner@example.com','invite',{email:'New@Example.com',channel:'sms'});
  assert.equal((await friends('owner@example.com')).length,1);
  assert.equal((await request('wrong@example.com')).code,403);
  assert.equal((await friends('owner@example.com')).length,1);
  newcomer=(await ok('new@example.com')).user;
  assert.equal((await friends('new@example.com'))[0].id,owner.id);
  await ok('new@example.com'); await ok('new@example.com');
  assert.equal((await friends('owner@example.com')).length,2);
});
test('plan invitations connect direct inviters on first login but not other plan members', async () => {
  sharedPlan=(await ok('owner@example.com','plan.create',{sourceKey:'friend-plan',details})).plan;
  await ok('owner@example.com','plan.invite',{planId:sharedPlan.id,email:'other@example.com'});
  await ok('owner@example.com','plan.invite',{planId:sharedPlan.id,email:'new@example.com'});
  await ok('owner@example.com','plan.invite',{planId:sharedPlan.id,email:'plan-new@example.com'});
  const second=(await ok('other@example.com','plan.create',{sourceKey:'second-plan',details})).plan;
  await ok('other@example.com','plan.invite',{planId:second.id,email:'plan-new@example.com'});
  await ok('plan-new@example.com');
  assert.deepEqual((await friends('plan-new@example.com')).map(f=>f.email),['other@example.com','owner@example.com']);
  assert.equal((await friends('new@example.com')).length,1);
  assert.ok(!(await friends('other@example.com')).some(f=>f.id===owner.id));
});
test('friend invitations reuse membership flow without sharing personal saves or unrelated plans', async () => {
  await ok('owner@example.com','save',{key:'nomNomGoSavedPlansV1',version:0,value:'[{"private":"owner only"}]'});
  assert.deepEqual((await ok('new@example.com')).state,{});
  const privatePlan=(await ok('owner@example.com','plan.create',{sourceKey:'uninvited-plan',details})).plan;
  assert.equal((await request('new@example.com','plan.get',{planId:privatePlan.id})).code,404);
  const selected=(await friends('owner@example.com')).find(f=>f.id===newcomer.id);
  await ok('owner@example.com','plan.invite',{planId:privatePlan.id,email:selected.email});
  assert.equal((await ok('new@example.com','plan.get',{planId:privatePlan.id})).plan.id,privatePlan.id);
});
test('friend endpoints ignore forged actor/admin values and validate removal targets', async () => {
  assert.equal((await request('new@example.com','friend.metrics',{isAdmin:true})).code,403);
  assert.equal((await request('new@example.com','friend.remove',{friendId:'bad'})).code,400);
  await ok('other@example.com','friend.remove',{friendId:newcomer.id,email:'owner@example.com',userId:owner.id});
  assert.ok((await friends('owner@example.com')).some(f=>f.id===newcomer.id));
  assert.equal((await ok('owner@example.com','friend.metrics')).friendships,4);
});
test('either person can remove mutually, repeated login cannot restore, existing RSVP membership remains', async () => {
  await ok('new@example.com','friend.remove',{friendId:owner.id});
  await ok('new@example.com','friend.remove',{friendId:owner.id});
  await ok('new@example.com');
  assert.deepEqual(await friends('new@example.com'),[]);
  assert.ok(!(await friends('owner@example.com')).some(f=>f.id===newcomer.id));
  assert.equal((await ok('new@example.com','plan.get',{planId:sharedPlan.id})).plan.id,sharedPlan.id);
});
test('friendship data is server-only and access revocation/rate limits apply', async () => {
  for (const role of ['anon','authenticated']) {
    const result=(await db.query(`select has_table_privilege($1,'public.nng_friendships','SELECT') as readable, has_function_privilege($1,'public.nng_friends(text,boolean,text,jsonb)','EXECUTE') as executable`,[role])).rows[0];
    assert.equal(result.readable,false); assert.equal(result.executable,false);
  }
  await db.exec('set role service_role');
  assert.equal((await rpc('nng_friends','owner@example.com','friend.list',{},true)).friends.length,2);
  assert.equal((await rpc('nng_alpha','owner@example.com','invite',{email:'service-invite@example.com'},true)).ok,true);
  assert.ok((await rpc('nng_alpha','service-invite@example.com','load')).user.id);
  assert.equal((await rpc('nng_friends','service-invite@example.com','friend.list')).friends[0].id,owner.id);
  await db.exec('reset role');
  await db.query(`update public.nng_accounts set requests_in_window=120,request_window=now() where id=$1`,[other.id]);
  assert.equal((await request('other@example.com','friend.list')).code,429);
  await db.exec(`delete from public.app_grants where user_email='new@example.com'`);
  assert.equal((await request('new@example.com','friend.list')).code,403);
});
