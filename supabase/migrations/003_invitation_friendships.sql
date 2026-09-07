-- Additive alpha migration. Apply after approval, following 001 and 002.
-- Friendship uses NNG account IDs; it grants no access to saves or plans.
begin;

create table public.nng_friendships (
  account_low uuid not null references public.nng_accounts(id),
  account_high uuid not null references public.nng_accounts(id),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (account_low, account_high),
  check (account_low < account_high)
);
create index nng_friendships_high on public.nng_friendships(account_high);
alter table public.nng_friendships enable row level security;
revoke all on public.nng_friendships from public, anon, authenticated;
grant select, insert, update on public.nng_friendships to service_role;

-- Only direct invitations issued before the new account's first login qualify.
-- Include multiple plan inviters, but never other members of those plans.
create function public.nng_connect_invited_account(p_email text)
returns void language sql security invoker set search_path = '' as $$
  insert into public.nng_friendships(account_low, account_high, created_at)
  select least(a.id, direct.inviter_id), greatest(a.id, direct.inviter_id), i.accepted_at
  from public.nng_accounts a
  join public.nng_invitations i on i.invitee_email=a.email and i.accepted_at is not null
  cross join lateral (
    select i.inviter_id, i.created_at
    union
    select m.invited_by, m.created_at from public.nng_shared_members m where m.email=a.email
  ) direct
  where a.email=p_email and direct.inviter_id<>a.id and direct.created_at<=a.created_at
  on conflict (account_low, account_high) do nothing;
$$;

create function public.nng_accept_invitation_friendships()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform public.nng_connect_invited_account(new.invitee_email);
  return new;
end;
$$;
create trigger nng_invitation_friendships_accepted
after update of accepted_at on public.nng_invitations
for each row when (old.accepted_at is null and new.accepted_at is not null)
execute function public.nng_accept_invitation_friendships();

-- Backfill the already tested alpha invitations without changing plans/RSVPs.
select public.nng_connect_invited_account(invitee_email)
from public.nng_invitations where accepted_at is not null;

create function public.nng_friends(p_email text, p_admin boolean, p_action text, p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  admission jsonb;
  actor uuid;
  target uuid;
  result jsonb;
begin
  admission := public.nng_alpha(p_email, p_admin, 'touch', '{}'::jsonb);
  if admission ? 'error' then return admission; end if;
  actor := (admission->>'id')::uuid;
  if p_action='friend.list' then
    select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'email',a.email,'connectedAt',f.created_at) order by a.email), '[]'::jsonb)
    into result from public.nng_friendships f
    join public.nng_accounts a on a.id=case when f.account_low=actor then f.account_high else f.account_low end
    where (f.account_low=actor or f.account_high=actor) and f.removed_at is null and a.enabled;
    return jsonb_build_object('friends', result);
  elsif p_action='friend.remove' then
    target := (p_data->>'friendId')::uuid;
    update public.nng_friendships set removed_at=coalesce(removed_at,now())
    where account_low=least(actor,target) and account_high=greatest(actor,target);
    return jsonb_build_object('ok',true);
  elsif p_action='friend.metrics' and p_admin then
    return jsonb_build_object('friendships',(select count(*) from public.nng_friendships where removed_at is null));
  end if;
  return jsonb_build_object('error','Unknown friend action.','status',400);
end;
$$;
revoke all on function public.nng_connect_invited_account(text), public.nng_accept_invitation_friendships(), public.nng_friends(text,boolean,text,jsonb) from public, anon, authenticated;
grant execute on function public.nng_connect_invited_account(text), public.nng_accept_invitation_friendships(), public.nng_friends(text,boolean,text,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
