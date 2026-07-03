import { motion, type TargetAndTransition } from 'framer-motion';

export type Tab = 'learn' | 'review' | 'alphabet' | 'profile';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'learn',    label: 'Journey',  icon: '🗺️' },
  { id: 'review',   label: 'Review',   icon: '🪞'  },
  { id: 'alphabet', label: 'ABCs',     icon: '🔤'  },
  { id: 'profile',  label: 'Me',       icon: '🤟'  },
];

const ICON_HOVER: Record<Tab, TargetAndTransition> = {
  learn:    { rotate: [0, -9, 8, -6, 0],           transition: { duration: 1.0, repeat: Infinity, ease: 'easeInOut' as const } },
  review:   { scale: [1, 1.16, 1, 1.12, 1],         transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' as const } },
  alphabet: { rotate: [0, -6, 6, -4, 0], scale: [1, 1.1, 1], transition: { duration: 1.0, repeat: Infinity, ease: 'easeInOut' as const } },
  profile:  { rotate: [0, -18, 14, -18, 14, 0],    transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const } },
};

export function BottomNav({ active, onChange }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-z-bg/90 backdrop-blur-md border-t border-z-purple-deep/40">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2.5">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-colors ${
                isActive ? 'bg-z-purple/20' : ''
              }`}
              initial="rest"
              animate="rest"
              whileHover="hover"
              whileTap={{ scale: 0.88, y: 0 }}
              variants={{
                rest:  { y: 0, scale: 1, transition: { duration: 0.18, ease: 'easeOut' } },
                hover: { y: -3, scale: 1.06, transition: { duration: 0.18, ease: 'easeOut' } },
              }}
            >
              <motion.span
                className="text-xl inline-block"
                style={{ transformOrigin: tab.id === 'profile' ? '75% 80%' : 'center' }}
                variants={{
                  rest:  { rotate: 0, scale: isActive ? 1.1 : 1, transition: { duration: 0.25, ease: 'easeOut' } },
                  hover: ICON_HOVER[tab.id],
                }}
              >
                {tab.icon}
              </motion.span>
              <span className={`text-[10px] font-semibold tracking-wide ${
                isActive ? 'text-z-purple-glow' : 'text-z-gray-400'
              }`}>
                {tab.label}
              </span>
              {isActive && (
                <motion.div
                  className="absolute -bottom-1 h-[3px] w-6 bg-z-purple-light rounded-full"
                  layoutId="nav-dot"
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
