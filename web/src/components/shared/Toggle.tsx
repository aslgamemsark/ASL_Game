import { useId } from 'react';
import { motion } from 'framer-motion';

interface Props {
  /** Visible name of the setting, and the switch's accessible name — they are the same string by
   *  construction, so they cannot drift apart. */
  label: string;
  /** Optional supporting line under the label. */
  description?: string;
  /** Optional leading emoji. Decorative: it is hidden from assistive tech, since the label already
   *  says what the setting is. */
  icon?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Spacing/position only — the row's place in a stack is the caller's concern (e.g. a top
   *  divider between two grouped settings). */
  className?: string;
}

/**
 * A labelled on/off setting row: name, optional description, and the switch itself.
 *
 * Owns the whole row rather than just the control, so the visible label and the accessible name
 * are one string wired through `aria-labelledby` instead of two that can drift.
 *
 * This exists because the switch markup was hand-rolled five times in SettingsPage — identical
 * every time, and every one of them shipped with no accessible name at all. A screen reader
 * announced all five as "switch, on", with nothing to say which setting had just been toggled
 * (axe `button-name`, critical, found 2026-07-28). Copying the markup a sixth time would have
 * copied the omission; taking `label` as a required prop makes that impossible.
 */
export function Toggle({ label, description, icon, checked, onChange, className = '' }: Props) {
  const labelId = useId();

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && <span className="text-xl shrink-0" aria-hidden="true">{icon}</span>}
        <div className="min-w-0">
          <p id={labelId} className="font-semibold text-sm">{label}</p>
          {description && (
            <p className="text-xs text-z-gray-400 mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      {/* p-1.5 -m-1.5 keeps the visible track at 56x32 while giving the hit area the ≥44px DESIGN.md
          requires, without the padding pushing the row taller. */}
      <button
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        onClick={() => onChange(!checked)}
        className="p-1.5 -m-1.5 shrink-0"
      >
        <span className={`relative block w-14 h-8 rounded-full transition-colors ${checked ? 'bg-z-purple' : 'bg-z-gray-500'}`}>
          <motion.span
            className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md"
            animate={{ x: checked ? 24 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </span>
      </button>
    </div>
  );
}
