import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ALPHABET } from '@/data/alphabet';
import { PRACTICEABLE_LETTER_IDS } from '@/data/alphabet';

interface Props {
  onStartLettersPractice: (signIds: string[]) => void;
}

export function AlphabetTab({ onStartLettersPractice }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedDef = ALPHABET.find(l => l.letter === selected);

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
            onClick={() => setSelected(def.letter === selected ? null : def.letter)}
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
            {def.signId && (
              <span className="text-[7px] text-z-purple-glow leading-none">●</span>
            )}
          </motion.button>
        ))}
      </div>

      <p className="text-z-gray-500 text-[11px] mb-5">
        ● = camera practice available ({PRACTICEABLE_LETTER_IDS.length}/26 letters)
      </p>

      {/* Detail card */}
      <AnimatePresence>
        {selectedDef && (
          <motion.div
            key={selectedDef.letter}
            className="rounded-2xl p-5 bg-z-card border border-white/5"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22 }}
          >
            <div className="flex items-center gap-4 mb-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-bold flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(123,47,190,0.2), rgba(168,85,247,0.3))',
                  border: '1px solid rgba(168,85,247,0.3)',
                }}
              >
                {selectedDef.letter}
              </div>
              <div>
                <p className="text-z-gray-400 text-[10px] uppercase tracking-widest">Handshape</p>
                <p className="font-bold text-z-gray-50">{selectedDef.handshape}</p>
                {selectedDef.signId ? (
                  <span className="text-[11px] text-z-purple-glow">● Camera practice available</span>
                ) : (
                  <span className="text-[11px] text-z-gray-500">Browse only</span>
                )}
              </div>
            </div>
            <p className="text-z-gray-200 text-sm mb-2 leading-relaxed">{selectedDef.description}</p>
            <div className="flex items-start gap-2">
              <span className="text-base flex-shrink-0">💡</span>
              <p className="text-z-yellow text-sm italic">{selectedDef.hint}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!selectedDef && (
        <div className="text-center py-4 text-z-gray-500 text-sm">
          Tap any letter above to see its handshape
        </div>
      )}
    </div>
  );
}
