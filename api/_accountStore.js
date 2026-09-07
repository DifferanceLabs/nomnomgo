// Temporary federation adapter. Only this server module and the alpha SQL
// adapter know about Differance Labs grants. Never send service credentials to clients.
async function accountRpc(args) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw Object.assign(new Error('Account storage is not configured.'), { status: 503 });
  const rpc = args.p_action.startsWith('plan.') ? 'nng_shared' : 'nng_alpha';
  const response = await fetch(`${base.replace(/\/$/, '')}/rest/v1/rpc/${rpc}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw Object.assign(new Error('Account storage is unavailable. Please try again.'), { status: 503 });
  const result = await response.json();
  if (args.p_action !== 'plan.list' || result.error || !result.plans?.length) return result;
  // The RPC above rechecks account admission and rate limits. This second read
  // scopes BOTH the outer membership and returned plan IDs to the verified actor.
  // Never fetch the member table globally with the service credential.
  const query = new URLSearchParams({
    select: 'plan_id,plan:nng_shared_plans!inner(revision,participants:nng_shared_members(account_id,email,rsvp,joined_at))',
    email: `eq.${args.p_email}`,
    plan_id: `in.(${result.plans.map((plan) => plan.id).join(',')})`,
  });
  const membershipResponse = await fetch(`${base.replace(/\/$/, '')}/rest/v1/nng_shared_members?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(12000),
  });
  if (!membershipResponse.ok) throw new Error('Shared responses could not be refreshed.');
  const memberships = await membershipResponse.json();
  const byId = new Map(memberships.map((row) => [row.plan_id, row.plan]));
  result.plans = result.plans.filter((plan) => byId.has(plan.id)).map((plan) => {
    const latest = byId.get(plan.id);
    const participants = latest.participants.map((member) => ({
      userId: member.account_id || `pending:${member.email}`, displayName: member.email,
      role: member.account_id === plan.ownerId ? 'owner' : 'participant',
      rsvp: member.rsvp, joined: !!member.joined_at,
    }));
    return { ...plan, revision: latest.revision, participants,
      rsvp: participants.find((member) => member.displayName === args.p_email)?.rsvp };
  });
  return result;
}

function isAccountAdmin(email) {
  return (process.env.NNG_ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).includes(email);
}

module.exports = { accountRpc, isAccountAdmin };
