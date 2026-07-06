export interface World {
  id: string;
  title: string;
  emoji: string;
  description: string;
  color: string;
  bgGradient: string;
  unlockCondition: string | null;
  unitIds: string[];
  badgeId: string;
  storyId: string | null;
}

export const WORLDS: World[] = [
  {
    id: 'greetings',
    title: 'Say Hello',
    emoji: '👋',
    description: 'Your first signs — say hello and meet Zippy',
    color: '#14B8A6',
    bgGradient: 'linear-gradient(135deg, #0F766E, #14B8A6)',
    unlockCondition: null,
    unitIds: ['unit-0'],
    badgeId: 'greetings_story',
    storyId: 'greetings-story',
  },
  {
    id: 'classroom',
    title: 'Classroom',
    emoji: '🏫',
    description: 'Teachers, friends, and everyday school signs',
    color: '#3B82F6',
    bgGradient: 'linear-gradient(135deg, #1E3A8A, #3B82F6)',
    unlockCondition: 'greetings-story',
    unitIds: ['unit-5', 'unit-6'],
    badgeId: 'classroom_story',
    storyId: 'classroom-story',
  },
  {
    id: 'coffee',
    title: 'Coffee Shop',
    emoji: '☕',
    description: 'Greetings, orders, and small talk at the café',
    color: '#A855F7',
    bgGradient: 'linear-gradient(135deg, #4C1D95, #7C3AED)',
    unlockCondition: 'classroom-story',
    unitIds: ['unit-1', 'unit-2'],
    badgeId: 'coffee_story',
    storyId: 'coffee-story',
  },
  {
    id: 'hospital',
    title: 'Hospital',
    emoji: '🏥',
    description: 'Emergencies, symptoms, and care with the medical team',
    color: '#EF4444',
    bgGradient: 'linear-gradient(135deg, #7F1D1D, #DC2626)',
    unlockCondition: 'coffee-story',
    unitIds: ['unit-3', 'unit-4'],
    badgeId: 'hospital_story',
    storyId: 'hospital-story',
  },
];

export function getWorld(id: string): World | undefined {
  return WORLDS.find((w) => w.id === id);
}
