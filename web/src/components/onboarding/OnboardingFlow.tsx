import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { supabaseReady } from '@/lib/supabase';
import { Zippy } from '@/components/shared/Zippy';
import { ZIPPY_LINES } from '@/data/zippy';
import type { SkillLevel } from '@/types/user';

interface Props {
  onComplete: () => void;
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

export function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState<'welcome' | 'auth' | 'skill' | 'done'>('welcome');
  const [selectedLevel, setSelectedLevel] = useState<SkillLevel | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { completeOnboarding } = useUserStore();
  const { user, signInWithGoogle } = useAuth();

  // Covers the Google OAuth redirect-and-return: the page reloads with an active session,
  // so if the user lands back here already signed in, skip straight past the auth step.
  useEffect(() => {
    if (user && step === 'auth') setStep('skill');
  }, [user, step]);

  const handleSkillSelect = (level: SkillLevel) => {
    setSelectedLevel(level);
    completeOnboarding(level);
    setStep('done');
    setTimeout(onComplete, 1400);
  };

  return (
    <div className="min-h-screen bg-z-bg flex items-center justify-center px-6">
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
            <div className="mb-5 flex justify-center">
              <Zippy expression="welcome" size="lg" float priority />
            </div>

            {/* Solid color, not gradient-clipped text: emphasis belongs to weight/color, and the
                TopBar wordmark is the app's single deliberate gradient-text brand mark. */}
            <h1 className="text-4xl font-bold mb-3 text-white">
              Welcome to <span className="text-z-purple-light">Segno</span>
            </h1>
            <p className="text-z-gray-300 text-lg mb-10">{ZIPPY_LINES.welcomeIntro[0]}</p>

            <motion.button
              onClick={() => setStep(supabaseReady ? 'auth' : 'skill')}
              className="w-full py-4 rounded-2xl font-bold text-lg text-white bg-gradient-primary"
              whileHover={{ scale: 1.02, boxShadow: '0 12px 40px rgba(168,85,247,0.45)' }}
              whileTap={{ scale: 0.97 }}
            >
              Get Started →
            </motion.button>
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
                onClick={signInWithGoogle}
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
                onClick={() => setShowAuthModal(true)}
                className="w-full py-3.5 rounded-2xl font-bold text-sm border border-white/15 text-white"
                whileHover={{ scale: 1.02, borderColor: 'rgba(168,85,247,0.5)' }}
                whileTap={{ scale: 0.97 }}
              >
                Sign in with email
              </motion.button>

              <button
                onClick={() => setStep('skill')}
                className="text-z-gray-400 text-sm mt-2 py-3 underline"
              >
                Continue as guest
              </button>
            </div>

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
                  className="w-full rounded-2xl p-4 text-left bg-z-card border border-white/5"
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
                      <p className="font-bold text-white">{s.title}</p>
                      <p className="text-z-gray-400 text-sm">{s.subtitle}</p>
                    </div>
                    <svg className="w-4 h-4 text-z-gray-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
              <Zippy expression="celebrating" size="lg" />
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
