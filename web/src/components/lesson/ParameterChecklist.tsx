import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ParamScore } from '@/engine/verifier';
import { Anchor, PalmFacing, type Sign } from '@/engine/schema';
import { advanceGateState, initGateState, type GateState } from '@/engine/coachingGate';

const FRIENDLY_NAMES: Record<string, string> = {
  handshape_dominant: 'Hand shape',
  handshape_nondominant: 'Support hand',
  location: 'Position',
  movement: 'Movement',
  orientation: 'Palm direction',
  nmm: 'Facial expression',
  no_extra_hand: 'One hand only',
};

const MOVEMENT_HINTS: Record<string, string> = {
  circular: 'Circle your hand',
  linear: 'Move your hand in a line',
  repeated: 'Repeat the motion a couple times',
  converge: 'Bring your hands together',
};

const HANDSHAPE_HINTS: Record<string, string> = {
  fist: 'Make a closed fist',
  s: 'Make a closed fist',
  a: 'Make an "A" fist, thumb resting on the side',
  index: 'Point with just your index finger',
  point: 'Point with just your index finger',
  '1': 'Point with just your index finger',
  open: 'Open your hand flat, fingers together',
  b: 'Open your hand flat, fingers together',
  '5': 'Spread your fingers open wide',
  claw: 'Curve your fingers into a claw shape',
  flat_o: 'Curl your fingertips lightly toward your thumb',
  n: 'Curl your index and middle finger down',
  h: 'Extend index and middle finger together',
  u: 'Extend index and middle finger together',
  w: 'Extend index, middle, and ring fingers',
  v: 'Make a "V" with index and middle finger',
  l: 'Make an "L" with thumb and index finger',
  y: 'Make a "Y" — thumb and pinky out, rest curled',
  middle: 'Extend just your middle finger',
  i: 'Make a fist, raise just your pinky, thumb tucked in',
  d: 'Point your index up, curl the rest toward your thumb',
  f: 'Touch thumb and index into a circle, other three fingers up',
  o: 'Curl every fingertip in to touch the thumb',
  t: 'Make a fist, tuck your thumb between the first two fingers',
  g: 'Point sideways with index and thumb, like L turned on its side',
  letter_h: 'Two fingers together, pointing sideways',
  k: 'Make a V, touch your thumb to the base of your middle finger',
  letter_n: 'Make a fist, tuck your thumb under the first two fingers',
  p: 'Make a K, then point it toward the ground',
  q: 'Make a G, then point it toward the ground',
  r: 'Cross your index and middle fingers',
  c: 'Curve your fingers and thumb into a "C" shape',
  e: 'Bend all four fingers down, thumb tucked under',
  m: 'Make a fist, tuck your thumb under your first three fingers',
  letter_s: 'Make a fist, wrap your thumb across the front',
  x: 'Make a fist, hook your index finger like a hook',
};

const LOCATION_HINTS: Record<Anchor, string> = {
  [Anchor.OTHER_HAND]: 'Bring your hand closer to your other hand',
  [Anchor.NEUTRAL_SPACE]: 'Hold your hand out in front of you',
  [Anchor.CHEST]: 'Move your hand to chest height',
  [Anchor.CHIN]: 'Move your hand up near your chin',
  [Anchor.FOREHEAD]: 'Move your hand up near your forehead',
  [Anchor.BELLY]: 'Move your hand down near your belly',
  [Anchor.SHOULDER]: 'Move your hand near your shoulder',
};

const ORIENTATION_HINTS: Record<PalmFacing, string> = {
  [PalmFacing.IN]: 'Turn your palm to face toward you',
  [PalmFacing.OUT]: 'Turn your palm to face away from you',
  [PalmFacing.UP]: 'Turn your palm to face up',
  [PalmFacing.DOWN]: 'Turn your palm to face down',
  [PalmFacing.LEFT]: 'Turn your palm to face left',
  [PalmFacing.RIGHT]: 'Turn your palm to face right',
};

// ARKit blendshape name -> coaching hint. No sign currently declares an nmm requirement (see
// engine/schema.ts's NmmReq), but this stays ready for the first one that does.
const NMM_HINTS: Record<string, string> = {
  browInnerUp: 'Raise your eyebrows',
  browDownLeft: 'Furrow your brow',
  browDownRight: 'Furrow your brow',
  mouthPucker: 'Purse your lips',
  jawOpen: 'Open your mouth slightly',
  cheekPuff: 'Puff out your cheeks',
  mouthShrugUpper: 'Raise your upper lip',
};

export function hintFor(param: ParamScore, sign?: Sign | null): string | null {
  if (param.name === 'movement') {
    return sign ? MOVEMENT_HINTS[sign.movement.kind] ?? 'Keep moving!' : 'Keep moving!';
  }
  if (param.name === 'handshape_dominant' && sign) {
    return HANDSHAPE_HINTS[sign.dominant.kind.toLowerCase()] ?? null;
  }
  if (param.name === 'handshape_nondominant' && sign?.nondominant) {
    return HANDSHAPE_HINTS[sign.nondominant.kind.toLowerCase()] ?? null;
  }
  if (param.name === 'location' && sign) {
    return LOCATION_HINTS[sign.location.anchor] ?? null;
  }
  if (param.name === 'orientation' && sign?.orientation) {
    return ORIENTATION_HINTS[sign.orientation.facing] ?? null;
  }
  if (param.name === 'nmm' && sign?.nmm) {
    return NMM_HINTS[sign.nmm.blendshape] ?? null;
  }
  return null;
}

interface Props {
  params: ParamScore[];
  sign?: Sign | null;
  /** 0..1 while a static (no-movement) sign is being held toward its pass duration; null/omitted
   *  otherwise (movement signs are paced by their own movement scorer, not a hold timer — see
   *  STATIC_HOLD_SECONDS in useRecognition.ts). */
  holdProgress?: number | null;
  /** Slightly more breathing room between rows (the desktop three-column signing layout, where
   *  this panel sits alongside a taller reference clip + webcam) — purely a spacing choice, not
   *  a height match; row content is unchanged. */
  fillHeight?: boolean;
}

export function ParameterChecklist({ params, sign, holdProgress, fillHeight }: Props) {
  // Per-parameter confidence-gate state, keyed by param name, sustained across frames so a
  // single noisy frame can't flip a specific (possibly wrong) coaching tip on or off. See
  // engine/coachingGate.ts — 'cleared' is immediate, 'confident-fail' requires a sustained
  // streak, everything else is a neutral "still working on it" state with no specific hint.
  const gatesRef = useRef<Record<string, GateState>>({});
  const [, setTick] = useState(0);

  useEffect(() => {
    let changed = false;
    for (const param of params) {
      const prev = gatesRef.current[param.name] ?? initGateState();
      const next = advanceGateState(prev, param.score, param.threshold, param.required);
      if (next.status !== prev.status || next.failStreak !== prev.failStreak) changed = true;
      gatesRef.current[param.name] = next;
    }
    if (changed) setTick((t) => t + 1);
  }, [params]);

  return (
    <div className={`flex flex-col gap-2 ${fillHeight ? 'lg:gap-3' : ''}`}>
      {holdProgress != null && (
        <motion.div
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 border bg-z-purple/10 border-z-purple/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-z-purple-light">Hold the pose…</p>
            <p className="text-xs text-z-gray-400 mt-0.5">Keep still while it locks in</p>
          </div>
          <div className="w-20 h-2 bg-z-surface rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-z-purple-light"
              animate={{ width: `${Math.round(holdProgress * 100)}%` }}
              transition={{ duration: 0.1, ease: 'linear' }}
            />
          </div>
          <span className="text-xs font-mono w-8 text-right text-z-purple-light">
            {Math.round(holdProgress * 100)}%
          </span>
        </motion.div>
      )}
      {params.map((param, i) => {
        const gate = gatesRef.current[param.name] ?? initGateState();
        const cleared = gate.status === 'cleared';
        const confidentFail = gate.status === 'confident-fail';
        const pct = Math.min(100, Math.round((param.score / Math.max(param.threshold, 0.01)) * 100));
        const hint = hintFor(param, sign);

        return (
          <motion.div
            key={param.name}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
              cleared
                ? 'bg-z-green/10 border-z-green/30'
                : confidentFail
                  ? 'bg-z-red/8 border-z-red/20'
                  : 'bg-z-surface/30 border-white/5'
            }`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
              cleared
                ? 'bg-z-green text-white'
                : confidentFail
                  ? 'bg-z-red/30 text-z-red'
                  : param.required
                    ? 'bg-z-gray-500/30 text-z-gray-300'
                    : 'bg-z-gray-500/30 text-z-gray-400'
            }`}>
              {cleared ? '✓' : confidentFail ? '✗' : param.required ? '…' : '—'}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${
                cleared ? 'text-z-green' : confidentFail ? 'text-z-gray-100' : 'text-z-gray-400'
              }`}>
                {FRIENDLY_NAMES[param.name] || param.name}
              </p>
              {confidentFail && hint && (
                <p className="text-xs text-z-gray-300 mt-0.5">{hint}</p>
              )}
              {!cleared && !confidentFail && param.required && (
                <p className="text-xs text-z-gray-500 mt-0.5">Keep trying…</p>
              )}
            </div>

            <div className="w-20 h-2 bg-z-surface rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  cleared ? 'bg-z-green' : confidentFail ? 'bg-z-red' : 'bg-z-purple-light'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <span className={`text-xs font-mono w-8 text-right ${
              cleared ? 'text-z-green' : 'text-z-gray-400'
            }`}>
              {Math.round(param.score * 100)}%
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
