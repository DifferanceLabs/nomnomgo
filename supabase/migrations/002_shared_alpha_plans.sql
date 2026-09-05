-- Pending production approval. Apply after 001_real_user_alpha.sql.
begin;
create table public.nng_shared_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.nng_accounts(id),
  source_key text not null,
  details jsonb not null,
  status text not null default 'planning' check (status in ('planning', 'locked')),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, source_key)
);
create table public.nng_shared_members (
  plan_id uuid not null references public.nng_shared_plans(id),
  email text not null,
  account_id uuid references public.nng_accounts(id),
  invited_by uuid not null references public.nng_accounts(id),
  rsvp text check (rsvp in ('going', 'maybe', 'cant_make_it')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(plan_id, email)
);
create index nng_shared_members_email on public.nng_shared_members(email, plan_id);
create index nng_shared_members_inviter on public.nng_shared_members(invited_by, created_at);
create table public.nng_shared_suggestions (
  id uuid primary key,
  plan_id uuid not null references public.nng_shared_plans(id),
  author_id uuid not null references public.nng_accounts(id),
  slot text not null check (slot in ('food', 'activity')),
  place jsonb not null,
  created_at timestamptz not null default now(),
  unique(plan_id, id)
);
create table public.nng_shared_votes (
  plan_id uuid not null,
  suggestion_id uuid not null,
  email text not null,
  created_at timestamptz not null default now(),
  primary key(suggestion_id, email),
  foreign key(plan_id, suggestion_id) references public.nng_shared_suggestions(plan_id, id),
  foreign key(plan_id, email) references public.nng_shared_members(plan_id, email) on delete cascade
);
create table public.nng_shared_events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.nng_shared_plans(id),
  actor_id uuid not null references public.nng_accounts(id),
  kind text not null,
  created_at timestamptz not null default now()
);
create index nng_shared_events_plan on public.nng_shared_events(plan_id, created_at);
alter table public.nng_shared_plans enable row level security;
alter table public.nng_shared_members enable row level security;
alter table public.nng_shared_suggestions enable row level security;
alter table public.nng_shared_votes enable row level security;
alter table public.nng_shared_events enable row level security;
revoke all on public.nng_shared_plans, public.nng_shared_members, public.nng_shared_suggestions, public.nng_shared_votes, public.nng_shared_events from public, anon, authenticated;
grant all on public.nng_shared_plans, public.nng_shared_members, public.nng_shared_suggestions, public.nng_shared_votes, public.nng_shared_events to service_role;

create function public.nng_shared_view(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select p.details || jsonb_build_object(
    'id', p.id, 'ownerId', p.owner_id, 'status', p.status, 'revision', p.revision,
    'createdAt', p.created_at, 'updatedAt', p.updated_at,
    'stops', coalesce((select jsonb_agg(value || jsonb_build_object('planId', p.id) order by ordinality)
      from jsonb_array_elements(p.details->'stops') with ordinality s(value, ordinality)), '[]'::jsonb),
    'participants', coalesce((select jsonb_agg(jsonb_build_object(
      'userId', coalesce(m.account_id::text, 'pending:' || m.email), 'displayName', m.email,
      'role', case when m.account_id = p.owner_id then 'owner' else 'participant' end,
      'rsvp', m.rsvp, 'joined', m.joined_at is not null
    ) order by m.created_at, m.email) from public.nng_shared_members m where m.plan_id = p.id), '[]'::jsonb),
    'suggestions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'planId', s.plan_id, 'slot', s.slot, 'place', s.place,
      'createdBy', s.author_id, 'createdAt', s.created_at,
      'votes', coalesce((select jsonb_agg(jsonb_build_object('suggestionId', v.suggestion_id, 'userId', m.account_id, 'createdAt', v.created_at))
        from public.nng_shared_votes v join public.nng_shared_members m on m.plan_id = v.plan_id and m.email = v.email
        where v.suggestion_id = s.id), '[]'::jsonb)
    ) order by s.created_at, s.id) from public.nng_shared_suggestions s where s.plan_id = p.id), '[]'::jsonb)
  ) from public.nng_shared_plans p where p.id = p_id;
$$;

create function public.nng_shared(p_email text, p_admin boolean, p_action text, p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  identity jsonb;
  actor_id uuid;
  plan public.nng_shared_plans;
  suggestion public.nng_shared_suggestions;
  target text;
  response jsonb;
  stops jsonb;
  pos integer;
  other_pos integer;
  current_stop jsonb;
  other_stop jsonb;
begin
  p_email := lower(trim(p_email));
  -- Keep the same lock order as alpha admission: global admission, account, plan.
  if p_action = 'plan.invite' then perform pg_advisory_xact_lock(773091, 1); end if;
  identity := public.nng_alpha(p_email, p_admin, 'touch', '{}'::jsonb);
  if identity ? 'error' then return identity; end if;
  actor_id := (identity->>'id')::uuid;

  if p_action = 'plan.metrics' then
    if not p_admin then return jsonb_build_object('error', 'Admin access required.', 'status', 403); end if;
    return jsonb_build_object(
      'sharedPlans', (select count(*) from public.nng_shared_plans),
      'lockedPlans', (select count(*) from public.nng_shared_plans where status = 'locked'),
      'memberships', (select count(*) from public.nng_shared_members),
      'rsvps', (select count(*) from public.nng_shared_members where rsvp is not null),
      'suggestions', (select count(*) from public.nng_shared_suggestions),
      'votes', (select count(*) from public.nng_shared_votes),
      'rsvpChanges', (select count(*) from public.nng_shared_events where kind = 'plan.rsvp'),
      'planInvitations', (select count(*) from public.nng_shared_events where kind = 'plan.invite')
    );
  end if;
  if p_action = 'plan.list' then
    return jsonb_build_object('plans', coalesce((select jsonb_agg(row_data order by updated_at desc) from (
      select jsonb_build_object('id', p.id, 'title', p.details->>'title', 'status', p.status,
        'dateStart', p.details->>'dateStart', 'locationLabel', p.details->>'locationLabel',
        'ownerId', p.owner_id, 'rsvp', m.rsvp) row_data, p.updated_at
      from public.nng_shared_plans p join public.nng_shared_members m on m.plan_id = p.id
      where m.email = p_email order by p.updated_at desc limit 200
    ) summaries), '[]'::jsonb));
  end if;
  if p_action = 'plan.create' then
    select * into plan from public.nng_shared_plans where owner_id = actor_id and source_key = p_data->>'sourceKey';
    if plan.id is not null then return jsonb_build_object('plan', public.nng_shared_view(plan.id)); end if;
    if (select count(*) from public.nng_shared_plans where owner_id = actor_id) >= 100 then
      return jsonb_build_object('error', 'Alpha currently supports 100 shared plans per organizer.', 'status', 429);
    end if;
    insert into public.nng_shared_plans(owner_id, source_key, details) values(actor_id, p_data->>'sourceKey', p_data->'details') returning * into plan;
    insert into public.nng_shared_members(plan_id, email, account_id, invited_by, rsvp, joined_at)
      values(plan.id, p_email, actor_id, actor_id, 'going', now());
    insert into public.nng_shared_events(plan_id, actor_id, kind) values(plan.id, actor_id, p_action);
    return jsonb_build_object('plan', public.nng_shared_view(plan.id));
  end if;

  -- A plan ID never grants access; every read and write requires membership.
  select p.* into plan from public.nng_shared_plans p
    join public.nng_shared_members m on m.plan_id = p.id
    where p.id = (p_data->>'planId')::uuid and m.email = p_email for update of p;
  if plan.id is null then return jsonb_build_object('error', 'This plan is unavailable. Ask the organizer to invite your Google account.', 'status', 404); end if;
  if exists(select 1 from public.nng_shared_members where plan_id = plan.id and email = p_email and (joined_at is null or account_id is distinct from actor_id)) then
    update public.nng_shared_members set account_id = actor_id, joined_at = coalesce(joined_at, now()) where plan_id = plan.id and email = p_email;
    update public.nng_shared_plans set revision = revision + 1 where id = plan.id returning * into plan;
  end if;
  if p_action = 'plan.get' then return jsonb_build_object('plan', public.nng_shared_view(plan.id)); end if;

  if p_action in ('plan.update', 'plan.lock', 'plan.reopen', 'plan.pick', 'plan.removeStop', 'plan.moveStop', 'plan.removeMember') and plan.owner_id <> actor_id then
    return jsonb_build_object('error', 'Only the organizer can change this part of the plan.', 'status', 403);
  end if;
  if p_action in ('plan.update', 'plan.lock', 'plan.reopen', 'plan.pick', 'plan.removeStop', 'plan.moveStop', 'plan.removeMember')
    and plan.revision <> (p_data->>'revision')::integer then
    return jsonb_build_object('error', 'The plan changed. Review the latest version and try again.', 'status', 409);
  end if;
  if plan.status = 'locked' and p_action in ('plan.update', 'plan.suggest', 'plan.vote', 'plan.pick', 'plan.removeStop', 'plan.moveStop') then
    return jsonb_build_object('error', 'The plan is locked. The organizer can reopen it. RSVPs are still available.', 'status', 409);
  end if;

  if p_action = 'plan.rsvp' then
    if exists(select 1 from public.nng_shared_members where plan_id = plan.id and email = p_email and rsvp = p_data->>'rsvp') then
      return jsonb_build_object('plan', public.nng_shared_view(plan.id));
    end if;
    update public.nng_shared_members set rsvp = p_data->>'rsvp' where plan_id = plan.id and email = p_email;
  elsif p_action = 'plan.invite' then
    target := lower(trim(p_data->>'email'));
    if exists(select 1 from public.nng_shared_members where plan_id = plan.id and email = target) then
      return jsonb_build_object('plan', public.nng_shared_view(plan.id));
    end if;
    if (select count(*) from public.nng_shared_members where plan_id = plan.id) >= 30
      or (select count(*) from public.nng_shared_members where invited_by = actor_id and email <> p_email and created_at > now() - interval '24 hours') >= 30 then
      return jsonb_build_object('error', 'Alpha allows 30 people per plan and 30 plan invitations per day.', 'status', 429);
    end if;
    if not (exists(select 1 from public.app_grants where user_email = target and app_slug = 'nomnomgo')
      and (exists(select 1 from public.nng_accounts where email = target) or exists(select 1 from public.nng_invitations where invitee_email = target))) then
      response := public.nng_alpha(p_email, p_admin, 'invite', jsonb_build_object('email', target, 'targetAdmin', coalesce((p_data->>'targetAdmin')::boolean, false)));
      if response ? 'error' then return response; end if;
    end if;
    insert into public.nng_shared_members(plan_id, email, account_id, invited_by)
      values(plan.id, target, (select id from public.nng_accounts where email = target), actor_id);
  elsif p_action = 'plan.suggest' then
    if (select count(*) from public.nng_shared_suggestions where plan_id = plan.id) >= 100 then
      return jsonb_build_object('error', 'This plan has reached the alpha suggestion limit.', 'status', 429);
    end if;
    select * into suggestion from public.nng_shared_suggestions where id = (p_data->>'suggestionId')::uuid;
    if suggestion.id is not null then
      if suggestion.plan_id = plan.id and suggestion.author_id = actor_id then return jsonb_build_object('plan', public.nng_shared_view(plan.id)); end if;
      return jsonb_build_object('error', 'Please retry with a new suggestion.', 'status', 409);
    end if;
    insert into public.nng_shared_suggestions(id, plan_id, author_id, slot, place)
      values((p_data->>'suggestionId')::uuid, plan.id, actor_id, p_data->>'slot', p_data->'place');
  elsif p_action in ('plan.vote', 'plan.pick') then
    select * into suggestion from public.nng_shared_suggestions where id = (p_data->>'suggestionId')::uuid and plan_id = plan.id;
    if suggestion.id is null then return jsonb_build_object('error', 'Suggestion not found.', 'status', 404); end if;
    if p_action = 'plan.vote' then
      if exists(select 1 from public.nng_shared_votes where suggestion_id = suggestion.id and email = p_email) = (p_data->>'voted')::boolean then
        return jsonb_build_object('plan', public.nng_shared_view(plan.id));
      end if;
      if (p_data->>'voted')::boolean then
        insert into public.nng_shared_votes(plan_id, suggestion_id, email) values(plan.id, suggestion.id, p_email) on conflict do nothing;
      else delete from public.nng_shared_votes where suggestion_id = suggestion.id and email = p_email;
      end if;
    else
      stops := plan.details->'stops';
      if not exists(select 1 from jsonb_array_elements(stops) stop where stop->>'id' = suggestion.id::text) then
        if jsonb_array_length(stops) >= 30 then return jsonb_build_object('error', 'A shared itinerary can have up to 30 stops.', 'status', 429); end if;
        stops := stops || jsonb_build_array(jsonb_build_object('id', suggestion.id, 'planId', plan.id, 'position', jsonb_array_length(stops), 'place', suggestion.place));
        update public.nng_shared_plans set details = jsonb_set(details, '{stops}', stops) where id = plan.id;
      end if;
    end if;
  elsif p_action = 'plan.update' then
    update public.nng_shared_plans set details = details || (p_data->'details') where id = plan.id;
  elsif p_action in ('plan.removeStop', 'plan.moveStop') then
    stops := plan.details->'stops';
    select ordinality::integer - 1 into pos from jsonb_array_elements(stops) with ordinality s(value, ordinality) where value->>'id' = p_data->>'stopId';
    if pos is null then return jsonb_build_object('error', 'Stop not found.', 'status', 404); end if;
    if p_action = 'plan.removeStop' then stops := stops - pos;
    else
      other_pos := pos + (p_data->>'direction')::integer;
      if other_pos < 0 or other_pos >= jsonb_array_length(stops) then return jsonb_build_object('error', 'That stop cannot move further.', 'status', 400); end if;
      current_stop := stops->pos; other_stop := stops->other_pos;
      stops := jsonb_set(jsonb_set(stops, array[pos::text], other_stop), array[other_pos::text], current_stop);
    end if;
    select coalesce(jsonb_agg(value || jsonb_build_object('position', ordinality - 1) order by ordinality), '[]'::jsonb) into stops
      from jsonb_array_elements(stops) with ordinality s(value, ordinality);
    update public.nng_shared_plans set details = jsonb_set(details, '{stops}', stops) where id = plan.id;
  elsif p_action = 'plan.removeMember' then
    target := p_data->>'email';
    if target = p_email then return jsonb_build_object('error', 'The organizer cannot be removed.', 'status', 400); end if;
    delete from public.nng_shared_members where plan_id = plan.id and email = target;
  elsif p_action = 'plan.lock' then
    if jsonb_array_length(plan.details->'stops') = 0 then return jsonb_build_object('error', 'Add a stop before locking the plan.', 'status', 400); end if;
    update public.nng_shared_plans set status = 'locked' where id = plan.id;
  elsif p_action = 'plan.reopen' then
    update public.nng_shared_plans set status = 'planning' where id = plan.id;
  else return jsonb_build_object('error', 'Unknown plan action.', 'status', 400);
  end if;
  update public.nng_shared_plans set revision = revision + 1, updated_at = now() where id = plan.id;
  insert into public.nng_shared_events(plan_id, actor_id, kind) values(plan.id, actor_id, p_action);
  return jsonb_build_object('plan', public.nng_shared_view(plan.id));
end;
$$;
revoke all on function public.nng_shared_view(uuid) from public, anon, authenticated;
revoke all on function public.nng_shared(text, boolean, text, jsonb) from public, anon, authenticated;
grant execute on function public.nng_shared_view(uuid) to service_role;
grant execute on function public.nng_shared(text, boolean, text, jsonb) to service_role;
commit;
