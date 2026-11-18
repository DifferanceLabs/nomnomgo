begin;
create table public.nng_starter_reviews (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.nng_accounts(id),
 day date not null default (now() at time zone 'UTC')::date, fingerprint text not null,
 places jsonb not null, created_at timestamptz not null default now(), state text not null default 'ready',
 result jsonb not null default '[]', latency_ms int, input_tokens int, output_tokens int,
 unique(actor_id,day,fingerprint)
);
alter table public.nng_starter_reviews enable row level security;
revoke all on public.nng_starter_reviews from public,anon,authenticated;
grant select,insert,update,delete on public.nng_starter_reviews to service_role;

create function public.nng_review_enqueue(p_email text,p_places jsonb,p_user_cap int,p_global_cap int,p_only uuid,p_admin boolean default false)
returns jsonb language plpgsql set search_path=public as $$
declare auth jsonb; actor uuid; row nng_starter_reviews; today date:=(now() at time zone 'UTC')::date;
begin
 auth:=nng_alpha(p_email,p_admin,'touch','{}');
 if auth ? 'error' then return auth; end if;
 actor:=(auth->>'id')::uuid;
 if p_only is not null and actor<>p_only then return '{}'; end if;
 if jsonb_typeof(p_places) is distinct from 'array' or jsonb_array_length(p_places) not between 1 and 6 then return '{}'; end if;
 perform pg_advisory_xact_lock(773091,4);
 delete from nng_starter_reviews where day<today-1;
 update nng_starter_reviews set state='expired' where state in ('running','ready') and created_at < now()-interval '10 minutes';
 select * into row from nng_starter_reviews where actor_id=actor and day=today and fingerprint=md5(p_places::text);
 if not found then
   if (select count(*) from nng_starter_reviews where day=today and actor_id=actor)>=p_user_cap or
      (select count(*) from nng_starter_reviews where day=today)>=p_global_cap then return '{}'; end if;
   insert into nng_starter_reviews(actor_id,fingerprint,places) values(actor,md5(p_places::text),p_places) returning * into row;
 end if;
 return jsonb_build_object('id',row.id,'state',row.state,'result',row.result);
end $$;

create function public.nng_review_claim(p_id uuid,p_since timestamptz,p_only uuid,p_user_cap int,p_global_cap int,p_admin_emails text[] default '{}')
returns jsonb language plpgsql set search_path=public as $$
declare job nng_starter_reviews; today date:=(now() at time zone 'UTC')::date;
begin
 perform pg_advisory_xact_lock(773091,4);
 if coalesce((select calls from nng_learning_usage where day=today and scope='global'),0)>=p_global_cap then return null; end if;
 select j.* into job from nng_starter_reviews j join nng_accounts a on a.id=j.actor_id
 where j.day=today and j.state='ready' and (p_id is null or j.id=p_id)
 and j.created_at>=greatest(p_since,now()-interval '10 minutes') and (p_only is null or j.actor_id=p_only)
 and a.enabled and exists(select 1 from apps where slug='nomnomgo' and status='active')
 and (a.email=any(p_admin_emails) or exists(select 1 from app_grants where user_email=a.email and app_slug='nomnomgo'))
 and coalesce((select calls from nng_learning_usage where day=today and scope=j.actor_id::text),0)<p_user_cap
 order by j.created_at for update of j skip locked limit 1;
 if not found then return null; end if;
 insert into nng_learning_usage(day,scope,calls) values(today,'global',1),(today,job.actor_id::text,1)
 on conflict(day,scope) do update set calls=nng_learning_usage.calls+1;
 update nng_starter_reviews set state='running' where id=job.id;
 return jsonb_build_object('id',job.id,'places',job.places);
end $$;

create function public.nng_review_finish(p_id uuid,p_state text,p_result jsonb,p_ms int,p_input int,p_output int)
returns boolean language plpgsql set search_path=public as $$
begin
 update nng_starter_reviews set state=p_state,result=p_result,latency_ms=p_ms,input_tokens=p_input,output_tokens=p_output
 where id=p_id and state='running';
 return found;
end $$;
revoke all on function public.nng_review_enqueue(text,jsonb,int,int,uuid,boolean),public.nng_review_claim(uuid,timestamptz,uuid,int,int,text[]),public.nng_review_finish(uuid,text,jsonb,int,int,int) from public,anon,authenticated;
grant execute on function public.nng_review_enqueue(text,jsonb,int,int,uuid,boolean),public.nng_review_claim(uuid,timestamptz,uuid,int,int,text[]),public.nng_review_finish(uuid,text,jsonb,int,int,int) to service_role;
commit;
