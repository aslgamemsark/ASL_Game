import { motion } from 'framer-motion';
import type { ParamScore } from '@/engine/verifier';
import { paramCleared } from '@/engine/verifier';
import { Anchor, PalmFacing, type Sign } from '@/engine/schema';

const FRIENDLY_NAMES: Record<string, string> = {
  handshape_dominant: 'Hand shape',
  handshape_nondominant: 'Support hand',
  location: 'Position',
  movement: 'Movement',
  orientation: 'Palm direction',
  nmm: 'Facial expression',
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
  n: 'Curl your index and middle finger down',
  h: 'Extend index and middle finger together',
  u: 'Extend index and middle finger together',
  w: 'Extend index, middle, and ring fingers',
  v: 'Make a "V" with index and middle finger',
  l: 'Make an "L" with thumb and index finger',
  y: 'Make a "Y" — thumb and pinky out, rest curled',
  middle: 'Extend just your middle finger',
  i: 'Make a fist, raise just your pinky, thumb tucked in',
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
}

export function ParameterChecklist({ params, sign }: Props) {
  return (
    <div className="space-y-2">
      {params.map((param, i) => {
        const cleared = paramCleared(param);
        const pct = Math.min(100, Math.round((param.score / Math.max(param.threshold, 0.01)) * 100));
        const hint = hintFor(param, sign);

        return (
          <motion.div
            key={param.name}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
              cleared
                ? 'bg-z-green/10 border-z-green/30'
                : param.required
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
                : param.required
                  ? 'bg-z-red/30 text-z-red'
                  : 'bg-z-gray-500/30 text-z-gray-400'
            }`}>
              {cleared ? '✓' : param.required ? '✗' : '—'}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${
                cleared ? 'text-z-green' : param.required ? 'text-z-gray-100' : 'text-z-gray-400'
              }`}>
                {FRIENDLY_NAMES[param.name] || param.name}
              </p>
              {!cleared && param.required && hint && (
                <p className="text-xs text-z-gray-300 mt-0.5">{hint}</p>
              )}
            </div>

            <div className="w-20 h-2 bg-z-surface rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  cleared ? 'bg-z-green' : param.required ? 'bg-z-purple-light' : 'bg-z-gray-400'
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
