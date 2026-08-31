import { frameShoulderWidth, type Frame } from '@/engine/landmarks';
import type { Sign } from '@/engine/schema';

export interface RecognitionEvidence {
  requiredHandCoverage: number;
  clippedFrameRatio: number;
  poseCoverage: number;
  signerScale: number;
  durationSeconds: number;
  maxFrameGapSeconds: number;
  stableTrackingRatio: number;
}

const EDGE_MARGIN = 0.02;

function clipped(frame: Frame): boolean {
  return frame.hands.some((hand) => hand.points.some(([x, y]) =>
    x <= frame.width * EDGE_MARGIN || x >= frame.width * (1 - EDGE_MARGIN)
    || y <= frame.height * EDGE_MARGIN || y >= frame.height * (1 - EDGE_MARGIN),
  ));
}

/** Measures raw capture evidence only; policy decides later whether any metric is punitive. */
export function measureRecognitionEvidence(frames: readonly Frame[], sign: Sign): RecognitionEvidence {
  if (frames.length === 0) {
    return { requiredHandCoverage: 0, clippedFrameRatio: 0, poseCoverage: 0, signerScale: 0, durationSeconds: 0, maxFrameGapSeconds: 0, stableTrackingRatio: 0 };
  }

  const requiredHands = sign.twoHanded ? 2 : 1;
  const shoulderWidths = frames.map(frameShoulderWidth).filter((width): width is number => width !== null);
  const handCoverage = frames.filter((frame) => frame.hands.length >= requiredHands).length / frames.length;
  const poseCoverage = frames.filter((frame) => frameShoulderWidth(frame) !== null).length / frames.length;
  const clippedFrameRatio = frames.filter(clipped).length / frames.length;
  const gaps = frames.slice(1).map((frame, index) => Math.max(0, frame.t - frames[index].t));
  const normalizedMotion = frames.slice(1).map((frame, index) => {
    const before = frames[index];
    const width = frameShoulderWidth(frame) ?? frameShoulderWidth(before);
    if (!width || !frame.hands[0] || !before.hands[0]) return 1;
    const [x, y] = frame.hands[0].points[0];
    const [previousX, previousY] = before.hands[0].points[0];
    return Math.hypot(x - previousX, y - previousY) / width;
  });

  return {
    requiredHandCoverage: handCoverage,
    clippedFrameRatio,
    poseCoverage,
    signerScale: shoulderWidths.length === 0 ? 0 : shoulderWidths.reduce((sum, width) => sum + width, 0) / shoulderWidths.length / frames[0].width,
    durationSeconds: Math.max(0, frames.at(-1)!.t - frames[0].t),
    maxFrameGapSeconds: gaps.length === 0 ? 0 : Math.max(...gaps),
    stableTrackingRatio: normalizedMotion.length === 0 ? 1 : 1 / (1 + normalizedMotion.reduce((sum, motion) => sum + motion, 0) / normalizedMotion.length),
  };
}
