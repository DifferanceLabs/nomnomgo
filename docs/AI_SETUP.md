# Plan history and OpenAI activation

NomNomGo learns immediately from saved selections, explicit completion and feedback. The first release runs with OpenAI disabled. The three starter IDs and display labels live in `src/domain/planStarters.ts`. People selected for a starter are private planning context. Sharing and RSVP use the existing shared workspace. Completion confirms the organizer's outing. A participant's feedback belongs to that participant.

## Configure server credentials

1. Choose a dedicated NomNomGo project on the OpenAI API Platform. Open organization Billing, add the payment method or activate credits offered to the account, and confirm a spendable balance or active pay-as-you-go billing. Set a project budget and usage alerts. Account API eligibility can be checked on the project's Limits page. [Billing overview](https://platform.openai.com/settings/organization/billing/overview) · [Project settings](https://platform.openai.com/settings/organization/projects)
2. Create a project-scoped server API key with permission to create Responses. Enter it directly in the existing Vercel **nomnomgo → Settings → Environment Variables → Production** as sensitive `OPENAI_API_KEY`. Set `OPENAI_MODEL` in the same scope to a model enabled for this project that supports both Responses and strict Structured Outputs. The initial selection is `gpt-6.1-terra`. Keep these variables out of Expo, Preview, Git and support messages. [API keys](https://platform.openai.com/api-keys) · [Model capabilities](https://developers.openai.com/api/docs/models/gpt-6.1-terra) · [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
3. The release operator provisions a separate high-entropy Production `CRON_SECRET` for the Vercel scheduler. Keep the existing Supabase service credentials and DL launch secret in their existing Production settings. A worker call requires the cron bearer even when AI is off. [Vercel Cron authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
4. Keep `NNG_AI_ENABLED=false` until the bounded smoke test. Environment updates take effect on a **new Production deployment**. With the key, model, activation timestamp, or enable flag missing, the worker makes zero provider requests.

## One-event live verification

Use one authorized alpha test account. Set `NNG_AI_ONLY_ACCOUNT` to its NNG account UUID, `NNG_AI_ACTIVE_FROM` to the current UTC ISO timestamp, both daily caps to **1**, and `NNG_AI_MAX_ATTEMPTS=1`. Then set `NNG_AI_ENABLED=true` and redeploy the verified release. The activation timestamp excludes older history. Make one food-only outing with one deliberately chosen stop and save it. For a completion-only smoke, prepare the saved outing before the activation timestamp and press Mark complete once afterward. Run the protected job from **Vercel → nomnomgo → Settings → Cron Jobs → Run**. The normal Hobby schedule runs daily at 05:00 UTC. Each dispatch drains up to ten items within its time budget.

Verify in the existing Supabase project's SQL Editor. Bind the test account UUID in the query, and inspect only operational fields. A completed Responses request, token usage, and an interpretation on that actor's active profile establish end-to-end success. An HTTP 200 alone is insufficient.

~~~sql
select j.state, j.last_status, j.input_tokens, j.output_tokens, j.latency_ms,
       p.kind, p.profile_version, r.revision, p.interpretation->>'intent' as learned_intent
from public.nng_learning_profiles p
join public.nng_learning_jobs j on j.event_id = p.id
join public.nng_profile_revisions r on r.actor_id = p.actor_id and r.scope = p.scope and r.people = p.evidence->'people'
where p.actor_id = '<test-account-uuid>'::uuid
order by p.created_at desc limit 5;
~~~

Run the worker again. Verify one applied interpretation and one reserved global call for the test day. If it fails or the profile does not reflect the sourced interpretation, leave the rollout bounded, inspect sanitized status, and disable AI before troubleshooting. After success, remove the account filter, set a fresh activation timestamp, restore normal caps and redeploy. Preserve the tested model ID in the release report.

## Limits and evidence

| Setting | Initial production limit |
| --- | --- |
| `NNG_AI_USER_DAILY_CAP` / `NNG_AI_GLOBAL_DAILY_CAP` | 3 / 30 provider attempts per UTC day |
| `NNG_AI_INPUT_TOKENS` / `NNG_AI_OUTPUT_TOKENS` | 2,000 / 512 tokens |
| `NNG_AI_TIMEOUT_MS` / `NNG_AI_MAX_ATTEMPTS` | 15,000 ms / 3 total attempts |

The database reserves usage before each attempt, including retries. Inspect queue depth by state with `select state, count(*) from public.nng_learning_jobs group by state`. Worker logs contain status, latency and token counts. A leased job is recoverable after two minutes. Retryable failures back off exponentially until a later dispatch. Refusals, invalid references, ambiguous results and unavailable service leave deterministic personalization available.

Each event records its origin, confidence, versions, time and outing. Profile ordering gives explicit feedback precedence over completion, then saved intent, with recency as a tie-breaker. The application preserves dietary selections and explicit favorites. Exact people sets scope group defaults. Saved dates, stop duration and price bands are planning estimates. Optional organizer-reported actuals use separate fields. Names, locations, titles, prompts and raw user text stay out of model input. The worker sends bounded categories with a one-use evidence reference and `store: false`.

## Deployment and rollback

Apply only `supabase/migrations/004_plan_learning.sql` to the same database used by the NomNomGo Production project before publishing the app. It runs in one transaction. Verify the RLS policies, service-only RPC permissions, and duplicate-save/completion behavior. Keep migrations 001–003 installed. Run the checks in AGENTS.md, push the release to main, verify GitHub and Vercel, then smoke-test the gated production URL.

To stop provider spending, set `NNG_AI_ENABLED=false` and redeploy. Revoke the project API key in OpenAI for an immediate credential cutoff if required. For an application rollback, revert the release commit on main through the established checks. Retain tables, profiles and feedback. To suspend passive collection under the previous app, disable the two triggers `nng_learning_private` on `public.nng_account_state` and `nng_learning_shared` on `public.nng_shared_plans` in a transaction. Re-enable them before rolling the feature forward.
