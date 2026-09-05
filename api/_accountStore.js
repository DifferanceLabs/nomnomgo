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
  return response.json();
}

function isAccountAdmin(email) {
  return (process.env.NNG_ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).includes(email);
}

module.exports = { accountRpc, isAccountAdmin };
