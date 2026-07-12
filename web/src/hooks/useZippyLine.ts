import { useState } from 'react';
import { pickZippyLine, type ZippyContext } from '@/data/zippy';

// Picks a Zippy line once per mount and keeps it stable across re-renders (calling the rotating
// pickZippyLine directly in render would return a different line every frame). Across mounts it
// still rotates, so the learner sees variety without flicker. Pass a seed for a deterministic line.
export function useZippyLine(context: ZippyContext, seed?: number): string {
  return useState(() => pickZippyLine(context, seed))[0];
}
