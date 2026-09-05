-- Apply only after approval, to the existing DL Supabase project.
-- Depends on DL public.users, public.apps and public.app_grants.
-- NNG tables are portable; nng_alpha is the temporary DL federation adapter.
begin;

create table public.nng_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  sign_ins bigint not null default 0,
  save_operations bigint not null default 0,
  api_requests bigint not null default 0,
  request_window timestamptz not null default now(),
  requests_in_window integer not null default 0
);
create table public.nng_account_state (
  account_id uuid not null references public.nng_accounts(id),
  key text not null check (key in (
    'thingsNearbyGooglePlacesMemoryV1', 'nomNomGoSavedPlansV1', 'nomNomGoBetaPlansV1',
    'nomNomGoActiveBetaPlanV1', 'nomNomGoPlanningSessionsV1',
    'nomNomGoActivePlanningSessionV1', 'nomNomGoUsageMeterV1'
  )),
  value text,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (account_id, key),
  check (value is null or octet_length(value) <= 1500000)
);
create table public.nng_invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.nng_accounts(id),
  invitee_email text not null unique,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index nng_invitations_inviter_created on public.nng_invitations(inviter_id, created_at);
create index nng_accounts_last_seen on public.nng_accounts(last_seen_at);

alter table public.nng_accounts enable row level security;
alter table public.nng_account_state enable row level security;
alter table public.nng_invitations enable row level security;
revoke all on public.nng_accounts, public.nng_account_state, public.nng_invitations from public, anon, authenticated;
grant all on public.nng_accounts, public.nng_account_state, public.nng_invitations to service_role;

-- Only the authenticated NNG server may call this function. p_email and p_admin
-- must come from verified session claims/server config, never request JSON.
create function public.nng_alpha(p_email text, p_admin boolean, p_action text, p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  actor public.nng_accounts;
  target text;
  stored public.nng_account_state;
  result jsonb;
  total_count bigint;
begin
  p_email := lower(trim(p_email));
  if not exists (select 1 from public.apps where slug = 'nomnomgo' and status = 'active')
    or (not p_admin and not exists (
      select 1 from public.app_grants where user_email = p_email and app_slug = 'nomnomgo'
    )) then
    return jsonb_build_object('error', 'NomNomGo access is no longer available. Contact the alpha organizer.', 'status', 403);
  end if;

  -- Serialize admissions and invitations so concurrent requests cannot overrun
  -- the global alpha limit. Other account operations only lock their own row.
  if p_action in ('load', 'invite') then
    perform pg_advisory_xact_lock(773091, 1);
  end if;
  -- Serialize counters/saves without blocking foreign-key references when
  -- another member invites this account to a plan concurrently.
  select * into actor from public.nng_accounts where email = p_email for no key update;
  if actor.id is null then
    if p_action <> 'load' then
      return jsonb_build_object('error', 'Open NomNomGo before continuing.', 'status', 401);
    end if;
    select count(*) into total_count from (
      select email from public.nng_accounts
      union select invitee_email from public.nng_invitations
    ) admitted;
    if total_count >= 500 and not exists (select 1 from public.nng_invitations where invitee_email = p_email) then
      return jsonb_build_object('error', 'Alpha is full. Contact the organizer.', 'status', 429);
    end if;
    insert into public.nng_accounts(email) values (p_email) returning * into actor;
  end if;
  if not actor.enabled then
    return jsonb_build_object('error', 'Your alpha account is paused. Contact the organizer.', 'status', 403);
  end if;
  if actor.request_window > now() - interval '1 minute' and actor.requests_in_window >= 120 then
    return jsonb_build_object('error', 'Too many account requests. Wait a minute, then reload.', 'status', 429);
  end if;
  update public.nng_accounts set last_seen_at = now(), api_requests = api_requests + 1,
    request_window = case when request_window <= now() - interval '1 minute' then now() else request_window end,
    requests_in_window = case when request_window <= now() - interval '1 minute' then 1 else requests_in_window + 1 end
    where id = actor.id;

  if p_action = 'touch' then
    return jsonb_build_object('id', actor.id, 'email', actor.email);
  elsif p_action = 'load' then
    update public.nng_accounts set sign_ins = sign_ins + 1 where id = actor.id;
    update public.nng_invitations set accepted_at = coalesce(accepted_at, now()) where invitee_email = p_email;
    select coalesce(jsonb_object_agg(key, jsonb_build_object('value', value, 'version', version)), '{}'::jsonb)
      into result from public.nng_account_state where account_id = actor.id;
    return jsonb_build_object('user', jsonb_build_object('id', actor.id, 'email', actor.email, 'isAdmin', p_admin), 'state', result);
  elsif p_action = 'save' then
    select * into stored from public.nng_account_state where account_id = actor.id and key = p_data->>'key';
    if coalesce(stored.version, 0) <> (p_data->>'version')::bigint then
      return jsonb_build_object('error', 'This data changed on another device. Reload before editing again.', 'status', 409);
    end if;
    insert into public.nng_account_state(account_id, key, value, version)
      values (actor.id, p_data->>'key', p_data->>'value', 1)
      on conflict (account_id, key) do update
        set value = excluded.value, version = public.nng_account_state.version + 1, updated_at = now()
      returning * into stored;
    update public.nng_accounts set save_operations = save_operations + 1 where id = actor.id;
    return jsonb_build_object('version', stored.version);
  elsif p_action = 'invite' then
    target := lower(trim(p_data->>'email'));
    if target = p_email then
      return jsonb_build_object('error', 'You already have access.', 'status', 400);
    end if;
    if exists (select 1 from public.nng_accounts where email = target)
      and not exists (select 1 from public.app_grants where user_email = target and app_slug = 'nomnomgo')
      and not coalesce((p_data->>'targetAdmin')::boolean, false) then
      return jsonb_build_object('error', 'This invitation needs the alpha organizer''s help.', 'status', 409);
    end if;
    -- Do not restore revoked grants or reveal whether an email has an account.
    if exists (select 1 from public.nng_invitations where invitee_email = target) then
      if exists (select 1 from public.nng_invitations where invitee_email = target and inviter_id = actor.id)
        and exists (select 1 from public.app_grants where user_email = target and app_slug = 'nomnomgo') then
        return jsonb_build_object('ok', true);
      end if;
      return jsonb_build_object('error', 'This invitation needs the alpha organizer''s help.', 'status', 409);
    end if;
    if (select count(*) from public.nng_invitations where inviter_id = actor.id and created_at > now() - interval '24 hours') >= 10 then
      return jsonb_build_object('error', 'You can invite 10 people per day. Try again tomorrow.', 'status', 429);
    end if;
    select count(*) into total_count from (
      select email from public.nng_accounts
      union select invitee_email from public.nng_invitations
    ) admitted;
    if total_count >= 500 and not exists (select 1 from public.nng_accounts where email = target) then
      return jsonb_build_object('error', 'Alpha is full. Contact the organizer.', 'status', 429);
    end if;
    insert into public.users(email) values (target) on conflict (email) do nothing;
    insert into public.app_grants(user_email, app_slug, role, granted_by)
      values (target, 'nomnomgo', 'member', p_email) on conflict (user_email, app_slug) do nothing;
    insert into public.nng_invitations(inviter_id, invitee_email) values (actor.id, target);
    return jsonb_build_object('ok', true);
  elsif p_action = 'metrics' and p_admin then
    return jsonb_build_object(
      'accounts', (select count(*) from public.nng_accounts),
      'active7Days', (select count(*) from public.nng_accounts where last_seen_at > now() - interval '7 days'),
      'invitations', (select count(*) from public.nng_invitations),
      'acceptedInvitations', (select count(*) from public.nng_invitations where accepted_at is not null),
      'accountLoads', (select coalesce(sum(sign_ins), 0) from public.nng_accounts),
      'saveOperations', (select coalesce(sum(save_operations), 0) from public.nng_accounts),
      'accountApiRequests', (select coalesce(sum(api_requests), 0) from public.nng_accounts),
      'savedPlans', (select coalesce(sum(case when jsonb_typeof(value::jsonb) = 'array' then jsonb_array_length(value::jsonb) else 0 end), 0)
        from public.nng_account_state where key = 'nomNomGoSavedPlansV1'),
      'planningRecords', (select coalesce(sum(case when jsonb_typeof(value::jsonb) = 'array' then jsonb_array_length(value::jsonb) else 0 end), 0)
        from public.nng_account_state where key = 'nomNomGoBetaPlansV1'),
      'favorites', (select coalesce(sum(case when jsonb_typeof(value::jsonb->'favorites') = 'array' then jsonb_array_length(value::jsonb->'favorites') else 0 end), 0)
        from public.nng_account_state where key = 'thingsNearbyGooglePlacesMemoryV1'),
      'reportedPlacesCallsMonth', (select coalesce(sum(
        case when value::jsonb->>'month' = to_char(now(), 'YYYY-MM') then
          case when jsonb_typeof(value::jsonb->'nearbySearchesMonth') = 'number' then (value::jsonb->>'nearbySearchesMonth')::numeric else 0 end
          + case when jsonb_typeof(value::jsonb->'textSearchesMonth') = 'number' then (value::jsonb->>'textSearchesMonth')::numeric else 0 end
        else 0 end), 0) from public.nng_account_state where key = 'nomNomGoUsageMeterV1')
    );
  end if;
  return jsonb_build_object('error', 'Action not permitted.', 'status', 403);
end;
$$;
revoke all on function public.nng_alpha(text, boolean, text, jsonb) from public, anon, authenticated;
grant execute on function public.nng_alpha(text, boolean, text, jsonb) to service_role;
commit;
