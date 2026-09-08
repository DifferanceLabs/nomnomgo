const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
function load(path) {
  const compiled = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const context = { exports: {}, require: () => ({}), setTimeout, clearTimeout };
  vm.runInNewContext(compiled, context);
  return context.exports;
}
const updates = load('src/data/sharedPlans.ts');

test('plan form rejects missing fields, impossible dates and reversed ranges before saving', () => {
  const draft = { title: 'Dinner', locationLabel: 'Franklin', dateStart: '2028-02-29', dateEnd: '2028-02-29' };
  assert.equal(updates.sharedPlanDraftError(draft), '');
  assert.match(updates.sharedPlanDraftError({...draft, title:'  '}), /plan name/);
  assert.match(updates.sharedPlanDraftError({...draft, locationLabel:'  '}), /meeting place/);
  for (const dateStart of ['2027-02-29', '2028-02-30', '2028-13-01', '02/29/2028', '']) {
    assert.match(updates.sharedPlanDraftError({...draft, dateStart}), /valid dates/);
  }
  assert.match(updates.sharedPlanDraftError({...draft, dateEnd:'2028-02-28'}), /end on or after/);
});

test('RSVP summaries distinguish unanswered invitations from explicit declines', () => {
  assert.equal(updates.sharedRsvpSummary([{rsvp:'going'}, {rsvp:'maybe'}, {rsvp:'cant_make_it'}, {rsvp:null}]), '1 Going · 1 Maybe · 1 Not going · 1 Awaiting reply');
  assert.equal(updates.sharedRsvpLabel('cant_make_it'), 'Not going');
  assert.equal(updates.sharedRsvpLabel(), 'Awaiting reply');
});
test('organizer summaries include invitee responses and announce a change even when total going is unchanged', () => {
  const owner = {userId:'owner',displayName:'owner@example.com',rsvp:'going'};
  const before = {id:'plan',participants:[owner,{userId:'friend',displayName:'friend@example.com',rsvp:null}]};
  const after = {id:'plan',participants:[owner,{userId:'friend',displayName:'friend@example.com',rsvp:'going'}]};
  assert.match(updates.sharedRsvpSummary(after.participants), /^2 Going/);
  assert.equal(updates.changedSharedRsvps(before, after, 'owner')[0], 'friend@example.com: Going');
  assert.equal(updates.changedSharedRsvps(after, after, 'owner').length, 0);
  assert.equal(updates.changedSharedRsvps(null, after, 'owner').length, 0);
  assert.equal(updates.changedSharedRsvps(before, after, 'friend').length, 0);
  const swapped = {id:'plan', participants:[{...owner,rsvp:'maybe'}, {...after.participants[1],rsvp:'going'}]};
  assert.equal(updates.changedSharedRsvps(before, swapped, 'owner')[0], 'friend@example.com: Going');
});
function fixture() {
  const { startForegroundRefresh } = load('src/data/foregroundRefresh.ts');
  const page = new EventTarget(); page.hidden = false;
  const window = new EventTarget();
  const tasks = new Map(); let next = 0, ready = true, calls = 0, finish;
  let hold = false;
  const poller = startForegroundRefresh(async () => { calls++; if(hold) await new Promise(resolve=>{finish=resolve;}); }, {
    page, window, ready:()=>ready,
    schedule:fn=>{const id=++next;tasks.set(id,fn);return id;}, cancel:id=>tasks.delete(id),
  });
  return {page,window,poller,get calls(){return calls;},get pending(){return tasks.size;},setReady:v=>{ready=v;},hold:()=>{hold=true;},finish:()=>{hold=false;finish();},
    async tick(){const entries=[...tasks.entries()];tasks.clear();for(const [,fn] of entries) fn();await settle();}};
}
const settle = async () => { for(let i=0;i<5;i++) await Promise.resolve(); };
test('polling survives ticks skipped during writes and while a phone is hidden', async () => {
  const f=fixture(); await settle(); assert.equal(f.calls,1);
  f.setReady(false); await f.tick(); assert.equal(f.calls,1); assert.equal(f.pending,1);
  f.setReady(true); await f.tick(); assert.equal(f.calls,2);
  f.page.hidden=true; await f.tick(); assert.equal(f.calls,2); assert.equal(f.pending,1);
  f.page.hidden=false; f.page.dispatchEvent(new Event('visibilitychange')); await settle(); assert.equal(f.calls,3);
  f.poller.stop(); assert.equal(f.pending,0);
});
test('page restoration and reconnect refresh promptly without concurrent requests or leaking after unmount', async () => {
  const f=fixture(); await settle();
  f.hold(); f.window.dispatchEvent(new Event('pageshow')); await settle(); assert.equal(f.calls,2);
  f.window.dispatchEvent(new Event('focus')); f.window.dispatchEvent(new Event('online')); await settle(); assert.equal(f.calls,2);
  f.finish(); await settle(); assert.equal(f.pending,1);
  f.window.dispatchEvent(new Event('online')); await settle(); assert.equal(f.calls,3);
  f.poller.stop(); f.window.dispatchEvent(new Event('pageshow')); f.poller.refresh(); await settle();
  assert.equal(f.calls,3); assert.equal(f.pending,0);
});
test('participant enrichment scopes the query to verified membership and drops concurrently removed plans', async () => {
  const {accountRpc}=require('../api/_accountStore');
  const originalFetch=global.fetch, originalEnv={...process.env};
  process.env.SUPABASE_URL='https://db.example.invalid'; process.env.SUPABASE_SERVICE_ROLE_KEY='local-test';
  let reads=0;
  global.fetch=async(url)=>{
    if(url.endsWith('/rpc/nng_shared')) return {ok:true,json:async()=>({plans:[{id:'kept',ownerId:'owner'},{id:'removed',ownerId:'owner'}]})};
    const query=new URL(url).searchParams;
    assert.equal(query.get('email'),'eq.owner@example.com'); assert.equal(query.get('plan_id'),'in.(kept,removed)');
    reads++;
    return {ok:true,json:async()=>[{plan_id:'kept',plan:{revision:4,participants:[{account_id:'friend',email:'friend@example.com',rsvp:'going',joined_at:'today'}]}}]};
  };
  try {
    const result=await accountRpc({p_email:'owner@example.com',p_admin:false,p_action:'plan.list',p_data:{}});
    assert.equal(reads,1); assert.equal(result.plans.length,1); assert.equal(result.plans[0].participants[0].rsvp,'going');
    global.fetch=async()=>({ok:true,json:async()=>({error:'Denied',status:403})});
    assert.equal((await accountRpc({p_email:'owner@example.com',p_admin:false,p_action:'plan.list',p_data:{}})).status,403);
  } finally {
    global.fetch=originalFetch;
    for(const key of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']) {
      if(originalEnv[key]===undefined) delete process.env[key]; else process.env[key]=originalEnv[key];
    }
  }
});
