import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { supabaseReady } from '@/lib/supabase';
import { EMAIL_SIGNUP_ENABLED } from '@/config/auth';
import { Zippy } from '@/components/shared/Zippy';
import { GoogleIcon } from '@/components/shared/GoogleIcon';
import { ZIPPY_LINES } from '@/data/zippy';
import type { SkillLevel } from '@/types/user';
import { track } from '@/analytics';
import { Button } from '@/components/shared/Button';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { useDialogA11y } from '@/hooks/useDialogA11y';
import { useCamera } from '@/hooks/useCamera';
import { useRecognition } from '@/hooks/useRecognition';
import { useAttemptLog } from '@/hooks/useAttemptLog';
import { WebcamMirror } from '@/components/shared/WebcamMirror';
import { CameraOnboarding } from '@/components/shared/CameraOnboarding';
import { LETTER_A } from '@/engine/signs/index';
import { SIGNS } from '@/data/signs';
import { useFirstRunCameraGuide } from '@/hooks/useFirstRunCameraGuide';
import { ParameterChecklist } from '@/components/lesson/ParameterChecklist';

interface Props {
  onComplete: () => void;
  /** Where the flow opens. Defaults to 'welcome' for a genuine first run; App passes 'auth' when
   *  routing a just-signed-out user here, so they land on the sign-in/sign-up step directly. */
  initialStep?: 'welcome' | 'auth' | 'skill';
}

// Survives a Google OAuth redirect (a full page reload — see the 'auth' step below): the skill
// level is picked BEFORE auth now (value-before-signup reorder, 2026-08-30), so if that in-memory
// state were lost on redirect-return, a Google sign-in mid-onboarding would have to ask again.
// sessionStorage rather than the persisted user store — this is scratch state for one onboarding
// pass, not app data, and must not survive into a later, separate session.
const PENDING_LEVEL_KEY = 'quicksign-onboarding-pending-level';

const SKILLS: {
  level: SkillLevel;
  emoji: string;
  title: string;
  subtitle: string;
  unlocks: string;
}[] = [
  {
    level: 'beginner',
    emoji: '🌱',
    title: 'Just Starting',
    subtitle: "I'm brand new to ASL",
    unlocks: 'Start from the very beginning',
  },
  {
    level: 'intermediate',
    emoji: '🌿',
    title: 'Some Experience',
    subtitle: 'I know a handful of signs',
    unlocks: 'First 2 lessons pre-unlocked',
  },
  {
    level: 'advanced',
    emoji: '🌳',
    title: 'Conversational',
    subtitle: 'I can have basic exchanges',
    unlocks: 'First 4 lessons pre-unlocked',
  },
];

export function OnboardingFlow({ onComplete, initialStep = 'welcome' }: Props) {
  const [step, setStep] = useState<'welcome' | 'auth' | 'skill' | 'firstSign' | 'done'>(initialStep);
  const [selectedLevel, setSelectedLevel] = useState<SkillLevel | null>(() => {
    try { return (sessionStorage.getItem(PENDING_LEVEL_KEY) as SkillLevel | null) ?? null; } catch { return null; }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  // The auth step's own consent notice claimed a Terms & Privacy link "readable any time in
  // Settings → Privacy & Terms" — but that text was never actually a link, and Settings isn't
  // reachable until onboarding finishes, so a guest who wanted to read it before agreeing had no
  // way to. Rendered as a local overlay (not App.tsx's 'privacy' screen route) so backing out of it
  // returns here — routing through App.tsx's screen machine would instead land on 'settings' (see
  // useBackDismiss's privacy case), which is wrong mid-onboarding.
  const [showPrivacy, setShowPrivacy] = useState(false);
  // `active: showPrivacy` since this overlay's JSX below stays inline in this component (not a
  // separately mounted child), matching CameraOnboarding's use of the same hook for the same kind
  // of full-screen, non-ModalShell overlay.
  const privacyDialog = useDialogA11y({ label: 'Privacy & Terms', onClose: () => setShowPrivacy(false), active: showPrivacy });
  const { completeOnboarding } = useUserStore();
  const { user, signInWithGoogle } = useAuth();
  const startedAtRef = useRef(Date.now());

  // First-sign step: value before signup (2026-08-30 reorder) — a brand-new visitor tries one real
  // sign before ever being asked to create an account, using the same camera machinery every other
  // recognition screen uses (LessonPage/PracticePage/StoryPage). No classifier here deliberately:
  // this is a single, generous, static-handshape attempt for someone who has never signed anything
  // before — an ML veto layer (off by default anyway, see config/classifier.ts) has no useful role
  // in a first impression. Letter A: the beginner track's own default first stop (App.tsx routes
  // 'beginner' straight to the Alphabet tab), a static handshape (no timing/movement to get right),
  // and the simplest possible "did that work?" moment.
  const { videoRef, status: camStatus, start: startCam, stop: stopCam } = useCamera('onboarding');
  const [firstSignPassed, setFirstSignPassed] = useState(false);
  const [showCameraOnboarding, setShowCameraOnboarding] = useState(false);
  // Feeds the same shared pipeline every other signing screen uses (LessonPage/PracticePage/etc):
  // fires `sign_attempt` for every rule-pass and, on the genuine first one, `first_sign_success` —
  // the product's real activation event. Before this, the first-sign step (a brand-new visitor's
  // very first camera attempt) was invisible to both: only the onboarding-specific
  // `onboarding_first_sign_passed` fired, so the canonical activation event never recorded a
  // guest's actual first success. Analytics-only here (see useAttemptLog's PERSISTED_SOURCES) —
  // there is usually no account yet at this point in the flow.
  const attemptLog = useAttemptLog({ source: 'onboarding' });
  const recognition = useRecognition({
    screen: 'onboarding',
    onAttempt: attemptLog.recordAttempt,
    onPass: () => {
      if (firstSignPassed) return; // startLoop keeps sampling after a pass; ignore repeats
      setFirstSignPassed(true);
      track('onboarding_first_sign_passed', { sign_id: LETTER_A.name });
      setTimeout(() => advancePastFirstSign(), 1600);
    },
  });
  // Face-target framing guide, same as every other camera screen (LessonPage/PracticePage) —
  // this is a brand-new user's FIRST camera screen ever, so it's arguably more important here
  // than anywhere else: nothing else has taught them yet how far back to sit or that their chest
  // needs to stay visible. Also real diagnostic value for a failed pass — if this box never turns
  // green, hand/pose detection itself isn't succeeding from their distance/lighting, independent
  // of anything about the sign-matching logic.
  const showCamGuide = useFirstRunCameraGuide(recognition.framing?.ok);
  useEffect(() => { recognition.init(); }, [recognition.init]);

  // Guards startLoop to fire ONCE, not on every render this effect (deliberately dependency-array-
  // free, matching LessonPage/StoryPage) re-runs on. startLoop "always stops the previous loop
  // first" — cancels the in-flight rAF tick, clears the rolling buffer, resets the hold-to-pass
  // timer (see useRecognition.ts) — so calling it repeatedly while conditions stay true (which they
  // do for the ENTIRE time a user holds a static sign) never let a single hold survive long enough
  // to reach STATIC_HOLD_SECONDS. Root cause of a real user report ("I made the A sign but nothing
  // happened") — camera displayed and permission worked fine (see the prior commit's video-element
  // fix), but recognition itself could never complete a hold. Found 2026-08-30.
  const loopStartedRef = useRef(false);
  useEffect(() => {
    if (
      step === 'firstSign' && !firstSignPassed && !loopStartedRef.current && camStatus === 'active' &&
      (recognition.status === 'ready' || recognition.status === 'running') && videoRef.current
    ) {
      loopStartedRef.current = true;
      recognition.startLoop(videoRef.current, LETTER_A);
      // Fires once the interactive attempt genuinely begins (the loop is sampling frames), not
      // when the step merely renders (onboarding_step_viewed, above) — a real gap can open between
      // those two when camera permission is slow, and that gap is exactly the friction Phase D of
      // the launch-readiness plan is measuring.
      track('first_sign_started', { sign_id: LETTER_A.name });
    }
    if (step !== 'firstSign' || firstSignPassed) loopStartedRef.current = false;
  });

  // Camera stays off on every step except firstSign — must not linger into auth/done.
  useEffect(() => {
    if (step !== 'firstSign') { stopCam(); recognition.stopLoop(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  useEffect(() => () => { stopCam(); recognition.stopLoop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const beginFirstSign = () => {
    if (!localStorage.getItem('signup-camera-onboarded')) {
      setShowCameraOnboarding(true);
      return;
    }
    void startCam();
  };

  useEffect(() => { track('onboarding_step_viewed', { step }); }, [step]);

  // Covers the Google OAuth redirect-and-return: the page reloads with an active session, so if
  // the user lands back here already signed in, resume past the auth step (skill selection already
  // happened before it in this order — selectedLevel is restored from sessionStorage above since
  // this component itself remounted fresh across the redirect).
  useEffect(() => {
    if (user && step === 'auth') finish(selectedLevel ?? 'beginner');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, step]);

  const handleSkillSelect = (level: SkillLevel) => {
    track('onboarding_skill_selected', { skill_level: level });
    setSelectedLevel(level);
    try { sessionStorage.setItem(PENDING_LEVEL_KEY, level); } catch { /* storage blocked */ }
    setStep('firstSign');
  };

  const advancePastFirstSign = () => {
    if (supabaseReady && !user) setStep('auth');
    else finish(selectedLevel ?? 'beginner');
  };

  // Takes the just-picked level explicitly rather than reading `selectedLevel` state — called from
  // several places (guest/Google/email at the auth step, or directly if Supabase is unconfigured)
  // that may fire before a `setSelectedLevel` from the same tick has actually applied.
  const finish = (level: SkillLevel) => {
    completeOnboarding(level);
    try { sessionStorage.removeItem(PENDING_LEVEL_KEY); } catch { /* storage blocked */ }
    track('onboarding_completed', {
      skill_level: level,
      duration_ms: Date.now() - startedAtRef.current,
    });
    setStep('done');
    setTimeout(onComplete, 1400);
  };

  return (
    // overflow-y-auto: previously relied entirely on the document's own scroll to reach content
    // taller than the viewport. That worked (nothing blocked it), but on a short viewport — a
    // landscape phone, or a browser window resized small — the welcome step's CTA button ended up
    // partially or fully below the fold with zero visual cue that more content existed, since a
    // centered block that overflows equally hides its own "more below" signal. Making the
    // container's own scrollability explicit here is defensive; the height-scoped spacing below is
    // the actual fix, closing the gap outright at common short heights (measured: cut off by 6px
    // at 800x660, 56px at 800x568) rather than just making the resulting scroll more reliable.
    <div className="min-h-dvh bg-z-bg flex items-center justify-center px-6 py-6 overflow-y-auto">
      {/* Hidden source video — required even though WebcamMirror below is what's actually visible.
          WebcamMirror doesn't open its own camera; it mirrors the SAME MediaStream off this
          element's srcObject (see WebcamMirror.tsx's own doc comment: "attach the SAME MediaStream
          the caller's hidden source video already carries"). Without this element in the DOM,
          useCamera's attachStream() has nothing to attach the stream to — getUserMedia still
          succeeds, camStatus still reports 'active', but nothing ever displays and the recognition
          loop's own videoRef.current gate never passes either, so recognition silently never
          starts. Every other camera screen (LessonPage/PracticePage/StoryPage/SpeedChallengePage)
          already renders this; missing here since the firstSign step was added (06aa50c) — found
          2026-08-30 from a real user report ("the camera isn't working").  */}
      <video
        ref={videoRef}
        style={{ width: 0, height: 0, opacity: 0, position: 'fixed', pointerEvents: 'none' }}
        muted
        playsInline
        autoPlay
      />
      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            className="text-center max-w-sm w-full"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="mb-5 [@media(max-height:700px)]:mb-2 flex justify-center">
              <Zippy expression="welcome" size="xl" float priority />
            </div>

            {/* Solid color, not gradient-clipped text: emphasis belongs to weight/color, and the
                TopBar wordmark is the app's single deliberate gradient-text brand mark. */}
            <h1 className="text-4xl font-bold mb-1 text-z-gray-50">
              Welcome to <span className="text-z-purple-light">QuickSign</span>
            </h1>
            {/* Full opacity, not /80 (found 2026-07-30): the 80%-alpha version measured 3.37:1 in
                the light theme and only 4.91:1 in dark — a thin-enough margin that it flickered
                between pass/fail across engines. Reducing contrast via text alpha is the same
                mechanism as a token tuned to exactly the AA floor (see index.css's z-yellow/
                z-gray-400 comments) — it has no headroom for anything. */}
            <p className="text-z-purple-light text-sm font-semibold tracking-wide uppercase mb-4">Beyond Words</p>
            <p className="text-z-gray-300 text-lg mb-10 [@media(max-height:700px)]:mb-4">{ZIPPY_LINES.welcomeIntro[0]}</p>

            {/* The app's single most important button (the first thing every new user taps) keeps
                its own hover glow rather than Button's default — a deliberate flourish, not drift. */}
            {/* Always to 'skill' now, never straight to 'auth' — value before signup (2026-08-30
                reorder): a new visitor picks their level and tries a real sign before ever being
                asked to create an account. supabaseReady no longer branches here; it still governs
                whether 'auth' is reachable at all, later, after firstSign. */}
            <Button
              onClick={() => setStep('skill')}
              size="lg"
              fullWidth
              whileHover={{ scale: 1.02, boxShadow: '0 12px 40px rgba(168,85,247,0.45)' }}
            >
              Get Started →
            </Button>
          </motion.div>
        )}

        {step === 'auth' && (
          <motion.div
            key="auth"
            className="text-center max-w-sm w-full"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="flex justify-center mb-3">
              <Zippy expression="teaching" size="md" />
            </div>
            {/* Was "Save your progress" as the heading with guest demoted to a small underlined
                text link below two account buttons — the exact anti-pattern this reorder exists to
                fix (auth as a wall before any value, guest as an afterthought). Now shown only
                AFTER a real first sign passed, so "keep this" is a real, true offer, not a promise
                on spec — and guest is the primary button, account creation the secondary offer,
                matching what most visitors will actually do. */}
            <h2 className="text-2xl font-bold mb-2">Nice work! Keep it saved?</h2>
            <p className="text-z-gray-300 text-sm mb-8">
              {ZIPPY_LINES.onboardingAuth[0]}
            </p>

            <div className="flex flex-col gap-3">
              <motion.button
                onClick={() => {
                  track('auth_option_selected', { method: 'guest' });
                  track('guest_started', {});
                  finish(selectedLevel ?? 'beginner');
                }}
                className="w-full py-3.5 rounded-2xl font-bold text-sm bg-white text-gray-900 flex items-center justify-center gap-2.5"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                Continue as guest
              </motion.button>

              <motion.button
                onClick={() => { track('auth_option_selected', { method: 'google' }); void signInWithGoogle(); }}
                className="w-full py-3.5 rounded-2xl font-bold text-sm border border-z-gray-400/30 text-z-gray-50 flex items-center justify-center gap-2.5"
                whileHover={{ scale: 1.02, borderColor: 'rgba(168,85,247,0.5)' }}
                whileTap={{ scale: 0.97 }}
              >
                <GoogleIcon size={18} />
                Continue with Google
              </motion.button>

              <button
                onClick={() => { track('auth_option_selected', { method: 'email' }); setShowAuthModal(true); }}
                className="text-z-gray-400 text-sm mt-1 py-2 underline"
              >
                {/* Labelled as a returning-user action, not a signup route: with email signup
                    withdrawn, "Sign in with email" led a brand-new user to a form that cannot
                    create them an account. */}
                {EMAIL_SIGNUP_ENABLED ? 'Sign in with email' : 'Already have an account? Sign in'}
              </button>
            </div>

            {/* Consent moved here from the old first-paint Terms wall (see App.tsx). Creating an
                account is the legally meaningful moment; a guest gets notice, not a contract.
                Camera/landmark disclosure is separate and lives at the camera itself
                (CameraOnboarding), which is where it is actually actionable — and covers the
                multiplayer exception ("never leaves your device" doesn't hold for Duel/Room, where
                video streams live to your opponent), so this notice doesn't repeat that claim. */}
            <p className="text-2xs text-z-gray-400 mt-5 leading-relaxed">
              By creating an account you agree to our{' '}
              <button
                type="button"
                onClick={() => setShowPrivacy(true)}
                className="underline hover:text-z-gray-200"
              >
                Terms &amp; Privacy Policy
              </button>
              , also readable any time in Settings → Privacy &amp; Terms.
            </p>

            {showAuthModal && (
              <AuthModal onClose={() => { setShowAuthModal(false); finish(selectedLevel ?? 'beginner'); }} />
            )}
          </motion.div>
        )}

        {showPrivacy && (
          <div ref={privacyDialog.ref} {...privacyDialog.props} className="fixed inset-0 z-overlay outline-none">
            <PrivacyPage onExit={() => setShowPrivacy(false)} />
          </div>
        )}

        {step === 'skill' && (
          <motion.div
            key="skill"
            className="max-w-sm w-full"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="flex justify-center mb-3">
              <Zippy expression="thinking" size="md" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">How much ASL do you know?</h2>
            <p className="text-z-gray-400 text-sm text-center mb-8">
              {ZIPPY_LINES.onboardingSkill[0]}
            </p>

            <div className="flex flex-col gap-3">
              {SKILLS.map((s, i) => (
                <motion.button
                  key={s.level}
                  onClick={() => handleSkillSelect(s.level)}
                  className="w-full rounded-2xl p-4 text-left bg-z-card border border-z-gray-400/20"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{
                    scale: 1.02,
                    borderColor: 'rgba(168,85,247,0.5)',
                    boxShadow: '0 8px 30px rgba(168,85,247,0.2)',
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{s.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-z-gray-50">{s.title}</p>
                      <p className="text-z-gray-400 text-sm">{s.subtitle}</p>
                    </div>
                    <svg className="w-4 h-4 text-z-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                  <p className="text-xs text-z-purple-glow mt-2 pl-12">{s.unlocks}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'firstSign' && (
          <motion.div
            key="firstSign"
            className="max-w-sm w-full text-center"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {camStatus === 'denied' || camStatus === 'error' || camStatus === 'stalled' ? (
              // Mirrors LessonPage.tsx's camera-failure card (same three states, same recovery
              // action) — this step previously kept showing the generic "Turn on camera" button
              // here, which on a hard permission denial just silently re-fails: getUserMedia()
              // rejects instantly without ever showing the browser's prompt again, so a user who
              // denied by mistake had no way to tell what to do next. Found in the launch-readiness
              // audit (2026-08-31) — this is a first-time visitor's FIRST camera screen ever, so a
              // dead end here is the worst possible place for one.
              <div className="rounded-2xl border border-z-red/30 bg-z-red/10 p-4 text-center">
                <p className="text-sm font-bold text-z-red">
                  {camStatus === 'denied'
                    ? 'Camera access denied'
                    : camStatus === 'error'
                      ? 'Camera unavailable'
                      : "Camera feed isn't showing"}
                </p>
                <p className="text-xs text-z-gray-300 mt-1">
                  {camStatus === 'denied'
                    ? 'Your first sign needs camera access. Allow it in your browser’s site settings (usually the icon left of the address bar), then try again.'
                    : camStatus === 'error'
                      ? 'Something went wrong starting the camera. Try again, or check that no other app is using it.'
                      : "Your camera is on but no picture is coming through. Try again, or check that no other app is using it."}
                </p>
                <button
                  onClick={() => { recognition.init(); stopCam(); void startCam(); }}
                  className="mt-3 text-xs font-bold text-z-gray-50 bg-z-red/40 hover:bg-z-red/50 px-4 py-2 rounded-lg"
                >
                  Try again
                </button>
                <button
                  onClick={advancePastFirstSign}
                  className="block mx-auto text-z-gray-400 text-sm mt-3 py-1 underline"
                >
                  Skip for now — I'll try this later
                </button>
              </div>
            ) : camStatus !== 'active' ? (
              <>
                <div className="flex justify-center mb-3">
                  <Zippy expression="teaching" size="md" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Try your first sign</h2>
                <p className="text-z-gray-300 text-sm mb-8">
                  Let's see if it works — no account needed. We'll teach you the letter A.
                </p>
                <Button onClick={beginFirstSign} size="lg" fullWidth>
                  Turn on camera
                </Button>
                <button
                  onClick={advancePastFirstSign}
                  className="text-z-gray-400 text-sm mt-3 py-2 underline"
                >
                  Skip for now
                </button>
              </>
            ) : (
              <>
                <p className="font-bold text-lg mb-1">
                  {firstSignPassed ? 'You got it! 🎉' : 'Sign the letter A'}
                </p>
                <p className="text-z-gray-400 text-sm mb-4">
                  {firstSignPassed ? 'That\'s ASL fingerspelling — you just did your first sign.' : SIGNS.LETTER_A.hint}
                </p>
                <div className="flex justify-center mb-4">
                  <WebcamMirror
                    videoRef={videoRef}
                    label="You"
                    passed={firstSignPassed}
                    frameGuide={showCamGuide ? recognition.framing : null}
                  />
                </div>
                {/* Live per-parameter feedback — same "Sign Coach" component every other camera
                    screen uses. Was missing here entirely, so a struggling first-time user had no
                    visible signal that anything was being measured at all, let alone how close they
                    were — "I made the sign and nothing happened" gives a real user no way to tell
                    "handshape scored 0.3" from "the app isn't looking at all." Added 2026-08-30. */}
                {recognition.result && !firstSignPassed && (
                  <div className="mb-4 text-left">
                    <ParameterChecklist
                      params={recognition.result.params}
                      sign={LETTER_A}
                      holdProgress={recognition.holdProgress}
                    />
                  </div>
                )}
                {!firstSignPassed && (
                  <button
                    onClick={advancePastFirstSign}
                    className="text-z-gray-400 text-sm py-2 underline"
                  >
                    Skip for now
                  </button>
                )}
              </>
            )}

            {showCameraOnboarding && (
              <CameraOnboarding
                onContinue={() => {
                  localStorage.setItem('signup-camera-onboarded', '1');
                  setShowCameraOnboarding(false);
                  void startCam();
                }}
                onCancel={() => setShowCameraOnboarding(false)}
              />
            )}
          </motion.div>
        )}

        {step === 'done' && (
          <motion.div
            key="done"
            className="text-center"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="mb-4 flex justify-center">
              <Zippy expression="celebrating" size="xl" />
            </div>
            {/* Was reusing the skill-level TITLE ("Just Starting"/"Some Experience"/
                "Conversational") as the celebratory headline — read as a non-sequitur, restating
                the user's own self-assessment as if it were an achievement, not a congratulation
                (first-time-user pass, 2026-07-12). A real celebratory line + their choice as
                smaller context reads correctly regardless of which level they picked. */}
            <h2 className="text-2xl font-bold">You're all set!</h2>
            <p className="text-z-gray-300 mt-2">
              Starting at <span className="text-z-purple-light font-semibold">
                {SKILLS.find(s => s.level === selectedLevel)?.title ?? 'the beginning'}
              </span> — let's sign! 🤟
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
