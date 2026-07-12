// Zippy — the single source of truth for the mascot: which art plays which role, and every line
// he says. Centralized on purpose (the brief: "centralize dialogue so it's easy to edit later,
// support localization"). The line banks are flat string arrays keyed by context, so a future
// locale file can mirror the same keys without touching any component. No i18n runtime is wired
// up yet — that's deliberate future work; this shape keeps the door open.

export type ZippyExpression =
  | 'welcome'
  | 'teaching'
  | 'thinking'
  | 'encouraging'
  | 'thumbsup'
  | 'celebrating'
  | 'proud'
  | 'applauding'
  | 'oops';

// Role → optimized asset (produced by scripts/optimize-zippy.mjs → public/zippy/*.webp).
// This is the swap-point for a future animated Zippy: change the values here (or the <Zippy>
// component) and every call site follows automatically.
export const ZIPPY_SRC: Record<ZippyExpression, string> = {
  welcome: '/zippy/welcome.webp',
  teaching: '/zippy/teaching.webp',
  thinking: '/zippy/thinking.webp',
  encouraging: '/zippy/encouraging.webp',
  thumbsup: '/zippy/thumbsup.webp',
  celebrating: '/zippy/celebrating.webp',
  proud: '/zippy/proud.webp',
  applauding: '/zippy/applauding.webp',
  oops: '/zippy/oops.webp',
};

// Rotating line banks. Tone rules (from the brief): warm, short, positive, never sarcastic, never
// shaming. Effort is celebrated over perfection. Keep each line to one breath.
export const ZIPPY_LINES = {
  // First-run welcome (onboarding). Kept to one clear line — this is a first impression.
  welcomeIntro: [
    "Hi! I'm Zippy. Let's learn to sign, one step at a time.",
  ],
  // Onboarding guide bubbles (short, per-step).
  onboardingAuth: [
    'Save your progress so we can pick up right where you left off.',
  ],
  onboardingSkill: [
    "Tell me where you're starting — there's no wrong answer.",
  ],
  // Home greeting for a returning learner (no active streak).
  homeGreeting: [
    'Welcome back! Ready to learn something new?',
    'Good to see you! What should we sign today?',
    "You're doing great — let's keep it going.",
    'Every practice makes it easier. Shall we?',
  ],
  // While the camera / recognition model is warming up.
  cameraLoading: [
    'Looking for your hands…',
    'Getting the camera ready…',
    'Almost there…',
  ],
  // A sign was recognized.
  success: [
    'Nice work!',
    'You got it!',
    'Beautiful signing!',
    "That's the one!",
    'Yes — perfect.',
  ],
  // A miss or a skip. Always kind; never disappointed.
  encourage: [
    "Almost! Let's try that one again.",
    'So close — give it another go.',
    'Nice try! Once more, you’ve got this.',
    'Signing takes practice. Let’s try again together.',
  ],
  // Finishing a whole lesson.
  lessonComplete: [
    'Awesome work! Ready for the next challenge?',
    'You did it! Proud of you.',
    'Lesson complete — you’re getting stronger every time.',
  ],
  // Empty-state explainers.
  emptyLeaderboard: [
    'No one’s here yet — finish a lesson and you could be first on the board!',
  ],
  emptyFriends: [
    'No friends yet! Add someone to cheer each other on.',
  ],
  emptyInsights: [
    'Practice a few signs and I’ll show you how you’re improving.',
  ],
  // Something broke.
  error: [
    'Oops! Something went sideways. A quick reload usually fixes it.',
  ],
} satisfies Record<string, readonly string[]>;

export type ZippyContext = keyof typeof ZIPPY_LINES;

// Remember the last index shown per context so consecutive picks don't repeat the same line.
const lastIdx: Partial<Record<ZippyContext, number>> = {};

/**
 * Pick a line for a context. Pass a stable `seed` (e.g. a lesson index) for a deterministic choice;
 * omit it to rotate, avoiding an immediate repeat of the previous line for that context.
 * Note: without a seed this advances a module counter, so call it once per mount (see useZippyLine)
 * rather than inline in render.
 */
export function pickZippyLine(context: ZippyContext, seed?: number): string {
  const bank = ZIPPY_LINES[context];
  if (bank.length === 0) return '';
  if (bank.length === 1) return bank[0];

  if (seed !== undefined) {
    return bank[((seed % bank.length) + bank.length) % bank.length];
  }
  const prev = lastIdx[context];
  let i = Math.floor(Math.random() * bank.length);
  if (i === prev) i = (i + 1) % bank.length;
  lastIdx[context] = i;
  return bank[i];
}
