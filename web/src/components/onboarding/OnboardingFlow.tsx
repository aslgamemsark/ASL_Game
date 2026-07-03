import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/stores/useUserStore';
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
  const [step, setStep] = useState<'welcome' | 'skill' | 'done'>('welcome');
  const [selectedLevel, setSelectedLevel] = useState<SkillLevel | null>(null);
  const { completeOnboarding } = useUserStore();

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
            <motion.div
              className="text-8xl mb-6 inline-block"
              animate={{ rotate: [0, -12, 12, -8, 8, 0], scale: [1, 1.12, 1] }}
              transition={{ duration: 1.2, delay: 0.3 }}
            >
              🤟
            </motion.div>

            {/* Solid color, not gradient-clipped text: emphasis belongs to weight/color, and the
                TopBar wordmark is the app's single deliberate gradient-text brand mark. */}
            <h1 className="text-4xl font-bold mb-3 text-white">
              Welcome to <span className="text-z-purple-light">SignUp</span>
            </h1>
            <p className="text-z-gray-300 text-lg mb-10">Your journey into ASL starts here</p>

            <motion.button
              onClick={() => setStep('skill')}
              className="w-full py-4 rounded-2xl font-bold text-lg text-white"
              style={{ background: 'linear-gradient(135deg, #7B2FBE, #A855F7)' }}
              whileHover={{ scale: 1.02, boxShadow: '0 12px 40px rgba(168,85,247,0.45)' }}
              whileTap={{ scale: 0.97 }}
            >
              Get Started →
            </motion.button>
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
            <h2 className="text-2xl font-bold text-center mb-2">How much ASL do you know?</h2>
            <p className="text-z-gray-400 text-sm text-center mb-8">
              We'll pick the right starting point for you
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
            <motion.div
              className="text-7xl mb-4 inline-block"
              animate={{ rotate: [0, -15, 15, -10, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6 }}
            >
              🎉
            </motion.div>
            <h2 className="text-2xl font-bold">
              {SKILLS.find(s => s.level === selectedLevel)?.title ?? 'Ready!'}
            </h2>
            <p className="text-z-gray-300 mt-2">Let's sign! 🤟</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
