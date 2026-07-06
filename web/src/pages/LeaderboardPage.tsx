import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseReady } from '@/lib/supabase';
import { useUserStore } from '@/stores/useUserStore';
import { getRankProgress } from '@/data/ranks';

interface Props {
  onExit: () => void;
}

type BoardTab = 'world' | 'region' | 'friends';

interface BoardRow {
  id: string;
  username: string;
  total_xp: number;
  streak: number;
}

function getMedal(i: number) {
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return null;
}

function BoardList({
  rows, userId, loading, relations, onAddFriend,
}: {
  rows: BoardRow[];
  userId?: string;
  loading: boolean;
  relations?: Map<string, 'accepted' | 'pendingSent' | 'pendingReceived'>;
  onAddFriend?: (id: string, username: string) => void;
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
      <div className="text-center py-16">
        <p className="text-4xl mb-3">🏆</p>
        <p className="text-z-gray-300 font-semibold text-sm">No one here yet</p>
        <p className="text-z-gray-500 text-xs mt-1">Be the first to claim the top spot!</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => {
        const isMe = row.id === userId;
        const medal = getMedal(i);
        const { rank } = getRankProgress(row.total_xp);
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

            {/* Avatar placeholder */}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${
              i === 0 ? 'bg-yellow-400/20' : i === 1 ? 'bg-gray-400/20' : i === 2 ? 'bg-orange-400/20' : 'bg-z-surface/60'
            }`}>
              {rank.emoji}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-sm truncate ${isMe ? 'text-z-purple-light' : 'text-white'}`}>
                {isMe ? `${row.username} (you)` : row.username}
              </p>
              <p className="text-[11px] text-z-gray-400">{rank.name}</p>
            </div>

            {/* XP + streak */}
            <div className="text-right shrink-0">
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
  const [worldLoading, setWorldLoading] = useState(false);
  const [friendLoading, setFriendLoading] = useState(false);
  const [relations, setRelations] = useState<Map<string, 'accepted' | 'pendingSent' | 'pendingReceived'>>(new Map());
  const [toast, setToast] = useState<string | null>(null);

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
    supabase
      .from('weekly_leaderboard')
      .select('id, username, total_xp, streak')
      .order('total_xp', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setWorldRows((data as unknown as BoardRow[]) ?? []);
        setWorldLoading(false);
      });
  }, []);

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

      // Fetch progress
      const { data: progresses } = await supabase
        .from('user_progress')
        .select('user_id, xp, streak')
        .in('user_id', allIds);

      // Fetch profiles for usernames
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', allIds);

      const profileMap = Object.fromEntries(
        ((profiles ?? []) as { id: string; username: string }[]).map((p) => [p.id, p.username])
      );
      const progressMap = Object.fromEntries(
        ((progresses ?? []) as { user_id: string; xp: number; streak: number }[]).map((p) => [p.user_id, p])
      );

      const rows: BoardRow[] = allIds
        .map((id) => {
          const username = profileMap[id];
          const prog = progressMap[id];
          // For current user, fall back to local store values
          const resolvedXp = id === user.id ? (prog?.xp ?? xp) : (prog?.xp ?? 0);
          const resolvedStreak = id === user.id ? (prog?.streak ?? streak) : (prog?.streak ?? 0);
          if (!username) return null;
          return { id, username, total_xp: resolvedXp, streak: resolvedStreak };
        })
        .filter(Boolean) as BoardRow[];

      rows.sort((a, b) => b.total_xp - a.total_xp);
      setFriendRows(rows);
      setFriendLoading(false);
    })();
  }, [tab, user, xp, streak]);

  const TABS: { id: BoardTab; label: string; icon: string }[] = [
    { id: 'world', label: 'World', icon: '🌍' },
    { id: 'region', label: 'Region', icon: '📍' },
    { id: 'friends', label: 'Friends', icon: '🤝' },
  ];

  return (
    <div className="min-h-screen bg-z-bg lg:pl-64">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <button
          onClick={onExit}
          className="w-8 h-8 flex items-center justify-center text-z-gray-400 hover:text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
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
          <BoardList rows={worldRows} userId={user?.id} loading={worldLoading} relations={relations} onAddFriend={user ? sendFriendRequest : undefined} />
        )}

        {tab === 'region' && (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📍</p>
            <p className="text-z-gray-200 font-bold text-base">Region boards coming soon</p>
            <p className="text-z-gray-500 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
              We're building regional rankings so you can compete with signers near you.
            </p>
          </div>
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
            <div className="text-center py-20">
              <p className="text-5xl mb-4">🤝</p>
              <p className="text-z-gray-200 font-bold text-base">No friends yet</p>
              <p className="text-z-gray-500 text-sm mt-2">Add friends to see how you compare!</p>
            </div>
          ) : (
            <BoardList rows={friendRows} userId={user.id} loading={false} />
          )
        )}
      </div>

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
