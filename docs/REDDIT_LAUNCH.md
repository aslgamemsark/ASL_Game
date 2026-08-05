# Reddit Launch Kit

Single source of truth for the QuickSign Reddit launch: verified research, the actual posts,
a reply playbook, and how to measure whether it worked. Read this top to bottom before posting
anything. Companion to `docs/LAUNCH_STRATEGY.md` (broader launch plan) and `docs/POSTHOG_GUIDE.md`
(analytics).

---

## HANDOFF — read this first if you're picking this up fresh

Everything below §0 is verified, real research from live browsing of the actual subreddits on
2026-07-20 — rules, precedent threads, community reactions, not guesses. Trust it; don't
re-research from scratch unless something looks stale.

**Current blocker, as of 2026-07-20 late evening:** the account that did the research and posted
(`Logical_Strain101`, Saad's) has a **past ban/recovery history** (previously suspended, likely
from a compromise, restored after an email change). That history appears to still be actively
penalized by Reddit's trust system:
- **Messaging is blocked** — every attempt to modmail a subreddit or message a stranger fails
  ("You can't message that user" / "Unable to invite selected invitees").
- **The r/SideProject post was silently spam-filtered.** It's live at
  https://redd.it/1v1o45e and renders normally *to the poster*, but is completely absent from
  r/SideProject's public `/new` listing — confirmed by direct comparison, the classic signature
  of an auto-removed post nobody else can actually see.

**If a friend's account is in good standing (no ban history, real karma), that account should do
the actual posting** — using the exact approved text in §4.1 (already the version that was live,
including the corrected COFFEE example — copy it exactly, it's been fact-checked against the
codebase twice). The r/HardOfHearing and r/languagelearning modmail drafts in §4.2/§4.4 are also
ready to send from a healthier account.

**Non-negotiable rule for whoever posts next: show Saad the exact final title + body and get an
explicit yes before hitting submit or edit on anything public.** This was violated once earlier
in the session (a post went up without a final confirmation) and corrected — don't repeat it.
"Go ahead" in a prior message about a different post does not carry forward to a new one.

**Still off-limits regardless of which account posts:** r/deaf (active moderator ban on this
exact category of post) and r/asl (technically allowed, reflexively hostile in practice — see
§0's live precedent). **r/AskDeaf is a live option worth checking** — found after the original
research, has a genuinely welcoming precedent (§3.1 update below) but gates submissions to
approved users only, so needs a mod-approval message before any post.

### Since the original research (§0–§7 below), also found:

**r/AskDeaf** (not in the original sub list) — real precedent already exists there: *"Thoughts on
a potential ASL practice tool"* (a HoH student's post, 2 months prior to this research) got a
warm, constructive reception — *"I think this is a good idea"*, clarifying questions, no
hostility. Structurally different from r/asl/r/deaf because the whole sub exists for outsiders
(and insiders) to ask questions, not to guard cultural space. **Gate:** sidebar says "Submissions
restricted — only approved users may post." Needs a mod-approval message first, same pattern as
r/HardOfHearing/r/languagelearning.

Also checked and ruled out: r/CODA (dead, wrong audience — already-fluent signers), 
r/AmericanSignLanguage (abandoned, posting locked, redirects to r/asl), r/DeafHOHDating (wrong
purpose), r/DeafTeen (minors, skip), r/NotDeafEnough (real but tiny/low-activity, non-signing
identity space, low priority), r/startups / r/Entrepreneur / r/webdev / r/coding / r/gamedev (all
explicitly ban standalone launch posts — see §3's "Checked 2026-07-20" block).

---

## 0. The headline finding — r/deaf and r/asl are off the launch list

**r/deaf has an active, verbatim, moderator-posted ban on exactly this post.** Pinned announcement
(still pinned, still top of "hot" at time of research):

> *"If you've been tasked with creating a new product to 'help' deaf people. Your post is not
> allowed. If you've created a product to help deaf people, and you want feedback. Your post is
> not allowed."*

The only exceptions require post-secondary IRB-approved research on something *already
established* (not a new product) with participant compensation prepared and prior mod-mail
consent — QuickSign qualifies for none of these. **Do not post to r/deaf. Do not modmail asking
permission — the rule already answers the question.**

**r/asl has no formal ban, but the community reflex is hostile regardless of tone.** Verified via
a live, one-day-old thread at the time of research — UPenn engineering students posting almost
exactly the post we planned: upfront limitations disclosed, explicitly asked "even if the answer
is 'don't build this,'" offered 1:1 calls. Reception:

> *"Don't. Do. The. Gloves."* (top comment, 15 pts)
> *"You're unlikely to get any support in this sub fyi. This type of question has been asked
> dozens of times."*
> *"Not this again."*

One comment broke the pattern: a hearing Penn alum who'd studied ASL validated the concern, then
**offered direct 1:1 help** ("Penn alum to Penn students... I can help direct you to local
resources"). That's the real playbook — broadcast posts get reflexive hostility no matter how
humble; a specific, individual, low-stakes ask can still land.

**Consequence:** launch posts go to learner subs only. Deaf-community input happens later, by
DMing individuals who've publicly offered to help hearing builders — not by posting to r/asl or
r/deaf.

---

## 1. What QuickSign actually ships (verified against code, not memory)

Every number below is traceable to a file. Use these and no others.

- **51 signs**: 26 fingerspelled letters + 25 word signs (`web/src/data/signs.ts`).
- **4 worlds**: Say Hello, Coffee Shop, Hospital, Classroom (`web/src/data/worlds.ts`).
- **16 lessons** across 7 units, **linear progression, no difficulty tiering** — `SkillLevel` is
  collected at onboarding but only picks which home tab opens (`App.tsx`), it doesn't gate content.
- **Recognition**: rule-based geometry engine is authoritative; a small TF.js classifier can only
  **veto** a rule-pass, never grant one (`engine/gate.ts`). Classifier covers 23 of 51 signs,
  **zero letters**, ~66% accuracy.
- **Feedback**: per-parameter checklist (handshape / location / movement, orientation on 7 signs).
  **Facial expression (NMM) is never evaluated on any sign** — typed, never emitted. This is the
  single most important thing to disclose unprompted in any Deaf-community-facing post, ever.
- **Multiplayer**: 1v1 Duel + 4-player Group Room, account-gated, free OpenRelay TURN (no paid
  fallback yet) — do not headline this.
- **Guest mode**: full app usable with no signup; progress persists locally and syncs on sign-in.
- **Privacy**: video never leaves the browser; recognition runs on-device.

**Never claim**: "AI-powered recognition" (it's rules-first, ML is veto-only), "beginner to
advanced" (no tiering exists), "workplaces" (no such world), "personalized learning" (doesn't
exist), full-ASL coverage (no NMM), a demo clip for every sign (41 of 51 have one).

---

## 2. Fixed before launch (2026-07-20)

Two real bugs found during this research and fixed in this session:

1. **MORE/WANT instruction-vs-recognizer mismatch.** For WANT, the on-screen instructions
   ("claw hands pull toward you") were *correct* real ASL — but the recognizer required an open/5
   handshape, so a user following the instructions failed. Fixed by pointing WANT's handshape
   check at the same `claw` scorer already calibrated for EMERGENCY (`web/src/engine/signs/index.ts`).
   For MORE, the recognizer was already correctly calibrated to `flat_o` (flattened-O), but the
   displayed instructions still said "claw" — fixed the display text in `web/src/data/signs.ts`
   to match. Both signs are early Coffee Shop signs; this was the single most likely source of
   "the recognition is too strict" complaints.
2. **Four orphaned signs removed** — RED, YELLOW, WIN, TEAM existed in the recognition engine but
   in no lesson, world, or display data. Removed from `web/src/engine/signs/index.ts` so "51
   signs" is a single, defensible number instead of disagreeing with itself (55 vs 51).

**Manually verified 2026-07-20**: both MORE and WANT signed on camera against the corrected
instructions and pass. WANT's `claw` handshape still has no calibration log or confusor test of
its own (unlike MORE, which has a documented 2026-07-14 calibration run) — reusing the
EMERGENCY-calibrated scorer was a reasoned choice, not a guess, and live confirms it works, but a
real `/calibrate` pass on WANT specifically is still worth doing post-launch to firm up the
threshold with real data rather than a borrowed one.

Verification run: `tsc -b` clean, `vitest run` — 541 passed / 9 todo (no drop), `oxlint src` — no
new warnings, production `build` — clean.

---

## 3. Research findings by subreddit

### r/SideProject — 780k members, ~2.1k daily active. Primary target.

Confirmed live (browsed the actual feed): dozens of "I built X, feedback?" posts per hour, zero
visible friction, matches the documented rules — **Radical Transparency** (don't hide the ugly
parts), **No Landing Page Gates** (show the product, not an email form), **Engage Don't Broadcast**
(reply to every comment or risk removal). Visual content (screenshot/GIF/demo) measurably
outperforms link-only posts.

**Benchmarks** (top 200 posts, trailing 30 days): median top-of-month post = 46 points / 32
comments; top decile clears 266 points. Median winning title ≈ 14 words. Milestone/numbers posts
are rarer (4.5% of top posts) but score highest (median 83).

**Timing**: sub-specific data favors Saturday (18% of top posts) and Friday 12:00 UTC / Thursday
08:00 UTC; generic Reddit data favors Tue–Thu mornings. Aim **Saturday morning ET**, and prioritize
being present to reply for 3–4h over the exact hour.

### r/languagelearning — 3.4M members. Blocked today; needs mod permission first.

Live sidebar rules (verified 2026-07-20), Rule 3: *"Do not submit self-owned content without
permission... see our rules for promotion."* This is a hard permission gate, not an etiquette
norm — posting without modmailing first risks removal. Rule 4 separately disallows "AI language
learning tools or chatbots" as a category, which is a real risk even after permission is granted,
given how easily "small ML assist" gets flattened to "AI tool" by a mod skimming a queue. **Do not
post here without modmailing the moderators first and getting an explicit yes.**

### r/InternetIsBeautiful — hard blocked, drop entirely

Live sidebar rules (verified 2026-07-20). Two rules disqualify QuickSign outright:
- **Rule 6**: "No sites that require personal information... this rule also extends to websites
  that require a webcam in order to function." QuickSign's core mechanic *is* the webcam.
- **Rule 10**: "No AI-Generated Content... or if AI is used to drive functionality." The veto-only
  classifier counts, regardless of how it's framed.

This isn't a tone problem to write around — it's a categorical exclusion. **Do not post here.**

### r/deaf, r/asl — see §0. Off the launch list.

### Checked 2026-07-20, all blocked for a direct launch post

- **r/startups**: "No direct sales, advertisements, or promotional posts of any kind" — only
  exception is the stickied Monthly Share Your Startup thread (comment there, not a standalone post).
- **r/Entrepreneur**: same pattern, plus requires >10 karma to submit a text post at all.
- **r/webdev**: Rule 3 is literally "No self-promotion."
- **r/coding**: Rule 3 is literally "'I made this!' Post" — listed as banned material. Wrong
  category anyway — it's programming-discussion only, not a showcase sub.
- **r/gamedev**: Rule 3 "No Showcasing Projects" — points elsewhere (r/indiegames, r/playmygame).
  Also the wrong category; QuickSign isn't primarily a game.
- **r/HardOfHearing**: no hard ban, but its own sidebar requires messaging the mods first for any
  "HOH-Related Product Informational/Advertisement" post. Real, live, active community — genuinely
  worth pursuing, just needs the same permission step as r/languagelearning. Draft below.

**r/SideProject remains the one sub actually built for this kind of post** — confirmed by how
uniformly everything adjacent to it (dev subs, startup subs) explicitly excludes launch posts and
funnels them back to dedicated project-sharing communities.

---

## 4. The posts

Shared positioning:

> Most ASL apps show you a video and ask you to *recognize* the sign. QuickSign watches you
> *make* it, and tells you which part was wrong.

**Banned across every post:** "AI-powered", "revolutionary", "beginner to advanced",
"personalized", "workplaces", "accessibility-first", "built for the Deaf community". No emoji
feature lists. No keyword repetition — Reddit's own search is weak; visibility comes from early
upvote velocity, not SEO.

### 4.1 r/SideProject — Day 1, Saturday morning ET

**This is the final, fact-checked, actually-posted version** (superseded an earlier draft after a
review pass — see HANDOFF section above for why it needs to be reposted from a different account).
Both inaccuracies from an intermediate GPT-assisted draft were fixed here: the COFFEE example
matches the real sign spec (fist-to-fist grinding rotation, no orientation check exists for
COFFEE), and orientation is not implied as a universal checklist item since it's only checked on
7 of 51 signs.

**Title** (14 words): `You can memorize 200 ASL signs and still have no idea if you're signing them correctly. We tried to fix that.`

**Body:**

> Learning ASL as a beginner is weirdly frustrating. Every app we tried was great at flashcards — recognize the sign, get the point, move on. None of them could answer the question we actually had: "Am I doing this right?"
>
> So over the last several months, two of us (CS students) built QuickSign. It watches you sign on webcam and, instead of one pass/fail, breaks feedback down by what your hands actually did:
>
> Example — signing COFFEE:
>
> ✅ Handshape — both hands in fists
> ❌ Movement — not enough rotation, needs a full grind, not just a tap
>
> → try again →
>
> ✅ Passed
>
> Every sign is checked on handshape, location, and movement. Palm orientation gets checked too, on the signs where it's actually part of the sign.
>
> Runs entirely in your browser. Your camera never leaves your device — nothing uploaded, no install, no signup to try it.
>
> We're in beta, and here's exactly where it's not there yet:
>
> - No facial expression / non-manual markers checked — real ASL grammar we don't evaluate
> - 51 signs (26 letters + 25 words), not a full curriculum
> - It's not "AI-powered" — recognition is a rule engine; a small ML classifier can only veto a pass, and only covers 23 of the 51 signs
> - Neither of us is Deaf — this is practice scaffolding, not instruction
>
> We're a lot more interested in honest criticism than compliments. If you try it:
>
> - Did the feedback actually help, or did it just tell you that you failed?
> - Which sign felt the most unfair?
> - Would something like this have helped you learn?
>
> https://aslgame.vercel.app — free, no signup.

### 4.2 r/languagelearning — on hold, needs mod permission first (see §3)

Their wiki (`wiki/rules_for_promotion`, read in full 2026-07-20) is unusually explicit: **"ALL
self-promotion outside of the monthly stickied thread is allowed only by permission... This is
grounds for instant banning."** The monthly "Share Your Resources" thread reappears on the 4th and
usually runs ~2 weeks — not live as of this check, so the only route today is the formal
permission request, in their exact required format (title prefixed `(self-promotion)`, full post
content pasted in the message, and an argument for why it's not "just another app").

One real, honest caveat baked into their own rules: **"if you are a new user or have not posted on
r/languagelearning, you are far less likely to be given permission."** This account has no history
there — a "please just wait for the sticky thread" reply is a normal, expected outcome, not a
failure.

Two of their stated criteria work in our favor and are worth leading with: (1) **"Apps that
utilise AI as a non-core feature... we allow these"** — true here, the rule engine is authoritative
and the classifier is veto-only; (2) it's free, not vibe-coded in under 6 months, and a genuine
niche (ASL) rather than another generic multi-language clone.

**Modmail sent 2026-07-20** (their required format):

> Hi, I am reaching out to request permission to post my tool. It's a completely free ASL practice
> tool built by two CS students — no account required to try it. It's not another AI-wrapper app:
> recognition is a rule engine that scores hand/pose geometry per sign parameter, and a small ML
> classifier can only veto a rule-pass, never grant one, so AI isn't a core feature. It took real
> engineering time, not a weekend vibe-code. Happy to wait for the resources thread if that's the
> better fit — just didn't want to post cold without asking first.
>
> Title: (self-promotion) The recognition/production gap in sign language — we built a tool that
> only trains production
>
> Content: Comprehension outpaces production in every language, but sign language has almost no
> production-feedback tools because it needs a camera to see what you're doing. We built QuickSign
> to test whether per-parameter feedback (handshape / location / movement scored separately, like
> pronunciation correction for speech) actually helps. It doesn't check facial expression, which is
> real ASL grammar — a known gap we're upfront about. Free, no signup: https://aslgame.vercel.app.
> Genuinely curious what production-feedback tools exist for spoken languages that we should be
> learning from.

Post itself stays on hold until they reply — either a yes, or (more likely, per their own
membership criterion) a redirect to wait for the monthly thread.

### 4.3 r/InternetIsBeautiful — dropped (see §3, hard rule conflict)

### 4.4 r/HardOfHearing — needs mod permission first (see §3)

Real, active community — no formal ban, but the sidebar requires messaging the mods before any
"HOH-Related Product Informational/Advertisement" post. Send this first, wait for a yes:

> Hi — we built a small ASL practice app (QuickSign) as students, not a company. It watches the
> user's hands on webcam and gives feedback on handshape/location/movement — not facial
> expression, which we know is real ASL grammar we don't check. We're not sure it's actually
> useful to people in this community specifically, since a lot of HoH folks don't sign — that's
> genuinely part of what we want to ask. Would a short post asking that question be welcome here,
> and is there anything we should frame differently first?

If approved, the post itself follows the r/asl playbook (§0) — a question, not a pitch, honest
about the audience-fit uncertainty:

**Title**: `Would an ASL hand-shape practice tool be useful to anyone here, or is that the wrong
community?`

Body: two students built it, explain the per-parameter feedback in one line, disclose the NMM gap
up front, then ask directly whether this is useful to HoH folks who sign vs. those who don't —
genuinely uncertain, not rhetorical. Link last, optional.

---

## 5. Reply playbook

r/SideProject can remove a post for ignoring comments — replying is not optional. Never defend,
never spin, concede what's true.

1. **"Does it check facial expressions / NMM?"** — No. Handshape, location, movement only; NMM is
   in the data model but unused. Real limitation, said plainly.
2. **"Is this another sign language glove?"** — No: gloves translate ASL *for hearing people's
   convenience*; this gives a learner feedback on their own practice. Opposite direction.
3. **"Are Deaf people involved?"** — Not yet in the way we want. Flat, unpadded.
4. **"AI can't recognize ASL."** — Agreed; pass/fail is a rule engine over hand geometry, not a
   model. The classifier can only reject.
5. **"Does this replace a teacher?"** — No, and the site says so.
6. **"Is my video uploaded?"** — Never. In-browser recognition; optional replay stays local;
   training-data collection is opt-out in Settings.
7. **"It says I'm wrong when I'm right."** — Ask which sign; this is the loop we want. Have the
   admin panel open.
8. **"Doesn't work on my phone."** — Ask if they opened it inside the Reddit app; point to the
   in-app-browser banner.
9. **"Regional/dialect variation?"** — Real limitation; one form encoded per sign.
10. **"Free? Will you charge?"** — Free right now, beta, no ads. No monetization plans yet — if
    that changes, existing users won't be the ones who find out last. Don't say "never," don't
    claim a commercial plan that doesn't exist yet; both would be overclaiming in the moment.
11. **"51 signs isn't much."** — Correct. Say so.
12. **"You're profiting off Deaf culture."** — No monetization exists. Answer calmly once; don't
    argue past the first reply.

---

## 6. Measurement plan

**Success is not upvotes.** North star: first-lesson completion and Day-2 return. Context: a
*median* r/SideProject top post is 46 points / 32 comments — that level is a normal outcome, not
a failure.

**During the thread (stay 3–4h):** watch the PostHog **Launch Day** dashboard — `landing_view` →
`lesson_started` → first `sign_attempt` with `final_passed=true` → `lesson_completed`. Fix the
biggest drop; don't argue about it in the comments.

**Numbers that mean it worked:**
- landing → lesson_started ≥ ~30%
- lesson_started → lesson_completed ≥ ~40%
- **D2 return ≥ ~15%** — the number that actually matters
- `camera_error` < ~10% of lesson starts
- in-app-browser banner impressions — how much Reddit-app traffic is being rescued

**Kill-switch tree:**
- Camera failing on one browser/OS → don't disable; comment the workaround.
- `multiplayer_ice_failed` spiking → flip `disable_multiplayer` (free OpenRelay TURN, deliberately
  not in any post title, so this is survivable).
- Recognition passing everything/nothing → check the admin **Today's Biggest Problem** card first.
- `ai_model_unavailable` > 0 → recognition still works, rules are authoritative. Say so if asked.

**Day 2 and Day 7:** re-check retention, read all in-app feedback before the next post.

---

## 7. Pre-flight checklist

- [x] MORE/WANT instruction/recognizer mismatch fixed
- [x] Orphaned RED/YELLOW/WIN/TEAM signs removed
- [x] `tsc -b` / `vitest run` (541 passed, 9 todo) / `oxlint` / `build` all clean
- [x] Manually signed MORE and WANT on camera against corrected instructions — confirmed pass
- [x] Read r/languagelearning's and r/InternetIsBeautiful's live sidebar rules — both blocked,
      see §3 (r/languagelearning needs mod permission first; r/InternetIsBeautiful is a hard no)
- [ ] Real-phone tap-through: open the link from inside the Reddit app, confirm the in-app-browser
      banner appears
- [ ] Confirm PostHog Launch Day dashboard renders and is wired before posting
- [ ] Post to r/SideProject

No demo GIF — decided against recording one; the post relies on the written description instead.
