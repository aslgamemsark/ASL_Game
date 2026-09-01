# CMO / Marketing-Agent System — Research

**Status: research only. Nothing in this document is implemented.** No social accounts created, no OAuth connected, no publishing tokens obtained, no posts scheduled, no ads purchased, no outreach sent. This is a feasibility and design brief for a future decision — per the mission's explicit scope boundary, this phase does not cross into building any of it.

Web-search-sourced facts below are dated August 2026 and should be re-verified before any spend decision — pricing and API terms for these products change often.

## 1. Competitive landscape

QuickSign's real differentiator is **live camera feedback that scores what you actually did**, not just video-and-quiz recognition. That's a smaller, more crowded space than it first looks:

- **Lingvano** is the closest direct competitor — ASL/BSL/Austrian Sign Language, deaf-instructor video lessons, and a "Sign Mirror" feature that uses the front camera for real-time visual feedback. This is the single most important competitive fact: the "camera watches you sign" pitch is not unclaimed territory.
- **ASL Bloom** (Oslo, unfunded, founded 2022) — free ASL learning modules, no camera-feedback claim found.
- **The ASL App, Ace ASL, Marlee Signs, SignSchool, ASL Dictionary** — mostly video-lesson/dictionary format, recognition-light or absent.
- General language apps (Duolingo-style) that added ASL as one language among many — broader reach, shallower ASL-specific investment.

**Positioning implication:** "Learn ASL with real-time feedback" alone is not a defensible claim once Lingvano is in the comparison. QuickSign's actual differentiators worth leading with instead: (a) the **per-parameter breakdown** ("Sign Coach" — tells you *which* of handshape/location/movement/orientation was wrong, not just pass/fail), (b) **free with no signup wall** (post-Phase-3 reorder, this is now genuinely true from first sign onward), (c) **multiplayer** (Duel/Room — no direct competitor found offering this), (d) gamification depth (worlds, streaks, quests) aimed at habit formation rather than one-off lessons.

## 2. Ideal customer profile (ICP)

Not independently validated by user research in this audit — inferred from the product's own design signals (gamified, mobile-first, guest-friendly, Reddit-beta-launched per `analytics/client.ts`'s `beta_cohort` group name):

- **Primary**: hearing adults with a personal reason to learn ASL fast and casually — a Deaf family member, coworker, or friend; not enrolled in a formal class. Motivated by a specific relationship, not a career requirement.
- **Secondary**: language-learning hobbyists who already use Duolingo-shaped apps and are ASL-curious.
- **Explicitly not (yet) served**: people who need CODA-level fluency, ASL interpreters-in-training, or K-12/university students needing curriculum alignment — the content depth and lesson structure aren't built for that today.

Recommend validating this with real user interviews (5-10 early beta users, structured questions on "why did you start," "what almost made you quit") before spending marketing budget against an ICP that's currently a guess.

## 3. Content strategy: faceless formats

"Faceless" (no on-camera human presenter) is a real, viable content strategy for this product specifically, because the product's own screen recording IS the content — a hand signing on camera, live feedback appearing, a pass animation. This maps directly to:

- **Short-form vertical** (TikTok/Reels/Shorts): screen-record a Practice or Duel session, 15-30s, no voiceover needed — the visual hook is "watch the app catch a wrong handshape in real time." Captions carry the narration.
- **"Can you beat the AI" / Duel clips**: multiplayer is inherently more shareable than solo practice — a real head-to-head round is a natural clip.
- **Before/after handshape correction**: a split-screen or sequential "here's what I was doing wrong, here's the fix" — leans on the Sign Coach's actual differentiator.

Faceless is lower-risk (no personal likeness/identity exposure for whoever produces it) and cheaper to scale than presenter-led content, but has a ceiling: it doesn't build a parasocial creator relationship the way a recurring human host does. Reasonable to start faceless and layer in a real presenter later if a channel starts working.

## 4. Tooling landscape (as of Aug 2026 — re-verify before committing spend)

| Tool | What it is | Pricing (Aug 2026) | Fit |
|---|---|---|---|
| **Buffer** | Scheduling/publishing, GraphQL API, first-party n8n/Make/Zapier/Claude integrations, hosted MCP server | Free: 3 channels, 10 scheduled posts/channel. Essentials $5/channel/mo (annual). Team $10/channel/mo (annual). | Best default if the volume is genuinely low (a handful of channels) — free tier may cover an early faceless-clip cadence entirely. |
| **Postiz** | Open-source (AGPL-3.0), self-hostable, 20+ networks incl. Bluesky/Threads/Mastodon/Reddit, own MCP server, real public API on every paid tier | $29/mo for 5 channels (cloud), or self-host free | More networks than Buffer out of the box; self-hosting is real but adds ops burden this team doesn't currently have capacity for. |
| **Activepieces** | Open-source workflow automation (n8n-style), no first-party Postiz integration as of this check but supports it via n8n/Make bridges | Has a free/OSS tier | Only relevant as connective tissue, not a posting tool itself. |
| **n8n** | General workflow automation, self-hostable or cloud | Cloud: $20/user/mo (Team, 2,500 executions/mo), scaling to $50-100+/mo | The right layer for "when X happens, post Y" orchestration once there's more than one tool in the pipeline — overkill for a single Buffer/Postiz account posting on a schedule. |
| **UnifAPI** | Unified read API for TikTok/Instagram/YouTube/X/LinkedIn/Reddit/Threads public data — pay-per-record, MCP-compatible | Free trial, then pay-per-record | Useful for competitive intelligence / trend research (what's performing in the ASL-content niche right now), NOT a posting tool — it reads public data, it doesn't publish. |
| **"Marketing Agent OS" category** (Lyzr/Skott, Digital.Marketing's AI Marketing OS, etc.) | Full agentic orchestration layers across content/social/email/SEO under one system | Enterprise-priced, typically custom/contact-sales | Overkill for QuickSign's current scale — this category is built for teams running many simultaneous channels/campaigns with dedicated headcount, not a two-person indie team's first marketing motion. Worth revisiting only if the $50/mo tier (below) is outgrown. |

**Recommendation for a first system, if this is ever built**: Buffer's free tier (or Postiz's $29 tier if more networks are needed from day one) plus n8n only once there's a real second workflow step to automate (e.g. "clip gets uploaded → auto-generate caption via Claude API → queue in Buffer" — at that point n8n or a simple custom script both work; n8n only earns its cost once there are multiple such workflows to maintain visually rather than in code).

## 5. Platform API feasibility (publishing, not just reading)

Genuinely publishing to each platform requires that platform's own OAuth app + API access, mediated through whichever scheduler is chosen — none of the tools above bypass this, they wrap it:

- **TikTok**: Content Posting API exists but has historically had approval friction for new developer apps, especially for direct (non-draft) publishing — budget for a review/approval lag before assuming day-one automated posting works.
- **Instagram/Threads (Meta)**: Graph API supports scheduled posting for Business/Creator accounts only, requires app review for anything beyond a handful of test users, and Threads' API is newer/less mature than Instagram's.
- **YouTube Shorts**: standard YouTube Data API upload endpoint works, but is subject to daily quota limits on a fresh API project (quota increase requests take time).
- **X/Twitter**: API access is tiered and paid separately from any scheduler's own price — this is a real added cost most of the table above doesn't include.
- **Bluesky/Mastodon**: comparatively the easiest — open, low-friction APIs, no app-review gate.

**Bottom line**: assume a 1-4 week lead time for API approvals on the major platforms before any automated posting can go live there, and budget X's API access as a separate line item from whichever scheduler is chosen.

## 6. Model routing (for AI-assisted content production)

If AI generates captions/scripts/thumbnails as part of this pipeline, route by task rather than using one model for everything:

- **Caption/copy generation** (short, high-volume, low-stakes-per-item): a fast, cheap model is the right fit — this is exactly the kind of task where a smaller/cheaper model in the same family as whatever's used elsewhere in this org is appropriate.
- **Strategic content planning / campaign structure** (infrequent, high-stakes, benefits from reasoning): the largest available model is worth the cost here — this is a handful of calls a week, not a per-post cost.
- **Thumbnail/visual generation**: a dedicated image model, not a text model — separate routing entirely.

Do not hardcode a specific model version into any pipeline built later — model families get superseded; route by capability tier (fast/cheap vs. large/reasoning vs. image) and re-resolve to whatever's current at call time.

## 7. Budget tiers — what each actually buys

| Tier | What it covers | What it doesn't |
|---|---|---|
| **$0/mo** | Buffer free tier (3 channels, manual posting cadence), faceless clips produced from existing app recordings, no paid ads, no premium scheduling tool | No automation beyond basic scheduling; all captioning/editing is manual; can't scale past ~3 channels or ~10 scheduled items/channel |
| **$10/mo** | Buffer Essentials-equivalent for 1-2 channels ($5-10/channel), still no automation layer | Still manual content production; one extra channel doesn't unlock automation |
| **$25/mo** | Postiz's $29 tier (round up) for 5 channels + real public API — the API is the actual unlock here, since it's what a future automation layer would call | X/Twitter API access is a separate cost not included; no orchestration layer yet (still manually triggering posts or scripting directly against the API) |
| **$50/mo** | Postiz $29 + n8n cloud starter-adjacent spend, OR Buffer + a paid X API tier for one platform — enough to run one real automated workflow (e.g. clip → AI caption → scheduled post) | Not enough for TikTok/Meta app-review-gated publishing at volume, not enough for the "Marketing Agent OS" category, not enough for paid ad spend |

None of these tiers include paid advertising (Meta/TikTok/Google ads) — that's a separate, uncapped line item and a separate decision (this doc takes no position on ad spend, since it's a financial commitment outside a research doc's scope to recommend).

## 8. Attribution

Landing-page events already exist and are typed (see `analytics/types.ts`'s `landing_view`/`hero_cta_clicked`/`scroll_depth`/`alphabet_landing_view`/`feedback_clicked`, fixed for DNT/opt-out and shape-consistency in this session's Phase 5/6 work) — `landing_view` already captures `utm_source`/`utm_medium`/`utm_campaign`. **The gap**: nothing currently threads a UTM/campaign identifier from landing-page arrival through to in-app signup/first-sign-success — once a visitor clicks through to the actual app (a different origin, `quicksignn.vercel.app` vs the marketing page), the UTM context is lost unless explicitly passed and captured.

If a real campaign is ever run, the minimum viable fix: append UTM params to the app-bundle URL in every CTA href (already technically possible — `hero_cta_clicked`'s `href` field shows the target), and read+register them as a one-time PostHog super property on the app's first load (mirroring how `traffic_type` is already registered in `client.ts`) so every subsequent event in that user's session — and ideally that carries through `identifyUser`/`aliasAnon` on eventual signup — stays attributable to the campcampaign that brought them. Not built; this document only identifies where the seam is.

## 9. Experiment schema (for A/B-testing content/campaigns, not yet built)

A minimal shape, if this is ever implemented — deliberately not built now:

```
experiment_id: string           # e.g. "landing-hero-copy-v2"
variant: string                 # which arm this session saw
assigned_at: timestamp
exposure_event: string          # the event name that counts as "saw the variant"
success_event: string           # the event name that counts as the experiment's target outcome
```

PostHog itself has native feature-flag-based experimentation (already partially used in this codebase — see `useFeatureFlag`, e.g. `disable_multiplayer`/`disable_camera` kill switches) — a real content/campaign experiment should likely reuse that mechanism rather than a bespoke schema, keeping experiment assignment and analysis in one tool.

## 10. Approval gates (process design, for whenever a human/agent runs this)

Recommended checkpoints if a marketing agent (human or AI-assisted) is ever authorized to operate this system — mirroring the caution this whole research phase was conducted under:

1. **Before any account is created or OAuth connected**: explicit owner approval, per-platform (not a blanket "go ahead").
2. **Before any post publishes** (even from an automated pipeline): a human review step for the first N posts on any new channel, relaxing to spot-check only once the pipeline's output is trusted.
3. **Before any paid spend**: explicit dollar-amount approval per campaign, never an open-ended "optimize spend" instruction to an automated system.
4. **Before any outreach to a real person** (influencer, potential tester, press): the same explicit-approval bar as the ASL validation program's recruitment message (see `docs/ASL_VALIDATION_PROGRAM.md` §2) — no automated DM/cold-outreach system, ever, without a human sending each message.
5. **Before publishing any user-generated content or testimonial**: explicit, separate consent from that person for that specific use (see the validation-program doc's §4 — this applies equally to a marketing testimonial pulled from in-app feedback).

## Explicit non-scope (restated)

This document is research and design only. No account was created, no token obtained, no message sent, no dollar spent, no content published, in the production of this research.
