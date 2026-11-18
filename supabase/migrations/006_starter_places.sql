-- Add only place IDs and venue types to the existing actor-owned history response.
begin;
create or replace function public.nng_learning(p_email text,p_admin boolean,p_action text,p_data jsonb)
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
     'places',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',s->>'id','types',s->'types')) order by n),'[]'::jsonb)
       from jsonb_array_elements(evidence->'stops') with ordinality st(s,n) where n<=40 and s->>'id' is not null),
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
commit;
