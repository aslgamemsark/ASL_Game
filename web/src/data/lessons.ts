import type { LessonUnit } from '@/types/lesson';

export const LESSON_UNITS: LessonUnit[] = [
  {
    id: 'unit-1',
    title: 'Getting Started',
    description: 'Learn your first signs',
    color: '#A855F7',
    nodes: [
      {
        id: 'greetings-1',
        title: 'Greetings',
        description: 'Say hello and be polite',
        signIds: ['HELLO', 'PLEASE', 'THANK_YOU', 'YOU'],
        status: 'current',
        xpReward: 20,
        iconEmoji: '👋',
        scenario: 'coffee_shop',
      },
      {
        id: 'cafe-order',
        title: 'Cafe Order',
        description: 'Order at the coffee shop',
        signIds: ['COFFEE', 'WANT', 'MORE', 'YES'],
        status: 'locked',
        xpReward: 15,
        iconEmoji: '☕',
        scenario: 'coffee_shop',
      },
      {
        id: 'fingerspelling-1',
        title: 'Fingerspelling I',
        description: 'Learn letters A, B, L',
        signIds: ['LETTER_A', 'LETTER_B', 'LETTER_L'],
        status: 'locked',
        xpReward: 15,
        iconEmoji: '🔤',
        scenario: 'coffee_shop',
      },
    ],
  },
  {
    id: 'unit-2',
    title: 'Building Skills',
    description: 'Expand your vocabulary',
    color: '#F59E0B',
    nodes: [
      {
        id: 'fingerspelling-2',
        title: 'Fingerspelling II',
        description: 'Learn letters V, Y',
        signIds: ['LETTER_V', 'LETTER_Y'],
        status: 'locked',
        xpReward: 10,
        iconEmoji: '✌️',
        scenario: 'coffee_shop',
      },
      {
        id: 'coffee-story',
        title: 'Coffee Shop',
        description: 'Order a coffee — role-play!',
        signIds: ['HELLO', 'COFFEE', 'WANT', 'PLEASE', 'THANK_YOU', 'YES'],
        status: 'locked',
        xpReward: 30,
        iconEmoji: '🏪',
        scenario: 'coffee_shop',
      },
    ],
  },
  {
    id: 'unit-3',
    title: 'Hospital Care',
    description: 'Communicate in a medical emergency',
    color: '#EF4444',
    nodes: [
      {
        id: 'first-aid',
        title: 'First Aid',
        description: 'Call for help and locate pain',
        signIds: ['HELP', 'PAIN', 'EMERGENCY'],
        status: 'locked',
        xpReward: 20,
        iconEmoji: '🚨',
        scenario: 'hospital',
      },
      {
        id: 'body-check',
        title: 'Body Check',
        description: 'Describe symptoms to the doctor',
        signIds: ['FEVER', 'WATER', 'DIZZY'],
        status: 'locked',
        xpReward: 20,
        iconEmoji: '🌡️',
        scenario: 'hospital',
      },
      {
        id: 'treatment',
        title: 'Treatment',
        description: 'Signs for care and where to go',
        signIds: ['MEDICINE', 'HOSPITAL'],
        status: 'locked',
        xpReward: 15,
        iconEmoji: '💊',
        scenario: 'hospital',
      },
      {
        id: 'hospital-story',
        title: 'Hospital',
        description: 'Help a patient — role-play!',
        signIds: ['HELP', 'PAIN', 'MEDICINE', 'EMERGENCY', 'FEVER', 'WATER', 'HOSPITAL', 'DIZZY'],
        status: 'locked',
        xpReward: 40,
        iconEmoji: '🏥',
        scenario: 'hospital',
      },
    ],
  },
  {
    id: 'unit-4',
    title: 'Hospital Advanced',
    description: 'Meet the medical team and more',
    color: '#34D399',
    nodes: [
      {
        id: 'medical-staff',
        title: 'Medical Staff',
        description: 'Doctor, nurse, and feeling sick',
        signIds: ['DOCTOR', 'NURSE', 'SICK'],
        status: 'locked',
        xpReward: 20,
        iconEmoji: '👩‍⚕️',
        scenario: 'hospital',
      },
      {
        id: 'recovery',
        title: 'Recovery',
        description: 'Breathe and take your medicine',
        signIds: ['BREATHE'],
        status: 'locked',
        xpReward: 15,
        iconEmoji: '🌬️',
        scenario: 'hospital',
      },
    ],
  },
];

export function getNextAvailableLesson(completedIds: string[]): string | null {
  for (const unit of LESSON_UNITS) {
    for (const node of unit.nodes) {
      if (!completedIds.includes(node.id)) {
        return node.id;
      }
    }
  }
  return null;
}

export function getLessonById(id: string) {
  for (const unit of LESSON_UNITS) {
    for (const node of unit.nodes) {
      if (node.id === id) return node;
    }
  }
  return null;
}
