# ASL & User Validation Program — Design Only

**Status: designed, not run.** Nothing in this document has been executed — no recruitment posts published, no testers contacted, no compensation sent, no accounts created on any platform. This is a ready-to-use design for the project owner to launch when they choose, per the mission brief's explicit scope boundary (research/design only for anything outside the QuickSign codebase itself).

## Why this exists

QuickSign's recognition engine, sign selection, and reference clips have never been reviewed by a Deaf person, a fluent hearing signer, or an ASL educator. The rule-verifier architecture (5-parameter scoring, confusor-rejection tests) proves the code does what its own schema says — it says nothing about whether the schema itself is linguistically correct, whether the taught signs are regional/dialect-appropriate, or whether a "correct" pass by the automated verifier would actually read as correct ASL to a native signer. That's a real, unaddressed risk for a product whose entire pitch is teaching real sign language.

## 1. Who to recruit

Three distinct reviewer roles, each catching a different class of problem:

| Role | What they catch | Where the current content most needs it |
|---|---|---|
| **Deaf, native/fluent signer** | Whether a sign as taught/verified is actually correct, natural ASL — not just structurally plausible | Every sign in `data/signs.ts` — especially ones with only one recorded reference clip and no cross-check |
| **Hearing, fluent signer / interpreter** | Same linguistic check, plus can articulate *why* something reads wrong in terms a hearing engineering team can act on | Same as above; also useful for the coaching-hint copy (`gateHint` in `engine/gate.ts`) — does the feedback text make sense to someone learning? |
| **ASL educator / Deaf-studies instructor** | Curriculum sequencing (is "Say Hello" actually a sensible first lesson?), register/formality appropriateness, whether the five-parameter breakdown matches how ASL is actually taught | The world/lesson structure (`data/worlds.ts` or equivalent), the Sign Coach's per-parameter framing itself |

Recruit through: local Deaf community organizations, ASL program instructors at community colleges (many are hearing CODAs or fluent signers themselves and can also refer Deaf colleagues), r/asl or similar community spaces (post *as yourself*, disclosed as the developer, never disguised as a random enthusiast), a state/regional Deaf association's community bulletin. Do **not** recruit through cold DMs to individuals found via social media search — that's the outreach class of action this mission is explicitly not authorized to perform, and it reads as intrusive regardless of authorization.

## 2. Recruitment message (template — not sent)

> Subject: Reviewing an ASL learning app I built — paid, ~30–45 min
>
> Hi — I'm building QuickSign, a free web app that teaches ASL fingerspelling and basic signs using your phone/laptop camera for real-time feedback (not video calls, not a class — it's more like a practice tool). I'd like a Deaf or fluent-signing reviewer to look at a handful of signs and tell me honestly whether they're taught/recognized correctly, and whether the feedback the app gives makes sense. This is a **paid review**, not a favor — [$X, see §5] for about 30–45 minutes of your time, done on your own schedule. No account or camera access required to review; I can send video clips and screenshots, or you're welcome to try the live app if you prefer. Happy to answer questions before you commit to anything. If you know someone else who'd be a good fit, a referral is very welcome too.

Delivered by the project owner from their own identity — never through a persona, never implying an existing relationship, never with urgency pressure.

## 3. What to actually ask a reviewer to evaluate

A structured checklist per sign, not an open-ended "does this look right":

1. **Handshape** — is the taught handshape correct for this sign in the dialect/register you know it in? If there's regional variation, which region does the current version match, and is that disclosed anywhere?
2. **Movement** — does the app's description/reference clip show the correct movement path, timing, and repetition count?
3. **Location** — is the sign positioned correctly relative to the body?
4. **Would you accept this as correct if a hearing student performed it exactly as instructed?** — this is the question that actually matters; a "technically matches the breakdown" sign can still read as wrong ASL to a native signer for reasons the 5-parameter model doesn't capture (fluidity, non-manual markers, context).
5. **Coaching copy** — when the app tells a learner what to fix (e.g. "hold your hand closer to your forehead"), does that read as helpful and accurate, or condescending/confusing/wrong?

Deliverable: one short structured response per sign reviewed (a shared spreadsheet or form works fine), not a long essay — respects the reviewer's time and produces something the eng team can act on directly.

## 4. Feedback flow for regular learners (in-product, not recruited testers)

Separate from the paid expert review above — this is what any learner sees after a session, and IS something the code should eventually support (not yet built):

- **After first success** (ties into the Phase 3 first-sign-in-onboarding work): a single, low-friction "did that feel right?" — thumbs up/down, no required text. Feeds an aggregate signal, not individual triage.
- **Private feedback vs. public review vs. testimonial** — three genuinely different things, currently conflated in `FeedbackModal.tsx` (bug/feature/other categories, always private, admin-only). Before ever surfacing a learner's words publicly (a testimonial, a launch quote, a review), get **explicit, separate, opt-in consent** for that specific use — silence or "they submitted feedback" is not consent to publish. This applies with extra weight to a Deaf contributor's feedback, since publishing it without clear consent risks being read as using someone's identity/expertise as an unpaid endorsement.
- **Compensation for anything beyond a thumbs-up** (a written response, a video, a call): state the amount and payment method up front, pay promptly, and if soliciting testimonials specifically, follow FTC endorsement guidelines — disclose compensation, don't require positive framing as a condition of payment.

## 5. Compensation (amounts to decide, not amounts set here)

This document intentionally does not fix a dollar figure — that's the project owner's budget call. Benchmarks worth knowing: paid user-research sessions for specialized/expert reviewers commonly run $50–150/hour in the US; a Deaf linguistic consultant's expertise is professional expertise, not casual crowd-testing, and should be priced accordingly rather than at a generic "app tester" rate. Whatever the rate, state it in the very first message (§2) — asking someone to commit before knowing the pay is itself a bad-faith pattern to avoid.

## 6. Reference-clip provenance (a real, separate open question)

`data/signs.ts`'s `clip` field points to `/clips/<SIGN>.mp4` for most signs. This audit did not trace where each clip's underlying footage came from, whether the performer consented to its use in a commercial(-adjacent) product, or whether any clips were sourced from copyrighted training datasets (ASL Citizen / WLASL — see `AGENTS.md`'s own licensing caveat about WLASL's non-commercial terms) rather than originally filmed for this app. **This needs a real audit before any commercial launch**, separate from the linguistic-correctness review above: for each clip, who performed it, was consent obtained for this specific use, and does its license (if drawn from a dataset) actually permit inclusion in a shipped, monetized product. See `docs/LICENSING_CHECKLIST.md`, which already flags this class of problem but should be cross-checked specifically against the clips actually shipped in `web/public/clips/`.

## Explicit non-scope (per the mission's own boundary)

Not done, and not to be done under this document's authority: creating any social media account, sending any message to any real person, connecting any OAuth/publishing token, posting any content, or spending any money. This document is ready for the project owner to act on; it is not itself an action.
