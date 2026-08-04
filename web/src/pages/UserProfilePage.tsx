import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseReady } from '@/lib/supabase';
import { getRankProgress } from '@/data/ranks';
import { SHOP_ITEMS, getShopItem } from '@/data/shop';
import { getBadge } from '@/data/badges';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { Zippy } from '@/components/shared/Zippy';
import { ReportUserModal } from '@/components/shared/ReportUserModal';
import { Tooltip } from '@/components/shared/Tooltip';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { Skeleton } from '@/components/shared/Skeleton';

interface Props {
  userId: string;
  onExit: () => void;
}

interface ProfileRow {
  id: string;
  username: string;
  total_xp: number;
  streak: number;
  equipped_avatar: string | null;
  equipped_border: string | null;
  active_badge: string | null;
  showcase_badges: string[] | null;
}

export function UserProfilePage({ userId, onExit }: Props) {
  const { user } = useAuth();
  const [row, setRow] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Distinct from notFound: the fetch itself failed (network down, timeout) rather than the
  // player genuinely not existing. Conflating the two used to show "they may have deleted their
  // account" for a plain connectivity blip — misleading and not actionable via retry.
  const [fetchError, setFetchError] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const load = useCallback(() => {
    if (!supabaseReady) return () => {};
    let active = true;
    setLoading(true);
    setNotFound(false);
    setFetchError(false);
    setRow(null);
    setPosition(null);

    (async () => {
      try {
        // Same resilience pattern as LeaderboardPage's region tab: try the full column list first,
        // and fall back to one without showcase_badges if that column's migration hasn't been run
        // against this database yet — so this page works today, not just after that migration lands.
        const full = await supabase
          .from('weekly_leaderboard')
          .select('id, username, total_xp, streak, equipped_avatar, equipped_border, active_badge, showcase_badges')
          .eq('id', userId)
          .single();

        let data: Record<string, unknown> | null = full.data;
        // PGRST116 = "no rows" from .single() — a genuine not-found, not a fetch failure. Any
        // other error code on the fallback too means the request itself couldn't complete.
        let hardError = false;
        if (full.error) {
          const fallback = await supabase
            .from('weekly_leaderboard')
            .select('id, username, total_xp, streak, equipped_avatar, equipped_border, active_badge')
            .eq('id', userId)
            .single();
          data = fallback.data;
          if (fallback.error && fallback.error.code !== 'PGRST116') hardError = true;
        }

        if (!active) return;
        if (hardError) {
          setFetchError(true);
          setLoading(false);
          return;
        }
        if (!data) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const profile = { showcase_badges: [], ...data } as unknown as ProfileRow;
        setRow(profile);
        setLoading(false);

        // A real global position (not just "index within whatever 50 rows happened to load"):
        // how many players have strictly more XP, +1. Cheap head-only count, no rows transferred.
        const { count } = await supabase
          .from('weekly_leaderboard')
          .select('id', { count: 'exact', head: true })
          .gt('total_xp', profile.total_xp);
        if (active && typeof count === 'number') setPosition(count + 1);
      } catch {
        if (!active) return;
        setFetchError(true);
        setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [userId]);

  useEffect(() => load(), [load]);

  const isMe = user?.id === userId;
  const avatarIcon = row?.equipped_avatar
    ? (SHOP_ITEMS.find((it) => it.id === row.equipped_avatar)?.icon ?? '🤟')
    : row?.active_badge ? (getBadge(row.active_badge)?.icon ?? '🤟') : '🤟';
  const borderClasses = row?.equipped_border ? (getShopItem(row.equipped_border)?.preview ?? '') : '';
  const { rank, next, progress } = getRankProgress(row?.total_xp ?? 0);
  const showcase = (row?.showcase_badges ?? []).map((id) => getBadge(id)).filter((b) => b != null);

  return (
    <div className="min-h-dvh bg-z-bg">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <HeaderBackButton onClick={onExit} />
        <h1 className="font-bold text-lg flex-1">Profile</h1>
        {!isMe && row && (
          <button
            onClick={() => setReportOpen(true)}
            aria-label={`Report ${row.username}`}
            className="w-11 h-11 -mr-2 flex items-center justify-center text-z-gray-400 hover:text-z-red transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
          </button>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 pb-nav-clear">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Skeleton className="w-24 h-24 rounded-full" />
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
        ) : fetchError ? (
          <div className="text-center py-16 flex flex-col items-center">
            <Zippy expression="oops" size="md" alt="Zippy looking puzzled" />
            <p className="text-z-gray-300 font-semibold text-sm mt-3">Couldn't load this profile</p>
            <p className="text-z-gray-400 text-xs mt-1">Check your connection and try again.</p>
            <button
              onClick={() => load()}
              className="text-z-purple-light text-xs mt-3 font-semibold hover:underline"
            >
              Try again
            </button>
          </div>
        ) : notFound || !row ? (
          <div className="text-center py-16 flex flex-col items-center">
            <Zippy expression="oops" size="md" alt="Zippy looking puzzled" />
            <p className="text-z-gray-300 font-semibold text-sm mt-3">Couldn't find that player</p>
            <p className="text-z-gray-400 text-xs mt-1">They may have deleted their account.</p>
          </div>
        ) : (
          <>
            {/* Avatar + name + rank tier */}
            <motion.div
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-z-purple to-z-purple-deep flex items-center justify-center text-5xl ${borderClasses}`}>
                {avatarIcon}
              </div>
              <h2 className="font-bold text-xl mt-3">
                {row.username}{isMe && <span className="text-z-gray-400 font-normal"> (you)</span>}
              </h2>
              <p className="text-z-gray-400 text-sm mt-0.5">
                {rank.emoji} {rank.name}
                {position != null && <span className="text-z-gray-400"> &middot; #{position.toLocaleString()} overall</span>}
              </p>
            </motion.div>

            {/* Rank progress */}
            <div className="mt-6 bg-z-card border border-white/5 rounded-2xl p-4">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-z-gray-400">{rank.emoji} {rank.name}</span>
                {next && <span className="text-z-gray-400">{next.emoji} {next.name}</span>}
              </div>
              <ProgressBar
                value={progress}
                label={next ? `Rank progress: ${rank.name} toward ${next.name}` : `Rank: ${rank.name}, max rank reached`}
                size="sm"
                fillClassName="bg-gradient-to-r from-z-purple to-z-purple-light"
                trackClassName="bg-white/10"
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-z-card border border-white/5 rounded-2xl p-4 text-center">
                <p className="text-2xl font-bold text-z-yellow tabular-nums">{row.total_xp.toLocaleString()}</p>
                <p className="text-2xs text-z-gray-400 mt-0.5 tracking-wide">Total XP</p>
              </div>
              <div className="bg-z-card border border-white/5 rounded-2xl p-4 text-center">
                <p className="text-2xl font-bold text-z-orange tabular-nums">🔥 {row.streak}</p>
                <p className="text-2xs text-z-gray-400 mt-0.5 tracking-wide">Day streak</p>
              </div>
            </div>

            {/* Showcased badges */}
            <div className="mt-6">
              <h3 className="text-xs font-bold text-z-gray-400 uppercase tracking-widest mb-3">Badges</h3>
              {showcase.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {showcase.map((badge) => (
                    <Tooltip key={badge!.id} title={badge!.title} description={badge!.description} className="aspect-square">
                      <div
                        tabIndex={0}
                        className="w-full h-full rounded-2xl flex flex-col items-center justify-center gap-1 border border-white/10 bg-z-card"
                      >
                        <span className="text-2xl">{badge!.icon}</span>
                        <span className="text-[9px] text-z-gray-400 text-center px-1 truncate w-full">{badge!.title}</span>
                      </div>
                    </Tooltip>
                  ))}
                </div>
              ) : (
                <p className="text-z-gray-400 text-sm">
                  {isMe ? "You haven't pinned any badges to your showcase yet." : `${row.username} hasn't pinned any badges yet.`}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {reportOpen && user && row && (
        <ReportUserModal
          reporterId={user.id}
          reportedId={row.id}
          reportedUsername={row.username}
          context="profile"
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
