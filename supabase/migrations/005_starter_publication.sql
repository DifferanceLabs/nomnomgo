-- Preserve private draft context on publication and record the removal of the last chosen stop.
begin;
create or replace function public.nng_learn_save(p_owner uuid,p_key text,p_record jsonb,p_shared uuid,p_source text,p_at timestamptz)
returns void language plpgsql set search_path=public as $$
declare snap jsonb; outing nng_outings; previous jsonb; removed jsonb; private_record jsonb; private_context jsonb;
begin
 if p_key is null or length(p_key) not between 1 and 200 then return; end if;
 snap:=nng_learn_snapshot(p_owner,p_record,p_shared is not null);
 if p_shared is null and jsonb_array_length(snap->'stops')=0 and not exists(
   select from nng_outings where owner_id=p_owner and source_key=p_key
 ) then return; end if;
 if p_shared is not null and not exists(select from nng_outings where shared_id=p_shared) then
   -- A private empty draft has no learning event. Resolve its context at the first explicit publication.
   select r into private_record from nng_account_state st join nng_accounts a on a.id=st.account_id
   cross join lateral jsonb_array_elements(case when jsonb_typeof(st.value::jsonb)='array' then st.value::jsonb else '[]' end) r
   where st.account_id=p_owner and st.key='nomNomGoBetaPlansV1' and r->>'id'=p_key
   and r->>'owner'=a.email and r->>'learningVersion'='1' limit 1;
   if private_record is not null then
     private_context:=nng_learn_snapshot(p_owner,private_record,false);
     snap:=snap||jsonb_build_object('people',private_context->'people','starter',private_context->'starter',
       'context',private_context->'context');
   end if;
 end if;
 insert into nng_outings(owner_id,source_key,shared_id,snapshot) values(p_owner,p_key,p_shared,snap)
 on conflict(owner_id,source_key) do nothing;
 select * into outing from nng_outings where owner_id=p_owner and source_key=p_key for update;
 if outing.shared_id is not null and p_shared is null then return; end if;
 previous:=outing.snapshot;
 snap:=snap||jsonb_build_object('participantIds',coalesce((select jsonb_agg(account_id order by account_id) from nng_shared_members where plan_id=p_shared and account_id is not null),'[]'));
 if not (snap->'participantIds' @> jsonb_build_array(p_owner)) then snap:=jsonb_set(snap,'{participantIds}',jsonb_build_array(p_owner)||(snap->'participantIds')); end if;
 if p_shared is not null then
   -- The public itinerary never carries organizer-private names or selections.
   snap:=snap || jsonb_build_object('people',coalesce(private_context->'people',previous->'people'),'starter',coalesce(private_context->'starter',previous->'starter'),
     'context',coalesce(private_context->'context',previous->'context'),'intent',coalesce(snap->>'intent',previous->>'intent'));
 end if;
 select coalesce(jsonb_agg(s),'[]') into removed from jsonb_array_elements(previous->'stops') s
 where not exists(select 1 from jsonb_array_elements(snap->'stops') n where n->>'id'=s->>'id');
 update nng_outings set snapshot=snap,shared_id=coalesce(p_shared,shared_id) where id=outing.id;
 perform nng_learn_emit(outing.id,p_owner,'plan-created','created',snap,p_source,p_at);
 if (previous - 'participantIds') is distinct from (snap - 'participantIds') then
   perform nng_learn_emit(outing.id,p_owner,'choices-updated','choices',snap||jsonb_build_object('replaced',removed),p_source,p_at);
 end if;
end $$;
commit;
