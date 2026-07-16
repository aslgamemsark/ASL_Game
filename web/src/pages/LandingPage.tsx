import { motion, useReducedMotion } from 'framer-motion';
import { Zippy } from '@/components/shared/Zippy';
import { WORLDS } from '@/data/worlds';
import { SIGNS } from '@/data/signs';

/** The beta review form (Google Forms). Opened in a new tab — a plain external navigation, so the
 *  CSP's `form-action 'self'` (vercel.json) doesn't apply; that governs form SUBMISSION targets. */
const REVIEW_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScUDv9ya88W4EIQAoQwa7I7xMZdrVyUDGyI16VZyrfbM7ttDQ/viewform';

// The app's signature easing + entrance duration (DESIGN.md "Motion"). Reused verbatim so the
// landing page reads as the same product, not a bolted-on marketing site.
const EASE = [0.25, 0.46, 0.45, 0.94] as const;

/**
 * Scroll reveal. `whileInView` + `once` so a section animates in a single time and then simply
 * stays — no re-triggering as the user scrolls back up, which is the tell of a gimmicky page.
 *
 * `initial={false}` under reduced motion is deliberate and load-bearing: MotionConfig's
 * reducedMotion="user" (main.tsx) drops transforms but still runs opacity, which would leave a
 * fade-in gating content visibility. Reveals must enhance an already-visible default — a crawler,
 * a headless renderer, or a background tab must never get a blank section.
 */
function Reveal({
  children,
  delay = 0,
  y = 20,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-15%' }}
      transition={{ duration: 0.45, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Exactly what the live Sign Coach shows for HELLO — no more, no less.
 *
 * These are HELLO's REAL parameters: engine/verifier.ts only emits `orientation` when a sign
 * declares one (4 of 51 do) and `nmm` when a sign declares one (currently NONE do), and HELLO
 * (data/signs.ts) declares neither — so its live checklist is these three rows. An earlier draft
 * of this section showed five rows including a green "Facial expression", which was fiction: it
 * promised a check the engine never runs, on the very page whose whole pitch is per-parameter
 * honesty. A visitor's first real attempt would have contradicted it.
 *
 * Names come from FRIENDLY_NAMES and hints from HANDSHAPE_HINTS / LOCATION_HINTS / MOVEMENT_HINTS
 * in components/lesson/ParameterChecklist.tsx. Keep in sync with that component; if HELLO ever
 * declares an orientation or nmm requirement, add the row here too.
 */
const PARAMETERS: { name: string; hint: string; cleared: boolean }[] = [
  { name: 'Hand shape', hint: 'Open your hand flat, fingers together', cleared: true },
  { name: 'Position', hint: 'Move your hand up near your forehead', cleared: true },
  { name: 'Movement', hint: 'Repeat the motion a couple times', cleared: false },
];

const STEPS: { zippy: 'reading' | 'looking' | 'thumbsup'; title: string; body: string }[] = [
  {
    zippy: 'reading',
    title: 'Pick a sign',
    // "on a loop" not "as slowly as you need" — slow-motion playback exists only in the post-pass
    // replay comparison (ReplayCompare.tsx), NOT when first learning a sign, and the copy must not
    // promise a control that isn't there.
    body: 'Watch a real signer demonstrate it, on a loop, as many times as you like. 51 signs, including the full alphabet.',
  },
  {
    zippy: 'looking',
    title: 'Sign it to your camera',
    body: 'Your webcam watches your hands. Everything runs on your own device — no video is ever uploaded.',
  },
  {
    zippy: 'thumbsup',
    title: 'Find out exactly what to fix',
    body: 'Not just right or wrong. Zippy scores each part of the sign separately and tells you which one missed.',
  },
];

interface Props {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: Props) {
  // The one sign shown in the Sign Coach section. HELLO is the app's very first taught sign, and
  // its hint ("Like a salute that waves!") is real content from data/signs.ts.
  const hello = SIGNS.HELLO;

  return (
    <main className="min-h-screen bg-z-bg overflow-x-hidden">
      {/* ── Hero ─────────────────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-[clamp(3rem,10vh,6rem)] pb-[clamp(3rem,8vh,5rem)]">
        {/* A single soft brand bloom behind Zippy. Purple is the committed identity (PRODUCT.md),
            but the anti-reference is explicit about gradient wallpaper — so this is one contained
            radial glow anchored to the mascot, not a page-wide gradient wash. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[560px] opacity-70"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 28%, rgba(124,58,237,0.28) 0%, rgba(124,58,237,0) 70%)',
          }}
        />

        <div className="relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex justify-center mb-6"
          >
            <Zippy expression="welcome" size="xl" float priority />
          </motion.div>

          <motion.h1
            className="font-bold text-white tracking-tight leading-[1.08] mb-4 text-[clamp(2.25rem,7vw,4rem)]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE, delay: 0.1 }}
          >
            Learn to sign.
            <br />
            <span className="text-z-purple-light">Actually sign.</span>
          </motion.h1>

          <motion.p
            className="text-z-gray-200 text-[clamp(1rem,2.2vw,1.25rem)] leading-relaxed max-w-[60ch] mx-auto mb-2"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE, delay: 0.18 }}
          >
            Most apps ask you to recognize a sign. QuickSign watches you make it — and tells you
            exactly which part to fix.
          </motion.p>
          <motion.p
            className="text-z-purple-light/80 text-xs font-semibold tracking-wide uppercase mb-9"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, ease: EASE, delay: 0.24 }}
          >
            Beyond Words
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE, delay: 0.3 }}
          >
            <motion.button
              onClick={onGetStarted}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-base text-white bg-gradient-primary"
              whileHover={{ scale: 1.02, boxShadow: '0 12px 40px rgba(168,85,247,0.45)' }}
              whileTap={{ scale: 0.97 }}
            >
              Get Started — it's free
            </motion.button>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-6 py-4 rounded-2xl font-bold text-sm text-z-gray-200 border border-white/15 hover:border-white/30 hover:text-white transition-colors"
            >
              See how it works
            </a>
          </motion.div>

          <p className="text-z-gray-400 text-xs mt-5">
            No account needed to try · Works in your browser
          </p>
        </div>
      </section>

      {/* ── The differentiator: the Sign Coach ───────────────────────────────────────── */}
      <section className="px-6 py-[clamp(4rem,10vh,7rem)]">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-12">
            {/* Honest framing: ASL signs are built from parts, and Zippy scores the parts THAT
                SIGN is defined by — separately. It does not check all five parameters on every
                sign (no sign declares a facial-expression requirement yet), so the claim is about
                per-part scoring, which is real, not about coverage, which would be a lie. */}
            <h2 className="font-bold text-white tracking-tight text-[clamp(1.75rem,4.5vw,2.75rem)] mb-4">
              A sign is made of parts.
              <br className="hidden sm:block" /> Zippy checks them one by one.
            </h2>
            <p className="text-z-gray-300 text-base leading-relaxed max-w-[62ch] mx-auto">
              A thumbs-up isn't feedback. Every part of a sign gets scored on its own — so when an
              attempt misses, you get the one thing that actually helps: which part, and how to fix
              it.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
            {/* The reference clip — real signing footage, the only asset that proves the product
                does what it says. Muted + no controls: this audience overlaps the Deaf and
                hard-of-hearing community, so nothing here may depend on audio (PRODUCT.md). */}
            <Reveal>
              <figure className="m-0">
                <div className="relative rounded-3xl overflow-hidden bg-z-card border border-white/5 aspect-video">
                  <video
                    src={hello.clip}
                    autoPlay
                    loop
                    muted
                    playsInline
                    aria-label="A signer demonstrating the ASL sign for HELLO: an open hand at the forehead, waving side to side."
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-3 left-3 text-xs font-bold bg-black/70 text-white px-2.5 py-1 rounded-lg">
                    HELLO
                  </span>
                </div>
                <figcaption className="text-z-gray-400 text-sm mt-3 italic">
                  “{hello.hint}”
                </figcaption>
              </figure>
            </Reveal>

            {/* A faithful still of the live ParameterChecklist. Deliberately shows one parameter
                mid-fail with its real coaching hint — that IS the product, and a screenshot where
                everything is green would sell the wrong thing (PRODUCT.md: "Coach, don't judge"). */}
            <Reveal delay={0.08}>
              <div className="rounded-3xl bg-z-card border border-white/5 p-4 sm:p-5">
                <div className="space-y-2">
                  {PARAMETERS.map((p, i) => (
                    <motion.div
                      key={p.name}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
                        p.cleared
                          ? 'bg-z-green/10 border-z-green/30'
                          : 'bg-z-red/8 border-z-red/20'
                      }`}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: '-10%' }}
                      transition={{ delay: 0.1 + i * 0.06, ease: EASE }}
                    >
                      <div
                        className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold ${
                          p.cleared ? 'bg-z-green text-white' : 'bg-z-red/30 text-z-red'
                        }`}
                        aria-hidden
                      >
                        {p.cleared ? '✓' : '✗'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-semibold ${
                            p.cleared ? 'text-z-green' : 'text-z-gray-100'
                          }`}
                        >
                          {p.name}
                        </p>
                        {!p.cleared && (
                          <p className="text-xs text-z-gray-300 mt-0.5">{p.hint}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
                <p className="text-z-gray-400 text-xs mt-4 leading-relaxed">
                  The Sign Coach on HELLO — two parts right, one to fix.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="px-6 py-[clamp(4rem,10vh,7rem)] scroll-mt-8">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-12">
            <h2 className="font-bold text-white tracking-tight text-[clamp(1.75rem,4.5vw,2.75rem)]">
              Three steps, a few minutes a day
            </h2>
          </Reveal>

          {/* A real 3-step sequence, so the numbers carry actual information (order matters) rather
              than being decorative section scaffolding. */}
          <ol className="grid gap-8 sm:gap-6 sm:grid-cols-3 list-none p-0 m-0">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.1}>
                <li className="text-center sm:text-left">
                  <div className="flex sm:block items-center gap-4">
                    <div className="shrink-0 sm:mb-4">
                      <Zippy expression={step.zippy} size="sm" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-baseline gap-2 mb-1.5">
                        <span
                          className="text-z-purple-light font-bold text-sm tabular-nums"
                          aria-hidden
                        >
                          {i + 1}
                        </span>
                        <h3 className="font-bold text-white text-lg">{step.title}</h3>
                      </div>
                      <p className="text-z-gray-300 text-sm leading-relaxed">{step.body}</p>
                    </div>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Worlds ───────────────────────────────────────────────────────────────────── */}
      <section className="px-6 py-[clamp(4rem,10vh,7rem)]">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-12">
            <h2 className="font-bold text-white tracking-tight text-[clamp(1.75rem,4.5vw,2.75rem)] mb-4">
              Signs you'd actually use
            </h2>
            <p className="text-z-gray-300 text-base leading-relaxed max-w-[62ch] mx-auto">
              Four worlds of real conversations — order a coffee, describe a symptom, talk to a
              teacher. Roleplay each one with Zippy when you're ready.
            </p>
          </Reveal>

          {/* Deliberately NOT a uniform card grid: the first world is a wide feature panel (it's
              the one everyone actually starts in — the others are locked behind it), the rest sit
              in a lighter row beneath. Each uses its own committed color from data/worlds.ts. */}
          <div className="space-y-4">
            <Reveal>
              <article
                className="relative overflow-hidden rounded-3xl p-7 sm:p-9 min-h-[190px] flex flex-col justify-end"
                style={{ background: WORLDS[0].bgGradient }}
              >
                {/* Scrim: the documented technique for text over a saturated brand background —
                    two WCAG failures were fixed this way and the pattern must not regress.
                    Measured at bg-black/30 (the value used elsewhere) this gradient's LIGHT end
                    (#14B8A6) only reached 3.85:1 for white/90 body text — under the 4.5:1 floor,
                    because teal is far lighter than the purple cards the /30 value was tuned on.
                    /45 + full-opacity text puts every line over the floor; verified by measuring
                    the composite against the lightest gradient stop, not the darkest. */}
                <div aria-hidden className="absolute inset-0 bg-black/45" />
                <div className="relative">
                  <span className="text-4xl block mb-3" aria-hidden>
                    {WORLDS[0].emoji}
                  </span>
                  <h3 className="font-bold text-white text-2xl mb-1.5">{WORLDS[0].title}</h3>
                  <p className="text-white text-sm max-w-[46ch]">{WORLDS[0].description}</p>
                  <p className="text-white/90 text-xs mt-3 font-semibold">Start here — free</p>
                </div>
              </article>
            </Reveal>

            <div className="grid gap-4 sm:grid-cols-3">
              {WORLDS.slice(1).map((world, i) => (
                <Reveal key={world.id} delay={i * 0.08}>
                  <article className="h-full rounded-2xl bg-z-card border border-white/5 p-5">
                    <span
                      className="text-2xl block mb-3"
                      style={{ filter: `drop-shadow(0 0 14px ${world.color}55)` }}
                      aria-hidden
                    >
                      {world.emoji}
                    </span>
                    <h3 className="font-bold text-white text-base mb-1">{world.title}</h3>
                    <p className="text-z-gray-300 text-sm leading-relaxed">{world.description}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Privacy / credibility ────────────────────────────────────────────────────── */}
      <section className="px-6 py-[clamp(4rem,10vh,7rem)]">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-3xl bg-z-card border border-white/5 p-7 sm:p-10">
            <Reveal className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="shrink-0">
                <Zippy expression="thinking" size="md" />
              </div>
              <div className="text-center sm:text-left">
                <h2 className="font-bold text-white tracking-tight text-[clamp(1.5rem,3.5vw,2rem)] mb-3">
                  Your camera stays yours
                </h2>
                {/* Copy reused from components/shared/CameraOnboarding.tsx — the same promise the
                    app makes at the permission prompt. Kept identical on purpose: a marketing page
                    that softens or overstates it would be the one place the claim breaks. */}
                <p className="text-z-gray-200 text-sm leading-relaxed mb-5 max-w-[62ch]">
                  QuickSign uses your camera to watch your hand signs and give you real-time
                  feedback. Your video never leaves your device — recognition runs locally in your
                  browser.
                </p>
                <ul className="space-y-3 text-left list-none p-0 m-0">
                  {[
                    'Your video is never uploaded or recorded',
                    'Optional replay stays on your device',
                    'You can turn off training-data collection anytime in Settings',
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-3">
                      <span className="text-z-green text-lg leading-none mt-0.5" aria-hidden>
                        ✓
                      </span>
                      <span className="text-sm text-z-gray-200">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Close ────────────────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-[clamp(3rem,8vh,5rem)] pb-[clamp(2rem,5vh,3rem)]">
        <Reveal className="max-w-2xl mx-auto text-center">
          <div className="flex justify-center mb-5">
            <Zippy expression="encouraging" size="lg" float />
          </div>
          <h2 className="font-bold text-white tracking-tight text-[clamp(1.75rem,4.5vw,2.5rem)] mb-3">
            Your first sign is a wave
          </h2>
          <p className="text-z-gray-300 text-base leading-relaxed max-w-[52ch] mx-auto mb-8">
            Start with HELLO. It takes about a minute, and Zippy will tell you exactly how you did.
          </p>
          <motion.button
            onClick={onGetStarted}
            className="w-full sm:w-auto px-10 py-4 rounded-2xl font-bold text-base text-white bg-gradient-primary"
            whileHover={{ scale: 1.02, boxShadow: '0 12px 40px rgba(168,85,247,0.45)' }}
            whileTap={{ scale: 0.97 }}
          >
            Get Started — it's free
          </motion.button>
        </Reveal>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────────────── */}
      <footer className="px-6 pb-10">
        <div className="max-w-5xl mx-auto border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-5">
          <p className="text-z-gray-400 text-xs order-2 sm:order-1">
            QuickSign is in beta · Made with 🤟
          </p>
          {/* Secondary by construction: bordered, never bg-gradient-primary (that's reserved for
              "Get Started"). Sits after the primary CTA in both source and reading order. */}
          <a
            href={REVIEW_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="order-1 sm:order-2 inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-white/15 text-z-gray-200 text-sm font-bold hover:border-z-purple/50 hover:text-white transition-colors"
          >
            💬 Tried it? Share feedback
          </a>
        </div>
      </footer>
    </main>
  );
}
