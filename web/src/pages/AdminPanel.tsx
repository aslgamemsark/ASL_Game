import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeaderBackButton } from '@/components/shared/HeaderBackButton';
import { supabase } from '@/lib/supabase';
import { SHOP_ITEMS } from '@/data/shop';
import { WORLDS } from '@/data/worlds';
import {
  buildAdminInsights, pickTopProblem, buildTrends,
  type BetaMetrics, type AdminInsight, type AdminStatus, type Trend, type TopProblem,
} from '@/lib/adminInsights';

interface Props {
  onExit: () => void;
}

type AdminTab = 'beta' | 'users' | 'worlds' | 'audit';

// The shape returned by the admin_beta_metrics() RPC is defined once in lib/adminInsights.ts
// (imported above), alongside the plain-English interpretation logic that reads it.

interface FeedbackRow {
  id: number;
  category: string;
  message: string;
  anonymous: boolean;
  page: string | null;
  user_agent: string | null;
  status: string;
  created_at: string;
}

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
        {(['beta', 'users', 'worlds', 'audit'] as const).map((t) => (
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
        {tab === 'beta' && <BetaTab showToast={showToast} />}
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

function pct(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(1)}%`;
}

// Beta dashboard: cohort recognition/engagement stats (from the admin_beta_metrics RPC, which
// aggregates the RLS-locked sign_attempts server-side) plus the live feedback inbox (read directly
// via the feedback_read_admin RLS policy). Read-only except for triaging a feedback row's status.
function BetaTab({ showToast }: { showToast: (m: string) => void }) {
  const [metrics, setMetrics] = useState<BetaMetrics | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [metricsRes, feedbackRes] = await Promise.all([
        supabase.rpc('admin_beta_metrics'),
        supabase
          .from('feedback')
          .select('id, category, message, anonymous, page, user_agent, status, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (metricsRes.error) showToast(`Error: ${metricsRes.error.message}`);
      else setMetrics(metricsRes.data as BetaMetrics);
      setFeedback((feedbackRes.data as FeedbackRow[] | null) ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void load(); }, [load]);

  const setStatus = async (id: number, status: string) => {
    const { error } = await supabase.from('feedback').update({ status }).eq('id', id);
    if (error) { showToast(`Error: ${error.message}`); return; }
    setFeedback((rows) => rows.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  if (loading) return <p className="text-sm text-z-gray-400">Loading…</p>;
  if (loadError) {
    return (
      <div className="text-center py-10">
        <p className="text-z-gray-300 text-sm">Couldn't load beta metrics</p>
        <button onClick={() => void load()} className="text-z-purple-light text-xs mt-1 font-semibold hover:underline">
          Try again
        </button>
      </div>
    );
  }

  const r = metrics?.recognition;
  const insights = metrics ? buildAdminInsights(metrics) : [];
  const topProblem = metrics ? pickTopProblem(insights) : null;
  const trends = metrics ? buildTrends(metrics) : [];

  return (
    <div className="space-y-5">
      {/* Today's biggest problem — the single most important thing to look at, in plain English. */}
      {topProblem && <TopProblemCard problem={topProblem} />}

      {/* Since yesterday — simple up/down arrows, only shown once there's a previous day to compare. */}
      {trends.length > 0 && (
        <div className="bg-z-card border border-white/5 rounded-2xl p-4">
          <h3 className="font-bold text-sm mb-3 text-z-gray-300 uppercase tracking-wide">Since yesterday</h3>
          <div className="space-y-2">
            {trends.map((t) => <TrendRow key={t.key} trend={t} />)}
          </div>
        </div>
      )}

      {/* Overview — every stat as a plain-English sentence with a status pill. */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((i) => <InsightCard key={i.key} insight={i} />)}
        </div>
      )}

      {/* Engagement (quick numbers) */}
      {metrics && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Active today" value={metrics.users.dau} />
          <Stat label="Active this week" value={metrics.users.wau} />
          <Stat label="Total users" value={metrics.users.total} />
        </div>
      )}

      {/* Plain-English glossary — collapsed by default. */}
      <details className="bg-z-card border border-white/5 rounded-2xl p-4">
        <summary className="font-bold text-sm text-z-gray-300 cursor-pointer select-none">What do these words mean?</summary>
        <div className="mt-3 space-y-2 text-sm text-z-gray-300">
          <p><b className="text-white">Active today / this week</b> — how many different people practiced signs in that time.</p>
          <p><b className="text-white">Success rate</b> — out of every sign someone tries, how often it gets accepted. Very low = too hard (people struggle); very high = maybe too easy.</p>
          <p><b className="text-white">Hardest signs</b> — the signs people fail most. A very high fail rate means that sign probably needs to be made easier.</p>
          <p><b className="text-white">AI veto / Rule reject / NO_SIGN</b> — developer diagnostics for how the recognizer made its decision. You can ignore these; they’re in the Advanced section for your dev.</p>
        </div>
      </details>

      {/* Recognition health — moved to Advanced (the technical detail behind "Success rate"). */}
      {r && (
        <details className="bg-z-card border border-white/5 rounded-2xl p-4">
          <summary className="font-bold text-sm text-z-gray-300 uppercase tracking-wide cursor-pointer select-none">Advanced (for developers)</summary>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mt-3">
            <Row label="Attempts (total)" value={String(r.attempts_total)} />
            <Row label="Attempts (24h)" value={String(r.attempts_24h)} />
            <Row label="Pass rate" value={pct(r.pass_rate)} />
            <Row label="Avg AI confidence" value={pct(r.avg_ai_confidence)} />
            <Row label={`Rule reject (n=${r.rule_reject_denom})`} value={pct(r.rule_reject_rate)} />
            <Row label={`AI veto (n=${r.ai_veto_denom})`} value={pct(r.ai_veto_rate)} />
            <Row label="NO_SIGN predictions" value={String(r.no_sign_count)} />
          </div>
        </details>
      )}

      {/* Most-failed signs */}
      {metrics && metrics.top_failed_signs.length > 0 && (
        <div className="bg-z-card border border-white/5 rounded-2xl p-4">
          <h3 className="font-bold text-sm mb-3 text-z-gray-300 uppercase tracking-wide">
            Hardest signs
          </h3>
          <div className="space-y-1.5">
            {metrics.top_failed_signs.map((s) => (
              <div key={s.sign_id} className="flex items-center gap-2 text-sm">
                <span className="font-mono font-semibold w-24 shrink-0">{s.sign_id}</span>
                <div className="flex-1 h-2 bg-z-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-z-red/70 rounded-full"
                    style={{ width: `${Math.round(s.fail_rate * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-z-gray-400 w-28 text-right shrink-0">
                  {Math.round(s.fail_rate * 100)}% · {s.failures}/{s.attempts}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback inbox */}
      <div className="bg-z-card border border-white/5 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-z-gray-300 uppercase tracking-wide">Feedback</h3>
          {metrics && (
            <span className="text-xs text-z-gray-400">
              {metrics.feedback.open} open · {metrics.feedback.total} total
            </span>
          )}
        </div>
        {feedback.length === 0 ? (
          <p className="text-sm text-z-gray-400">No feedback yet.</p>
        ) : (
          <div className="space-y-2">
            {feedback.map((f) => (
              <div key={f.id} className="bg-z-surface rounded-xl p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase text-z-purple-light">{f.category}</span>
                  {f.anonymous && <span className="text-[10px] text-z-gray-500">anon</span>}
                  <span className="text-[10px] text-z-gray-500 ml-auto">
                    {new Date(f.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-z-gray-200 whitespace-pre-wrap break-words">{f.message}</p>
                <div className="flex items-center gap-2 mt-2">
                  {f.page && <span className="text-[10px] text-z-gray-500">on {f.page}</span>}
                  <select
                    value={f.status}
                    onChange={(e) => void setStatus(f.id, e.target.value)}
                    className="ml-auto bg-z-card border border-white/10 rounded-lg px-2 py-1 text-xs outline-none focus:border-z-purple"
                  >
                    <option value="open">open</option>
                    <option value="triaged">triaged</option>
                    <option value="resolved">resolved</option>
                    <option value="wontfix">wontfix</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Plain-English status → colors + label. One place so the pill and cards stay consistent.
const STATUS_UI: Record<AdminStatus, { pill: string; label: string; ring: string }> = {
  good: { pill: 'bg-z-green/15 text-z-green', label: 'All good', ring: 'border-white/5' },
  watch: { pill: 'bg-z-yellow/15 text-z-yellow', label: 'Keep an eye', ring: 'border-z-yellow/30' },
  action: { pill: 'bg-z-red/15 text-z-red', label: 'Needs action', ring: 'border-z-red/40' },
};

// The hero card: the single highest-priority issue right now, or a calm "all clear".
function TopProblemCard({ problem }: { problem: TopProblem }) {
  if (!problem.hasProblem) {
    return (
      <div className="rounded-2xl border border-z-green/30 bg-z-green/10 p-4">
        <p className="text-sm font-bold text-z-green">✓ {problem.title}</p>
        <p className="text-sm text-z-gray-200 mt-1">{problem.whyItMatters}</p>
        <p className="text-sm text-z-gray-300 mt-2"><b className="text-white">Do next:</b> {problem.nextAction}</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-z-red/40 bg-z-red/10 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-z-red">⚠ Today’s biggest problem</p>
      <p className="text-base font-bold text-white mt-1">{problem.whatsWrong}</p>
      <div className="mt-3 space-y-1.5 text-sm text-z-gray-200">
        <p><b className="text-white">Why it matters:</b> {problem.whyItMatters}</p>
        <p><b className="text-white">Check first:</b> {problem.checkFirst}</p>
        <p><b className="text-white">Do next:</b> {problem.nextAction}</p>
      </div>
    </div>
  );
}

function TrendRow({ trend }: { trend: Trend }) {
  const arrow = trend.dir === 'up' ? '↑' : trend.dir === 'down' ? '↓' : '→';
  // A trend is "positive" when it moved in the good direction (up for users/accuracy).
  const positive = trend.dir === 'flat' ? null : (trend.dir === 'up') === trend.goodWhenUp;
  const color = positive === null ? 'text-z-gray-400' : positive ? 'text-z-green' : 'text-z-red';
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`font-bold w-5 text-center ${color}`}>{arrow}</span>
      <span className="font-semibold text-z-gray-200 w-40 shrink-0">{trend.label}</span>
      <span className="text-z-gray-400">{trend.plain}</span>
    </div>
  );
}

function InsightCard({ insight }: { insight: AdminInsight }) {
  const ui = STATUS_UI[insight.status];
  return (
    <div className={`bg-z-card border ${ui.ring} rounded-2xl p-3.5`}>
      <div className="flex items-start gap-2">
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${ui.pill}`}>{ui.label}</span>
        <div className="flex-1">
          <p className="text-sm text-z-gray-100">{insight.plain}</p>
          {insight.advice && <p className="text-xs text-z-gray-400 mt-1">{insight.advice}</p>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-z-card border border-white/5 rounded-xl py-3">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[11px] text-z-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-z-gray-400 text-xs">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function UsersTab({ showToast }: { showToast: (m: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState<UserSearchResult | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [goldAmount, setGoldAmount] = useState('');
  const [goldReason, setGoldReason] = useState('');
  const [banReason, setBanReason] = useState('');
  const [newName, setNewName] = useState('');
  // Shared busy flag for the mutating admin actions below (grant gold, set cosmetic, grant all
  // cosmetics, ban/unban) — they're sequential edits to the same user, never meant to run
  // concurrently, and none of the buttons disabled themselves while their RPC was in flight, so a
  // fast double-click could fire the same grant/ban twice before the first response landed.
  const [actionBusy, setActionBusy] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || searching) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const { data, error } = (await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `%${query.trim()}%`)
        .limit(10)) as { data: UserSearchResult[] | null; error: { message: string } | null };
      if (error) { showToast(`Search failed: ${error.message}`); setResults([]); return; }
      setResults(data ?? []);
    } catch {
      showToast('Search failed — check your connection and try again.');
      setResults([]);
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
    if (!selected || actionBusy) return;
    const amount = parseInt(goldAmount, 10);
    if (!Number.isFinite(amount) || amount === 0) { showToast('Enter a non-zero amount'); return; }
    setActionBusy(true);
    try {
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
    } finally {
      setActionBusy(false);
    }
  };

  const handleSetCosmetic = async (cosmeticType: 'border' | 'avatar', itemId: string | null) => {
    if (!selected || actionBusy) return;
    setActionBusy(true);
    try {
      const { error } = await supabase.rpc('admin_set_cosmetic', {
        target_user_id: selected.id,
        cosmetic_type: cosmeticType,
        item_id: itemId,
      });
      if (error) { showToast(`Error: ${error.message}`); return; }
      showToast('Cosmetic updated');
      void loadDetail(selected);
    } finally {
      setActionBusy(false);
    }
  };

  const handleGrantAllCosmetics = async () => {
    if (!selected || actionBusy) return;
    setActionBusy(true);
    try {
      const ids = SHOP_ITEMS.filter((i) => i.type === 'border' || i.type === 'avatar').map((i) => i.id);
      const { error } = await supabase.rpc('admin_grant_cosmetics', { target_user_id: selected.id, item_ids: ids });
      if (error) { showToast(`Error: ${error.message}`); return; }
      showToast('Granted all cosmetics');
      void loadDetail(selected);
    } finally {
      setActionBusy(false);
    }
  };

  const handleRename = async () => {
    if (!selected || actionBusy) return;
    const trimmed = newName.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
      showToast('3-20 chars, letters/numbers/underscore only');
      return;
    }
    setActionBusy(true);
    try {
      const { error } = await supabase.rpc('admin_set_username', {
        target_user_id: selected.id,
        new_name: trimmed,
      });
      if (error) { showToast(`Error: ${error.message}`); return; }
      showToast(`Renamed to @${trimmed}`);
      setNewName('');
      setSelected({ ...selected, username: trimmed });
    } finally {
      setActionBusy(false);
    }
  };

  const handleBan = async (banned: boolean) => {
    if (!selected || actionBusy) return;
    setActionBusy(true);
    try {
      const { error } = await supabase.rpc('admin_set_ban', {
        target_user_id: selected.id,
        banned,
        reason: banned ? banReason || 'No reason given' : null,
      });
      if (error) { showToast(`Error: ${error.message}`); return; }
      showToast(banned ? 'User banned' : 'User unbanned');
      setBanReason('');
      void loadDetail(selected);
    } finally {
      setActionBusy(false);
    }
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
          className="px-4 py-2 rounded-xl bg-z-purple text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {searching ? '…' : 'Search'}
        </button>
      </div>

      {!selected && hasSearched && !searching && results.length === 0 && (
        <p className="text-sm text-z-gray-400 text-center py-4">No users found matching "{query.trim()}"</p>
      )}

      {results.length > 0 && !selected && (
        <div className="space-y-2">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => void loadDetail(r)}
              className="w-full text-left bg-z-card border border-white/5 rounded-xl px-4 py-3 hover:border-z-purple/40 transition-colors flex items-center min-w-0"
            >
              <span className="font-semibold text-sm truncate min-w-0">@{r.username}</span>
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
                    className="w-24 bg-z-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-z-purple"
                  />
                  <input
                    value={goldReason}
                    onChange={(e) => setGoldReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="flex-1 bg-z-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-z-purple"
                  />
                </div>
                <button onClick={handleGrantGold} disabled={actionBusy} className="w-full py-2 rounded-lg bg-z-yellow/15 text-z-yellow font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  🪙 Send
                </button>
              </div>

              <div>
                <p className="text-xs font-bold text-z-gray-300 uppercase mb-2">Cosmetics</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select
                    value={detail.equipped_border ?? ''}
                    onChange={(e) => void handleSetCosmetic('border', e.target.value || null)}
                    disabled={actionBusy}
                    className="bg-z-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-z-purple disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">No border</option>
                    {SHOP_ITEMS.filter((i) => i.type === 'border').map((i) => (
                      <option key={i.id} value={i.id}>{i.icon} {i.title}</option>
                    ))}
                  </select>
                  <select
                    value={detail.equipped_avatar ?? ''}
                    onChange={(e) => void handleSetCosmetic('avatar', e.target.value || null)}
                    disabled={actionBusy}
                    className="bg-z-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-z-purple disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">No avatar</option>
                    {SHOP_ITEMS.filter((i) => i.type === 'avatar').map((i) => (
                      <option key={i.id} value={i.id}>{i.icon} {i.title}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleGrantAllCosmetics}
                  disabled={actionBusy}
                  className="w-full py-2 rounded-lg bg-z-purple/15 text-z-purple-light font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Grant all cosmetics
                </button>
              </div>

              <div>
                <p className="text-xs font-bold text-z-gray-300 uppercase mb-2">Rename</p>
                <p className="text-[11px] text-z-gray-500 mb-2">
                  Clears an offensive username (banning alone leaves it visible on leaderboards).
                </p>
                <div className="flex gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="New username"
                    className="flex-1 bg-z-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-z-purple"
                  />
                  <button onClick={handleRename} disabled={actionBusy} className="px-4 py-1.5 rounded-lg bg-z-purple/15 text-z-purple-light font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                    Rename
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-z-gray-300 uppercase mb-2">Moderation</p>
                {detail.is_banned ? (
                  <button onClick={() => void handleBan(false)} disabled={actionBusy} className="w-full py-2 rounded-lg bg-z-green/15 text-z-green font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                    Unban user
                  </button>
                ) : (
                  <>
                    <input
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="Ban reason"
                      className="w-full bg-z-surface border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-z-purple mb-2"
                    />
                    <button onClick={() => void handleBan(true)} disabled={actionBusy} className="w-full py-2 rounded-lg bg-z-red/15 text-z-red font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
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
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = (await supabase.from('world_flags').select('world_id, enabled, coming_soon')) as {
        data: WorldFlagRow[] | null;
        error: { message: string } | null;
      };
      if (error) { setLoadError(true); return; }
      const map: Record<string, WorldFlagRow> = {};
      for (const row of data ?? []) map[row.world_id] = row;
      setFlags(map);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
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

  if (loadError) {
    return (
      <div className="text-center py-10">
        <p className="text-z-gray-300 text-sm">Couldn't load world settings</p>
        <button onClick={() => void load()} className="text-z-purple-light text-xs mt-1 font-semibold hover:underline">
          Try again
        </button>
      </div>
    );
  }

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
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = (await supabase
        .from('admin_audit_log')
        .select('id, admin_id, action, target_user_id, payload, created_at')
        .order('created_at', { ascending: false })
        .limit(50)) as { data: AuditRow[] | null; error: { message: string } | null };
      if (error) { setLoadError(true); return; }
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
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <p className="text-sm text-z-gray-400">Loading…</p>;
  if (loadError) {
    return (
      <div className="text-center py-10">
        <p className="text-z-gray-300 text-sm">Couldn't load the audit log</p>
        <button onClick={() => void load()} className="text-z-purple-light text-xs mt-1 font-semibold hover:underline">
          Try again
        </button>
      </div>
    );
  }
  if (rows.length === 0) return <p className="text-sm text-z-gray-400">No admin actions yet.</p>;

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="bg-z-card border border-white/5 rounded-xl p-3 text-xs">
          <p className="min-w-0 break-words">
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
