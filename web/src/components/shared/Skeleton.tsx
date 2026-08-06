interface Props {
  /** Caller controls size and shape (`w-*`, `h-*`, `rounded-*`) — a skeleton is a placeholder for
   *  whatever real content is loading, which can be any dimension. */
  className?: string;
}

/**
 * A pulsing placeholder block for content that hasn't loaded yet.
 *
 * Replaces 3 hand-rolled versions (`FriendsPage`, `LeaderboardPage`, `UserProfilePage`) that
 * agreed on `animate-pulse` and disagreed on colour (`bg-z-surface` vs `bg-z-card`) — consolidated
 * to `bg-z-surface`, the token already used for other "recessed, not-yet-real-content" surfaces
 * (e.g. `ProgressBar`'s default track). `aria-hidden`: the pulse itself carries no information: a
 * screen reader should hear that the *region* is loading (`aria-busy`/`role="status"` on the
 * container, wherever that page already announces it), not a stream of anonymous decorative divs.
 */
export function Skeleton({ className = '' }: Props) {
  return <div aria-hidden="true" className={`bg-z-surface animate-pulse ${className}`} />;
}
