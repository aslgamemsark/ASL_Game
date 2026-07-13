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
    .replace(/0/g, 'o').replace(/5/g, 's').replace(/7/g, 't');
}

// Drops every character that isn't a-z, so separator characters used to
// break up a slur (n_i_g_g_a, n1g2g3a's stray digits, etc.) can't defeat a
// substring check the way they could when only two flat variants were tried.
function stripNonLetters(s: string): string {
  return s.replace(/[^a-z]/g, '');
}

// Collapses runs of the same letter down to one, so a stretched-out spelling
// (niggga, fuuuck) normalises the same way as its base word. Must be applied
// to the blocklist words too (nigger -> niger, bitch has no doubles so it's
// unchanged) — otherwise a legitimately double-lettered word like "nigga"
// would stop matching its own collapsed candidate form.
function collapseRepeats(s: string): string {
  return s.replace(/(.)\1+/g, '$1');
}

const BLOCKED_COLLAPSED: readonly string[] = BLOCKED.map(collapseRepeats);

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
