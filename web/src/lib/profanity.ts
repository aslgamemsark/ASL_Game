// Slurs and explicit content that must not appear in usernames.
// Checked against several normalised variants of the name — a plain substring
// check on the raw name is not enough, since the username charset allows
// underscores as separators (n_i_g_g_a passed the old check outright) and
// nothing collapsed stretched-out spellings (niggga). Found live on the
// production leaderboard; see username-policy hardening.
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
  // Alternate spellings not reachable via leet-digit substitution or letter
  // collapsing alone (dropped vowels/letters rather than swapped or repeated)
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

// Drops every character that isn't a-z, so separator characters used to
// break up a slur (n_i_g_g_a, n1g2g3a's stray digits, etc.) can't defeat a
// substring check the way they could when only two flat variants were tried.
function stripNonLetters(s: string): string {
  return s.replace(/[^a-z]/g, '');
}

// Collapses ANY run of the same letter down to one, so a stretched-out spelling (niggga, fuuuck)
// normalises the same way as its base word (nigga has its own doubled "gg", so stretching must
// collapse the same way the blocklist word does, or "niggga" and "nigga" collapse to different
// lengths and stop matching each other).
function collapseRepeats(s: string): string {
  return s.replace(/(.)\1+/g, '$1');
}

// A collapsed blocklist entry shorter than this is rejected from the collapsed-matching pass
// entirely — collapsing "coon" (2 o's) produces "con", a 3-letter substring that flags ordinary
// words and names (connor, control, iconic, economics). The uncollapsed BLOCKED list below still
// catches "coon" typed plainly or via leet substitution; only the over-aggressive short collapsed
// form is excluded. Verified empirically against both directions: every stretched-slur test case
// this file's tests require (niggga, fuuuck, n_1_g_g_4) still matches at length >= 4.
const MIN_COLLAPSED_LEN = 4;
const BLOCKED_COLLAPSED: readonly string[] = BLOCKED.map(collapseRepeats).filter((w) => w.length >= MIN_COLLAPSED_LEN);

export function isInappropriate(username: string): boolean {
  const low = username.toLowerCase();
  const stripped = new Set<string>();
  for (const base of [low, normaliseLeet(low)]) {
    stripped.add(stripNonLetters(base));
  }
  const collapsed = Array.from(stripped, collapseRepeats);

  return (
    BLOCKED.some((w) => Array.from(stripped).some((v) => v.includes(w))) ||
    BLOCKED_COLLAPSED.some((w) => collapsed.some((v) => v.includes(w)))
  );
}
