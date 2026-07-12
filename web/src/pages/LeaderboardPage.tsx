import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseReady } from '@/lib/supabase';
import { useUserStore } from '@/stores/useUserStore';
import { getRankProgress } from '@/data/ranks';
import { SHOP_ITEMS, getShopItem } from '@/data/shop';
import { getBadge } from '@/data/badges';
import { ReportUserModal } from '@/components/shared/ReportUserModal';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { Zippy } from '@/components/shared/Zippy';
import { ZIPPY_LINES } from '@/data/zippy';
import { countryName } from '@/lib/geolocation';

interface Props {
  onExit: () => void;
}

type BoardTab = 'world' | 'region' | 'friends';

interface BoardRow {
  id: string;
  username: string;
  total_xp: number;
  streak: number;
  equipped_avatar: string | null;
  equipped_border: string | null;
  active_badge: string | null;
}

function getMedal(i: number) {
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return null;
}

function BoardList({
  rows, userId, loading, relations, onAddFriend, onReport,
}: {
  rows: BoardRow[];
  userId?: string;
  loading: boolean;
  relations?: Map<string, 'accepted' | 'pendingSent' | 'pendingReceived'>;
  onAddFriend?: (id: string, username: string) => void;
  onReport?: (id: string, username: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-z-card rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 flex flex-col items-center">
        <Zippy expression="teaching" size="md" />
        <p className="text-z-gray-300 font-semibold text-sm mt-3">No one here yet</p>
        <p className="text-z-gray-500 text-xs mt-1 max-w-[16rem]">{ZIPPY_LINES.emptyLeaderboard[0]}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => {
        const isMe = row.id === userId;
        const medal = getMedal(i);
        const { rank } = getRankProgress(row.total_xp);
        const avatarIcon = row.equipped_avatar
          ? (SHOP_ITEMS.find((it) => it.id === row.equipped_avatar)?.icon ?? '🤟')
          : row.active_badge ? (getBadge(row.active_badge)?.icon ?? '🤟') : '🤟';
        const borderClasses = row.equipped_border ? (getShopItem(row.equipped_border)?.preview ?? '') : '';
        return (
          <motion.div
            key={row.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${
              isMe
                ? 'bg-z-purple/20 border border-z-purple/40'
                : i < 3
                ? 'bg-z-card border border-white/8'
                : 'bg-z-card/60 border border-white/4'
            }`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            {/* Rank number / medal */}
            <div className="w-8 text-center shrink-0">
              {medal ? (
                <span className="text-lg">{medal}</span>
              ) : (
                <span className="text-xs font-bold text-z-gray-400 tabular-nums">{i + 1}</span>
              )}
            </div>

            {/* Avatar (equipped avatar/badge + equipped border, matching Me tab / side nav) */}
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-z-purple to-z-purple-deep flex items-center justify-center text-lg shrink-0 ${borderClasses}`}>
              {avatarIcon}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-sm truncate ${isMe ? 'text-z-purple-light' : 'text-white'}`}>
                {isMe ? `${row.username} (you)` : row.username}
              </p>
            </div>

            {/* Rank tier name + XP + streak, stacked */}
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-z-gray-400">{rank.name}</p>
              <p className="text-sm font-bold text-z-yellow tabular-nums">{row.total_xp.toLocaleString()} XP</p>
              {row.streak > 0 && (
                <p className="text-[11px] text-z-gray-400">🔥 {row.streak}d</p>
              )}
            </div>

            {/* Friend action — only for other users when signed in */}
            {userId && row.id !== userId && onAddFriend && (() => {
              const rel = relations?.get(row.id);
              if (rel === 'accepted') return <span className="text-[11px] text-z-gray-500 shrink-0">Friends ✓</span>;
              if (rel === 'pendingSent') return <span className="text-[11px] text-z-gray-500 shrink-0">Pending</span>;
              if (rel === 'pendingReceived') return <span className="text-[11px] text-z-gray-500 shrink-0">Incoming</span>;
              return (
                <motion.button
                  onClick={() => onAddFriend(row.id, row.username)}
                  className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-z-purple/20 text-z-purple-light border border-z-purple/30"
                  whileTap={{ scale: 0.94 }}
                >
                  + Add
                </motion.button>
              );
            })()}

            {/* Report — only for other users when signed in */}
            {userId && row.id !== userId && onReport && (
              <button
                onClick={() => onReport(row.id, row.username)}
                aria-label={`Report ${row.username}`}
                className="shrink-0 text-z-gray-500 hover:text-z-red transition-colors p-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
              </button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

export function LeaderboardPage({ onExit }: Props) {
  const { user } = useAuth();
  const { xp, streak } = useUserStore();
  const [tab, setTab] = useState<BoardTab>('world');
  const [worldRows, setWorldRows] = useState<BoardRow[]>([]);
  const [friendRows, setFriendRows] = useState<BoardRow[]>([]);
  const [regionRows, setRegionRows] = useState<BoardRow[]>([]);
  const [worldLoading, setWorldLoading] = useState(false);
  const [friendLoading, setFriendLoading] = useState(false);
  const [regionLoading, setRegionLoading] = useState(false);
  const [myRegion, setMyRegion] = useState<string | null | undefined>(undefined); // undefined = not checked yet
  const [relations, setRelations] = useState<Map<string, 'accepted' | 'pendingSent' | 'pendingReceived'>>(new Map());
  const [toast, setToast] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; username: string } | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // Load friendship relations for the current user
  useEffect(() => {
    if (!user || !supabaseReady) return;
    supabase
      .from('friendships')
      .select('requester_id, addressee_id, status')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .then(({ data }) => {
        const map = new Map<string, 'accepted' | 'pendingSent' | 'pendingReceived'>();
        ((data ?? []) as { requester_id: string; addressee_id: string; status: string }[]).forEach((r) => {
          const otherId = r.requester_id === user.id ? r.addressee_id : r.requester_id;
          if (r.status === 'accepted') map.set(otherId, 'accepted');
          else if (r.requester_id === user.id) map.set(otherId, 'pendingSent');
          else map.set(otherId, 'pendingReceived');
        });
        setRelations(map);
      });
  }, [user]);

  const sendFriendRequest = async (targetId: string, targetUsername: string) => {
    if (!user || !supabaseReady) return;
    const { error } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: targetId,
    } as Record<string, string>);
    if (error) { showToast(`Error: ${error.message}`); return; }
    setRelations((prev) => new Map(prev).set(targetId, 'pendingSent'));
    showToast(`Friend request sent to ${targetUsername} 📨`);
  };

  // Load world leaderboard (top 50 by total_xp)
  useEffect(() => {
    if (!supabaseReady) return;
    setWorldLoading(true);
    (async () => {
      // The equipped_* / active_badge columns require a migration that may not have
      // run yet on this project — fall back to the base columns if that select 400s,
      // so the board still renders (just without avatars) instead of going empty.
      let data: unknown[] | null;
      const first = await supabase
        .from('weekly_leaderboard')
        .select('id, username, total_xp, streak, equipped_avatar, equipped_border, active_badge')
        .order('total_xp', { ascending: false })
        .limit(50);
      if (first.error) {
        const fallback = await supabase
          .from('weekly_leaderboard')
          .select('id, username, total_xp, streak')
          .order('total_xp', { ascending: false })
          .limit(50);
        data = fallback.data;
      } else {
        data = first.data;
      }
      const rows = (data as unknown as BoardRow[]) ?? [];
      // My own row: fall back to local store cosmetics if the remote value is missing
      // (pre-migration, or not synced yet) — same override the friends board already does.
      if (user) {
        const { equippedAvatar, equippedBorder, activeBadge } = useUserStore.getState();
        const idx = rows.findIndex((r) => r.id === user.id);
        if (idx !== -1) {
          rows[idx] = {
            ...rows[idx],
            equipped_avatar: rows[idx].equipped_avatar ?? equippedAvatar,
            equipped_border: rows[idx].equipped_border ?? equippedBorder,
            active_badge: rows[idx].active_badge ?? activeBadge,
          };
        }
      }
      setWorldRows(rows);
      setWorldLoading(false);
    })();
  }, [user]);

  // Load friends leaderboard
  useEffect(() => {
    if (!user || !supabaseReady || tab !== 'friends') return;
    setFriendLoading(true);
    (async () => {
      // Get accepted friend IDs
      const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, status')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted');

      const friendIds: string[] = (friendships ?? []).map((r: { requester_id: string; addressee_id: string }) =>
        r.requester_id === user.id ? r.addressee_id : r.requester_id
      );

      // Include self
      const allIds = [user.id, ...friendIds];

      if (allIds.length === 0) {
        setFriendRows([]);
        setFriendLoading(false);
        return;
      }

      // Fetch progress. Same equipped_*/active_badge migration fallback as the world board.
      let progresses: unknown[] | null;
      const firstProg = await supabase
        .from('user_progress')
        .select('user_id, xp, streak, equipped_avatar, equipped_border, active_badge')
        .in('user_id', allIds);
      if (firstProg.error) {
        const fallbackProg = await supabase
          .from('user_progress')
          .select('user_id, xp, streak')
          .in('user_id', allIds);
        progresses = fallbackProg.data;
      } else {
        progresses = firstProg.data;
      }

      // Fetch profiles for usernames
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', allIds);

      const profileMap = Object.fromEntries(
        ((profiles ?? []) as { id: string; username: string }[]).map((p) => [p.id, p.username])
      );
      const progressMap = Object.fromEntries(
        ((progresses ?? []) as {
          user_id: string; xp: number; streak: number;
          equipped_avatar: string | null; equipped_border: string | null; active_badge: string | null;
        }[]).map((p) => [p.user_id, p])
      );

      const { equippedAvatar: myAvatar, equippedBorder: myBorder, activeBadge: myBadge } = useUserStore.getState();

      const rows: BoardRow[] = allIds
        .map((id) => {
          const username = profileMap[id];
          const prog = progressMap[id];
          const isMe = id === user.id;
          // For current user, fall back to local store values
          const resolvedXp = isMe ? (prog?.xp ?? xp) : (prog?.xp ?? 0);
          const resolvedStreak = isMe ? (prog?.streak ?? streak) : (prog?.streak ?? 0);
          if (!username) return null;
          return {
            id, username, total_xp: resolvedXp, streak: resolvedStreak,
            equipped_avatar: isMe ? (prog?.equipped_avatar ?? myAvatar) : (prog?.equipped_avatar ?? null),
            equipped_border: isMe ? (prog?.equipped_border ?? myBorder) : (prog?.equipped_border ?? null),
            active_badge: isMe ? (prog?.active_badge ?? myBadge) : (prog?.active_badge ?? null),
          };
        })
        .filter(Boolean) as BoardRow[];

      rows.sort((a, b) => b.total_xp - a.total_xp);
      setFriendRows(rows);
      setFriendLoading(false);
    })();
  }, [tab, user, xp, streak]);

  // Load region leaderboard: same view as world, filtered to players who share the
  // current user's detected region (see useProgressSync's one-time geolocation lookup).
  useEffect(() => {
    if (!user || !supabaseReady || tab !== 'region') return;
    setRegionLoading(true);
    (async () => {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('region')
        .eq('id', user.id)
        .single();
      const region = (myProfile as { region?: string | null } | null)?.region ?? null;
      setMyRegion(region);

      if (!region) {
        setRegionRows([]);
        setRegionLoading(false);
        return;
      }

      let data: unknown[] | null;
      const first = await supabase
        .from('weekly_leaderboard')
        .select('id, username, total_xp, streak, equipped_avatar, equipped_border, active_badge')
        .eq('region', region)
        .order('total_xp', { ascending: false })
        .limit(50);
      if (first.error) {
        const fallback = await supabase
          .from('weekly_leaderboard')
          .select('id, username, total_xp, streak')
          .eq('region', region)
          .order('total_xp', { ascending: false })
          .limit(50);
        data = fallback.data;
      } else {
        data = first.data;
      }

      const rows = (data as unknown as BoardRow[]) ?? [];
      const { equippedAvatar, equippedBorder, activeBadge } = useUserStore.getState();
      const idx = rows.findIndex((r) => r.id === user.id);
      if (idx !== -1) {
        rows[idx] = {
          ...rows[idx],
          equipped_avatar: rows[idx].equipped_avatar ?? equippedAvatar,
          equipped_border: rows[idx].equipped_border ?? equippedBorder,
          active_badge: rows[idx].active_badge ?? activeBadge,
        };
      }
      setRegionRows(rows);
      setRegionLoading(false);
    })();
  }, [tab, user]);

  const TABS: { id: BoardTab; label: string; icon: string }[] = [
    { id: 'world', label: 'World', icon: '🌍' },
    { id: 'region', label: 'Region', icon: '📍' },
    { id: 'friends', label: 'Friends', icon: '🤝' },
  ];

  return (
    <div className="min-h-screen bg-z-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <HeaderBackButton onClick={onExit} />
        <h1 className="font-bold text-lg flex-1">Leaderboard</h1>
        <span className="text-2xl">🏆</span>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 pb-24">
        {/* Tab bar */}
        <div className="flex bg-z-surface/50 rounded-xl p-1 mb-5 gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-bold rounded-lg transition-colors ${
                tab === t.id ? 'bg-z-card text-white' : 'text-z-gray-400 hover:text-z-gray-200'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'world' && (
          <BoardList
            rows={worldRows}
            userId={user?.id}
            loading={worldLoading}
            relations={relations}
            onAddFriend={user ? sendFriendRequest : undefined}
            onReport={user ? (id, username) => setReportTarget({ id, username }) : undefined}
          />
        )}

        {tab === 'region' && !user && (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📍</p>
            <p className="text-z-gray-200 font-bold text-base">Sign in to see your region</p>
            <p className="text-z-gray-500 text-sm mt-2">Compare your progress with signers near you.</p>
          </div>
        )}

        {tab === 'region' && user && !regionLoading && myRegion === null && (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📍</p>
            <p className="text-z-gray-200 font-bold text-base">Still detecting your region</p>
            <p className="text-z-gray-500 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
              This happens automatically shortly after you sign in — check back in a minute.
            </p>
          </div>
        )}

        {tab === 'region' && user && (regionLoading || myRegion !== null) && (
          <>
            {myRegion && (
              <p className="text-z-gray-400 text-xs font-bold uppercase tracking-widest mb-3 text-center">
                {countryName(myRegion)}
              </p>
            )}
            <BoardList
              rows={regionRows}
              userId={user.id}
              loading={regionLoading}
              relations={relations}
              onAddFriend={sendFriendRequest}
              onReport={(id, username) => setReportTarget({ id, username })}
            />
          </>
        )}

        {tab === 'friends' && !user && (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🤝</p>
            <p className="text-z-gray-200 font-bold text-base">Sign in to see friends</p>
            <p className="text-z-gray-500 text-sm mt-2">Add friends to compare your progress.</p>
          </div>
        )}

        {tab === 'friends' && user && (
          friendLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 bg-z-card rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : friendRows.length <= 1 ? (
            <div className="text-center py-20 flex flex-col items-center">
              <Zippy expression="welcome" size="md" />
              <p className="text-z-gray-200 font-bold text-base mt-3">No friends yet</p>
              <p className="text-z-gray-500 text-sm mt-2 max-w-[18rem]">{ZIPPY_LINES.emptyFriends[0]}</p>
            </div>
          ) : (
            <BoardList
              rows={friendRows}
              userId={user.id}
              loading={false}
              onReport={(id, username) => setReportTarget({ id, username })}
            />
          )
        )}
      </div>

      {user && reportTarget && (
        <ReportUserModal
          reporterId={user.id}
          reportedId={reportTarget.id}
          reportedUsername={reportTarget.username}
          context={tab === 'friends' ? 'friends' : 'leaderboard'}
          onClose={() => setReportTarget(null)}
        />
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-z-card border border-white/10 rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl z-50 whitespace-nowrap"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
