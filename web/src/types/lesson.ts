export type LessonNodeStatus = 'locked' | 'available' | 'current' | 'completed';

export interface LessonNode {
  id: string;
  title: string;
  description: string;
  signIds: string[];
  status: LessonNodeStatus;
  xpReward: number;
  iconEmoji: string;
  scenario: 'coffee_shop' | 'hospital' | 'classroom';
}

export interface LessonUnit {
  id: string;
  title: string;
  description: string;
  nodes: LessonNode[];
  color: string;
}

export interface LessonPrompt {
  signId: string;
  signName: string;
  promptText: string;
  clip?: string;
}

export type LessonState =
  | { phase: 'intro'; lessonId: string }
  | { phase: 'signing'; promptIndex: number; hearts: number }
  | { phase: 'result'; correct: boolean; promptIndex: number; hearts: number }
  | { phase: 'complete'; xpEarned: number; accuracy: number };
