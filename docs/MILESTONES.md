# NomNomGo Milestones

This document maps the issue hierarchy to execution milestones. Milestones are ordered by product dependency, not fixed dates.

## M1 - Local MVP

Goal: A local or development build can complete the core planning loop.

Primary outcome:

- Users can create a plan, invite participants, set when and where, suggest venues, vote, lock a result, share it, and open map directions.

Required issues:

- ISSUE-0001 Create Planning Session
- ISSUE-0002 Invite Participants
- ISSUE-0003 Set Time Window
- ISSUE-0004 Set Search Area
- ISSUE-0005 Suggest Venues
- ISSUE-0006 Vote On Suggestions
- ISSUE-0007 Lock Final Plan
- ISSUE-0009 Plan Status State Machine
- ISSUE-0020 Restaurant Recommendations
- ISSUE-0027 Manual Recommendation Override
- ISSUE-0029 Deep Link Routing
- ISSUE-0030 Native Share Sheets
- ISSUE-0032 Maps Handoff
- ISSUE-0034 Core Accessibility Pass
- ISSUE-0036 Independent Auth Architecture
- ISSUE-0037 User Profiles
- ISSUE-0038 Session Management
- ISSUE-0039 Core Planning API Contracts
- ISSUE-0041 Analytics Event Taxonomy
- ISSUE-0043 Environment Separation
- ISSUE-0044 Error Logging
- ISSUE-0051 Provider Failure Degradation
- ISSUE-0073 Invite Link Format
- ISSUE-0076 Shareable Plans
- ISSUE-0079 Lightweight Invite Onboarding

Exit criteria:

- One full planning session can be completed manually from create through lock.
- MVP analytics events exist for the planning funnel.
- Provider failure does not block manual planning.
- No server-side secrets are exposed to the browser.

## M2 - Private Alpha

Goal: Hosted alpha users can use the MVP safely, with launch gating and operational basics in place.

Primary outcome:

- The hosted app remains protected by Differance Labs alpha launch auth while local and Expo development remain unblocked.

Required issues:

- ISSUE-0008 Calendar Export
- ISSUE-0031 Calendar Integration
- ISSUE-0042 Feature Flags
- ISSUE-0045 Monitoring Health Checks
- ISSUE-0046 Rate Limiting
- ISSUE-0048 Audit Trails
- ISSUE-0049 Backup Restore Runbook
- ISSUE-0074 Invite Preview Metadata
- ISSUE-0078 Waitlist Flow
- ISSUE-0089 Alpha Launch Gate Regression

Exit criteria:

- Valid launch access reaches the app and invalid direct hosted access shows the locked screen.
- Core endpoints have rate limits.
- Basic health and error visibility exists.
- Calendar and share flows are usable by alpha testers.

## M3 - Friends & Groups

Before this milestone becomes the main focus, closed beta readiness should be satisfied by the dedicated roadmap in `docs/CLOSED_BETA_ROADMAP.md`. That closed beta path keeps Android and iOS app distribution, independent NomNomGo auth, mobile deep links, backend persistence, analytics, support, and the temporary DL web launch gate in one execution frame.

Goal: Groups return naturally after the first successful planning sessions.

Primary outcome:

- Users can reuse friends, groups, saved places, and group history to start future plans faster.

Required issues:

- ISSUE-0010 Reopen Or Cancel Plan
- ISSUE-0011 Friend Connections
- ISSUE-0012 Friend Requests
- ISSUE-0014 Reusable Groups
- ISSUE-0015 Group History
- ISSUE-0018 Favorite Places
- ISSUE-0028 Plan Notifications
- ISSUE-0047 Abuse Detection Basics
- ISSUE-0077 Viral Loop Instrumentation

Exit criteria:

- Returning participants can start repeat plans with less manual invite work.
- Group history and saved places are visible and reusable.
- Notifications and abuse basics support recurring use.

## M4 - Recommendation Engine

Goal: NomNomGo recommendations become useful enough that users choose inside the app more often.

Primary outcome:

- The app understands candidate quality, user feedback, travel context, group preferences, and early relationship graph signals.

Required issues:

- ISSUE-0017 Attendance Tracking
- ISSUE-0021 Activity Recommendations
- ISSUE-0022 Weather Aware Suggestions
- ISSUE-0023 Travel Aware Suggestions
- ISSUE-0024 Group Taste Profiles
- ISSUE-0025 Recommendation Feedback
- ISSUE-0026 Recommendation Explanations
- ISSUE-0080 Relationship Event Taxonomy
- ISSUE-0081 Relationship Graph Data Model
- ISSUE-0082 Shared History Signals
- ISSUE-0083 Shared Preferences Model
- ISSUE-0084 Recurring Pattern Detection

Exit criteria:

- Recommendation cards explain why they appear.
- Users can provide feedback.
- Group history and shared preferences influence recommendations without hidden assumptions.

## M5 - Public Launch

Goal: NomNomGo is ready for broader public access and can operate independently.

Primary outcome:

- Public launch safety, support, provider proxying, onboarding, and trust features are in place.

Required issues:

- ISSUE-0013 Mutual Friends Context
- ISSUE-0016 Shared Memories
- ISSUE-0019 Reputation Signals
- ISSUE-0033 Offline Plan Read
- ISSUE-0035 Dark Mode
- ISSUE-0040 Admin Support Tools
- ISSUE-0050 Incident Dashboards
- ISSUE-0075 QR Onboarding
- ISSUE-0086 Graph Transparency Controls
- ISSUE-0088 Server-Side Provider Proxy

Exit criteria:

- Provider calls that require private credentials are behind server-side endpoints.
- Support and incident workflows exist.
- Public-facing trust and transparency controls are documented.
- NomNomGo remains independently deployable.

## M6 - Monetization

Goal: NomNomGo can validate revenue without compromising the planning experience.

Primary outcome:

- Venue partners, attribution, offers, campaign tracking, and premium planning concepts can be tested.

Required issues:

- ISSUE-0052 Referral Attribution
- ISSUE-0053 Venue Partnerships Model
- ISSUE-0054 Premium Planning Discovery
- ISSUE-0055 Premium Groups Discovery
- ISSUE-0056 Sponsored Recommendation Labels
- ISSUE-0057 Event Packages Prototype
- ISSUE-0058 Revenue Reporting
- ISSUE-0066 Business Accounts
- ISSUE-0067 Business Dashboards
- ISSUE-0068 Offer Management
- ISSUE-0069 Event Promotion Tools
- ISSUE-0070 Business Analytics
- ISSUE-0071 Campaign Tracking
- ISSUE-0072 Business Managed Venue Data
- ISSUE-0087 Referral Program

Exit criteria:

- Sponsored and partner placements are labeled clearly.
- Businesses can see meaningful planning attribution.
- Monetization experiments are measurable and reversible.
- No paid service dependency is introduced without approval.

## M7 - Agent Platform

Goal: NomNomGo becomes assistant-native coordination infrastructure.

Primary outcome:

- Agents can draft, summarize, and integrate with planning flows through permissioned APIs and human approval.

Required issues:

- ISSUE-0059 AI Planning Assistant Drafting
- ISSUE-0060 Group Coordination Assistant
- ISSUE-0061 Venue Negotiation Assistant
- ISSUE-0062 External AI Integrations
- ISSUE-0063 Shared Planning API Docs
- ISSUE-0064 Agent Permissions
- ISSUE-0065 Agent Approval Checkpoints
- ISSUE-0085 Planning Prediction Surfaces

Exit criteria:

- Agent permissions are visible, revocable, and auditable.
- Sensitive actions require human approval.
- External integrations use stable planning APIs rather than hidden browser workflows.
- Relationship-aware predictions assist planning without deciding for users.
