-- NNG-owned plan history. Original save records and deployed RPC contracts remain compatible.
begin;
create table public.nng_companions (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.nng_accounts,
 label text not null check (length(trim(label)) between 1 and 60), unique(owner_id,label)
);
create table public.nng_outings (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.nng_accounts,
 source_key text not null, shared_id uuid unique references public.nng_shared_plans,
 snapshot jsonb not null, completed_at timestamptz, unique(owner_id,source_key)
);
create table public.nng_learning_events (
 id uuid primary key default gen_random_uuid(), outing_id uuid not null references public.nng_outings,
 actor_id uuid not null references public.nng_accounts, kind text not null, slot text not null,
 evidence jsonb not null, source text not null, confidence text not null,
 schema_version int not null default 1, profile_version int not null default 1,
 created_at timestamptz not null default clock_timestamp(), active boolean not null default true
);
create unique index nng_learning_current on public.nng_learning_events(outing_id,actor_id,slot) where active;
create index nng_learning_actor on public.nng_learning_events(actor_id,created_at desc) where active;
create table public.nng_learning_jobs (
 event_id uuid primary key references public.nng_learning_events, state text not null default 'ready',
 attempts int not null default 0, due_at timestamptz not null default now(), lease uuid, result jsonb,
 latency_ms int, input_tokens int, output_tokens int, last_status text
);
create table public.nng_learning_usage (
 day date not null, scope text not null, calls int not null, primary key(day,scope)
);

-- Construct evidence from the committed plan. Raw display data stays inside NNG.
create function public.nng_learn_snapshot(p_owner uuid,p_record jsonb,p_shared boolean)
returns jsonb language sql stable set search_path = public as $$
 with stops as (
 select s, n, case when p_shared then s->'place' else s->'item' end item
 from jsonb_array_elements(case when jsonb_typeof(p_record->'stops')='array' then p_record->'stops' else '[]' end)
 with ordinality t(s,n) where n<=40 and s->>'automatic' is distinct from 'true'
 ), places as (
 select jsonb_strip_nulls(jsonb_build_object(
 'id',left(coalesce(item->>'providerId',item->>'id','manual-'||md5(coalesce(item->>'title',item#>>'{}',''))),200),
 'title',left(coalesce(item->>'title',item#>>'{}'),200),
 'category',case when coalesce(s->>'kind',s->>'visualType',s->>'slot') in ('food','dessert','activity','idea') then coalesce(s->>'kind',s->>'visualType',s->>'slot') else 'activity' end,
 'types',case when jsonb_typeof(item->'types')='array' then (select jsonb_agg(left(t,64)) from (select t from jsonb_array_elements_text(item->'types') t limit 4) x) end,
 'budgetEstimate',left(item->>'priceLevel',20),
 'durationEstimate',case when jsonb_typeof(s->'durationMinutes')='number' then s->'durationMinutes' end,
 'arrivalEstimate',left(s->>'arrivalTime',30),'provider',item->>'provider'
 )) place,n from stops where item is not null and item <> 'null'
 ), people as (
 select distinct v from jsonb_array_elements_text(case when jsonb_typeof(p_record#>'{starter,people}')='array' then p_record#>'{starter,people}' else '[]' end) v
 where exists(select 1 from nng_companions where owner_id=p_owner and id::text=v)
 or exists(select 1 from nng_friendships where removed_at is null and
 ((account_low=p_owner and account_high::text=v) or (account_high=p_owner and account_low::text=v)))
 )
 select jsonb_build_object('stops',coalesce((select jsonb_agg(place order by n) from places),'[]'),
 'people',coalesce((select jsonb_agg(v order by v) from people),'[]'),
 'starter',left(p_record#>>'{starter,id}',64),'intent',left(coalesce(p_record#>>'{starter,intent}',p_record->>'intent'),16),
 'context',case when p_record->>'planType'='trip_plan' or p_record->>'roadTripMode'='true' then 'travel'
 when p_record->>'planType' in ('local_plan','day_plan') then 'local' else 'unknown' end,
 'date',left(coalesce(p_record->>'planDateStart',p_record->>'dateStart'),10),
 'time',left(p_record->>'timeWindow',80),'actuals',null)
$$;

create function public.nng_learn_emit(p_outing uuid,p_actor uuid,p_kind text,p_slot text,p_evidence jsonb,p_source text,p_at timestamptz default clock_timestamp())
returns void language plpgsql set search_path=public as $$
declare prev nng_learning_events; eid uuid;
begin
 select * into prev from nng_learning_events where outing_id=p_outing and actor_id=p_actor and slot=p_slot and active for update;
 if found then
   if p_slot in ('created','completed') or (prev.kind=p_kind and prev.evidence=p_evidence) then return; end if;
   update nng_learning_events set active=false where id=prev.id;
 end if;
 insert into nng_learning_events(outing_id,actor_id,kind,slot,evidence,source,confidence,created_at)
 values(p_outing,p_actor,p_kind,p_slot,p_evidence,p_source,case when p_kind='plan-completed' then 'behavior'
 when p_kind in ('plan-created','choices-updated') then 'weak' else 'explicit' end,p_at) returning id into eid;
 if p_source <> 'legacy' and p_kind <> 'choices-updated' then insert into nng_learning_jobs(event_id) values(eid); end if;
end $$;

create function public.nng_learn_save(p_owner uuid,p_key text,p_record jsonb,p_shared uuid,p_source text,p_at timestamptz)
returns void language plpgsql set search_path=public as $$
declare snap jsonb; outing nng_outings; previous jsonb; removed jsonb;
begin
 if p_key is null or length(p_key) not between 1 and 200 then return; end if;
 snap:=nng_learn_snapshot(p_owner,p_record,p_shared is not null);
 if p_shared is null and jsonb_array_length(snap->'stops')=0 then return; end if;
 insert into nng_outings(owner_id,source_key,shared_id,snapshot) values(p_owner,p_key,p_shared,snap)
 on conflict(owner_id,source_key) do nothing;
 select * into outing from nng_outings where owner_id=p_owner and source_key=p_key for update;
 if outing.shared_id is not null and p_shared is null then return; end if;
 previous:=outing.snapshot;
 snap:=snap||jsonb_build_object('participantIds',coalesce((select jsonb_agg(account_id order by account_id) from nng_shared_members where plan_id=p_shared and account_id is not null),'[]'));
 if not (snap->'participantIds' @> jsonb_build_array(p_owner)) then snap:=jsonb_set(snap,'{participantIds}',jsonb_build_array(p_owner)||(snap->'participantIds')); end if;
 if p_shared is not null then
   -- The public itinerary never carries organizer-private names or selections.
   snap:=snap || jsonb_build_object('people',previous->'people','starter',previous->'starter',
     'context',previous->'context','intent',coalesce(snap->>'intent',previous->>'intent'));
 end if;
 select coalesce(jsonb_agg(s),'[]') into removed from jsonb_array_elements(previous->'stops') s
 where not exists(select 1 from jsonb_array_elements(snap->'stops') n where n->>'id'=s->>'id');
 update nng_outings set snapshot=snap,shared_id=coalesce(p_shared,shared_id) where id=outing.id;
 perform nng_learn_emit(outing.id,p_owner,'plan-created','created',snap,p_source,p_at);
 if (previous - 'participantIds') is distinct from (snap - 'participantIds') then
   perform nng_learn_emit(outing.id,p_owner,'choices-updated','choices',snap||jsonb_build_object('replaced',removed),p_source,p_at);
 end if;
end $$;

create function public.nng_learn_private_trigger() returns trigger language plpgsql set search_path=public as $$
declare rec jsonb; oldrows jsonb; owner_email text;
begin
 if new.key not in ('nomNomGoBetaPlansV1','nomNomGoSavedPlansV1') or jsonb_typeof(new.value::jsonb) is distinct from 'array' then return new; end if;
 oldrows:=case when tg_op='UPDATE' and jsonb_typeof(old.value::jsonb)='array' then old.value::jsonb else '[]' end;
 select email into owner_email from nng_accounts where id=new.account_id;
 for rec in select value from jsonb_array_elements(new.value::jsonb) limit 40 loop
   if rec->>'owner' is distinct from owner_email or rec->>'source'='shared' or rec->>'learningVersion' is distinct from '1'
    or exists(select from jsonb_array_elements(oldrows) x where x=rec) then continue; end if;
   perform nng_learn_save(new.account_id,coalesce(rec->>'outingKey',rec->>'id'),rec,null,'private-save',clock_timestamp());
 end loop;
 return new;
end $$;
create trigger nng_learning_private after insert or update of value on public.nng_account_state for each row execute function public.nng_learn_private_trigger();

create function public.nng_learn_shared_trigger() returns trigger language plpgsql set search_path=public as $$
begin
 perform nng_learn_save(new.owner_id,new.source_key,new.details,new.id,'shared-save',clock_timestamp());
 return new;
end $$;
create trigger nng_learning_shared after insert or update of details on public.nng_shared_plans for each row execute function public.nng_learn_shared_trigger();

-- Backfill only organizer-authored shared plans and unambiguous private saves.
select public.nng_learn_save(owner_id,source_key,details,id,'legacy',created_at) from public.nng_shared_plans;
do $$
declare r record;
begin
 for r in select st.account_id,s,st.updated_at from public.nng_account_state st join public.nng_accounts a on a.id=st.account_id
 cross join lateral jsonb_array_elements(case when jsonb_typeof(st.value::jsonb)='array' then st.value::jsonb else '[]' end) s
 where st.key='nomNomGoSavedPlansV1' and s->>'source'='saved' and s->>'owner'=a.email
 -- Older snapshots lack lineage. Avoid attributing copies that may also be shared.
 and not exists(select from public.nng_shared_plans sp where sp.owner_id=a.id and sp.details->>'title'=s->>'title')
 and not exists(select from jsonb_array_elements(st.value::jsonb) other where other->>'id'<>s->>'id' and other->>'title'=s->>'title')
 loop
 perform public.nng_learn_save(r.account_id,r.s->>'id',r.s,null,'legacy',case when r.s->>'createdAt' ~ '^[0-9]{13}$' then to_timestamp((r.s->>'createdAt')::numeric/1000) else r.updated_at end);
 end loop;
end $$;


-- Profiles are projections of active evidence. Each row has a single contributor.
-- A group row is organizer-owned and available only in its exact people context.
create view public.nng_learning_profiles with (security_invoker=true) as
 select e.id,e.actor_id,e.outing_id,e.kind,e.confidence,e.created_at,e.profile_version,e.source,
        e.evidence,coalesce(j.result,'{}') as interpretation,
        case when jsonb_array_length(e.evidence->'people')>0 then 'group' else 'individual' end as scope
 from public.nng_learning_events e left join public.nng_learning_jobs j on j.event_id=e.id
 where e.active and (e.kind<>'plan-created' or not exists(select from public.nng_learning_events newer
   where newer.outing_id=e.outing_id and newer.kind='choices-updated' and newer.active));

create view public.nng_profile_revisions with (security_invoker=true) as
 select actor_id,scope,evidence->'people' as people,profile_version,
   md5(string_agg(id::text || interpretation::text,',' order by id)) as revision
 from public.nng_learning_profiles group by actor_id,scope,evidence->'people',profile_version;

create function public.nng_learning(p_email text,p_admin boolean,p_action text,p_data jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare identity jsonb; actor uuid; outing nng_outings; snap jsonb; val text; spot jsonb;
 mem jsonb; memversion bigint; fav text; prior text; people jsonb; now_at timestamptz:=clock_timestamp();
begin
 identity:=nng_alpha(p_email,p_admin,'touch','{}'); if identity ? 'error' then return identity; end if;
 actor:=(identity->>'id')::uuid;
 if p_action='learn.companion' then
   val:=trim(p_data->>'label');
   if val is null or length(val) not between 1 and 60 then return jsonb_build_object('error','Choose a short companion name.','status',400); end if;
   if (select count(*) from nng_companions where owner_id=actor)>=60 then return jsonb_build_object('error','Companion limit reached.','status',409); end if;
   insert into nng_companions(owner_id,label) values(actor,val) on conflict do nothing;
 end if;
 if p_action in ('learn.profile','learn.companion') then
   return jsonb_build_object('people',coalesce((select jsonb_agg(p order by p->>'label') from (
     select jsonb_build_object('id',id,'label',label) p from nng_companions where owner_id=actor
     union all select jsonb_build_object('id',a.id,'label',a.email) from nng_friendships f join nng_accounts a
     on a.id=case when f.account_low=actor then f.account_high else f.account_low end
     where actor in(f.account_low,f.account_high) and f.removed_at is null and a.enabled) t),'[]'),
   'signals',coalesce((select jsonb_agg(signal) from (select jsonb_build_object('starter',evidence->'starter','people',evidence->'people',
     'intent',evidence->'intent','context',evidence->'context','kind',kind,'scope',scope,'at',created_at,
     'categories',(select jsonb_agg(s->>'category') from jsonb_array_elements(evidence->'stops') s),
     'interpretation',interpretation) signal from nng_learning_profiles where actor_id=actor order by created_at desc limit 400) t),'[]'),
   'favoriteCategories',coalesce((select jsonb_agg(c.value->>'slot') from nng_account_state st
     cross join lateral jsonb_each(case when jsonb_typeof(st.value::jsonb->'favoriteCards')='object' then st.value::jsonb->'favoriteCards' else '{}' end) c
     where st.account_id=actor and st.key='thingsNearbyGooglePlacesMemoryV1' and st.value::jsonb->'favorites' ? c.key),'[]'));
 end if;
 if p_data ? 'sharedId' then
   select o.* into outing from nng_outings o join nng_shared_members m on m.plan_id=o.shared_id
     where o.shared_id::text=p_data->>'sharedId' and m.account_id=actor and m.email=lower(trim(p_email)) for update of o;
 else
   select * into outing from nng_outings where owner_id=actor and source_key=p_data->>'sourceKey' for update;
 end if;
 if outing.id is null then return jsonb_build_object('error','This saved outing is unavailable.','status',404); end if;
 snap:=outing.snapshot;
 if outing.shared_id is not null then
   select coalesce(jsonb_agg(id order by id),'[]') into people from (
     select account_id::text as id from nng_shared_members where plan_id=outing.shared_id and account_id is not null and account_id<>actor and joined_at is not null
     union select value from jsonb_array_elements_text(snap->'people') where actor=outing.owner_id) t;
   snap:=jsonb_set(snap,'{people}',people)||jsonb_build_object('participantIds',(select jsonb_agg(account_id order by account_id) from nng_shared_members where plan_id=outing.shared_id and account_id is not null));
 end if;
 if actor<>outing.owner_id then
   snap:=snap||jsonb_build_object('people','[]'::jsonb,'starter',null,'intent',null);
 end if;
 if p_action='learn.complete' then
   if actor<>outing.owner_id then return jsonb_build_object('error','Only the organizer can complete the outing.','status',403); end if;
   if outing.completed_at is null then
     update nng_outings set completed_at=now_at where id=outing.id returning * into outing;
     perform nng_learn_emit(outing.id,actor,'plan-completed','completed',snap||jsonb_build_object('actuals',p_data->'actuals'),'organizer');
   end if;
 elsif p_action='learn.feedback' then
   if outing.completed_at is null then return jsonb_build_object('error','Complete the outing first.','status',409); end if;
   val:=p_data->>'value';
   if val in ('more','different') then
     perform nng_learn_emit(outing.id,actor,val,'feedback',snap,'self-report');
   elsif val='favorite' then
     fav:=p_data->>'placeId';
     select s into spot from jsonb_array_elements(snap->'stops') s where s->>'id'=fav;
     if spot is null then return jsonb_build_object('error','Choose a saved stop.','status',400); end if;
     select value::jsonb,version into mem,memversion from nng_account_state where account_id=actor and key='thingsNearbyGooglePlacesMemoryV1';
     mem:=coalesce(mem,'{}'); memversion:=coalesce(memversion,0);
     if not coalesce(mem->'favorites','[]') ? fav then
       mem:=mem||jsonb_build_object('favorites',jsonb_build_array(fav)||coalesce(mem->'favorites','[]'),
        'favoriteCards',coalesce(mem->'favoriteCards','{}')||jsonb_build_object(fav,jsonb_build_object('slot',case when spot->>'category' in ('food','dessert') then 'food' else 'activity' end,
         'card',jsonb_build_object('id',fav,'title',spot->>'title','subtitle','','types',spot->'types','priceLevel',spot->'budgetEstimate'))));
       insert into nng_account_state(account_id,key,value,version) values(actor,'thingsNearbyGooglePlacesMemoryV1',mem::text,memversion+1)
       on conflict(account_id,key) do update set value=excluded.value,version=excluded.version,updated_at=now() returning version into memversion;
     end if;
     perform nng_learn_emit(outing.id,actor,'favorite','favorite:'||fav,snap||jsonb_build_object('stops',jsonb_build_array(spot)),'self-report');
   else return jsonb_build_object('error','Unknown feedback.','status',400); end if;
 elsif p_action<>'learn.outing' then return jsonb_build_object('error','Unknown action.','status',400); end if;
 select kind into prior from nng_learning_events where outing_id=outing.id and actor_id=actor and slot='feedback' and active;
 return jsonb_build_object('completed',outing.completed_at is not null,'owner',actor=outing.owner_id,'feedback',prior,
 'stops',(select coalesce(jsonb_agg(jsonb_build_object('id',s->>'id','title',s->>'title',
 'favorite',coalesce((select value::jsonb->'favorites' ? (s->>'id') from nng_account_state where account_id=actor and key='thingsNearbyGooglePlacesMemoryV1'),false))),'[]') from jsonb_array_elements(snap->'stops') s),
 'memory',case when mem is not null then jsonb_build_object('value',mem::text,'version',memversion) end);
end $$;

-- Reserve quotas before network I/O; a timed-out/billed attempt still consumes a call.
create function public.nng_learning_claim(p_since timestamptz,p_only uuid,p_user_cap int,p_global_cap int,p_max_attempts int)
returns jsonb language plpgsql set search_path=public as $$
declare job record; token uuid:=gen_random_uuid(); day_key date:=(now() at time zone 'UTC')::date;
begin
 perform pg_advisory_xact_lock(773091,4);
 update nng_learning_jobs set state='stopped',lease=null,last_status='lease_expired' where state='running' and due_at<=now() and attempts>=p_max_attempts;
 if coalesce((select calls from nng_learning_usage where day=day_key and scope='global'),0)>=p_global_cap then return null; end if;
 select e.id,e.actor_id,e.kind,e.evidence into job from nng_learning_jobs j join nng_learning_events e on e.id=j.event_id join nng_accounts a on a.id=e.actor_id
 where e.active and exists(select from nng_learning_profiles profile where profile.id=e.id)
 and a.enabled and exists(select 1 from app_grants g where g.app_slug='nomnomgo' and g.user_email=a.email)
 and exists(select 1 from apps where slug='nomnomgo' and status='active') and e.created_at>=p_since and (p_only is null or e.actor_id=p_only) and j.state in ('ready','running')
 and j.due_at<=now() and j.attempts<p_max_attempts and coalesce((select calls from nng_learning_usage where day=day_key and scope=e.actor_id::text),0)<p_user_cap
 order by e.created_at for update of j skip locked limit 1;
 if not found then return null; end if;
 insert into nng_learning_usage(day,scope,calls) values(day_key,'global',1),(day_key,job.actor_id::text,1)
 on conflict(day,scope) do update set calls=nng_learning_usage.calls+1;
 update nng_learning_jobs set lease=token,attempts=attempts+1,state='running',due_at=now()+interval '2 minutes' where event_id=job.id;
 return jsonb_build_object('event',job.id,'lease',token,'kind',job.kind,'intent',job.evidence->'intent','context',job.evidence->'context',
 'stops',(select coalesce(jsonb_agg(jsonb_build_object('category',s->'category','duration',s->'durationEstimate','budget',s->'budgetEstimate')),'[]')
 from jsonb_array_elements(job.evidence->'stops') s));
end $$;

create function public.nng_learning_finish(p_event uuid,p_lease uuid,p_status text,p_result jsonb,p_latency int,p_input int,p_output int,p_max_attempts int)
returns boolean language plpgsql set search_path=public as $$
begin
 update nng_learning_jobs j set state=case when not e.active then 'superseded' when p_status='success' then 'done'
 when p_status='retry' and j.attempts<p_max_attempts then 'ready' else 'stopped' end,
 result=case when e.active and p_status='success' and exists(select from nng_learning_profiles profile where profile.id=e.id) then p_result end,last_status=p_status,latency_ms=p_latency,input_tokens=p_input,output_tokens=p_output,
 due_at=now()+make_interval(mins=>power(2,j.attempts)::int), lease=null
 from nng_learning_events e where e.id=j.event_id and j.event_id=p_event and j.lease=p_lease and j.state='running'
 and j.due_at>now();
 return found;
end $$;

do $$
declare n text; f regprocedure;
begin
 foreach n in array array['nng_companions','nng_outings','nng_learning_events','nng_learning_jobs','nng_learning_usage'] loop
 execute format('alter table public.%I enable row level security',n);
 execute format('revoke all on public.%I from public, anon, authenticated',n);
 execute format('grant select,insert,update on public.%I to service_role',n);
 end loop;
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and
 (proname like 'nng_learn\_%' escape '\' or proname in ('nng_learning','nng_learning_claim','nng_learning_finish')) loop
 execute format('revoke all on function %s from public, anon, authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
revoke all on public.nng_learning_profiles,public.nng_profile_revisions from public,anon,authenticated;
grant select on public.nng_learning_profiles,public.nng_profile_revisions to service_role;
commit;
