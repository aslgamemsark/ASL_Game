import type { LessonUnit } from '@/types/lesson';

export const LESSON_SKIP_COST = 40;

export const LESSON_UNITS: LessonUnit[] = [
  {
    id: 'unit-0',
    title: 'Say Hello',
    description: 'Your very first signs',
    color: '#14B8A6',
    nodes: [
      {
        id: 'greetings-intro',
        title: 'Say Hello',
        description: 'Wave hello and be polite',
        signIds: ['HELLO', 'PLEASE', 'YOU'],
        status: 'current',
        xpReward: 15,
        iconEmoji: '👋',
        scenario: 'greetings',
      },
      {
        id: 'spell-hi',
        title: 'Spell It Out',
        description: 'Fingerspell H and I',
        signIds: ['LETTER_H', 'LETTER_I'],
        status: 'locked',
        xpReward: 15,
        iconEmoji: '🔤',
        scenario: 'greetings',
      },
      {
        id: 'greetings-story',
        title: 'Meet Zippy',
        description: 'Say hi to Zippy — role-play!',
        signIds: ['HELLO', 'PLEASE', 'YOU', 'LETTER_H', 'LETTER_I'],
        status: 'locked',
        xpReward: 30,
        iconEmoji: '🌟',
        scenario: 'greetings',
      },
    ],
  },
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
    ],
  },
  {
    id: 'unit-2',
    title: 'Building Skills',
    description: 'Expand your vocabulary',
    color: '#F59E0B',
    nodes: [
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
      {
        id: 'coffee-story-2',
        title: 'Coffee Shop: Rush Hour',
        description: "It's the morning rush — role-play!",
        signIds: ['HELLO', 'COFFEE', 'WANT', 'MORE', 'THANK_YOU'],
        status: 'locked',
        xpReward: 35,
        iconEmoji: '⏰',
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
  {
    id: 'unit-5',
    title: 'Classroom Time',
    description: 'Learn signs for school and study',
    color: '#3B82F6',
    nodes: [
      {
        id: 'classroom-greetings',
        title: 'Classroom Greetings',
        description: 'Say hello and be polite at school',
        signIds: ['HELLO', 'PLEASE', 'THANK_YOU'],
        status: 'current',
        xpReward: 15,
        iconEmoji: '🎒',
        scenario: 'classroom',
      },
      {
        id: 'classroom-basics',
        title: 'Classroom Basics',
        description: 'Teacher, write, read, and friend',
        signIds: ['TEACHER', 'WRITE', 'READ', 'NAME', 'FRIEND'],
        status: 'locked',
        xpReward: 25,
        iconEmoji: '📚',
        scenario: 'classroom',
      },
    ],
  },
  {
    id: 'unit-6',
    title: 'Classroom Story',
    description: 'Meet your teacher and make a friend',
    color: '#6366F1',
    nodes: [
      {
        id: 'classroom-story',
        title: 'Classroom',
        description: 'A day at school — role-play!',
        signIds: ['HELLO', 'TEACHER', 'WRITE', 'READ', 'NAME', 'FRIEND', 'THANK_YOU'],
        status: 'locked',
        xpReward: 35,
        iconEmoji: '🏫',
        scenario: 'classroom',
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

/** Which unit a lesson belongs to — analytics uses this + data/worlds.ts's getWorldIdForUnit to
 *  label lesson/sign-attempt events with a world_id without every caller re-walking LESSON_UNITS. */
export function getUnitIdForLesson(lessonId: string): string | null {
  for (const unit of LESSON_UNITS) {
    if (unit.nodes.some((node) => node.id === lessonId)) return unit.id;
  }
  return null;
}
