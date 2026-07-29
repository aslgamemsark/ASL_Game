import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ReportUserModal } from '@/components/shared/ReportUserModal';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';

// ── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  username: string;
  xp: number;
  streak: number;
}

interface FriendshipRow {
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
}

interface RelEntry {
  other: UserProfile;
  status: 'accepted' | 'pendingSent' | 'pendingReceived';
  /** true if I was the one who sent the original request */
  iAmRequester: boolean;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onExit: () => void;
  onChallengeFriend?: (friendId: string, friendUsername: string) => void;
  onStartMultiplayer?: () => void;
  onViewProfile: (userId: string) => void;
  /** Open the sign-in modal — the friend graph keys off a real user id, so a guest can't use it. */
  onRequireSignIn?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FriendsPage({ onExit, onChallengeFriend, onStartMultiplayer, onViewProfile, onRequireSignIn }: Props) {
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [relationships, setRelationships] = useState<RelEntry[]>([]);
  const [loadingRels, setLoadingRels] = useState(true);
  const [relError, setRelError] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; username: string } | null>(null);
  // Ids currently mid-mutation (send/accept/decline/cancel/remove) — guards each relationship
  // button independently so a fast double-click can't fire the same friendship insert/update/
  // delete twice before the first response lands, mirroring AdminPanel's actionBusy pattern.
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    if (busyIds.has(id)) return;
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await fn();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // ── Load all relationships ──────────────────────────────────────────────────

  const loadRelationships = useCallback(async () => {
    // A guest has no relationships to load — clear the loading flag so the UI never gets stuck on
    // the skeleton (the reported bug: guests saw a perpetual "friends loading" state because this
    // returned early while loadingRels stayed true). The guest sign-in gate below renders instead.
    if (!user) { setLoadingRels(false); setRelationships([]); return; }
    setLoadingRels(true);
    setRelError(false);
    try {
      const { data: rows, error } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, status')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`) as { data: FriendshipRow[] | null; error: { message: string } | null };

      if (error) { setRelError(true); setRelationships([]); return; }
      if (!rows || rows.length === 0) { setRelationships([]); return; }

      // Collect the IDs of the other people
      const otherIds = rows.map((r) => (r.requester_id === user.id ? r.addressee_id : r.requester_id));

      // Fetch their profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', otherIds) as { data: { id: string; username: string }[] | null };

      // Fetch their progress (xp + streak)
      const { data: progresses } = await supabase
        .from('user_progress')
        .select('user_id, xp, streak')
        .in('user_id', otherIds) as { data: { user_id: string; xp: number; streak: number }[] | null };

      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      const progressMap = Object.fromEntries((progresses ?? []).map((p) => [p.user_id, p]));

      const entries: RelEntry[] = rows
        .map((row): RelEntry | null => {
          const otherId = row.requester_id === user.id ? row.addressee_id : row.requester_id;
          const profile = profileMap[otherId];
          if (!profile) return null;
          const prog = progressMap[otherId];
          const other: UserProfile = {
            id: otherId,
            username: profile.username,
            xp: prog?.xp ?? 0,
            streak: prog?.streak ?? 0,
          };
          const iAmRequester = row.requester_id === user.id;
          let status: RelEntry['status'];
          if (row.status === 'accepted') status = 'accepted';
          else if (iAmRequester) status = 'pendingSent';
          else status = 'pendingReceived';
          return { other, status, iAmRequester };
        })
        .filter((e): e is RelEntry => e !== null);

      setRelationships(entries);
    } catch {
      setRelError(true);
      setRelationships([]);
    } finally {
      setLoadingRels(false);
    }
  }, [user]);

  useEffect(() => { loadRelationships(); }, [loadRelationships]);

  // ── Search ─────────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!query.trim() || !user || searching) return;
    setSearching(true);
    setSearchError(false);
    setHasSearched(true);
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `%${query.trim()}%`)
        .neq('id', user.id)
        .limit(10) as { data: { id: string; username: string }[] | null; error: { message: string } | null };

      if (error) { setSearchError(true); setSearchResults([]); return; }
      if (!profiles || profiles.length === 0) { setSearchResults([]); return; }

      const { data: progresses } = await supabase
        .from('user_progress')
        .select('user_id, xp, streak')
        .in('user_id', profiles.map((p) => p.id)) as { data: { user_id: string; xp: number; streak: number }[] | null };

      const progressMap = Object.fromEntries((progresses ?? []).map((p) => [p.user_id, p]));
      setSearchResults(
        profiles.map((p) => ({
          id: p.id,
          username: p.username,
          xp: progressMap[p.id]?.xp ?? 0,
          streak: progressMap[p.id]?.streak ?? 0,
        }))
      );
    } catch {
      setSearchError(true);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // ── Send friend request ─────────────────────────────────────────────────────

  const handleSendRequest = (profile: UserProfile) => withBusy(profile.id, async () => {
    if (!user) return;
    // Check not already related
    const already = relationships.find((r) => r.other.id === profile.id);
    if (already) { showToast('Already connected with this user'); return; }

    const { error } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: profile.id,
    } as Record<string, string>);

    if (error) { showToast(`Could not send request: ${error.message}`); return; }
    showToast(`Friend request sent to ${profile.username} 📨`);
    // Optimistically add to local state
    setRelationships((prev) => [...prev, { other: profile, status: 'pendingSent', iAmRequester: true }]);
    setSearchResults((prev) => prev.filter((p) => p.id !== profile.id));
  });

  // ── Accept / decline request ────────────────────────────────────────────────

  const handleAccept = (entry: RelEntry) => withBusy(entry.other.id, async () => {
    if (!user) return;
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' } as Record<string, string>)
      .eq('requester_id', entry.other.id)
      .eq('addressee_id', user.id);

    if (error) { showToast(`Could not accept: ${error.message}`); return; }
    showToast(`You and ${entry.other.username} are now friends! 🤝`);
    setRelationships((prev) =>
      prev.map((r) => r.other.id === entry.other.id ? { ...r, status: 'accepted' } : r)
    );
  });

  const handleDecline = (entry: RelEntry) => withBusy(entry.other.id, async () => {
    if (!user) return;
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('requester_id', entry.other.id)
      .eq('addressee_id', user.id);

    if (error) { showToast(`Could not decline: ${error.message}`); return; }
    setRelationships((prev) => prev.filter((r) => r.other.id !== entry.other.id));
    showToast('Request declined');
  });

  // ── Cancel sent request ─────────────────────────────────────────────────────

  const handleCancelRequest = (entry: RelEntry) => withBusy(entry.other.id, async () => {
    if (!user) return;
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('requester_id', user.id)
      .eq('addressee_id', entry.other.id);

    if (error) { showToast(`Could not cancel: ${error.message}`); return; }
    setRelationships((prev) => prev.filter((r) => r.other.id !== entry.other.id));
    showToast('Request cancelled');
  });

  // ── Remove friend ───────────────────────────────────────────────────────────

  const handleRemove = (entry: RelEntry) => withBusy(entry.other.id, async () => {
    if (!user) return;
    // Try both orderings; RLS allows either participant to delete
    const { error: e1 } = await supabase
      .from('friendships')
      .delete()
      .eq('requester_id', user.id)
      .eq('addressee_id', entry.other.id);

    if (e1) {
      const { error: e2 } = await supabase
        .from('friendships')
        .delete()
        .eq('requester_id', entry.other.id)
        .eq('addressee_id', user.id);
      if (e2) { showToast(`Could not remove friend: ${e2.message}`); return; }
    }

    setRelationships((prev) => prev.filter((r) => r.other.id !== entry.other.id));
    showToast('Friend removed');
  });

  // ── Challenge ───────────────────────────────────────────────────────────────

  const handleChallenge = (entry: RelEntry) => {
    if (!onChallengeFriend) return;
    onChallengeFriend(entry.other.id, entry.other.username);
  };

  // ── Derived lists ───────────────────────────────────────────────────────────

  const friends          = relationships.filter((r) => r.status === 'accepted');
  const pendingReceived  = relationships.filter((r) => r.status === 'pendingReceived');
  const pendingSent      = relationships.filter((r) => r.status === 'pendingSent');

  const relatedIds = new Set(relationships.map((r) => r.other.id));

  // ── Render ──────────────────────────────────────────────────────────────────

  // Guest gate — mirrors MultiplayerHubPage. The friend graph keys off a real user id, so a guest
  // has nothing to load or show here; a clear "sign in" prompt beats an empty or perpetually
  // loading list.
  if (!user) {
    return (
      <div className="min-h-dvh bg-z-bg flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
          <HeaderBackButton onClick={onExit} />
          <h1 className="font-bold text-lg">Friends &amp; 1v1</h1>
        </div>
        <div className="flex-1 max-w-lg mx-auto w-full px-4 py-8 flex flex-col items-center justify-center gap-4 text-center overflow-y-auto">
          <span className="text-5xl">🤝</span>
          <div>
            <p className="font-bold text-lg">Sign in to add friends</p>
            <p className="text-z-gray-400 text-sm mt-1">Create an account so you can find players, send requests, and challenge friends to 1v1.</p>
          </div>
          {onRequireSignIn && (
            <motion.button
              onClick={onRequireSignIn}
              className="px-6 py-3 rounded-2xl font-bold text-white bg-gradient-primary"
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            >
              Sign In
            </motion.button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-z-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <HeaderBackButton onClick={onExit} />
        <h1 className="font-bold text-lg flex-1">Friends &amp; 1v1</h1>
        {onStartMultiplayer && (
          <motion.button
            onClick={onStartMultiplayer}
            className="flex items-center gap-1.5 text-xs font-bold bg-z-purple/20 text-z-purple-light border border-z-purple/30 rounded-xl px-3 py-1.5"
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          >
            ⚔️ Start 1v1
          </motion.button>
        )}
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-24 space-y-6">

        {/* Search */}
        <div>
          <p className="text-xs text-z-gray-400 uppercase tracking-widest mb-2">Find Players</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by username…"
              maxLength={20}
              className="flex-1 bg-z-card border border-white/10 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-z-purple/60 placeholder:text-z-gray-500"
            />
            <motion.button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2.5 bg-z-purple rounded-2xl text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              whileTap={{ scale: 0.96 }}
            >
              {searching ? '…' : 'Search'}
            </motion.button>
          </div>

          <AnimatePresence>
            {searchError && (
              <motion.div
                className="mt-3 text-center py-4 bg-z-card border border-z-red/20 rounded-2xl"
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              >
                <p className="text-z-red text-sm font-semibold">Search failed</p>
                <p className="text-z-gray-500 text-xs mt-1">Check your connection and try again.</p>
              </motion.div>
            )}
            {!searchError && !searching && hasSearched && searchResults.length === 0 && (
              <motion.div
                className="mt-3 text-center py-4"
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              >
                <p className="text-z-gray-400 text-sm">No players found matching "{query.trim()}"</p>
              </motion.div>
            )}
            {searchResults.length > 0 && (
              <motion.div className="mt-3 space-y-2" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                {searchResults.map((p) => {
                  const rel = relationships.find((r) => r.other.id === p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-3 bg-z-card border border-white/8 rounded-2xl px-4 py-3">
                      <button onClick={() => onViewProfile(p.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <div className="w-10 h-10 rounded-xl bg-z-purple/20 flex items-center justify-center text-xl">🤟</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">@{p.username}</p>
                          <p className="text-xs text-z-gray-400">{p.xp} XP · 🔥 {p.streak}d</p>
                        </div>
                      </button>
                      {relatedIds.has(p.id) ? (
                        <span className="text-xs text-z-gray-400 px-3 py-1.5">
                          {rel?.status === 'accepted' ? 'Friends ✓' : rel?.status === 'pendingSent' ? 'Requested' : 'Incoming'}
                        </span>
                      ) : (
                        <motion.button
                          onClick={() => handleSendRequest(p)}
                          disabled={busyIds.has(p.id)}
                          className="text-xs px-3 py-1.5 rounded-xl font-bold bg-z-purple text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          whileTap={{ scale: 0.96 }}
                        >
                          {busyIds.has(p.id) ? '…' : '+ Add'}
                        </motion.button>
                      )}
                      <button onClick={() => setReportTarget({ id: p.id, username: p.username })}
                        aria-label={`Report ${p.username}`}
                        className="w-11 h-11 -mr-2 flex items-center justify-center text-z-gray-500 hover:text-z-red transition-colors shrink-0">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                          <line x1="4" y1="22" x2="4" y2="15" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Incoming requests */}
        {pendingReceived.length > 0 && (
          <div>
            <p className="text-xs text-z-gray-400 uppercase tracking-widest mb-2">
              Incoming Requests ({pendingReceived.length})
            </p>
            <div className="space-y-2">
              {pendingReceived.map((entry) => (
                <motion.div key={entry.other.id}
                  className="flex items-center gap-3 bg-z-card border border-z-purple/20 rounded-2xl px-4 py-3"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <button onClick={() => onViewProfile(entry.other.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="w-10 h-10 rounded-xl bg-z-purple/20 flex items-center justify-center text-xl">🤟</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">@{entry.other.username}</p>
                      <p className="text-xs text-z-gray-400">{entry.other.xp} XP</p>
                    </div>
                  </button>
                  <div className="flex gap-2">
                    <motion.button onClick={() => handleAccept(entry)}
                      disabled={busyIds.has(entry.other.id)}
                      className="text-xs px-3 py-1.5 rounded-xl font-bold bg-z-purple text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      whileTap={{ scale: 0.96 }}>
                      {busyIds.has(entry.other.id) ? '…' : 'Accept'}
                    </motion.button>
                    <motion.button onClick={() => handleDecline(entry)}
                      disabled={busyIds.has(entry.other.id)}
                      className="text-xs px-3 py-1.5 rounded-xl font-bold border border-white/15 text-z-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      whileTap={{ scale: 0.96 }}>
                      Decline
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Friends list */}
        <div>
          <p className="text-xs text-z-gray-400 uppercase tracking-widest mb-2">
            Friends ({friends.length})
          </p>
          {loadingRels ? (
            <div className="space-y-2">
              {[0,1,2].map((i) => (
                <div key={i} className="flex items-center gap-3 bg-z-card border border-white/8 rounded-2xl px-4 py-3 opacity-40">
                  <div className="w-10 h-10 rounded-xl bg-z-surface animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-28 bg-z-surface rounded animate-pulse" />
                    <div className="h-2 w-20 bg-z-surface rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : relError ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-3">⚠️</p>
              <p className="text-z-gray-300 text-sm">Couldn't load your friends</p>
              <button
                onClick={() => void loadRelationships()}
                className="text-z-purple-light text-xs mt-1 font-semibold hover:underline"
              >
                Try again
              </button>
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-3">🤝</p>
              <p className="text-z-gray-300 text-sm">No friends yet</p>
              <p className="text-z-gray-500 text-xs mt-1">Search for players by username above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {friends.map((entry) => (
                <motion.div key={entry.other.id}
                  className="flex items-center gap-3 bg-z-card border border-white/8 rounded-2xl px-4 py-3"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <button onClick={() => onViewProfile(entry.other.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="w-10 h-10 rounded-xl bg-z-purple/20 flex items-center justify-center text-xl">🤟</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">@{entry.other.username}</p>
                      <div className="flex items-center gap-2 text-xs text-z-gray-400 mt-0.5">
                        <span>🔥 {entry.other.streak}d</span>
                        <span>·</span>
                        <span>⭐ {entry.other.xp} XP</span>
                      </div>
                    </div>
                  </button>
                  <div className="flex gap-2">
                    {onChallengeFriend && (
                      <motion.button onClick={() => handleChallenge(entry)}
                        className="text-xs px-3 min-h-11 rounded-xl font-bold bg-z-purple/20 text-z-purple-light border border-z-purple/30"
                        whileTap={{ scale: 0.96 }}>
                        ⚔️ Challenge
                      </motion.button>
                    )}
                    <button onClick={() => setReportTarget({ id: entry.other.id, username: entry.other.username })}
                      aria-label={`Report ${entry.other.username}`}
                      className="w-11 h-11 -mx-1 flex items-center justify-center text-z-gray-500 hover:text-z-red transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                        <line x1="4" y1="22" x2="4" y2="15" />
                      </svg>
                    </button>
                    <button onClick={() => handleRemove(entry)}
                      disabled={busyIds.has(entry.other.id)}
                      className="w-11 h-11 -ml-1 -mr-2 flex items-center justify-center text-z-gray-500 hover:text-z-red transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Sent requests */}
        {pendingSent.length > 0 && (
          <div>
            <p className="text-xs text-z-gray-400 uppercase tracking-widest mb-2">
              Sent Requests ({pendingSent.length})
            </p>
            <div className="space-y-2">
              {pendingSent.map((entry) => (
                <div key={entry.other.id} className="flex items-center gap-3 bg-z-card border border-white/8 rounded-2xl px-4 py-3 opacity-70">
                  <button onClick={() => onViewProfile(entry.other.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="w-10 h-10 rounded-xl bg-z-surface flex items-center justify-center text-xl">🤟</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">@{entry.other.username}</p>
                      <p className="text-xs text-z-gray-400">Pending…</p>
                    </div>
                  </button>
                  <motion.button onClick={() => handleCancelRequest(entry)}
                    disabled={busyIds.has(entry.other.id)}
                    className="text-xs px-3 py-1.5 rounded-xl font-bold border border-white/15 text-z-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileTap={{ scale: 0.96 }}>
                    Cancel
                  </motion.button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {user && reportTarget && (
        <ReportUserModal
          reporterId={user.id}
          reportedId={reportTarget.id}
          reportedUsername={reportTarget.username}
          context="friends"
          onClose={() => setReportTarget(null)}
        />
      )}

      {/* Toast */}
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
