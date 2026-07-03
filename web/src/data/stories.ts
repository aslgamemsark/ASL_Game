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

export const STORIES: StoryScript[] = [COFFEE_SHOP_STORY, HOSPITAL_STORY];
