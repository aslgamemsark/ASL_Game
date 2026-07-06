// Slurs and explicit content that must not appear in usernames.
// Checked against the lowercased name and a leet-speak-normalised variant.
const BLOCKED: readonly string[] = [
  // Racial slurs
  'nigger','nigga','chink','gook','jap','spic','kike','wetback','beaner',
  'raghead','towelhead','zipperhead','coon','cracker','honky',
  // Homophobic / transphobic slurs
  'faggot','faget','tranny',
  // Ableist slurs
  'retard','retarded',
  // Sexual / explicit
  'fuck','shit','cunt','bitch','whore','slut','asshole','dickhead','cocksucker',
  // Violence / hate
  'hitler','nazi','rape','rapist','pedophile','pedofil','pedo',
  // Common leet variants already captured by normaliseLeet(), but keep explicit ones too
  'fck','fuk','sh1t','b1tch',
];

function normaliseLeet(s: string): string {
  return s
    .replace(/4/g, 'a').replace(/3/g, 'e').replace(/1/g, 'i')
    .replace(/0/g, 'o').replace(/5/g, 's').replace(/7/g, 't');
}

export function isInappropriate(username: string): boolean {
  const low  = username.toLowerCase();
  const norm = normaliseLeet(low);
  return BLOCKED.some((w) => low.includes(w) || norm.includes(w));
}
