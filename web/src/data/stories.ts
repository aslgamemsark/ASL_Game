export interface DialogueLine {
  npcText: string;
  npcMood: 'neutral' | 'happy' | 'curious' | 'surprised';
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
      requiredSignId: 'HELLO',
      hint: 'Wave hello!',
      npcResponse: "Yay, hi! 👋",
    },
    {
      npcText: "Nice to meet you! Can you sign PLEASE for me?",
      npcMood: 'curious',
      requiredSignId: 'PLEASE',
      hint: 'Circle your open hand on your chest',
      npcResponse: "Aw, so polite! 😊",
    },
    {
      npcText: "Now point to yourself — sign YOU pointing this way!",
      npcMood: 'neutral',
      requiredSignId: 'YOU',
      hint: 'Point your index finger forward',
      npcResponse: "That's you alright! 😄",
    },
    {
      npcText: "What's your NAME? Go ahead and sign it!",
      npcMood: 'curious',
      requiredSignId: 'NAME',
      hint: 'Cross your H-hands and tap together twice',
      npcResponse: "Great to know you! 🙋",
    },
    {
      npcText: "I think we're going to be great FRIENDs!",
      npcMood: 'surprised',
      requiredSignId: 'FRIEND',
      hint: 'Hook your index fingers and tap together twice',
      npcResponse: "Friends forever! Welcome to SignUp! 🌟",
    },
  ],
};

export const COFFEE_SHOP_STORY: StoryScript = {
  id: 'coffee-story',
  title: 'At the Coffee Shop',
  description: 'Order a coffee from Zippy the barista',
  npcName: 'Zippy',
  npcEmoji: '🤟',
  backgroundEmoji: '☕',
  lines: [
    {
      npcText: "Hey there! Welcome to Zippy's Coffee! Can you say hello?",
      npcMood: 'happy',
      requiredSignId: 'HELLO',
      hint: 'Wave hello!',
      npcResponse: "Hi! Great to see you! 👋",
    },
    {
      npcText: "What can I get for you today?",
      npcMood: 'curious',
      requiredSignId: 'COFFEE',
      hint: 'Two fists, grind the top over the bottom',
      npcResponse: "A coffee, coming right up! ☕",
    },
    {
      npcText: "Anything else you'd like?",
      npcMood: 'neutral',
      requiredSignId: 'PLEASE',
      hint: 'Circle your open hand on your chest',
      npcResponse: "Of course! Since you asked so nicely 😊",
    },
    {
      npcText: "Do you want milk with that?",
      npcMood: 'curious',
      requiredSignId: 'YES',
      hint: 'Nod your fist up and down',
      npcResponse: "Milk it is! 🥛",
    },
    {
      npcText: "It's happy hour — want a second cup? Sign MORE if you do!",
      npcMood: 'surprised',
      requiredSignId: 'MORE',
      hint: 'Two claw hands, tap your fingertips together',
      npcResponse: "You got it — one more coming right up! ☕☕",
    },
    {
      npcText: "Here's your coffee! That'll be $4.50.",
      npcMood: 'happy',
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
  backgroundEmoji: '⏰',
  lines: [
    {
      npcText: "Whoa, it's slammed this morning — quick, say hello!",
      npcMood: 'surprised',
      requiredSignId: 'HELLO',
      hint: 'Wave hello!',
      npcResponse: "Hey! Line's already out the door. 👋",
    },
    {
      npcText: "No time to chat — what do you want?",
      npcMood: 'neutral',
      requiredSignId: 'COFFEE',
      hint: 'Two fists, grind the top over the bottom',
      npcResponse: "Coffee, got it — brewing now! ☕",
    },
    {
      npcText: "The next customer wants one too — sign WANT for them.",
      npcMood: 'curious',
      requiredSignId: 'WANT',
      hint: 'Both open hands, pull down toward you',
      npcResponse: "Two coffees coming up! ☕☕",
    },
    {
      npcText: "We're out of regular cups — is MORE okay, in a bigger one?",
      npcMood: 'surprised',
      requiredSignId: 'MORE',
      hint: 'Two claw hands, tap your fingertips together',
      npcResponse: "Big cup it is — crisis averted! 😅",
    },
    {
      npcText: "Rush is finally over — thanks for hanging in there!",
      npcMood: 'happy',
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
  backgroundEmoji: '🏥',
  lines: [
    {
      npcText: "A patient needs help — can you sign it?",
      npcMood: 'neutral',
      requiredSignId: 'HELP',
      hint: 'Fist on palm, lift it up!',
      npcResponse: "Great — I can see you know ASL. Let's communicate!",
    },
    {
      npcText: "Where is the pain?",
      npcMood: 'curious',
      requiredSignId: 'PAIN',
      hint: 'Point both index fingers toward each other',
      npcResponse: "Got it — I'll check the area right away.",
    },
    {
      npcText: "Do they have a fever?",
      npcMood: 'curious',
      requiredSignId: 'FEVER',
      hint: 'Sweep your open hand across your forehead',
      npcResponse: "Temperature is elevated. I'll get medication.",
    },
    {
      npcText: "The patient is thirsty. What do they need?",
      npcMood: 'neutral',
      requiredSignId: 'WATER',
      hint: 'Three fingers (W shape) at your chin',
      npcResponse: "Water — good call. Hydration is key for recovery.",
    },
    {
      npcText: "Time to give them their medication.",
      npcMood: 'neutral',
      requiredSignId: 'MEDICINE',
      hint: 'Open hand twists over your flat palm',
      npcResponse: "Medicine given. The patient looks more comfortable.",
    },
    {
      npcText: "They feel dizzy now — is that right?",
      npcMood: 'curious',
      requiredSignId: 'DIZZY',
      hint: 'Circle your open hand near your face',
      npcResponse: "Noted — that can be a side effect. We're monitoring.",
    },
    {
      npcText: "This is serious. Where do we need to go?",
      npcMood: 'surprised',
      requiredSignId: 'HOSPITAL',
      hint: 'Two fingers (H) by your shoulder, draw a cross',
      npcResponse: "The hospital! I'll call an ambulance now. 🚑",
    },
    {
      npcText: "It's urgent — sign the emergency!",
      npcMood: 'surprised',
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
  backgroundEmoji: '🏫',
  lines: [
    {
      npcText: "Good morning! Welcome to class — can you say hello?",
      npcMood: 'happy',
      requiredSignId: 'HELLO',
      hint: 'Wave hello!',
      npcResponse: "Hello! Glad you're here! 👋",
    },
    {
      npcText: "I'm your teacher — do you know the sign for TEACHER?",
      npcMood: 'curious',
      requiredSignId: 'TEACHER',
      hint: 'Hands at your temples, move outward twice',
      npcResponse: "That's right, that's me! 🍎",
    },
    {
      npcText: "Time for our lesson — please WRITE down today's date.",
      npcMood: 'neutral',
      requiredSignId: 'WRITE',
      hint: 'Pinch a pen and scribble on your other palm',
      npcResponse: "Great handwriting! ✍️",
    },
    {
      npcText: "Now let's READ the first chapter together.",
      npcMood: 'neutral',
      requiredSignId: 'READ',
      hint: 'Sweep a V-hand down your other palm',
      npcResponse: "Wonderful reading! 📖",
    },
    {
      npcText: "There's a new student next to you — what's their NAME?",
      npcMood: 'curious',
      requiredSignId: 'NAME',
      hint: 'Cross your H-hands and tap together twice',
      npcResponse: "Nice to meet them! 🙋",
    },
    {
      npcText: "You two seem to get along — are you FRIENDs now?",
      npcMood: 'surprised',
      requiredSignId: 'FRIEND',
      hint: 'Hook your index fingers and tap together twice',
      npcResponse: "A new friendship! That's wonderful. 🤝",
    },
    {
      npcText: "Class is over — thank you for a great lesson today!",
      npcMood: 'happy',
      requiredSignId: 'THANK_YOU',
      hint: 'Flat hand from chin, move outward',
      npcResponse: "You're welcome — see you tomorrow! 🎒",
    },
  ],
};

export const STORIES: StoryScript[] = [GREETINGS_STORY, COFFEE_SHOP_STORY, COFFEE_SHOP_RUSH_STORY, HOSPITAL_STORY, CLASSROOM_STORY];
