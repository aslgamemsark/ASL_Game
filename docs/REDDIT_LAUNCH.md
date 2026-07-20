# Reddit Launch Kit

Single source of truth for the QuickSign Reddit launch: verified research, the actual posts,
a reply playbook, and how to measure whether it worked. Read this top to bottom before posting
anything. Companion to `docs/LAUNCH_STRATEGY.md` (broader launch plan) and `docs/POSTHOG_GUIDE.md`
(analytics).

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

### r/languagelearning — 3.4M members. Self-promo allowed *with conditions*.

Rule: *"Do not submit self-owned content too frequently."* Mechanism (weekly thread vs. flair vs.
mod approval vs. ratio) unconfirmed — **check the live sidebar before posting**, this is the
largest sub on the list and the easiest to get auto-removed from.

### r/InternetIsBeautiful — rules not independently confirmed this pass

Assume strict title format and heavy anti-self-promo moderation. Read the sidebar manually before
posting; keep the post to two sentences, no marketing voice, no "we."

### r/deaf, r/asl — see §0. Off the launch list.

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

**Title** (14 words): `Two CS students built an ASL trainer that tells you which part of your sign was wrong`

**Body:**

> Every ASL app we tried was flashcards — you can recognize 200 signs and still not be able to
> produce one. Nothing watched our hands.
>
> **What it does**: 51 signs (26 letters + 25 words) across 4 scenario worlds. Feedback is broken
> out by handshape / location / movement, not a single green check. Runs in the browser, guest
> mode, no install, no email gate.
>
> **How it works**: MediaPipe hand+pose landmarks → a rule engine scoring each sign parameter
> against a data-defined spec → a small TF.js classifier that can only *veto* a pass, never grant
> one. Movement signs validate over a ~1.5s rolling window — our first version passed two static
> fists as COFFEE, which taught us that lesson the hard way.
>
> **The ugly parts, since we'd rather say them first**: it doesn't check facial expression, which
> is real ASL grammar — a known, unsolved gap. 51 signs is not a curriculum. The ML assist covers
> 23 of 51 signs and zero letters. Neither of us is Deaf. We just fixed two signs whose written
> instructions contradicted what the recognizer actually checked for.
>
> If you try it — did the feedback tell you something useful, or just tell you that you failed?
> That's the whole bet and I genuinely don't know yet.
>
> [link] — free, no signup needed.

### 4.2 r/languagelearning — Day 3–4 (check self-promo mechanism first)

**Title**: `The recognition/production gap in sign language — we built a tool that only trains production`

Pedagogy hook: comprehension outpaces production in every language, but sign language has almost
no production-feedback tools because it needs a camera. Frame per-parameter feedback as the
sign-language analogue of pronunciation correction. Ask what production-feedback tools exist for
*spoken* languages worth stealing ideas from. Link at the bottom.

### 4.3 r/InternetIsBeautiful — Day 2–3 (read the title rules first)

**Title**: `A site that watches your webcam and tells you which part of your ASL sign was wrong`

Body: what it does in one line, privacy in one line ("nothing is uploaded"), link. Nothing else —
this sub punishes marketing voice.

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
10. **"Free? Will you charge?"** — Free, beta, no ads, no data selling.
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
- [ ] Real-phone tap-through: open the link from inside the Reddit app, confirm the in-app-browser
      banner appears
- [ ] Read r/languagelearning's and r/InternetIsBeautiful's live sidebar rules
- [ ] Confirm PostHog Launch Day dashboard renders and is wired before posting
- [ ] Pick the actual posting day (Saturday morning ET recommended for r/SideProject)

No demo GIF — decided against recording one; the post relies on the written description instead.
