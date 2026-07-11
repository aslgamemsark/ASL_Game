import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { supabase } from '@/lib/supabase';
import { SHOP_ITEMS } from '@/data/shop';
import { WORLDS } from '@/data/worlds';

interface Props {
  onExit: () => void;
}

type AdminTab = 'users' | 'worlds' | 'audit';

interface UserSearchResult {
  id: string;
  username: string;
}

interface UserDetail {
  user_id: string;
  xp: number;
  level: number;
  streak: number;
  gold: number;
  owned_cosmetics: string[];
  equipped_border: string | null;
  equipped_avatar: string | null;
  is_banned: boolean;
  ban_reason: string | null;
}

interface WorldFlagRow {
  world_id: string;
  enabled: boolean;
  coming_soon: boolean;
}

interface AuditRow {
  id: number;
  admin_id: string | null;
  action: string;
  target_user_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  admin_username?: string;
  target_username?: string;
}

// This page is only reachable when useAuth().isAdmin is true (see SettingsPage's entry point and
// App.tsx's screen gate) — every mutation below still re-checks admin status server-side inside
// the RPC function itself (migration 20260707120000_admin_panel.sql), so a hidden button is a UX
// nicety here, never the actual security boundary.
export function AdminPanel({ onExit }: Props) {
  const [tab, setTab] = useState<AdminTab>('users');
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  return (
    <div className="min-h-screen bg-z-bg flex flex-col lg:pl-64">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-z-purple-deep/40">
        <HeaderBackButton onClick={onExit} />
        <h1 className="font-bold text-lg flex-1">🛠 Admin Panel</h1>
      </div>

      <div className="flex bg-z-surface/50 mx-4 mt-4 rounded-xl p-1 max-w-2xl lg:mx-auto lg:w-full">
        {(['users', 'worlds', 'audit'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize transition-colors ${
              tab === t ? 'bg-z-purple text-white' : 'text-z-gray-400'
            }`}
          >
            {t === 'audit' ? 'Audit Log' : t}
          </button>
        ))}
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-24">
        {tab === 'users' && <UsersTab showToast={showToast} />}
        {tab === 'worlds' && <WorldsTab showToast={showToast} />}
        {tab === 'audit' && <AuditTab />}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-z-card border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold shadow-xl z-50"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UsersTab({ showToast }: { showToast: (m: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<UserSearchResult | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [goldAmount, setGoldAmount] = useState('');
  const [goldReason, setGoldReason] = useState('');
  const [banReason, setBanReason] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const { data } = (await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `%${query.trim()}%`)
        .limit(10)) as { data: UserSearchResult[] | null };
      setResults(data ?? []);
    } finally {
      setSearching(false);
    }
  };

  const loadDetail = useCallback(
    async (u: UserSearchResult) => {
      setSelected(u);
      setLoadingDetail(true);
      setDetail(null);
      try {
        const { data, error } = await supabase.rpc('admin_get_user_progress', { target_user_id: u.id });
        if (error) { showToast(`Error: ${error.message}`); return; }
        const row = (data as UserDetail[] | null)?.[0] ?? null;
        setDetail(row);
      } finally {
        setLoadingDetail(false);
      }
    },
    [showToast]
  );

  const handleGrantGold = async () => {
    if (!selected) return;
    const amount = parseInt(goldAmount, 10);
    if (!Number.isFinite(amount) || amount === 0) { showToast('Enter a non-zero amount'); return; }
    const { data, error } = await supabase.rpc('admin_grant_gold', {
      target_user_id: selected.id,
      amount,
      reason: goldReason || null,
    });
    if (error) { showToast(`Error: ${error.message}`); return; }
    showToast(`New balance: ${data} 🪙`);
    setGoldAmount('');
    setGoldReason('');
    void loadDetail(selected);
  };

  const handleSetCosmetic = async (cosmeticType: 'border' | 'avatar', itemId: string | null) => {
    if (!selected) return;
    const { error } = await supabase.rpc('admin_set_cosmetic', {
      target_user_id: selected.id,
      cosmetic_type: cosmeticType,
      item_id: itemId,
    });
    if (error) { showToast(`Error: ${error.message}`); return; }
    showToast('Cosmetic updated');
    void loadDetail(selected);
  };

  const handleGrantAllCosmetics = async () => {
    if (!selected) return;
    const ids = SHOP_ITEMS.filter((i) => i.type === 'border' || i.type === 'avatar').map((i) => i.id);
    const { error } = await supabase.rpc('admin_grant_cosmetics', { target_user_id: selected.id, item_ids: ids });
    if (error) { showToast(`Error: ${error.message}`); return; }
    showToast('Granted all cosmetics');
    void loadDetail(selected);
  };

  const handleBan = async (banned: boolean) => {
    if (!selected) return;
    const { error } = await supabase.rpc('admin_set_ban', {
      target_user_id: selected.id,
      banned,
      reason: banned ? banReason || 'No reason given' : null,
    });
    if (error) { showToast(`Error: ${error.message}`); return; }
    showToast(banned ? 'User banned' : 'User unbanned');
    setBanReason('');
    void loadDetail(selected);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search username..."
          className="flex-1 bg-z-card border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-z-purple"
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="px-4 py-2 rounded-xl bg-z-purple text-white font-bold text-sm disabled:opacity-50"
        >
          {searching ? '…' : 'Search'}
        </button>
      </div>

      {results.length > 0 && !selected && (
        <div className="space-y-2">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => void loadDetail(r)}
              className="w-full text-left bg-z-card border border-white/5 rounded-xl px-4 py-3 hover:border-z-purple/40 transition-colors"
            >
              <span className="font-semibold text-sm">@{r.username}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="bg-z-card border border-white/5 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">@{selected.username}</h3>
            <button
              onClick={() => { setSelected(null); setDetail(null); setResults([]); }}
              className="text-xs text-z-gray-400 hover:text-white"
            >
              ← Back to search
            </button>
          </div>

          {loadingDetail && <p className="text-sm text-z-gray-400">Loading…</p>}

          {detail && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-z-surface rounded-lg py-2">
                  <p className="text-xs text-z-gray-400">XP</p>
                  <p className="font-bold">{detail.xp}</p>
                </div>
                <div className="bg-z-surface rounded-lg py-2">
                  <p className="text-xs text-z-gray-400">Streak</p>
                  <p className="font-bold">{detail.streak}</p>
                </div>
                <div className="bg-z-surface rounded-lg py-2">
                  <p className="text-xs text-z-gray-400">Gold</p>
                  <p className="font-bold text-z-yellow">{detail.gold}</p>
                </div>
              </div>

              {detail.is_banned && (
                <div className="bg-z-red/10 border border-z-red/30 rounded-lg p-3 text-xs text-z-red">
                  Currently banned: {detail.ban_reason ?? 'No reason given'}
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-z-gray-300 uppercase mb-2">Send gold</p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="number"
                    value={goldAmount}
                    onChange={(e) => setGoldAmount(e.target.value)}
                    placeholder="Amount"
                    className="w-24 bg-z-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none"
                  />
                  <input
                    value={goldReason}
                    onChange={(e) => setGoldReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="flex-1 bg-z-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none"
                  />
                </div>
                <button onClick={handleGrantGold} className="w-full py-2 rounded-lg bg-z-yellow/15 text-z-yellow font-bold text-sm">
                  🪙 Send
                </button>
              </div>

              <div>
                <p className="text-xs font-bold text-z-gray-300 uppercase mb-2">Cosmetics</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select
                    value={detail.equipped_border ?? ''}
                    onChange={(e) => void handleSetCosmetic('border', e.target.value || null)}
                    className="bg-z-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none"
                  >
                    <option value="">No border</option>
                    {SHOP_ITEMS.filter((i) => i.type === 'border').map((i) => (
                      <option key={i.id} value={i.id}>{i.icon} {i.title}</option>
                    ))}
                  </select>
                  <select
                    value={detail.equipped_avatar ?? ''}
                    onChange={(e) => void handleSetCosmetic('avatar', e.target.value || null)}
                    className="bg-z-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none"
                  >
                    <option value="">No avatar</option>
                    {SHOP_ITEMS.filter((i) => i.type === 'avatar').map((i) => (
                      <option key={i.id} value={i.id}>{i.icon} {i.title}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleGrantAllCosmetics}
                  className="w-full py-2 rounded-lg bg-z-purple/15 text-z-purple-light font-bold text-sm"
                >
                  Grant all cosmetics
                </button>
              </div>

              <div>
                <p className="text-xs font-bold text-z-gray-300 uppercase mb-2">Moderation</p>
                {detail.is_banned ? (
                  <button onClick={() => void handleBan(false)} className="w-full py-2 rounded-lg bg-z-green/15 text-z-green font-bold text-sm">
                    Unban user
                  </button>
                ) : (
                  <>
                    <input
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="Ban reason"
                      className="w-full bg-z-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none mb-2"
                    />
                    <button onClick={() => void handleBan(true)} className="w-full py-2 rounded-lg bg-z-red/15 text-z-red font-bold text-sm">
                      🚫 Ban user
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function WorldsTab({ showToast }: { showToast: (m: string) => void }) {
  const [flags, setFlags] = useState<Record<string, WorldFlagRow>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = (await supabase.from('world_flags').select('world_id, enabled, coming_soon')) as {
      data: WorldFlagRow[] | null;
    };
    const map: Record<string, WorldFlagRow> = {};
    for (const row of data ?? []) map[row.world_id] = row;
    setFlags(map);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (worldId: string, field: 'enabled' | 'coming_soon') => {
    const current = flags[worldId] ?? { world_id: worldId, enabled: true, coming_soon: false };
    const next = { ...current, [field]: !current[field] };
    const { error } = await supabase.rpc('admin_set_world_flag', {
      p_world_id: worldId,
      p_enabled: next.enabled,
      p_coming_soon: next.coming_soon,
    });
    if (error) { showToast(`Error: ${error.message}`); return; }
    setFlags((f) => ({ ...f, [worldId]: next }));
  };

  if (loading) return <p className="text-sm text-z-gray-400">Loading…</p>;

  return (
    <div className="space-y-3">
      {WORLDS.map((w) => {
        const flag = flags[w.id] ?? { world_id: w.id, enabled: true, coming_soon: false };
        return (
          <div key={w.id} className="bg-z-card border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xl">{w.emoji}</span>
              <p className="font-bold text-sm">{w.title}</p>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs text-z-gray-300">
                <input type="checkbox" checked={flag.enabled} onChange={() => void toggle(w.id, 'enabled')} />
                Visible
              </label>
              <label className="flex items-center gap-1.5 text-xs text-z-gray-300">
                <input type="checkbox" checked={flag.coming_soon} onChange={() => void toggle(w.id, 'coming_soon')} />
                Coming soon
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AuditTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = (await supabase
        .from('admin_audit_log')
        .select('id, admin_id, action, target_user_id, payload, created_at')
        .order('created_at', { ascending: false })
        .limit(50)) as { data: AuditRow[] | null };
      const entries = data ?? [];
      const ids = Array.from(
        new Set(entries.flatMap((r) => [r.admin_id, r.target_user_id]).filter((x): x is string => !!x))
      );
      const { data: profiles } = (await supabase.from('profiles').select('id, username').in('id', ids)) as {
        data: { id: string; username: string }[] | null;
      };
      const nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.username]));
      setRows(
        entries.map((r) => ({
          ...r,
          admin_username: r.admin_id ? nameMap[r.admin_id] : undefined,
          target_username: r.target_user_id ? nameMap[r.target_user_id] : undefined,
        }))
      );
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-sm text-z-gray-400">Loading…</p>;
  if (rows.length === 0) return <p className="text-sm text-z-gray-400">No admin actions yet.</p>;

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="bg-z-card border border-white/5 rounded-xl p-3 text-xs">
          <p>
            <span className="font-bold text-z-purple-light">@{r.admin_username ?? '?'}</span>{' '}
            <span className="text-z-gray-300">{r.action}</span>
            {r.target_username && (
              <>
                {' → '}
                <span className="font-bold">@{r.target_username}</span>
              </>
            )}
          </p>
          <p className="text-z-gray-500 mt-1">{new Date(r.created_at).toLocaleString()}</p>
          {Object.keys(r.payload).length > 0 && (
            <p className="text-z-gray-500 mt-1 font-mono break-all">{JSON.stringify(r.payload)}</p>
          )}
        </div>
      ))}
    </div>
  );
}
