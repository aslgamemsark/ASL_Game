# QuickSign — Known Limitations

An honest, user-facing-adjacent list of what QuickSign does **not** do well or at all, so nobody
ships surprised. This is deliberately candid — every item is real and evidenced.

## Recognition (AI)
- **Cross-dataset generalization is limited.** The model recognizes signers who resemble its training
  data (ASL Citizen / WLASL / MS-ASL signers) better than the general public. Held-out test accuracy
  overstates real-world accuracy for atypical signers, lighting, or camera angles. The ML layer is
  veto-only, so this degrades disambiguation, not the core rule-based pass/fail.
- **Some signs are at a rule-verifier ceiling.** HELP and DOCTOR-class signs recognize less reliably
  by design (documented, kept playable as an accepted risk). The distinguishing handshape reads as
  "open" to the current features.
- **RED and WANT are not individually confusor-tested.** They share a movement-threshold block that
  needed tightening for THANK_YOU; they may accept a non-signing motion until calibrated.
- **Recognition needs decent lighting and a mostly-frontal camera.** It is a learning aid, not a
  certified interpreter — it will sometimes pass sloppy signs and fail good ones.

## Multiplayer
- **Room mode (3–4 players) has no disconnect handling.** If a player drops mid-round, the round
  stalls until a 10-second timeout. Duel (1v1) has reconnect/forfeit; rooms do not yet.
- **Video is peer-to-peer (WebRTC).** Behind strict corporate/NAT firewalls, video may fail to
  connect; the fallback TURN server is a free tier not sized for scale.
- **No matchmaking.** Multiplayer is play-with-a-friend via room codes only — there is no "find a
  random opponent."

## Platform / performance
- **First load is heavy.** On-device MediaPipe + TF.js is ~1 MB+ of runtime. This is the deliberate
  price of privacy (no video leaves your device), but it means a slow first paint on poor networks.
- **Not deeply tested across browsers/devices this pass.** iOS Safari camera + WebRTC in particular
  needs real-device verification before relying on it.
- **Hardware/browser Back is wired for top-level screens, dialogs, and the multiplayer hub only**
  (2026-07-30, `useBackDismiss`) — not for step machines *within* a screen. Pressing Back mid-way
  through the onboarding flow's own steps, or while `AuthModal` is showing its "sign up" tab
  instead of "sign in", exits that screen/dialog entirely rather than stepping back one internal
  step. Each of those would need its own `useBackDismiss` adoption; not done broadly this pass
  because it requires auditing every internal step flow app-wide, not just this one bug class.

## Accessibility
- **Not yet WCAG-audited.** Keyboard navigation, screen-reader support, focus management, and
  reduced-motion handling are unverified. The app is also inherently camera- and motion-dependent,
  which limits some access modes.

## Observability
- **No production error monitoring yet.** Crashes users hit are not reported anywhere until this is
  wired.

## Privacy / legal
- **Legal posture for minors is unverified.** Camera-based, appeals to children, collects landmark
  data, training collection defaults on. On-device recognition and consent plumbing exist, but the
  privacy policy, age-appropriate consent, and retention/deletion documentation are not yet complete.

## Data integrity (low impact)
- **Leaderboard cosmetic integrity is client-trusted in two spots.** A technically-savvy user could
  display unearned badges (`showcase_badges`) or spoof speed scores (`speed_high_scores`) via crafted
  API calls. No economy or account-security impact — purely vanity/leaderboard display.
- **Region is self-reportable.** A user can spoof their region string (display-only).

## Avatar
- **The 3D avatar (`/avatarlab`) is a dev-only prototype**, not on the user launch path. Finger/palm-roll
  solving is not implemented (milestone M6+). It has not been reviewed for user-facing readiness.
