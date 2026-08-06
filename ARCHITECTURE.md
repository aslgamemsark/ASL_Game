# QuickSign Architecture Document

*Generated from codebase analysis on 2026-07-25*

---

## 1. Project Overview

QuickSign is a **camera-based ASL learning web app** with two implementations sharing the same recognition logic:
- **Python prototype** (`core/`, `scenarios/`, `signs/`) — desktop OpenCV app, rule-based verification only
- **Web app** (`web/`) — React 19 + Vite + TypeScript SPA, same rule engine ported to TS + optional TF.js classifier as veto-only layer

**Core differentiator**: Per-parameter feedback (handshape, location, movement, orientation) scored independently — not just pass/fail.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            QUICKSIGN SYSTEM                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐     ┌──────────────────┐                         │
│  │  PYTHON PROTO    │     │   WEB APP (React)│                         │
│  │  (core/, signs/) │     │   (web/src/)     │                         │
│  └────────┬─────────┘     └────────┬─────────┘                         │
│           │                        │                                    │
│           │      SHARED SCHEMA     │                                    │
│           │    (core/schema.py     │                                    │
│           │     web/src/engine/    │                                    │
│           │     schema.ts)         │                                    │
│           │                        │                                    │
│           ▼                        ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │              RECOGNITION ENGINE (rule-based)                  │      │
│  │  MediaPipe Hand/Pose/Face → RollingBuffer (2s) → Verifier    │      │
│  │  Per-parameter scoring: handshape/location/movement/orient.  │      │
│  └──────────────────────────────────────────────────────────────┘      │
│           │                        ▲                                    │
│           │                        │                                    │
│           ▼                        │                                    │
│  ┌──────────────────┐     ┌────────┴────────┐                          │
│  │  CLASSIFIER      │     │  SUPABASE       │                          │
│  │  (TF.js, veto)   │     │  (auth, progress,│                          │
│  │  Only overrides  │     │   training data)│                          │
│  │  rule PASS       │     └─────────────────┘                          │
│  └──────────────────┘                                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Major Modules

### 3.1 Python Prototype (`core/`, `signs/`, `scenarios/`)

| Module | Responsibility | Key Files |
|--------|----------------|-----------|
| `core/schema.py` | **Single source of truth** for sign definitions (5 ASL parameters) | `HandShapeReq`, `LocationReq`, `MovementReq`, `OrientationReq`, `NmmReq`, `Sign` |
| `core/verifier.py` | Temporal verification engine — scores each parameter over 2s rolling window | `verify()`, `_score_*()`, `assign_roles()` |
| `core/landmarks.py` | MediaPipe frame normalization, `RollingBuffer`, `HandStabilizer` | `Frame`, `Hand`, `RollingBuffer` |
| `core/handshape.py` | 30+ handshape classifiers (fist, open, claw, letters A-Z, etc.) | `*_confidence()` functions |
| `core/movement.py` | Movement kind scorers (circular, linear, repeated, converge, traced) | `circularConfidence`, `linearConfidence`, etc. |
| `core/orientation.py` | Palm-facing detection | `facing_confidence()` |
| `signs/*.py` | Individual sign definitions (data, not code) — 51 signs | `hello.py`, `coffee.py`, `doctor.py`, etc. |
| `scenarios/*/main.py` | Playable lessons (coffee_shop, hospital_shop, classroom) | Lesson flow, level progression |
| `tools/*.py` | Dev tools: fixture recorder, live verifier, landmark demo | `record_fixture.py`, `demo_verify.py` |

**Key invariant**: A sign requiring movement **must** declare `movement.required=True` and a non-NONE kind — enforced in `Sign.__post_init__`. This structurally prevents the single-frame COFFEE bug.

### 3.2 Web App (`web/src/`)

| Area | Responsibility | Key Files |
|------|----------------|-----------|
| `engine/` | **Port of Python recognition engine** — same schema, same math | `schema.ts`, `verifier.ts`, `handshape.ts`, `movement.ts`, `landmarks.ts`, `capture.ts` |
| `engine/classifier.ts` | TF.js Bi-GRU loader — **veto-only**, never grants pass | `loadClassifier()`, `SignClassifier` |
| `engine/gate.ts` | Combines rule pass + classifier vote → final decision | `gatePass()`, `gateHint()` |
| `hooks/useRecognition.ts` | **Main recognition loop** — camera → buffer → verify → gate → callbacks | `useRecognition()` |
| `hooks/useCamera.ts` | getUserMedia + stall detection + kill switch | `useCamera()` |
| `hooks/useUserStore.ts` | **Zustand store** — all user progress (XP, streak, lessons, signs, gold, badges) | 27k lines, ~130 actions |
| `pages/*.tsx` | Screens: LessonPage, PracticePage, StoryPage, DuelPage, HomePage, etc. | 15+ pages |
| `components/lesson/` | Lesson UI: `ParameterChecklist`, `ReferenceClip`, `ReplayCompare` | Per-parameter feedback |
| `data/` | Static content: signs, lessons, worlds, shop, badges, quests, zippy lines | `signs.ts`, `lessons.ts`, `worlds.ts` |
| `analytics/` | PostHog event taxonomy (42 active events) — centralized `track()` | `events.ts`, `capture.ts`, `types.ts` |
| `contexts/AuthContext.tsx` | Supabase auth (email/password, Google, password recovery) | |

---

## 4. Data Flow

### 4.1 Recognition Pipeline (Web)

```
Camera (getUserMedia)
    │
    ▼
Capture.ts (MediaPipe HandLandmarker + PoseLandmarker + optional FaceLandmarker)
    │   → HandLandmarker: 2 hands, 21 landmarks each, VIDEO mode
    │   → PoseLandmarker: shoulders, mouth (for shoulder-width normalization)
    │   → FaceLandmarker: 52 blendshapes (NMM, unused in v1)
    │
    ▼
Frame (t, width, height, hands[21 pts], leftShoulder, rightShoulder, mouth, faceBlendshapes)
    │
    ▼
HandStabilizer (holds last seen hand ~0.3s to bridge MediaPipe dropouts on fists)
    │
    ▼
RollingBuffer (2.0s window, auto-evicts old frames)
    │
    ▼
Verifier.ts (port of core/verifier.py)
    │   1. assignRoles() — dominant = hand with more path length
    │   2. bestFitRoles() — stabilizes for signs with DIFFERENT handshapes (HELP)
    │   3. Score each required parameter:
    │      • handshape_dominant / handshape_nondominant / no_extra_hand
    │      • location (anchor-relative, shoulder-width normalized)
    │      • movement (circular/linear/repeated/converge/traced over window)
    │      • orientation (palm facing)
    │      • nmm (blendshape)
    │   4. Each param: score ∈ [0,1] vs threshold → cleared/failed
    │   5. Overall PASS = ALL required params cleared (no averaging)
    │
    ▼
Gate.ts (classifier veto layer)
    │   • Only runs if rule verifier PASSED
    │   • Classifier runs on same RollingBuffer frames
    │   • If classifier confident (>0.7) on DIFFERENT sign → VETO
    │   • Never turns FAIL → PASS
    │
    ▼
Callbacks: onPass, onHint, onVote, onVerified, onAttempt
    │
    ▼
UI: ParameterChecklist (green/red per param), ReplayCompare, Zippy coach
```

### 4.2 Lesson Flow

```
LessonPage (lessonId) → getLessonById() → signIds[]
    │
    ├─► intro phase: Zippy reads, camera warmup
    │
    ├─► signing phase (per sign):
    │     ReferenceClip (looped demo) + ParameterChecklist (live)
    │     WebcamMirror (user's hands)
    │     useRecognition.startLoop(video, engineSign)
    │          │
    │          ├─► PASS → +10 XP, confetti, optional replay, auto-advance (1.2s)
    │          ├─► SKIP → record failure, advance
    │          └─► FAIL → retry (no penalty)
    │
    └─► complete phase: streak check, badge check, chest every 3 lessons
```

### 4.3 Progress Persistence

```
User action (completeLesson, recordSign, addXp, etc.)
    │
    ├─► Local: Zustand persist middleware → localStorage (instant)
    │
    └─► Remote (if signed in): useProgressSync → Supabase
         • progress table (upsert on debounced changes)
         • training_samples table (landmark frames, opt-in)
         • Real-time sync on login (mergeProgress takes max of local/remote)
```

---

## 5. Dependency Graph

```
core/schema.py ◄─── signs/*.py                    web/src/engine/schema.ts ◄─── web/src/engine/signs/index.ts
      │                                              │
      ▼                                              ▼
core/verifier.py ──► core/handshape.py               web/src/engine/verifier.ts ──► web/src/engine/handshape.ts
      │                                              │
      ▼                                              ▼
core/movement.py ──► core/orientation.py             web/src/engine/movement.ts ──► web/src/engine/orientation.ts
      │                                              │
      ▼                                              ▼
core/landmarks.py (RollingBuffer, HandStabilizer)   web/src/engine/landmarks.ts (same)
      │                                              │
      ▼                                              ▼
scenarios/*/main.py (uses signs + verifier)         web/src/hooks/useRecognition.ts (uses engine/*)
                                                          │
                                                          ▼
                                                 web/src/pages/LessonPage.tsx
                                                          │
                                                          ▼
                                                 web/src/stores/useUserStore.ts
                                                          │
                                                          ▼
                                                 web/src/hooks/useProgressSync.ts → Supabase
```

**Critical rule (CLAUDE.md)**: The Python `core/verifier.py` is the **source of truth** for recognition logic. The TypeScript `engine/verifier.ts` is a port — when they diverge, Python wins. Changes to recognition must be made in Python first, then ported.

---

## 6. Identified Problems & Technical Debt

### 6.1 Large Files (>2000 lines)

| File | Lines | Problem |
|------|-------|---------|
| `web/src/stores/useUserStore.ts` | **662** | God store: 130+ actions, all progress logic in one file |
| `web/src/App.tsx` | **543** | Giant screen router + auth + onboarding + modals + side nav |
| `web/src/pages/LessonPage.tsx` | **562** | Lesson flow + camera + recognition + UI all mixed |
| `web/src/pages/PracticePage.tsx` | **728** | Multiple modes (expressive/receptive/mixed) in one component |
| `web/src/pages/DuelPage.tsx` | **455** | Multiplayer duel logic + UI |
| `web/src/pages/RoomPage.tsx` | **392** | Group room logic + UI |
| `core/handshape.py` | **610** | 30+ handshape classifiers in one file |
| `core/verifier.py` | **571** | All parameter scorers + role assignment + main verify() |
| `web/src/engine/verifier.ts` | **518** | Direct port, same structure |
| `web/src/engine/handshape.ts` | **527** | Direct port, 30+ classifiers |

### 6.2 Duplicated Logic (Python ↔ TypeScript)

The **entire recognition engine is duplicated**:
- `core/verifier.py` ↔ `web/src/engine/verifier.ts` (571 vs 518 lines)
- `core/handshape.py` ↔ `web/src/engine/handshape.ts` (610 vs 527 lines)
- `core/movement.py` ↔ `web/src/engine/movement.ts`
- `core/schema.py` ↔ `web/src/engine/schema.ts`
- `core/landmarks.py` ↔ `web/src/engine/landmarks.ts`

**Risk**: Divergence causes bugs (e.g., COFFEE single-frame bug fixed in Python but not ported to web). CLAUDE.md mandates Python as source of truth but porting is manual.

### 6.3 Tight Coupling

- `useUserStore` is imported by **20+ components/pages** — any change risks cascade
- `useRecognition` couples camera, buffer, verifier, classifier, analytics, callbacks
- Pages directly import engine types (`VerifyResult`, `Sign`) — no abstraction layer

### 6.4 Global State Issues

- `useUserStore` holds **50+ fields** (XP, streak, lessons, signs, gold, badges, cosmetics, friends, quests, settings)
- No domain separation — progress, economy, social, settings all mixed
- Persistence via `zustand/middleware/persist` serializes entire store to localStorage

### 6.5 Missing Abstractions

| Missing | Current Workaround |
|---------|-------------------|
| Recognition service interface | `useRecognition` returns raw callbacks + state |
| Lesson controller | Logic embedded in `LessonPage.tsx` |
| Camera manager | `useCamera` + `getSharedCapture` singleton |
| Progress sync strategy | `useProgressSync` called ad-hoc in components |
| Sign registry | `ENGINE_SIGNS` imported directly from `engine/signs/index.ts` |

### 6.6 Testing Gaps

- Python: `pytest` with fixture-based regressions (good coverage for signs)
- Web: `vitest` only for analytics (`analytics/tests/`) — **no component or integration tests**
- E2E: `playwright.config.ts` exists but no tests in `e2e/`

### 6.7 Build/Config Issues

- `tsc --noEmit` misses errors — must use `tsc -b` (what `npm run build` runs)
- Vitest only discovers `**/tests/**/*.test.ts` — tests elsewhere ignored
- Vercel: only deploys on push to `main` only — but "Promote" button silently reverts prod (happened twice)

---

## 7. Refactoring Opportunities

### 7.1 Single Source of Truth for Recognition

**Option A**: Keep Python as source, auto-generate TS from Python (codegen)
- Write sign definitions once (Python dataclasses) → generate `engine/signs/index.ts`
- Use `pydantic` + custom generator or `py2ts`

**Option B**: Move sign definitions to JSON/YAML, both engines consume
- `signs/*.json` with schema matching `Sign` interface
- Python: `Sign.from_json()`, TS: `createSign(json)`

**Option C**: Shared WASM module (compile Python verifier to WASM via pyodide/emscripten)
- Overkill for now, but eliminates duplication entirely

### 7.2 Store Decomposition

Split `useUserStore` into domain stores:
```
useProgressStore      ← xp, level, streak, completedLessons, signAccuracy
useEconomyStore       ← gold, signs, badges, cosmetics, chests
useSocialStore        ← friends, renameCards
useSettingsStore      ← collectTrainingData, dominantHand, skillLevel
useQuestStore         ← dailyQuests, questsLastReset
```
Each persists independently; `useAuthStore` handles user identity.

### 7.3 Recognition Layer Extraction

Create `RecognitionService` interface:
```typescript
interface RecognitionService {
  init(): Promise<void>
  startLoop(video: HTMLVideoElement, sign: Sign): void
  stopLoop(): void
  onPass: (result: VerifyResult) => void
  onHint: (msg: string | null) => void
  onVerified: (entry: VerificationEntry) => void
  onAttempt: (attempt: AttemptRecord) => void
  framing: FramingStatus | null
  holdProgress: number | null
}
```
- `useRecognition` becomes thin React wrapper
- Enables testing with mock service
- Decouples pages from engine internals

### 7.4 Page Component Splitting

| Page | Extract To |
|------|------------|
| `LessonPage` | `LessonController` (flow), `LessonCamera` (camera+recognition), `LessonUI` (render) |
| `PracticePage` | `PracticeController`, `ExpressiveMode`, `ReceptiveMode`, `MixedMode` |
| `DuelPage` / `RoomPage` | `MultiplayerController`, `DuelEngine`, `RoomEngine` |
| `App.tsx` | `AppRouter` (screen state machine), `AuthGuard`, `OnboardingGate` |

### 7.5 Constants & Configuration

Extract magic numbers from verifier/handshape:
- `SMOOTH_SECONDS`, `CHEST_OFFSET_RATIO`, `CHIN_DY`, `RADIUS_CV_FREE`, etc.
- Move to `engine/config/constants.ts` + `core/config/constants.py` (shared source)

### 7.6 Testing Infrastructure

- Add `vitest` + `@testing-library/react` for component tests
- Test `useRecognition` with mocked `Capture` + synthetic `RollingBuffer`
- Add `playwright` E2E for critical flows: onboarding → first lesson → camera permission → pass sign

---

## 8. Proposed Target Architecture

```
web/src/
├── app/                    # App shell, routing, providers
│   ├── App.tsx
│   ├── AppRouter.tsx       # Screen state machine
│   ├── AuthProvider.tsx
│   └── providers.tsx
│
├── domains/                # Domain-driven stores (split from useUserStore)
│   ├── progress/
│   │   ├── useProgressStore.ts
│   │   ├── progressTypes.ts
│   │   └── progressActions.ts
│   ├── economy/
│   ├── social/
│   ├── settings/
│   └── quests/
│
├── features/               # Feature modules (vertical slices)
│   ├── recognition/
│   │   ├── RecognitionService.ts      # Interface
│   │   ├── MediaPipeRecognition.ts    # Implementation
│   │   ├── useRecognition.ts          # React hook
│   │   └── types.ts
│   ├── camera/
│   │   ├── CameraManager.ts
│   │   ├── useCamera.ts
│   │   └── types.ts
│   ├── lessons/
│   │   ├── LessonController.ts
│   │   ├── LessonFlow.ts
│   │   └── types.ts
│   ├── practice/
│   ├── multiplayer/
│   └── onboarding/
│
├── engine/                 # Recognition engine (port of Python core)
│   ├── schema.ts           # Generated from single source
│   ├── signs/
│   │   ├── index.ts        # Generated from single source
│   │   └── registry.ts     # SignRegistry class
│   ├── verifier/
│   │   ├── Verifier.ts
│   │   ├── HandshapeScorer.ts
│   │   ├── LocationScorer.ts
│   │   ├── MovementScorer.ts
│   │   └── RoleAssigner.ts
│   ├── capture/
│   │   ├── Capture.ts
│   │   └── SharedCapture.ts
│   ├── landmarks/
│   │   ├── Frame.ts
│   │   ├── RollingBuffer.ts
│   │   └── HandStabilizer.ts
│   ├── classifier/
│   │   ├── Classifier.ts
│   │   └── Gate.ts
│   └── config/
│       └── constants.ts    # All magic numbers
│
├── shared/                 # Truly shared utilities
│   ├── ui/                 # Zippy, WebcamMirror, ParameterChecklist, etc.
│   ├── lib/                # supabase, multiplayerRooms, handCheckGate
│   ├── analytics/          # track(), events, types
│   └── hooks/              # useSounds, useConfetti, useZippyLine
│
├── pages/                  # Thin page components (compose features)
│   ├── LessonPage.tsx
│   ├── PracticePage.tsx
│   └── ...
│
└── data/                   # Static content (signs, lessons, worlds, shop, badges)
    └── (unchanged)
```

---

## 9. Migration Principles

1. **Never change behavior** — every refactor must keep all tests passing
2. **Python first** — recognition changes start in `core/`, then port to `engine/`
3. **Small steps** — extract one module, verify, commit, repeat
4. **No rewrites** — incrementally split files, don't replace
5. **Test as you go** — add vitest tests for each extracted module
6. **Shared source for signs** — eliminate Python/TS duplication before store split

---

## 10. Next Steps (Phase 2)

1. **Create shared sign definition format** (JSON + schema) — single source for both engines
2. **Extract constants** from verifier/handshape into `engine/config/constants.ts`
3. **Split `useUserStore`** into domain stores (progress first — most used)
4. **Create `RecognitionService` interface** and extract `useRecognition` implementation
5. **Split `LessonPage`** into controller + UI components
6. **Add vitest tests** for each extracted module
7. **Document porting process** for recognition changes (Python → TS)

---

*End of Architecture Analysis*