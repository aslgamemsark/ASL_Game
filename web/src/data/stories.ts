import type { ZippyExpression } from './zippy';

export interface DialogueLine {
  npcText: string;
  npcMood: 'neutral' | 'happy' | 'curious' | 'surprised';
  /** What the player's character says back, in plain English — shown above the sign prompt so the
   *  exchange reads as a real conversation, not just a bare vocabulary word. */
  userLine: string;
  requiredSignId: string;
  hint: string;
  npcResponse: string;
}

export interface StoryScript {
  id: string;
  title: string;
  description: string;
  npcName: string;
  npcEmoji: string;
  backgroundEmoji: string;
  /** Dr. Reeves, Ms. Rowan, and the coffee-shop barista are still Zippy underneath — just dressed
   *  for the part. When set, this costume art replaces npcEmoji everywhere the NPC appears
   *  (story screens, world map node icon). Omitted for stories Zippy narrates as himself. */
  npcCostume?: ZippyExpression;
  lines: DialogueLine[];
}

export const GREETINGS_STORY: StoryScript = {
  id: 'greetings-story',
  title: 'Meet Zippy',
  description: 'Say hello and make a new friend',
  npcName: 'Zippy',
  npcEmoji: '🤟',
  backgroundEmoji: '🌟',
  lines: [
    {
      npcText: "Hi there! I'm Zippy — can you say hello back?",
      npcMood: 'happy',
      userLine: 'Hi Zippy!',
      requiredSignId: 'HELLO',
      hint: 'Wave hello!',
      npcResponse: "Yay, hi! 👋",
    },
    {
      npcText: "Nice to meet you! Can you sign PLEASE for me?",
      npcMood: 'curious',
      userLine: 'Sure, please!',
      requiredSignId: 'PLEASE',
      hint: 'Circle your open hand on your chest',
      npcResponse: "Aw, so polite! 😊",
    },
    {
      npcText: "Now point to yourself — sign YOU pointing this way!",
      npcMood: 'neutral',
      userLine: "That's me!",
      requiredSignId: 'YOU',
      hint: 'Point your index finger forward',
      npcResponse: "That's you alright! 😄",
    },
    {
      npcText: "Let's spell a word together — fingerspell the letter H!",
      npcMood: 'curious',
      userLine: 'H — like this!',
      requiredSignId: 'LETTER_H',
      hint: 'Index and middle fingers together, pointing sideways',
      npcResponse: "H! Nice handshape! ✋",
    },
    {
      npcText: "Now finish it off — fingerspell the letter I!",
      npcMood: 'surprised',
      userLine: 'And I — all done!',
      requiredSignId: 'LETTER_I',
      hint: 'Fist with only the pinky finger raised',
      npcResponse: "H-I — you just spelled HI! Welcome to Segno! 🌟",
    },
  ],
};

export const COFFEE_SHOP_STORY: StoryScript = {
  id: 'coffee-story',
  title: 'At the Coffee Shop',
  description: 'Order a coffee from Zippy the barista',
  npcName: 'Zippy',
  npcEmoji: '🤟',
  npcCostume: 'barista',
  backgroundEmoji: '☕',
  lines: [
    {
      npcText: "Hey there! Welcome to Zippy's Coffee! Can you say hello?",
      npcMood: 'happy',
      userLine: 'Hi there!',
      requiredSignId: 'HELLO',
      hint: 'Wave hello!',
      npcResponse: "Hi! Great to see you! 👋",
    },
    {
      npcText: "What can I get for you today?",
      npcMood: 'curious',
      userLine: "I'd like a coffee.",
      requiredSignId: 'COFFEE',
      hint: 'Two fists, grind the top over the bottom',
      npcResponse: "A coffee, coming right up! ☕",
    },
    {
      npcText: "Anything else you'd like?",
      npcMood: 'neutral',
      userLine: "That's all, please.",
      requiredSignId: 'PLEASE',
      hint: 'Circle your open hand on your chest',
      npcResponse: "Of course! Since you asked so nicely 😊",
    },
    {
      npcText: "Do you want milk with that?",
      npcMood: 'curious',
      userLine: 'Yes, please!',
      requiredSignId: 'YES',
      hint: 'Nod your fist up and down',
      npcResponse: "Milk it is! 🥛",
    },
    {
      npcText: "It's happy hour — want a second cup? Sign MORE if you do!",
      npcMood: 'surprised',
      userLine: 'Yes, more please!',
      requiredSignId: 'MORE',
      hint: 'Two claw hands, tap your fingertips together',
      npcResponse: "You got it — one more coming right up! ☕☕",
    },
    {
      npcText: "Here's your coffee! That'll be $4.50.",
      npcMood: 'happy',
      userLine: 'Thank you so much!',
      requiredSignId: 'THANK_YOU',
      hint: 'Flat hand from chin, move outward',
      npcResponse: "You're welcome! Have a great day! 💜",
    },
  ],
};

export const COFFEE_SHOP_RUSH_STORY: StoryScript = {
  id: 'coffee-story-2',
  title: 'Coffee Shop: Rush Hour',
  description: "It's the morning rush — keep up with Zippy!",
  npcName: 'Zippy',
  npcEmoji: '🤟',
  npcCostume: 'barista',
  backgroundEmoji: '⏰',
  lines: [
    {
      npcText: "Whoa, it's slammed this morning — quick, say hello!",
      npcMood: 'surprised',
      userLine: 'Hi! Busy morning!',
      requiredSignId: 'HELLO',
      hint: 'Wave hello!',
      npcResponse: "Hey! Line's already out the door. 👋",
    },
    {
      npcText: "No time to chat — what do you want?",
      npcMood: 'neutral',
      userLine: 'Just a coffee, please.',
      requiredSignId: 'COFFEE',
      hint: 'Two fists, grind the top over the bottom',
      npcResponse: "Coffee, got it — brewing now! ☕",
    },
    {
      npcText: "The next customer wants one too — sign WANT for them.",
      npcMood: 'curious',
      userLine: 'They want one too.',
      requiredSignId: 'WANT',
      hint: 'Both open hands, pull down toward you',
      npcResponse: "Two coffees coming up! ☕☕",
    },
    {
      npcText: "We're out of regular cups — is MORE okay, in a bigger one?",
      npcMood: 'surprised',
      userLine: 'More is fine!',
      requiredSignId: 'MORE',
      hint: 'Two claw hands, tap your fingertips together',
      npcResponse: "Big cup it is — crisis averted! 😅",
    },
    {
      npcText: "Rush is finally over — thanks for hanging in there!",
      npcMood: 'happy',
      userLine: 'Thank you for the help!',
      requiredSignId: 'THANK_YOU',
      hint: 'Flat hand from chin, move outward',
      npcResponse: "You're a lifesaver. See you tomorrow! 💜",
    },
  ],
};

export const HOSPITAL_STORY: StoryScript = {
  id: 'hospital-story',
  title: 'At the Hospital',
  description: 'Help a patient communicate with the doctor',
  npcName: 'Dr. Reeves',
  npcEmoji: '🩺',
  npcCostume: 'doctor',
  backgroundEmoji: '🏥',
  lines: [
    {
      npcText: "A patient needs help — can you sign it?",
      npcMood: 'neutral',
      userLine: 'They need help!',
      requiredSignId: 'HELP',
      hint: 'Fist on palm, lift it up!',
      npcResponse: "Great — I can see you know ASL. Let's communicate!",
    },
    {
      npcText: "Where is the pain?",
      npcMood: 'curious',
      userLine: 'Right here, it hurts.',
      requiredSignId: 'PAIN',
      hint: 'Point both index fingers toward each other',
      npcResponse: "Got it — I'll check the area right away.",
    },
    {
      npcText: "Do they have a fever?",
      npcMood: 'curious',
      userLine: 'Yes, a fever.',
      requiredSignId: 'FEVER',
      hint: 'Sweep your open hand across your forehead',
      npcResponse: "Temperature is elevated. I'll get medication.",
    },
    {
      npcText: "The patient is thirsty. What do they need?",
      npcMood: 'neutral',
      userLine: 'Some water, please.',
      requiredSignId: 'WATER',
      hint: 'Three fingers (W shape) at your chin',
      npcResponse: "Water — good call. Hydration is key for recovery.",
    },
    {
      npcText: "Time to give them their medication.",
      npcMood: 'neutral',
      userLine: "Here's their medicine.",
      requiredSignId: 'MEDICINE',
      hint: 'Open hand twists over your flat palm',
      npcResponse: "Medicine given. The patient looks more comfortable.",
    },
    {
      npcText: "They feel dizzy now — is that right?",
      npcMood: 'curious',
      userLine: 'Yes, a bit dizzy.',
      requiredSignId: 'DIZZY',
      hint: 'Circle your open hand near your face',
      npcResponse: "Noted — that can be a side effect. We're monitoring.",
    },
    {
      npcText: "This is serious. Where do we need to go?",
      npcMood: 'surprised',
      userLine: 'To the hospital!',
      requiredSignId: 'HOSPITAL',
      hint: 'Two fingers (H) by your shoulder, draw a cross',
      npcResponse: "The hospital! I'll call an ambulance now. 🚑",
    },
    {
      npcText: "It's urgent — sign the emergency!",
      npcMood: 'surprised',
      userLine: "It's an emergency!",
      requiredSignId: 'EMERGENCY',
      hint: 'Make a claw and shake it fast!',
      npcResponse: "Amazing work — you helped save a life today! 💙",
    },
  ],
};

export const CLASSROOM_STORY: StoryScript = {
  id: 'classroom-story',
  title: 'At School',
  description: 'Meet your teacher and make a new friend',
  npcName: 'Ms. Rowan',
  npcEmoji: '👩‍🏫',
  npcCostume: 'teacher',
  backgroundEmoji: '🏫',
  lines: [
    {
      npcText: "Good morning! Welcome to class — can you say hello?",
      npcMood: 'happy',
      userLine: 'Good morning!',
      requiredSignId: 'HELLO',
      hint: 'Wave hello!',
      npcResponse: "Hello! Glad you're here! 👋",
    },
    {
      npcText: "I'm your teacher — do you know the sign for TEACHER?",
      npcMood: 'curious',
      userLine: 'Yes, my teacher!',
      requiredSignId: 'TEACHER',
      hint: 'Hands at your temples, move outward twice',
      npcResponse: "That's right, that's me! 🍎",
    },
    {
      npcText: "Time for our lesson — please WRITE down today's date.",
      npcMood: 'neutral',
      userLine: 'Writing it now.',
      requiredSignId: 'WRITE',
      hint: 'Pinch a pen and scribble on your other palm',
      npcResponse: "Great handwriting! ✍️",
    },
    {
      npcText: "Now let's READ the first chapter together.",
      npcMood: 'neutral',
      userLine: "Let's read together.",
      requiredSignId: 'READ',
      hint: 'Sweep a V-hand down your other palm',
      npcResponse: "Wonderful reading! 📖",
    },
    {
      npcText: "There's a new student next to you — what's their NAME?",
      npcMood: 'curious',
      userLine: "What's your name?",
      requiredSignId: 'NAME',
      hint: 'Cross your H-hands and tap together twice',
      npcResponse: "Nice to meet them! 🙋",
    },
    {
      npcText: "You two seem to get along — are you FRIENDs now?",
      npcMood: 'surprised',
      userLine: "Yes, we're friends!",
      requiredSignId: 'FRIEND',
      hint: 'Hook your index fingers and tap together twice',
      npcResponse: "A new friendship! That's wonderful. 🤝",
    },
    {
      npcText: "Class is over — thank you for a great lesson today!",
      npcMood: 'happy',
      userLine: 'Thank you, teacher!',
      requiredSignId: 'THANK_YOU',
      hint: 'Flat hand from chin, move outward',
      npcResponse: "You're welcome — see you tomorrow! 🎒",
    },
  ],
};

export const STORIES: StoryScript[] = [GREETINGS_STORY, COFFEE_SHOP_STORY, COFFEE_SHOP_RUSH_STORY, HOSPITAL_STORY, CLASSROOM_STORY];
