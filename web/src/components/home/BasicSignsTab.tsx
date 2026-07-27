import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SIGNS } from '@/data/signs';
import { BASIC_SIGN_IDS } from '@/data/basicSigns';
import { SignDetailModal } from './SignDetailModal';
import { useSounds } from '@/hooks/useSounds';

interface Props {
  onStartSignsPractice: (signIds: string[]) => void;
  onTestMemory: (signIds: string[]) => void;
}

export function BasicSignsTab({ onStartSignsPractice, onTestMemory }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedSign = selected ? SIGNS[selected] : undefined;
  const sounds = useSounds();

  return (
    <div className="px-4 pb-24">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold mb-1 tracking-tight">Basic Signs</h2>
        <p className="text-z-gray-300 text-sm mb-4">
          Everyday greetings and courtesy words
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
          onClick={() => onStartSignsPractice(BASIC_SIGN_IDS)}
          className="w-full rounded-2xl p-4 text-left border border-white/5 overflow-hidden relative bg-gradient-violet"
          whileHover={{ scale: 1.02, boxShadow: '0 14px 40px rgba(91,33,182,0.5)' }}
          whileTap={{ scale: 0.97 }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Practice Basic Signs</h3>
              <p className="text-white/80 text-sm mt-0.5">
                {BASIC_SIGN_IDS.length} signs with camera recognition
              </p>
            </div>
            <span className="text-3xl">👋</span>
          </div>
        </motion.button>
      </motion.div>

      {/* Sign list */}
      <h3 className="font-bold text-xs mb-3 text-z-gray-400 uppercase tracking-widest">
        Tap a sign to see it performed
      </h3>
      <div className="flex flex-col gap-2 mb-5">
        {BASIC_SIGN_IDS.map((id, i) => {
          const sign = SIGNS[id];
          return (
            <motion.button
              key={id}
              onClick={() => { sounds.tap(); setSelected(id); }}
              className={`rounded-2xl px-4 py-3.5 text-left font-bold border transition-colors flex items-center justify-between ${
                selected === id
                  ? 'bg-z-purple/30 border-z-purple-light text-z-gray-50'
                  : 'bg-z-card border-white/5 text-z-gray-200'
              }`}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <span>{sign.name.replace(/_/g, ' ')}</span>
              <span className="text-z-gray-500 text-sm">→</span>
            </motion.button>
          );
        })}
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
          onClick={() => { sounds.tap(); onTestMemory([...BASIC_SIGN_IDS].sort(() => Math.random() - 0.5)); }}
          className="w-full rounded-2xl p-4 text-left border border-white/5 overflow-hidden relative bg-gradient-teal"
                   whileHover={{ scale: 1.02, boxShadow: '0 14px 40px rgba(20,184,166,0.4)' }}
          whileTap={{ scale: 0.97 }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Test from Memory</h3>
              <p className="text-white/80 text-sm mt-0.5">
                {BASIC_SIGN_IDS.length} signs on camera · XP + gold
              </p>
            </div>
            <span className="text-3xl">📷</span>
          </div>
        </motion.button>
      </motion.div>

      {/* Sign detail popup */}
      <AnimatePresence>
        {selectedSign && (
          <SignDetailModal
            sign={selectedSign}
            onClose={() => setSelected(null)}
            onTryYourself={(signId) => { setSelected(null); onStartSignsPractice([signId]); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
