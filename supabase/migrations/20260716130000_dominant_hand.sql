-- ============================================================
-- Dominant hand — 2026-07-16
--
-- Captured during onboarding ("raise the hand you sign with"). The recognition engine is
-- handedness-agnostic (dominant/non-dominant roles are assigned per attempt by motion), so this
-- is a personalization preference only, not a recognition input. Stored on user_progress and
-- synced by useProgressSync alongside the other progress fields (null until chosen/skipped).
-- ============================================================

alter table public.user_progress
  add column if not exists dominant_hand text
  check (dominant_hand is null or dominant_hand in ('left', 'right'));
