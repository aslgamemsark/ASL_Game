# Marketing Analytics — UTM Conventions

Canonical UTM format for every link QuickSign posts publicly, so campaign attribution
(`web/src/analytics/attribution.ts`) is comparable across channels instead of ad-hoc per post. Use
this for Product Hunt, Reddit, Hacker News, Discord, X/Twitter, email, and anywhere else a link goes
out — including the in-app share loop (`ShareButton.tsx`), which already follows this format.

## How it actually reaches PostHog

1. A visitor lands on `/` or `/asl-alphabet` (or `/app` directly, e.g. a deep link) with UTM
   params on the URL.
2. `attribution.ts`'s `captureAttribution()` (called from both the static pages' inline scripts and
   the app's `main.tsx`) writes two records, same-origin so both marketing pages and the app share
   them:
   - **First-touch** (`localStorage['qs_first_touch']`, write-once) — the channel that *originally*
     brought this browser here. Never overwritten by a later visit.
   - **Session-touch** (`sessionStorage['qs_session_touch']`, overwritten per UTM-bearing load) —
     the channel that drove *this* visit.
3. `client.ts` registers both, flattened and prefixed (`first_touch_utm_source`,
   `session_utm_source`, etc.), as PostHog super properties — every event from every screen from
   that point on carries them, not just the marketing page's own events.
4. `identifyUser()` additionally `$set_once`s the first-touch properties onto the Person profile, so
   the *original* channel survives a later `identify()` (a different device, a re-login).

**In PostHog:** breakdown any funnel or event by `first_touch_utm_source` /
`first_touch_utm_campaign` to answer "which channel produced activated users," not just "which
channel produced clicks" — `landing_view` alone only tells you the latter.

## Canonical format

```
https://quicksignn.vercel.app/?utm_source=<channel>&utm_medium=<medium>&utm_campaign=<campaign>[&utm_content=<variant>]
```

| Param | Required | Values | Notes |
|---|---|---|---|
| `utm_source` | Yes | The platform — `reddit`, `producthunt`, `hackernews`, `discord`, `twitter`, `email`, `share` | Lowercase, no spaces. `share` is reserved for the in-app share loop — don't reuse it for a manual post. |
| `utm_medium` | Yes | `social`, `community`, `referral`, `email` | Broad category, not the platform name again. |
| `utm_campaign` | Yes | `<launch-name>_<date-or-iteration>`, e.g. `beta_launch_2026_08`, `ph_launch` | One per distinct push, not per post — a Reddit post and its Discord cross-post for the SAME announcement share a campaign. |
| `utm_content` | No | Distinguishes two variants of the same campaign/link — e.g. `hero_link` vs `comment_link` for two different placements of the same PH launch post | Use when you need to A/B which specific placement converts, not for every post. |

## Per-channel examples

**Product Hunt** (launch day post + comment link, if they differ):
```
https://quicksignn.vercel.app/?utm_source=producthunt&utm_medium=community&utm_campaign=ph_launch&utm_content=tagline_link
https://quicksignn.vercel.app/?utm_source=producthunt&utm_medium=community&utm_campaign=ph_launch&utm_content=comment_link
```

**Reddit** (one campaign value per distinct post/subreddit, so a bad-performing subreddit is
visible on its own — see `docs/REDDIT_LAUNCH.md` for the actual post plan):
```
https://quicksignn.vercel.app/?utm_source=reddit&utm_medium=social&utm_campaign=r_asl_launch
https://quicksignn.vercel.app/?utm_source=reddit&utm_medium=social&utm_campaign=r_deaf_launch
```

**Hacker News:**
```
https://quicksignn.vercel.app/?utm_source=hackernews&utm_medium=social&utm_campaign=hn_showhn
```

**Discord** (a server announcement or DM):
```
https://quicksignn.vercel.app/?utm_source=discord&utm_medium=community&utm_campaign=beta_launch_2026_08
```

**X/Twitter:**
```
https://quicksignn.vercel.app/?utm_source=twitter&utm_medium=social&utm_campaign=beta_launch_2026_08
```

**Direct-message/email outreach** (not a public post — a personal ask to try it):
```
https://quicksignn.vercel.app/?utm_source=email&utm_medium=email&utm_campaign=beta_launch_2026_08
```

**Deep-linking straight past the pitch:** for a channel where the audience already knows the
product (e.g. a Discord server that's been following development), link to `/app?start=first-sign`
with the same UTM params instead of `/`. `App.tsx` reads `?start=first-sign` to skip the welcome
screen straight to skill selection — the UTMs are still captured the same way regardless of which
page they land on first (`captureAttribution()` runs on `/app` too).

## What NOT to do

- Don't invent a new `utm_source` per post on the same platform — that fragments the channel
  breakdown for no analytical gain. `utm_campaign` (or `utm_content`) is where per-post variation
  belongs.
- Don't reuse `utm_campaign` across genuinely different pushes (e.g. the beta launch and a later
  content-marketing push) — that merges two different questions ("did the launch work" vs "does
  this blog post drive signups") into one number.
- Don't add UTMs to internal links (nav, footer, the app's own links back to itself) — first-touch
  is write-once specifically so an internal navigation can't overwrite a visitor's real acquisition
  channel with "direct."
