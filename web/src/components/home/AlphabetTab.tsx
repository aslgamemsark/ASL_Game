import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ALPHABET } from '@/data/alphabet';
import { PRACTICEABLE_LETTER_IDS } from '@/data/alphabet';
import { LetterDetailModal } from './LetterDetailModal';
import { useSounds } from '@/hooks/useSounds';

const QUIZ_SIZE = 5;

function pickRandomLetters(count: number): string[] {
  const shuffled = [...PRACTICEABLE_LETTER_IDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

interface Props {
  onStartLettersPractice: (signIds: string[]) => void;
  onTestMemory: (signIds: string[]) => void;
}

export function AlphabetTab({ onStartLettersPractice, onTestMemory }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedDef = ALPHABET.find(l => l.letter === selected);
  const sounds = useSounds();
  const quizSize = Math.min(QUIZ_SIZE, PRACTICEABLE_LETTER_IDS.length);

  return (
    <div className="px-4 pb-24">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold mb-1 tracking-tight">Alphabet</h2>
        <p className="text-z-gray-300 text-sm mb-4">
          ASL fingerspelling A–Z
        </p>
      </motion.div>

      {/* Practice button */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="mb-5"
      >
        <motion.button
          onClick={() => onStartLettersPractice(PRACTICEABLE_LETTER_IDS)}
          className="w-full rounded-2xl p-4 text-left border border-white/5 overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #7B2FBE, #A855F7)' }}
          whileHover={{ scale: 1.02, boxShadow: '0 14px 40px rgba(91,33,182,0.5)' }}
          whileTap={{ scale: 0.97 }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Practice Letters</h3>
              <p className="text-purple-200 text-sm mt-0.5">
                {PRACTICEABLE_LETTER_IDS.length} letters with camera recognition
              </p>
            </div>
            <span className="text-3xl">🔤</span>
          </div>
        </motion.button>
      </motion.div>

      {/* Letter grid */}
      <h3 className="font-bold text-xs mb-3 text-z-gray-400 uppercase tracking-widest">
        Tap a letter to learn the handshape
      </h3>
      <div className="grid grid-cols-5 gap-2 mb-5">
        {ALPHABET.map((def, i) => (
          <motion.button
            key={def.letter}
            onClick={() => { sounds.tap(); setSelected(def.letter); }}
            className={`aspect-square rounded-2xl font-bold text-xl flex flex-col items-center justify-center gap-0.5 border transition-colors ${
              selected === def.letter
                ? 'bg-z-purple/30 border-z-purple-light text-z-gray-50'
                : 'bg-z-card border-white/5 text-z-gray-200'
            }`}
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.018 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            {def.letter}
          </motion.button>
        ))}
      </div>

      {/* Test from memory */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h3 className="font-bold text-xs mb-3 text-z-gray-400 uppercase tracking-widest">
          Ready to test yourself?
        </h3>
        <motion.button
          onClick={() => { sounds.tap(); onTestMemory(pickRandomLetters(QUIZ_SIZE)); }}
          disabled={quizSize === 0}
          className="w-full rounded-2xl p-4 text-left border border-white/5 overflow-hidden relative disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #0F766E, #14B8A6)' }}
          whileHover={quizSize > 0 ? { scale: 1.02, boxShadow: '0 14px 40px rgba(20,184,166,0.4)' } : undefined}
          whileTap={quizSize > 0 ? { scale: 0.97 } : undefined}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Test from Memory</h3>
              <p className="text-teal-100 text-sm mt-0.5">
                {quizSize} random letters on camera · XP + gold
              </p>
            </div>
            <span className="text-3xl">📷</span>
          </div>
        </motion.button>
      </motion.div>

      {/* Letter detail popup */}
      <AnimatePresence>
        {selectedDef && (
          <LetterDetailModal
            def={selectedDef}
            onClose={() => setSelected(null)}
            onTryYourself={(signId) => { setSelected(null); onStartLettersPractice([signId]); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
