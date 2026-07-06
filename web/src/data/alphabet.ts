export interface LetterDef {
  letter: string;
  signId: string | null;
  handshape: string;
  description: string;
  hint: string;
}

export const ALPHABET: LetterDef[] = [
  { letter: 'A', signId: 'LETTER_A', handshape: 'Fist + thumb side', description: 'Fist with thumb resting against the side of the index finger', hint: 'Like a rock — tight fist, thumb up the side!' },
  { letter: 'B', signId: 'LETTER_B', handshape: 'Flat 4 fingers', description: 'Four fingers together pointing up, thumb folded across palm', hint: 'All fingers standing at attention, thumb tucked in' },
  { letter: 'C', signId: 'LETTER_C', handshape: 'Curved C shape', description: 'All fingers and thumb curved into a C shape', hint: 'Your hand IS the letter C' },
  { letter: 'D', signId: 'LETTER_D', handshape: 'Circle + index up', description: 'Index finger points up while middle, ring, pinky curl and touch thumb to form a circle', hint: 'Index stands tall, others form an O beneath it' },
  { letter: 'E', signId: 'LETTER_E', handshape: 'Bent fingers', description: 'All four fingers bent at the middle knuckle, thumb tucked underneath', hint: 'Fingers curled like claws, thumb hides below' },
  { letter: 'F', signId: 'LETTER_F', handshape: 'OK + 3 fingers up', description: 'Index and thumb touch in a circle; middle, ring, and pinky spread upward', hint: 'Make an OK sign, fan the other three fingers out' },
  { letter: 'G', signId: 'LETTER_G', handshape: 'Pointing sideways', description: 'Index and thumb point horizontally to one side; other fingers folded in', hint: 'Gun shape pointing sideways' },
  { letter: 'H', signId: 'LETTER_H', handshape: '2 fingers sideways', description: 'Index and middle fingers extended together, pointing sideways', hint: 'Peace sign rotated 90° to the side' },
  { letter: 'I', signId: 'LETTER_I', handshape: 'Pinky up', description: 'Fist with only the pinky finger raised', hint: 'Just the pinky — tea-cup style!' },
  { letter: 'J', signId: 'LETTER_J', handshape: 'Pinky draws J', description: 'Start with pinky up (letter I), then trace a J shape downward and hook to the side', hint: 'Draw a J in the air with your pinky — it moves!' },
  { letter: 'K', signId: 'LETTER_K', handshape: 'Peace + thumb between', description: 'Index and middle fingers spread in a V, thumb placed between them', hint: 'Peace sign with thumb peeking through the gap' },
  { letter: 'L', signId: 'LETTER_L', handshape: 'L shape', description: 'Index finger points straight up, thumb points straight out — making an L', hint: 'Classic L with your fingers!' },
  { letter: 'M', signId: 'LETTER_M', handshape: '3 fingers over thumb', description: 'Index, middle, and ring fingers curled over the thumb', hint: 'Three fingers giving the thumb a blanket' },
  { letter: 'N', signId: 'LETTER_N', handshape: '2 fingers over thumb', description: 'Index and middle fingers curled over the thumb', hint: 'Like M but with two fingers instead of three' },
  { letter: 'O', signId: 'LETTER_O', handshape: 'O circle', description: 'All fingers and thumb form a rounded circle like the letter O', hint: 'Make a perfect O with your whole hand' },
  { letter: 'P', signId: 'LETTER_P', handshape: 'K pointing down', description: 'K handshape (V + thumb between) rotated so fingers point down toward the floor', hint: 'Like K, but flip it so it points down' },
  { letter: 'Q', signId: 'LETTER_Q', handshape: 'G pointing down', description: 'G handshape (index + thumb pointing side) rotated downward', hint: 'Like G but pointing toward the floor' },
  { letter: 'R', signId: 'LETTER_R', handshape: 'Crossed fingers', description: 'Index and middle fingers crossed over each other, pointing up', hint: 'Cross your fingers for luck — that\'s R!' },
  { letter: 'S', signId: 'LETTER_S', handshape: 'Fist thumb over', description: 'Fist with thumb folded across the front of the fingers (not to the side)', hint: 'Like A but the thumb wraps over the front instead' },
  { letter: 'T', signId: 'LETTER_T', handshape: 'Thumb between', description: 'Fist with thumb placed between the index and middle fingers', hint: 'Sneak your thumb between the first two fingers' },
  { letter: 'U', signId: 'LETTER_U', handshape: '2 fingers together up', description: 'Index and middle fingers extended together and pointing straight up', hint: 'Peace sign but keep the two fingers side by side' },
  { letter: 'V', signId: 'LETTER_V', handshape: 'V / peace sign', description: 'Index and middle fingers spread apart in a V shape', hint: 'Classic peace sign / victory V!' },
  { letter: 'W', signId: 'LETTER_W', handshape: '3 fingers spread', description: 'Index, middle, and ring fingers spread and pointing up; thumb and pinky folded', hint: 'Three fingers fanned out like a W' },
  { letter: 'X', signId: 'LETTER_X', handshape: 'Hook finger', description: 'Index finger bent into a hook or crooked shape, like a beckoning gesture', hint: 'Crook your index finger into a hook' },
  { letter: 'Y', signId: 'LETTER_Y', handshape: 'Hang loose', description: 'Thumb and pinky extended out; index, middle, and ring fingers folded in', hint: 'Hang loose / Shaka sign!' },
  { letter: 'Z', signId: 'LETTER_Z', handshape: 'Index traces Z', description: 'Index finger traces the shape of the letter Z in the air horizontally', hint: 'Draw a Z in the air — it moves!' },
];

export const PRACTICEABLE_LETTER_IDS = ALPHABET
  .filter(l => l.signId !== null)
  .map(l => l.signId as string);
