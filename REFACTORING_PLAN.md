# QuickSign Refactoring Plan

*Step-by-step migration from current architecture to target architecture*

---

## Guiding Principles

1. **Behavior-preserving only** — every step must pass existing tests
2. **Small, reversible steps** — one module extraction per step
3. **Python-first for recognition** — changes to engine start in `core/`, then port
4. **No rewrites** — extract, don't replace
5. **Test as you go** — add vitest for each extracted module

---

## Phase 0: Prerequisites (Do First)

### Step 0.1: Add Test Infrastructure
- [ ] Install `@testing-library/react`, `@testing-library/user-event`, `vitest` (if not present)
- [ ] Configure `vitest.config.ts` to discover `**/*.test.tsx` (not just `tests/**`)
- [ ] Add `setupTests.ts` with React Testing Library config
- [ ] Verify `npm test` runs

### Step 0.2: Document Current Test Commands
```bash
# Python
pytest                    # or pytest tests/test_coffee.py -v

# Web
npm run build             # runs tsc -b (authoritative)
npm test                  # vitest
```

### Step 0.3: Baseline Verification
- [ ] Run `pytest` — all green
- [ ] Run `npm run build` — clean
- [ ] Run `npm test` — all green (currently only analytics tests)

---

## Phase 1: Eliminate Recognition Engine Duplication (Highest Impact)

### Step 1.1: Create Shared Sign Definition Format
**Goal**: Single source of truth for sign definitions, consumed by both Python and TS

**Approach**: JSON files + schema validation

```
signs/
├── hello.json
├── coffee.json
├── please.json
├── ... (51 files)
└── sign.schema.json          # JSON Schema for validation
```

**Schema** (mirrors `Sign` interface):
```json
{
  "name": "HELLO",
  "twoHanded": false,
  "dominant": { "kind": "open", "required": true, "minConfidence": 0.55 },
  "location": { "anchor": "forehead", "actingHand": "dominant", "maxDistRatio": 0.6, "required": true, "minConfidence": 0.6 },
  "movement": { "kind": "repeated", "actor": "dominant", "minCycles": 2, "minDurationS": 0.6, "required": true, "minConfidence": 0.6 }
}
```

**Tasks**:
1. Create `sign.schema.json` (Draft 2020-12)
2. Write Python script: `tools/generate_sign_jsons.py` — reads `signs/*.py` → emits `signs/*.json`
3. Write Python loader: `signs/__init__.py` loads from JSON (replaces current definitions)
4. Write TS generator: `tools/generate_engine_signs.ts` — reads JSON → emits `engine/signs/index.ts`
5. Verify: `pytest` passes, `npm run build` passes

**Risk**: Medium — schema must capture all fields. Test with 5 signs first.

### Step 1.2: Extract Verifier Constants to Shared Config
**File**: `core/config/constants.py` + `engine/config/constants.ts`

Move all magic numbers:
```python
# core/config/constants.py
SMOOTH_SECONDS = 0.5
CHEST_OFFSET_RATIO = 0.35
CHEST_VBAND = 0.25
CHEST_VFALL = 0.12
CHIN_DY = 0.45
CHIN_DY_BAND = 0.18
CHIN_DY_FALL = 0.17
FOREHEAD_DY_MAX = 0.15
FOREHEAD_DY_FALL = 0.30
BELLY_DY = 0.90
BELLY_DY_BAND = 0.30
BELLY_DY_FALL = 0.25
SHOULDER_FALL = 0.30
RADIUS_CV_FREE = 0.30
EXTRA_HAND_TOLERANCE = 0.8
EXTRA_HAND_MOTION_FLOOR = 0.30
CONVERGE_TAIL_S = 0.6
CONVERGE_TOUCH_RATIO = 0.25
MONO_FREE = 0.5
PASS_WINDOW = 0.6
PASS_MIN_FRAMES = 4
SUCCESS_SECONDS = 1.4
LEVEL_CARD_SECONDS = 3.0
STATIC_HOLD_SECONDS = 2.0
MIN_FRAMES_BEFORE_PASS = 30
PASS_THRESHOLD = 6
MIN_FRAME_INTERVAL_MS = 1000 / 28
STALL_TIMEOUT_MS = 6000
```

Same in `engine/config/constants.ts` (generated or manual sync).

**Tasks**:
1. Create `core/config/constants.py`
2. Update `core/verifier.py` to import from it
3. Create `web/src/engine/config/constants.ts`
4. Update `web/src/engine/verifier.ts`, `web/src/engine/movement.ts`, `web/src/hooks/useRecognition.ts`, `web/src/hooks/useCamera.ts`, `core/lesson.py` to import
5. Run tests

### Step 1.3: Port Verifier to Use Shared Constants (Python → TS Sync)
**Verify** both engines produce identical scores for same fixture.

**Tasks**:
1. Run Python test fixtures through verifier, capture scores
2. Run same fixtures through TS verifier (write small test script)
3. Compare — any divergence = bug to fix
4. Document any intentional differences

---

## Phase 2: Split the God Store (`useUserStore`)

### Step 2.1: Create Domain Store Structure
**Target**: `web/src/domains/`

```
domains/
├── progress/
│   ├── progressTypes.ts      # UserProgress interface
│   ├── useProgressStore.ts   # Zustand store
│   └── progressActions.ts    # addXp, completeLesson, recordSign, checkStreak, checkBadges
├── economy/
│   ├── economyTypes.ts
│   ├── useEconomyStore.ts    # gold, signs, badges, cosmetics, chests
│   └── economyActions.ts     # addGold, purchaseCosmetic, openChest, etc.
├── social/
│   ├── socialTypes.ts
│   ├── useSocialStore.ts     # friends, renameCards
│   └── socialActions.ts
├── settings/
│   ├── settingsTypes.ts
│   ├── useSettingsStore.ts   # collectTrainingData, dominantHand, skillLevel
│   └── settingsActions.ts
└── quests/
    ├── questTypes.ts
    ├── useQuestStore.ts      # dailyQuests, questsLastReset
    └── questActions.ts
```

### Step 2.2: Extract `progress` Store First (Most Used)
1. Copy `useUserStore` → `useProgressStore`
2. Keep only progress-related fields + actions:
   - `xp`, `level`, `streak`, `lastPracticeDate`, `streakFreezes`
   - `dailyGoalMinutes`, `dailyProgressMinutes`, `dailyProgressDate`
   - `completedLessons`, `signAccuracy`, `totalCorrectSigns`
   - `onboardingComplete`, `skillLevel`
   - `streakMilestonesAwarded`, `pendingChests`, `firstLessonCelebrated`
   - Actions: `addXp`, `addDailyMinutes`, `completeLesson`, `skipLesson`, `recordSign`, `checkStreak`, `checkBadges`, `mergeProgress` (progress fields only), `completeOnboarding`, `refreshDailyQuests` (progress part), `updateQuestProgress` (progress part), `markFirstLessonCelebrated`
3. Add its own persist middleware with key `asl-progress`
4. **Test**: Import in `LessonPage`, `PracticePage`, `StoryPage` — verify XP, streak, lessons work

### Step 2.3: Extract `economy` Store
1. Fields: `gold`, `signs`, `badges`, `ownedCosmetics`, `equippedBorder`, `equippedAvatar`, `activeBadge`, `showcaseBadges`, `speedHighScores`, `pendingChests` (chest logic), `unlockedWorldIds`
2. Actions: `addGold`, `addSigns`, `purchaseCosmetic`, `purchaseRenameCard`, `consumeRenameCard`, `purchaseStreakFreeze`, `unlockWorldWithGold`, `equipBorder`, `equipAvatar`, `setActiveBadge`, `toggleShowcaseBadge`, `recordSpeedResult`, `openChest`, `skipChest`, `awardBadge`
3. Persist key: `asl-economy`

### Step 2.4: Extract `social`, `settings`, `quests` Stores
(Same pattern — smaller, lower risk)

### Step 2.5: Create Facade Hook for Backward Compatibility
```typescript
// web/src/stores/useUserStore.ts (NEW - thin facade)
export function useUserStore() {
  const progress = useProgressStore()
  const economy = useEconomyStore()
  const social = useSocialStore()
  const settings = useSettingsStore()
  const quests = useQuestStore()
  return { ...progress, ...economy, ...social, ...settings, ...quests }
}
```
- All existing imports continue working
- Gradually migrate components to use domain stores directly

### Step 2.6: Remove Old `useUserStore` Implementation
- Delete the 662-line store
- Keep only the facade

---

## Phase 3: Extract Recognition Service

### Step 3.1: Define Interface
**File**: `web/src/features/recognition/RecognitionService.ts`

```typescript
export interface RecognitionService {
  init(): Promise<void>
  startLoop(video: HTMLVideoElement, sign: EngineSign): void
  stopLoop(): void
  setSign(sign: EngineSign): void
  getSnapshot(): Frame[]
  // State (read-only, subscribe via React hook)
  status: RecognitionStatus
  result: VerifyResult | null
  framing: FramingStatus | null
  holdProgress: number | null
  // Callbacks
  onPass: (result: VerifyResult) => void
  onHint: (msg: string | null) => void
  onVote: (decision: GateDecision) => void
  onVerified: (entry: VerificationEntry) => void
  onAttempt: (attempt: AttemptRecord) => void
}
```

### Step 3.2: Create Implementation
**File**: `web/src/features/recognition/MediaPipeRecognition.ts`

Move logic from `useRecognition.ts` into a class:
- `Capture` + `RollingBuffer` + `HandStabilizer` as instance fields
- `tick()` loop as method
- Callbacks as properties

### Step 3.3: Thin React Hook Wrapper
**File**: `web/src/features/recognition/useRecognition.ts`

```typescript
export function useRecognition(opts: UseRecognitionOpts) {
  const [status, setStatus] = useState<RecognitionStatus>('loading')
  const [result, setResult] = useState<VerifyResult | null>(null)
  // ... other state

  const serviceRef = useRef<RecognitionService>(new MediaPipeRecognition())

  // Bridge callbacks → setState
  useEffect(() => {
    serviceRef.current.onPass = (r) => { setResult(r); opts.onPass?.(r) }
    // ...
  }, [opts])

  return {
    status, result, framing, holdProgress,
    init: () => serviceRef.current.init(),
    startLoop: (v, s) => serviceRef.current.startLoop(v, s),
    stopLoop: () => serviceRef.current.stopLoop(),
    setSign: (s) => serviceRef.current.setSign(s),
    getSnapshot: () => serviceRef.current.getSnapshot(),
  }
}
```

### Step 3.4: Add Tests for RecognitionService
- Mock `Capture` → return synthetic frames
- Test: static sign hold → pass after `STATIC_HOLD_SECONDS`
- Test: movement sign → pass after `PASS_THRESHOLD` frames
- Test: classifier veto → `onHint` called, no `onPass`

---

## Phase 4: Split Page Components

### Step 4.1: `LessonPage` → Controller + UI
**Extract**:
1. `LessonController.ts` — lesson flow state machine (sign queue, phase, XP, skip)
2. `LessonCamera.tsx` — camera + recognition hook + framing guide
3. `LessonUI.tsx` — renders ReferenceClip, ParameterChecklist, WebcamMirror, Zippy

**LessonPage.tsx** becomes:
```tsx
export function LessonPage({ lessonId, onExit }) {
  const controller = useLessonController(lessonId, onExit)
  const camera = useLessonCamera(controller.currentSign)
  const ui = useLessonUI(controller, camera)

  return <LessonUIRenderer controller={controller} camera={camera} />
}
```

### Step 4.2: `PracticePage` → Mode Components
**Extract**:
1. `PracticeController.ts` — queue management, mode switching, session stats
2. `ExpressiveMode.tsx` — camera + recognition (reuses LessonCamera)
3. `ReceptiveMode.tsx` — multiple choice quiz (no camera)
4. `MixedMode.tsx` — orchestrates both

### Step 4.3: `DuelPage` / `RoomPage` → Multiplayer Engine
**Extract**:
1. `MultiplayerEngine.ts` — signaling, room state, turn management
2. `DuelEngine.ts` — 1v1 specific logic
3. `RoomEngine.ts` — 4-player specific logic

### Step 4.4: `App.tsx` → Router + Guards
**Extract**:
1. `AppRouter.tsx` — screen state machine (Screen union + transitions)
2. `AuthGuard.tsx` — banned, password recovery, terms gate
3. `OnboardingGate.tsx` — onboardingComplete check
4. `DevRoutes.tsx` — /avatarlab, /calibrate, /test-signs

---

## Phase 5: Testing & Documentation

### Step 5.1: Component Tests
- `LessonController.test.ts` — phase transitions, XP, streak
- `RecognitionService.test.ts` — pass/veto/hold logic
- `PracticeController.test.ts` — queue advance, mode switch

### Step 5.2: E2E Tests (Playwright)
- `onboarding.spec.ts` — guest → camera permission → first lesson
- `lesson.spec.ts` — complete lesson → streak → chest
- `camera.spec.ts` — denied → retry → stalled → recovery

### Step 5.3: Architecture Decision Records (ADRs)
Create `docs/adr/`:
- ADR-001: Shared sign definitions (JSON)
- ADR-002: Domain stores split
- ADR-003: Recognition service extraction
- ADR-004: Page component decomposition

---

## Phase 6: Ongoing Improvements (Post-Migration)

### Step 6.1: Auto-generate TS from Python (or vice versa)
- Evaluate `py2ts`, `pydantic-to-typescript`, or custom script
- CI check: Python and TS sign definitions stay in sync

### Step 6.2: WASM Port of Verifier (Optional)
- Compile `core/verifier.py` → WASM via Pyodide
- Both Python and TS call same WASM module
- Eliminates duplication entirely

### Step 6.3: Performance Budgets
- Bundle size targets per route
- Recognition loop frame budget (<16ms)
- Add `web-vitals` monitoring

---

## Execution Order Summary

| Phase | Step | Description | Est. Effort |
|-------|------|-------------|-------------|
| 0 | 0.1-0.3 | Test infra + baseline | 2h |
| 1 | 1.1 | Shared sign JSON format | 4h |
| 1 | 1.2 | Extract constants | 1h |
| 1 | 1.3 | Verify Python↔TS parity | 2h |
| 2 | 2.1-2.2 | Progress store split | 4h |
| 2 | 2.3-2.4 | Economy/social/settings/quests | 3h |
| 2 | 2.5-2.6 | Facade + cleanup | 2h |
| 3 | 3.1-3.4 | RecognitionService + tests | 6h |
| 4 | 4.1 | LessonPage split | 4h |
| 4 | 4.2 | PracticePage split | 4h |
| 4 | 4.3-4.4 | Multiplayer + AppRouter | 4h |
| 5 | 5.1-5.3 | Tests + ADRs | 4h |

**Total**: ~40 hours (can be done incrementally over 2-3 weeks)

---

## Rollback Plan Per Step

| Step | Rollback |
|------|----------|
| 1.1 | Keep `signs/*.py` as source; JSON is generated artifact |
| 1.2 | Constants are just imports — revert import paths |
| 2.x | Facade `useUserStore` maintains 100% API compatibility |
| 3.x | `useRecognition` hook signature unchanged |
| 4.x | Page components still export same props |

---

*End of Refactoring Plan*