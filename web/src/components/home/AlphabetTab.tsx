import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ALPHABET } from '@/data/alphabet';
import { PRACTICEABLE_LETTER_IDS } from '@/data/alphabet';
import { LetterDetailModal } from './LetterDetailModal';
import { useSounds } from '@/hooks/useSounds';

const QUIZ_SIZE = 5;
// A brand-new beginner's very first tap here should land in a real practice session within one
// click, not a 26-letter marathon — the first 5 (A-E) give a quick, completable first win.
// Distinct from QUIZ_SIZE/pickRandomLetters below: this is a fixed starter set for guided
// practice, not a random draw for testing recall.
const FIRST_LETTERS_COUNT = 5;

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
    <div className="px-4 pb-nav-clear">
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
          onClick={() => onStartLettersPractice(PRACTICEABLE_LETTER_IDS.slice(0, FIRST_LETTERS_COUNT))}
          className="w-full rounded-2xl p-4 text-left border border-white/5 overflow-hidden relative bg-gradient-violet"
          whileHover={{ scale: 1.02, boxShadow: '0 14px 40px rgba(91,33,182,0.5)' }}
          whileTap={{ scale: 0.97 }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Practice Letters</h3>
              <p className="text-white/80 text-sm mt-0.5">
                Start with your first {FIRST_LETTERS_COUNT} letters
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
          className="w-full rounded-2xl p-4 text-left border border-white/5 overflow-hidden relative bg-gradient-teal disabled:opacity-50 disabled:cursor-not-allowed"
                   whileHover={quizSize > 0 ? { scale: 1.02, boxShadow: '0 14px 40px rgba(20,184,166,0.4)' } : undefined}
          whileTap={quizSize > 0 ? { scale: 0.97 } : undefined}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Test from Memory</h3>
              <p className="text-white/80 text-sm mt-0.5">
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
