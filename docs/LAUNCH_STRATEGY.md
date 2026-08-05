# QuickSign — Reddit Launch Strategy

> **North star for launch day: not upvotes — the number of people who complete their first lesson
> and come back on day 2.** Every choice below is judged against that, not vanity reach. A 300-upvote
> post that sends 5,000 people to a camera wall is a failure; a 40-upvote post that gets 200 people
> to finish a lesson and 60 of them back tomorrow is a win.

_Last updated 2026-07-20. Pairs with `PROJECT_MEMORY.md` (source of truth) and `docs/POSTHOG_GUIDE.md`._

---

## 1. The single biggest strategic risk (read first)

**QuickSign is a hearing-built ASL tool.** The Deaf community has seen many of these launched with
good intentions and poor cultural humility, and reacts strongly to apps that treat ASL as a gamified
novelty or claim to "teach ASL" without Deaf involvement. This is not a reason not to launch — it's a
reason to **frame with humility and never oversell**. Concretely:
- Do **not** claim QuickSign teaches fluency or replaces a Deaf teacher. Frame it as *practice /
  feedback on individual signs*, a supplement, built by students who want feedback — including from
  Deaf and HoH signers (your landing FAQ already says this; lead with it).
- Launching directly in **r/asl or r/deaf first is high-risk.** Earn credibility in builder/learner
  spaces first; approach Deaf spaces later, humbly, as "we built this, we know we're not the experts,
  we'd value your critique" — never as "check out our cool ASL app."

This one framing decision will do more for (or against) your launch than any title tweak.

---

## 2. Landing page vs. direct app

**Recommendation: Reddit → landing page → app (keep the funnel you have), with one change.**

Reasoning:
- The landing page is where the **in-app-browser banner** (shipped) can catch Reddit-app users
  *before* they hit the camera wall — direct-to-app loses that early catch.
- It sets expectations (camera-based, privacy promise, what the product is) so the people who reach
  the app are pre-qualified → higher first-lesson completion (the north star).
- Cost: one extra click. Worth it for the expectation-setting + in-app catch.

**The one change:** make the landing hero CTA also work as "Try a sign right now" — the lower the
distance from Reddit-click to *first hand-on-camera moment*, the better. Every screen between the
click and the first "✓ you signed HELLO!" is abandonment risk (see §8).

---

## 3. Product framing decisions

| Question | Answer | Why |
|---|---|---|
| Guest mode or forced signup? | **Guest-first, always.** | Forced signup before value is the #1 top-of-funnel killer for Reddit traffic (people are sampling, not committing). Let them finish a lesson, *then* offer signup to save progress. |
| Advertise multiplayer? | **No, not in the title.** Mention in the post body as a bonus. | Multiplayer is on free TURN (will fail for some mobile users under load). Don't headline a feature that might break on launch day. Single-player is the reliable hero. |
| Advertise AI? | **Softly — "real-time feedback", not "AI".** | "AI-powered" is now noise on Reddit and invites "just another AI wrapper" cynicism. Lead with the *concrete benefit*: it tells you exactly which part of your sign is wrong. That's the differentiator; "AI" is the mechanism. |
| Mention two students? | **Yes — it's an asset.** | Reddit rewards authentic indie/student builders; it earns goodwill and softens criticism ("they're students learning, not a company overpromising"). |
| Mention privacy / "camera never leaves your browser"? | **Yes — prominently.** | A camera app on Reddit *will* get "so you're watching me?" comments. Pre-empt it. On-device processing is a genuine, rare trust signal — use it. |
| Mention ASL in the title? | **Yes.** | It's the product and the search/interest hook. Just pair it with the humility framing (§1). |
| Ask for feedback or present? | **Ask for feedback.** | It's an open beta by two students — "we'd love your feedback / what's broken" invites participation, lowers the bar for criticism (you asked), and fits the subreddits that welcome launches. |

---

## 4. Subreddits: sequence, avoid, cross-post

**Launch order (staggered over ~1 week — never blast all at once; it reads as spam and you can't
respond to simultaneous threads):**

1. **r/SideProject** (day 1) — friendliest to indie launches, forgiving, good for a first read on
   messaging + early PostHog funnel data. Low stakes, high signal.
2. **r/InternetIsBeautiful** (day 2–3, only if the first went well) — huge reach for a polished web
   demo; strict "must be a cool website" bar → the landing + instant-try matters here.
3. **r/languagelearning** (day 3–4) — genuinely interested audience; frame as an ASL learning tool,
   lead with the feedback loop.
4. **r/webdev / r/reactjs** (optional) — if you want technical feedback + goodwill; frame as a
   "built this with React + on-device MediaPipe" show-and-tell, not a user pitch.
5. **r/deaf, r/asl** (LAST, and only after you've absorbed feedback) — approach per §1. Humble,
   critique-seeking, no marketing tone. Consider posting as a genuine question, not a launch.

**Avoid / be careful:** r/apple, r/Android (wrong framing), anything where self-promotion is banned
(read rules first — many subs require a mod-approved flair or a specific day). **Never** post the
same title/body to multiple subs on the same day (Reddit's spam filter + human readers both punish it).

**Cross-post?** Prefer *fresh, subreddit-tailored posts* over Reddit's cross-post feature — each
community wants to be spoken to in its own language. Reuse the product, rewrite the framing.

---

## 5. Timing

- **Best days:** Tuesday–Thursday. Avoid Friday–Sunday (lower quality traffic, mods less active).
- **Best time:** ~8–10am US Eastern (catches US morning + Europe afternoon; Reddit's peak US window).
- Post, then **be present for the next 3–4 hours** to reply — early engagement drives the algorithm
  and early replies set the thread's tone. Don't post and disappear.

---

## 6. Titles (10) — story/benefit-driven, not technical

Reddit titles win on *curiosity + concrete benefit + humility*, not feature lists. Lead candidates
first:

1. I built a free tool that watches you sign ASL and tells you exactly what to fix (two students, feedback welcome)
2. We made an ASL practice app that gives you real-time feedback on your handshape and movement — free, no signup, camera stays on your device
3. My friend and I built a free ASL learning game with a webcam "sign coach" — would love brutally honest feedback
4. Practice ASL with instant feedback in your browser — it checks your handshape, location, and movement as you sign
5. Free ASL practice tool: sign into your webcam, it tells you which part of the sign you got wrong
6. Two uni students built a gamified ASL trainer with on-device sign recognition — open beta, tear it apart
7. I wanted to practice ASL but had no one to correct me, so we built a webcam coach that does it
8. Learn ASL by actually signing — free browser app with real-time per-parameter feedback (beta)
9. We built an ASL "Duolingo but you use your hands" — free, private, and we need testers
10. Open beta: a free ASL practice app that grades your signs live from your webcam (no video ever leaves your browser)

**Notes:** #1 and #3 lead because they combine the differentiator (real-time correction) + humility
(students, feedback). Avoid "AI-powered" in the title (§3). Avoid "revolutionary/best" — instant
downvote bait.

---

## 7. Post bodies (5 versions)

Keep them short, honest, benefit-first, with the privacy line and a single clear CTA. Use the one
matching the subreddit.

**A — r/SideProject (builder-friendly):**
> Hey r/SideProject — my friend and I (two uni students) built **QuickSign**, a free web app for
> practicing ASL. The idea: most apps show you a video to copy, but nothing tells you *what you got
> wrong*. QuickSign watches your webcam and gives real-time, per-parameter feedback — handshape,
> location, movement, palm orientation — as you sign.
> Everything runs on-device (your camera never leaves your browser — no video is uploaded). No signup
> needed, just start.
> It's an early beta and we'd genuinely love feedback — what's confusing, what's broken, what's
> missing. [link]
> (We know we're hearing devs building an ASL tool — we're treating this as a supplement/practice
> aid, not a replacement for real instruction, and we'd especially value critique from Deaf/HoH folks.)

**B — r/InternetIsBeautiful (web demo):**
> A free browser tool that turns your webcam into an ASL practice coach — sign into the camera and it
> tells you, in real time, which part of the sign to fix. Runs entirely on-device (nothing uploaded),
> no signup. Built by two students; feedback very welcome. [link]

**C — r/languagelearning (learner audience):**
> If you're learning or curious about ASL: we built a free tool that gives you instant feedback while
> you practice — it scores each part of a sign (handshape/location/movement) so you can self-correct,
> which is the thing you normally can't do without a teacher. On-device, private, no signup. Early
> beta, honest feedback wanted. [link]

**D — r/webdev (technical show-and-tell):**
> Built a real-time ASL sign recognizer that runs 100% in-browser — MediaPipe hand/pose landmarks +
> a rule engine (five ASL sign parameters) with a small veto-only classifier, React 19 + Vite. No
> server-side recognition, camera never leaves the device. It's a free ASL practice app; happy to talk
> architecture, and feedback on the UX is welcome. [link]

**E — r/deaf or r/asl (humble, critique-first — post LAST):**
> We're two hearing CS students who built a free tool to help people practice individual ASL signs
> with webcam feedback. We're very aware ASL isn't ours to "teach," and we don't want to overstate
> what this does — it checks handshape/movement on individual signs, nothing more. We'd really value
> honest critique from this community: where does it get ASL wrong, and is a tool like this helpful or
> harmful in your view? [link]

---

## 8. Predicted funnel abandonment (ranked) + fixes

From highest drop-off to lowest, with the north star (first-lesson completion + D2 return) in mind:

| Rank | Step | Why they leave | Fix |
|---|---|---|---|
| 1 | **Camera permission** | "A camera app? No." + in-app-browser blocks | The privacy line up front (done); in-app banner (done). Consider a "why we need your camera + it never leaves your device" one-liner right at the permission prompt. |
| 2 | **In-app browser (Reddit app)** | getUserMedia blocked → dead end | Banner shipped. **Verify on a real phone** before launch. |
| 3 | **First sign attempt fails repeatedly** | Recognition too strict / bad framing → frustration | Framing guide (done). Watch `sign_attempt` fail-rate by sign in PostHog; if a launch sign has a brutal fail rate, it's a recalibration target. Make the *first* taught sign (HELLO) very forgiving. |
| 4 | **Onboarding length** | Too many steps before value | Keep onboarding to the minimum before the first "✓". Measure `onboarding_step_viewed` drop-off. |
| 5 | **Landing → app click** | Weak CTA / unclear value | Instant-try CTA (§2). |
| 6 | **Day-2 return** | No reason/reminder to come back | Streaks exist; the D2 number is your real KPI — if low, that's the post-launch priority, not more traffic. |

---

## 9. Comment reply templates

- **"So you're recording me / watching me?"**
  > Totally fair question — no. All the sign recognition runs on your own device in your browser; no
  > video or camera data is ever uploaded or stored. You can check the network tab — nothing leaves.
- **"Isn't it problematic for hearing people to build an ASL app?"**
  > We hear you, and we tried to be careful: we don't claim to teach fluency or replace Deaf
  > instruction — it's a practice aid for individual signs. We'd genuinely value your critique on where
  > it falls short; that's a big reason we're posting.
- **"It didn't recognize my sign / it's too strict."**
  > Sorry about that — recognition is the hardest part and still improving. If you can tell us which
  > sign and whether your hands/shoulders were fully in frame, that's super useful. (There's a framing
  > guide that helps a lot.)
- **"Just another AI wrapper."**
  > Fair skepticism! The recognition is actually a rule engine over hand/pose geometry (the five ASL
  > sign parameters), running on-device — the "AI" is a small assist, not a GPT call. Happy to go deeper.
- **"Cool, will there be [feature]?"**
  > Love that idea — noted. We're a two-person beta so we're prioritizing by what testers ask for most;
  > this helps.
- **Harsh criticism that's correct:** thank them, agree specifically, say what you'll do. Never argue.
- **Harsh criticism that's bad-faith/trolling:** don't feed it. One calm reply max, or ignore.

---

## 10. FAQ (pre-write these into your replies)

- **Is it free?** Yes, fully free in beta.
- **Do I need to sign up?** No — guest mode, start immediately. Signup only if you want to save progress.
- **Does it work on mobile?** Yes in a real mobile browser (Chrome/Safari); in-app browsers (opening
  from inside Reddit/Instagram) can block the camera — open it in your browser.
- **What signs does it know?** A growing set across a few themed scenarios (coffee shop, hospital,
  classroom) — it's a beta, not a full curriculum.
- **Is my video stored?** No. On-device only, nothing uploaded.
- **Are Deaf people involved?** Not yet in the way we want — that's a gap we're openly trying to close;
  feedback from Deaf/HoH signers is exactly what we're seeking.

---

## 11. Launch-day checklist

- [ ] Real-phone test: camera works in Chrome (Android) + Safari (iOS), in a real browser.
- [ ] Real Reddit tap-through on a phone: does the in-app-browser banner appear and work?
- [ ] 2-device multiplayer smoke test (or accept the risk and don't headline it).
- [ ] PostHog live: confirm `screen_viewed` / `lesson_started` / `sign_attempt` arriving as production.
- [ ] Kill switches ready (disable_camera/classifier/multiplayer/shop) — know how to flip them.
- [ ] Landing OG image renders when you paste the link (test in Reddit's post preview).
- [ ] Post at Tue–Thu ~8–10am ET to r/SideProject first. Then **stay for 3–4h** and reply.
- [ ] Watch the Activation funnel + error/crash events live for the first few hours.

## 12. First-week checklist

- [ ] Daily: check the Activation funnel (landing → first correct sign → D2 return) and top drop-off.
- [ ] Daily: check `fatal_error` / `session_crashed` / `camera_error` counts by browser/device.
- [ ] Check `sign_attempt` fail-rate by sign — recalibrate any brutal outliers (per `/new-sign`).
- [ ] Check `multiplayer_ice_connected.used_relay` rate → is paid TURN warranted? (runbook §5).
- [ ] Reply to every good-faith comment across threads; collect feature requests.
- [ ] Stagger the next subreddit only if the previous went okay.

---

## 13. Post-launch roadmap (prioritise by data, not guesses)

- **Week 1:** stabilise. Fix the top real bug + the worst funnel drop-off the data shows. Recalibrate
  brutal signs. Decide on paid TURN from `used_relay` data.
- **Week 2:** the biggest *retention* lever the D2 number points to (likely: onboarding shortening,
  first-sign forgiveness, or a comeback hook). Wire `error_captured`. Build the PostHog dashboards.
- **Month 1:** Deaf/HoH outreach for real content review; add most-requested signs; first A/B test
  (see §15). Consider the r/asl humble post now that you have credibility + fixes.
- **Month 3:** content depth (more worlds/signs), retention features that moved the D2/D7 numbers;
  evaluate whether multiplayer earns paid TURN.
- **Month 6:** if retention is real, begin the monetization experiments (§14). Not before — monetizing
  a leaky funnel just caps a small number.

---

## 14. Monetization roadmap (design only — do NOT build pre-launch)

Order reflects lowest-risk-to-trust first. Keep the core practice loop free forever (it's the
acquisition engine and the goodwill anchor, especially given §1).
- **Free tier (permanent):** core lessons + practice + feedback. Never gate the thing that gets users.
- **Premium (individual):** extra worlds/signs, advanced analytics of your own progress, cosmetics,
  offline. ~$3–5/mo. Test only after D7 retention is proven.
- **Teacher tier:** classroom/assignment views, student progress dashboards — this is the most
  defensible wedge (ASL classes exist and need practice tools). Needs the `organization` account work
  (already a typed placeholder in analytics).
- **School / institution licensing:** the real revenue if the teacher tier lands. Long sales cycle.
- **Lifetime purchase:** optional early-supporter one-time price during beta to fund servers (and to
  test willingness-to-pay) — frame as "support two students", not a hard paywall.

---

## 15. Founder review — challenge the plan (independent view)

**What you're likely missing / should add:**
- **A "reason to return tomorrow" is your weakest link, not traffic.** The whole plan optimizes
  acquisition; your north star is retention. Before launch, make sure *something* pulls a user back on
  D2 (a streak nudge, "you're 1 sign from a badge", an email if they signed up). This is higher
  leverage than any title.
- **Instrument "first correct sign" as a first-class funnel step** (you can derive it from
  `sign_attempt` where `final_passed=true` the first time). Time-to-first-success is the single best
  predictor of activation for a skill app — watch it obsessively.
- **You're not collecting *why* people leave.** Add a one-question micro-survey (PostHog survey) on
  exit or after a failed lesson: "what stopped you?" — cheap, and it turns silent churn into a fixable
  list. (PostHog Surveys — set up post-launch.)
- **PostHog Error Tracking** (not just your custom `fatal_error` events) — enable it so launch-day
  exceptions are grouped and triaged automatically. Wire `error_captured` at Supabase/network sites.
- **Cohorts you should create:** "activated" (finished ≥1 lesson), "returned D2", "multiplayer users",
  "in-app-browser hit" — then compare retention across them (e.g. *does multiplayer improve
  retention?* is just retention of the multiplayer cohort vs. not).

**Experiments / A-B tests to prepare (run post-launch, one at a time, gated by the flags now created):**
- Onboarding length: full vs. minimal-before-first-sign (`new_onboarding`). Metric: first-lesson completion.
- First-sign forgiveness: normal vs. extra-lenient HELLO. Metric: first `sign_attempt` success rate.
- Landing: current vs. instant-try CTA. Metric: landing→first-sign conversion.
- Guest signup prompt timing: after lesson 1 vs. lesson 3. Metric: signup rate without hurting completion.

**KPIs to watch during beta (in priority order):**
1. First-lesson completion rate (activation) — the north star's first half.
2. **D2 / D7 return rate** — the north star's second half; the number that decides if you have a product.
3. Time-to-first-correct-sign.
4. `sign_attempt` success rate overall + worst signs.
5. Camera-permission grant rate + in-app-browser hit rate.
6. Crash/error rate by browser/device.
7. Multiplayer `used_relay` (the TURN decision) — only if you push multiplayer.

**What would make QuickSign meaningfully more successful:** relentlessly shorten the path to the first
"✓ you signed it!" moment, make the first signs almost impossible to fail, give one concrete reason to
return tomorrow, and bring Deaf/HoH voices in early enough that the community becomes an advocate
rather than a critic. Retention over reach — every single time.
