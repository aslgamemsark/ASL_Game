import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SIGNS } from '@/data/signs';
import { LESSON_UNITS } from '@/data/lessons';
import { useUserStore } from '@/stores/useUserStore';

interface Props {
  onStartPractice: () => void;
  onStartWeakPractice: (signIds: string[]) => void;
}

// Groups every taught (non-letter) sign by the lesson `scenario` tag it first appears under —
// derived from LESSON_UNITS so this never drifts out of sync with the actual curriculum. Letters
// get their own dedicated "Alphabet" dropdown instead of being scattered across scenarios.
const SCENARIO_LABELS: Record<string, string> = {
  greetings: 'Greetings',
  coffee_shop: 'Coffee Shop',
  hospital: 'Hospital',
  classroom: 'Classroom',
};

function buildScenarioGroups(): { key: string; label: string; signIds: string[] }[] {
  const byScenario = new Map<string, Set<string>>();
  for (const unit of LESSON_UNITS) {
    for (const node of unit.nodes) {
      if (!byScenario.has(node.scenario)) byScenario.set(node.scenario, new Set());
      const set = byScenario.get(node.scenario)!;
      for (const id of node.signIds) {
        if (!id.startsWith('LETTER_')) set.add(id);
      }
    }
  }
  return Object.entries(SCENARIO_LABELS).map(([key, label]) => ({
    key,
    label,
    signIds: Array.from(byScenario.get(key) ?? []),
  }));
}

const SCENARIO_GROUPS = buildScenarioGroups();
const ALPHABET_IDS = Object.keys(SIGNS).filter((id) => id.startsWith('LETTER_')).sort();
// Safety net: any sign not covered by a scenario grouping or the alphabet (e.g. added later
// without a lesson yet) still shows up somewhere instead of silently vanishing from Review.
const GROUPED_IDS = new Set([...SCENARIO_GROUPS.flatMap((g) => g.signIds), ...ALPHABET_IDS]);
const OTHER_IDS = Object.keys(SIGNS).filter((id) => !GROUPED_IDS.has(id));

function SignChip({ id, name, accuracy, isWeak }: { id: string; name: string; accuracy: number | null; isWeak: boolean }) {
  return (
    <div
      key={id}
      className={`border rounded-xl p-3 text-center ${
        isWeak ? 'bg-z-orange/10 border-z-orange/20' : 'bg-z-card border-white/5'
      }`}
    >
      <p className="font-semibold text-xs truncate text-z-gray-100">{name.replace(/_/g, ' ')}</p>
      {accuracy !== null ? (
        <p className={`text-[11px] mt-1 font-bold ${accuracy >= 70 ? 'text-z-green' : 'text-z-orange'}`}>
          {accuracy}%
        </p>
      ) : (
        <p className="text-[11px] mt-1 text-z-gray-500">—</p>
      )}
    </div>
  );
}

function ScenarioDropdown({ label, signIds }: { label: string; signIds: string[] }) {
  const [open, setOpen] = useState(false);
  const { signAccuracy } = useUserStore();

  if (signIds.length === 0) return null;

  return (
    <div className="mb-2 rounded-2xl border border-white/5 bg-z-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-bold text-sm text-z-gray-100">{label}</span>
        <span className="flex items-center gap-2 text-xs text-z-gray-400">
          {signIds.length} sign{signIds.length !== 1 ? 's' : ''}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>▾</motion.span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-3 gap-2 px-4 pb-4">
              {signIds.map((id) => {
                const sign = SIGNS[id];
                const stats = signAccuracy[id];
                const accuracy = stats ? Math.round((stats.successes / stats.attempts) * 100) : null;
                const isWeak = !!stats && stats.easeFactor < 2.2 && stats.attempts > 0;
                return <SignChip key={id} id={id} name={sign.name} accuracy={accuracy} isWeak={isWeak} />;
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PracticeTab({ onStartPractice, onStartWeakPractice }: Props) {
  const { signAccuracy } = useUserStore();

  const signEntries = Object.entries(SIGNS);

  const dueForReview = signEntries.filter(([id]) => {
    const stats = signAccuracy[id];
    return stats && stats.nextReviewAt <= Date.now();
  });

  const weakSignIds = signEntries
    .filter(([id]) => {
      const stats = signAccuracy[id];
      return stats && stats.attempts > 0 && stats.easeFactor < 2.2;
    })
    .sort(([idA], [idB]) => {
      return (signAccuracy[idA]?.easeFactor ?? 99) - (signAccuracy[idB]?.easeFactor ?? 99);
    })
    .slice(0, 8)
    .map(([id]) => id);

  return (
    <div className="px-4 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-2xl font-bold mb-1 tracking-tight">Review</h2>
        <p className="text-z-gray-300 text-sm mb-6">
          Sharpen your signs with spaced recall
        </p>
      </motion.div>

      {/* Quick session */}
      <motion.div
        className="mb-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <motion.button
          onClick={onStartPractice}
          className="w-full rounded-2xl p-5 text-left border border-white/5 overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #5B21B6, #7C3AED)' }}
          initial="rest"
          animate="rest"
          whileHover="hover"
          whileTap={{ scale: 0.97 }}
          variants={{
            rest:  { scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' },
            hover: { scale: 1.02, boxShadow: '0 14px 40px rgba(91,33,182,0.55)', transition: { duration: 0.25, ease: 'easeOut' } },
          }}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Quick Session</h3>
              <p className="text-purple-200 text-sm mt-1">
                {dueForReview.length > 0
                  ? `${dueForReview.length} sign${dueForReview.length > 1 ? 's' : ''} to review`
                  : 'Warm up with your learned signs'}
              </p>
            </div>
            <motion.span
              className="text-3xl inline-block"
              style={{ transformOrigin: '75% 80%' }}
              variants={{
                rest:  { rotate: 0, transition: { duration: 0.3, ease: 'easeOut' } },
                hover: { rotate: [0, -18, 14, -18, 14, 0], transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } },
              }}
            >🤟</motion.span>
          </div>
        </motion.button>
      </motion.div>

      {/* Weak Signs — only shows if there are struggling signs */}
      {weakSignIds.length > 0 && (
        <motion.div
          className="mb-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
        >
          <motion.button
            onClick={() => onStartWeakPractice(weakSignIds)}
            className="w-full rounded-2xl p-5 text-left border border-z-orange/20 overflow-hidden relative"
            style={{ background: 'linear-gradient(135deg, #78180A, #C2410C)' }}
            initial="rest"
            animate="rest"
            whileHover="hover"
            whileTap={{ scale: 0.97 }}
            variants={{
              rest:  { scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' },
              hover: { scale: 1.02, boxShadow: '0 14px 40px rgba(194,65,12,0.45)', transition: { duration: 0.25, ease: 'easeOut' } },
            }}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Weak Signs</h3>
                <p className="text-orange-200 text-sm mt-1">
                  {weakSignIds.length} sign{weakSignIds.length > 1 ? 's' : ''} that need extra practice
                </p>
              </div>
              <motion.span
                className="text-3xl inline-block"
                variants={{
                  rest:  { rotate: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
                  hover: { rotate: [0, -8, 8, -6, 0], scale: [1, 1.1, 1], transition: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } },
                }}
              >
                💪
              </motion.span>
            </div>
          </motion.button>
        </motion.div>
      )}

      {/* Vocabulary, grouped by scenario + alphabet — collapsed by default */}
      <h3 className="font-bold text-sm mb-3 mt-6 text-z-gray-300 uppercase tracking-widest">
        Your vocabulary
      </h3>
      {SCENARIO_GROUPS.map((g) => (
        <ScenarioDropdown key={g.key} label={g.label} signIds={g.signIds} />
      ))}
      <ScenarioDropdown label="Alphabet" signIds={ALPHABET_IDS} />
      {OTHER_IDS.length > 0 && <ScenarioDropdown label="Other Signs" signIds={OTHER_IDS} />}
    </div>
  );
}
