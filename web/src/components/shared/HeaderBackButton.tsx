interface Props {
  onClick: () => void;
  /** 'back' = arrow, for navigating up a level. 'close' = ×, for exiting a focused session
   * (lesson/practice/story/speed/multiplayer). Matches the icon each screen used before this
   * was extracted — kept as a prop rather than always using one icon so the semantic meaning
   * (back vs. exit-session) stays visible in the UI. */
  icon?: 'back' | 'close';
  'aria-label'?: string;
}

// Every page header used to hand-roll this exact button at 32x32px — a real touch-target gap
// (below the 44px minimum) repeated 11 times identically. Extracted during the impeccable
// flagship polish pass (2026-07-11) to fix the target size once and remove the duplication.
export function HeaderBackButton({ onClick, icon = 'back', 'aria-label': ariaLabel }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? (icon === 'close' ? 'Close' : 'Back')}
      className="w-11 h-11 -ml-1.5 flex items-center justify-center text-z-gray-400 hover:text-z-gray-50 transition-colors shrink-0"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        {icon === 'close'
          ? <path d="M18 6L6 18M6 6l12 12" />
          : <path d="M19 12H5M12 19l-7-7 7-7" />}
      </svg>
    </button>
  );
}
