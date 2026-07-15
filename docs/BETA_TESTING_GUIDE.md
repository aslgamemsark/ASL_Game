# QuickSign — Beta Testing Guide

Welcome, and thank you for testing QuickSign. This is a **closed beta** (25–100 testers). The app
teaches American Sign Language through your webcam: you sign, and the app tells you — per sign
parameter — what was right and what to fix. Your job as a tester is to use it like a real learner
and tell us where it breaks or frustrates you. Blunt feedback is the most useful feedback.

## What QuickSign is (and isn't)

- It's a **learning aid**, not a certified interpreter. It will sometimes pass a sloppy sign and
  sometimes fail a good one. When that happens, that's exactly the kind of thing we want reported.
- Recognition runs **entirely on your device**. Your video never leaves your computer — only
  anonymized hand-landmark coordinates (never video) are saved, and only if you leave the
  "Help improve the AI" setting on (Settings → Privacy). You can turn it off any time.

## Getting started

1. Open the app link you were sent and sign in (or play as a guest — but signing in saves your
   progress and streak).
2. **Allow camera access** when prompted. Good lighting and a mostly head-on camera angle matter a
   lot — sign in front of a window, not with a bright light behind you.
3. Start with a **Lesson** in the coffee-shop or hospital world. Follow the demo, then sign.
4. Try the other modes once you're comfortable: **Practice**, **Story**, **Speed Challenge**, and
   **Multiplayer** (Duel 1v1 or a Room of up to 4 — needs a friend and a room code).

## What to test, specifically

We especially want eyes on these areas:

- **Recognition accuracy.** Which signs pass too easily? Which refuse to pass even when you're sure
  you're signing them correctly? Name the sign.
- **Camera start-up.** Did the webcam fail to start, freeze, or show a black box? On what
  browser/device?
- **Long sessions.** Play for 15–20 minutes straight. Does it slow down, heat up your device, or get
  choppy?
- **Multiplayer.** Does exactly one player get "SIGN THIS" per round in a Duel? What happens if one
  player closes their tab mid-match, or their wifi drops? Does the timer stay in sync?
- **Refresh / tab-switching.** Switch tabs mid-lesson, or refresh the page. Does your progress
  survive? Does the camera come back?
- **Slow devices / networks.** First load is intentionally heavy (the recognition engine downloads
  to your device). How bad is it on your slowest device?

## How to send feedback (in-app)

The fastest way is built in — no email needed:

> **Settings → Support → "Send feedback / report a problem"**

Pick a category (🐞 bug, 💡 idea, 💬 other), type what happened, and send. It automatically attaches
which screen you were on and your browser info so we can reproduce it — you don't need to describe
your setup. If you're signed in, you can tick **"Send anonymously"** to submit without attaching
your account.

**Good bug reports include:** what you did, what you expected, what actually happened, which sign or
screen, and your browser/device. Screenshots help if it's a visual glitch — you can describe where
in the message.

## Known issues (don't bother reporting these — we know)

These are documented in `docs/KNOWN_LIMITATIONS.md`; the highlights:

- **Some signs are hard on purpose.** HELP and DOCTOR-class signs recognize less reliably — their
  distinguishing handshape reads as "open" to the current engine. Report if they're *worse* than
  "occasionally stubborn," but occasional misses are expected.
- **Room mode (3–4 players) has no disconnect recovery yet.** If someone drops, the round waits for a
  10s timeout. (Duel 1v1 *does* have reconnect/forfeit — test that one hard.)
- **First load is slow**, especially on weak networks — the on-device engine is ~1 MB+. This is the
  price of your video never leaving your device.
- **iOS Safari** camera + multiplayer video is under-tested — expect rough edges there and tell us
  what you hit.
- **No production crash reporting is wired yet**, which is exactly why your reports matter this
  round: if the app white-screens, we may not hear about it unless you tell us.

## Troubleshooting

- **Camera won't start:** check the browser's site permissions (camera allowed?), close other apps
  using the camera (Zoom, Teams), and refresh. Chrome or Edge on desktop is the most reliable combo.
- **Recognition won't pass anything:** improve your lighting and move back so your upper body and
  both hands are in frame. Face the camera.
- **Multiplayer won't connect:** strict corporate/school firewalls can block the peer-to-peer video.
  Try a home network.
- **Something white-screened:** refresh. Then send feedback describing what you were doing right
  before — that's a crash we want.

Thanks again. Every report, even a one-liner, makes the next build better.
