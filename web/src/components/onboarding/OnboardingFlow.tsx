import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { supabaseReady } from '@/lib/supabase';
import { EMAIL_SIGNUP_ENABLED } from '@/config/auth';
import { Zippy } from '@/components/shared/Zippy';
import { ZIPPY_LINES } from '@/data/zippy';
import type { SkillLevel } from '@/types/user';
import { track } from '@/analytics';
import { Button } from '@/components/shared/Button';

interface Props {
  onComplete: () => void;
  /** Where the flow opens. Defaults to 'welcome' for a genuine first run; App passes 'auth' when
   *  routing a just-signed-out user here, so they land on the sign-in/sign-up step directly. */
  initialStep?: 'welcome' | 'auth' | 'skill';
}

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
  const [step, setStep] = useState<'welcome' | 'auth' | 'skill' | 'done'>(initialStep);
  const [selectedLevel, setSelectedLevel] = useState<SkillLevel | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { completeOnboarding } = useUserStore();
  const { user, signInWithGoogle } = useAuth();
  const startedAtRef = useRef(Date.now());

  useEffect(() => { track('onboarding_step_viewed', { step }); }, [step]);

  // Covers the Google OAuth redirect-and-return: the page reloads with an active session,
  // so if the user lands back here already signed in, skip straight past the auth step.
  useEffect(() => {
    if (user && step === 'auth') setStep('skill');
  }, [user, step]);

  const handleSkillSelect = (level: SkillLevel) => {
    track('onboarding_skill_selected', { skill_level: level });
    setSelectedLevel(level);
    completeOnboarding(level);
    finish(level);
  };

  // Takes the just-picked level explicitly rather than reading `selectedLevel` state — called in
  // the same tick as setSelectedLevel(level) above, before that state update has actually applied.
  const finish = (level: SkillLevel) => {
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
            <Button
              onClick={() => setStep(supabaseReady ? 'auth' : 'skill')}
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
            <h2 className="text-2xl font-bold mb-2">Save your progress</h2>
            <p className="text-z-gray-300 text-sm mb-8">
              {ZIPPY_LINES.onboardingAuth[0]}
            </p>

            <div className="flex flex-col gap-3">
              <motion.button
                onClick={() => { track('auth_option_selected', { method: 'google' }); void signInWithGoogle(); }}
                className="w-full py-3.5 rounded-2xl font-bold text-sm bg-white text-gray-900 flex items-center justify-center gap-2.5"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </motion.button>

              <motion.button
                onClick={() => { track('auth_option_selected', { method: 'email' }); setShowAuthModal(true); }}
                className="w-full py-3.5 rounded-2xl font-bold text-sm border border-z-gray-400/30 text-z-gray-50"
                whileHover={{ scale: 1.02, borderColor: 'rgba(168,85,247,0.5)' }}
                whileTap={{ scale: 0.97 }}
              >
                {/* Labelled as a returning-user action, not a signup route: with email signup
                    withdrawn, "Sign in with email" led a brand-new user to a form that cannot
                    create them an account. */}
                {EMAIL_SIGNUP_ENABLED ? 'Sign in with email' : 'Already have an account? Sign in'}
              </motion.button>

              <button
                onClick={() => {
                  track('auth_option_selected', { method: 'guest' });
                  track('guest_started', {});
                  setStep('skill');
                }}
                className="text-z-gray-400 text-sm mt-2 py-3 underline"
              >
                Continue as guest
              </button>
            </div>

            {/* Consent moved here from the old first-paint Terms wall (see App.tsx). Creating an
                account is the legally meaningful moment; a guest gets notice, not a contract.
                Camera/landmark disclosure is separate and lives at the camera itself
                (CameraOnboarding), which is where it is actually actionable. */}
            <p className="text-2xs text-z-gray-400 mt-5 leading-relaxed">
              By creating an account you agree to our Terms &amp; Privacy Policy — readable any time
              in Settings → Privacy &amp; Terms. Your camera video never leaves your device.
            </p>

            {showAuthModal && (
              <AuthModal onClose={() => { setShowAuthModal(false); setStep('skill'); }} />
            )}
          </motion.div>
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
