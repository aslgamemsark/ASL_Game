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
    .replace(/0/g, 'o').replace(/5/g, 's').replace(/7/g, 't')
    .replace(/9/g, 'g').replace(/6/g, 'g').replace(/8/g, 'b')
    .replace(/\$/g, 's').replace(/@/g, 'a').replace(/\|/g, 'i')
    .replace(/!/g, 'i');
}

// Collapses long stutter runs (3+ of the same char) down to one, e.g.
// "niiiggaaa" -> "niga", "hitlerrrr" -> "hitler" — but leaves normal doubled
// letters (e.g. "coon", "connor") alone, since collapsing those would create
// short substrings that false-positive on innocuous words.
function collapseRepeats(s: string): string {
  return s.replace(/_/g, '').replace(/(.)\1{2,}/g, '$1');
}

const BLOCKED_COLLAPSED = BLOCKED.map(collapseRepeats);

export function isInappropriate(username: string): boolean {
  const low  = username.toLowerCase();
  const norm = normaliseLeet(low);
  if (BLOCKED.some((w) => low.includes(w) || norm.includes(w))) return true;

  const collapsedLow  = collapseRepeats(low);
  const collapsedNorm = collapseRepeats(norm);
  return BLOCKED_COLLAPSED.some((w) => collapsedLow.includes(w) || collapsedNorm.includes(w));
}
