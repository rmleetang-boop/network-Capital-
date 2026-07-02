import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Crown, Users, Wallet, ShieldCheck, Megaphone, Star, Sparkles, Settings,
  ArrowRight, ArrowLeft, AlertTriangle, RefreshCw, RotateCcw, Filter, Loader2,
  TrendingUp, FileText, Briefcase, MessageSquare, ChevronRight, Lock,
  CheckCircle2, XCircle, Search, Activity, BarChart3, Banknote, Trash2, Mail, Map,
} from 'lucide-react';
import { axiosInstance } from '../App';
import usePayoutSchedule from '../hooks/usePayoutSchedule';

/** OwnerControlCenterPage — the Platform Owner's single pane of glass.
 *  Surfaces every operational, commercial, content, advertising, rewards, and
 *  engagement signal AND offers in-place corrective actions (reverse audit
 *  rows, toggle feature flags, jump to admin pages).
 *
 *  Visible only to super_admin. Other roles get a friendly 403 screen.
 */
const OwnerControlCenterPage = ({ user }) => {
  const navigate = useNavigate();
  const isOwner = user && user.role === 'super_admin';

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);

  const loadOverview = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await axiosInstance.get('/admin/owner/overview');
      setOverview(r.data);
    } catch (e) {
      if (e.response?.status !== 403) toast.error(e.response?.data?.detail || 'Failed to load overview');
    } finally {
      setLoading(false);
      setReloading(false);
    }
  };

  useEffect(() => { if (isOwner) loadOverview(); /* eslint-disable-next-line */ }, [isOwner]);

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" data-testid="owner-center-denied">
        <div className="max-w-md text-center bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
          <Lock size={32} className="mx-auto text-text-muted mb-3" />
          <h1 className="font-heading font-bold text-xl mb-2">Platform Owner only</h1>
          <p className="text-sm text-text-secondary">This control center is reserved for the Platform Owner account.</p>
          <button onClick={() => navigate(-1)} className="mt-5 bg-primary text-white text-sm font-bold px-5 py-2 rounded-full">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#04101e] via-[#04101e] to-[#0a1e3a] text-white" data-testid="owner-control-center">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#04101e]/85 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/5"><ArrowLeft size={16} /></button>
          <div className="flex items-center gap-2 min-w-0">
            <Crown size={18} className="text-secondary" />
            <h1 className="font-heading font-bold text-sm sm:text-base truncate">Owner Control Center</h1>
            <span className="text-[10px] uppercase tracking-wider font-bold text-secondary bg-secondary/10 border border-secondary/30 px-1.5 py-0.5 rounded ml-1">Super Admin</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => { setReloading(true); loadOverview(true); }}
              disabled={reloading}
              className="text-xs font-semibold text-white/80 hover:text-white inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
              data-testid="owner-refresh"
            >
              <RefreshCw size={12} className={reloading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8 pb-24">
        {loading ? (
          <div className="py-20 text-center text-white/55">
            <Loader2 className="mx-auto animate-spin" />
          </div>
        ) : (
          <>
            {/* KPI summary tiles */}
            <KpiGrid overview={overview} />

            {/* Operational status banner */}
            <OpsBanner overview={overview} />

            {/* Quick action grid */}
            <SectionTitle icon={Settings} title="Quick actions" sub="Jump straight to the admin tools you need most." />
            <QuickActionGrid />

            {/* Sections */}
            <SectionTitle icon={Users} title="Users & roles" sub="Promote, demote, suspend, and review users." />
            <UsersRolesSection overview={overview} />

            <SectionTitle icon={Wallet} title="Wallet & financial" sub="Adjust balances and audit every change ever made." />
            <WalletFinancialSection overview={overview} onChange={loadOverview} />

            <SectionTitle icon={TrendingUp} title="Rewards & score engine" sub="Promotion windows, score brackets, ad reward inventory." />
            <RewardsSection overview={overview} />

            <SectionTitle icon={Megaphone} title="Content & engagement" sub="Official broadcasts, DMs, ambassador applications." />
            <ContentSection overview={overview} />

            <SectionTitle icon={Sparkles} title="Advertising" sub="Live campaigns + analytics + claim history." />
            <AdsSection overview={overview} />

            <SectionTitle icon={ShieldCheck} title="Operational & feature flags" sub="Toggle platform features and review the audit trail." />
            <OpsSection />
          </>
        )}
      </main>
    </div>
  );
};

/* ────────────────────────── Section helpers ──────────────────────────── */
const SectionTitle = ({ icon: Icon, title, sub }) => (
  <div className="pt-4 pb-1" data-testid={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
    <div className="flex items-center gap-2">
      <Icon size={16} className="text-secondary" />
      <h2 className="font-heading font-bold text-base sm:text-lg">{title}</h2>
    </div>
    {sub && <p className="text-xs text-white/55 mt-0.5">{sub}</p>}
  </div>
);

const Tile = ({ to, onClick, icon: Icon, title, sub, badge, danger, accent, testid }) => {
  const Inner = (
    <div
      className={`relative bg-white/[0.04] hover:bg-white/[0.07] border ${danger ? 'border-red-500/40' : accent ? 'border-secondary/30' : 'border-white/10'} rounded-2xl p-4 transition-all active:scale-[0.98] cursor-pointer h-full`}
      data-testid={testid}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`w-9 h-9 rounded-full ${danger ? 'bg-red-500/10 text-red-300' : accent ? 'bg-secondary/15 text-secondary' : 'bg-white/5 text-white/80'} flex items-center justify-center`}>
          <Icon size={16} />
        </div>
        {badge !== undefined && badge !== null && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${danger ? 'bg-red-500/20 text-red-200' : 'bg-secondary/15 text-secondary'}`}>{badge}</span>
        )}
      </div>
      <h3 className="font-heading font-bold text-sm text-white">{title}</h3>
      {sub && <p className="text-[11px] text-white/55 mt-0.5 leading-snug">{sub}</p>}
      <ChevronRight size={14} className="absolute right-3 bottom-3 text-white/30" />
    </div>
  );
  return to ? <Link to={to} className="block h-full">{Inner}</Link> : <button onClick={onClick} className="block w-full text-left h-full">{Inner}</button>;
};

const Stat = ({ icon: Icon, label, value, hint, danger }) => (
  <div className={`bg-white/[0.04] border ${danger ? 'border-red-500/30' : 'border-white/10'} rounded-2xl p-3`}>
    <div className="flex items-center gap-1.5 mb-1">
      {Icon && <Icon size={11} className={danger ? 'text-red-300' : 'text-white/55'} />}
      <p className="text-[10px] uppercase tracking-wider font-semibold text-white/55">{label}</p>
    </div>
    <p className={`text-lg font-heading font-bold leading-none ${danger ? 'text-red-200' : 'text-white'}`}>{value}</p>
    {hint && <p className="text-[10px] text-white/40 mt-1">{hint}</p>}
  </div>
);

/* ────────────────────────── KPI Grid ──────────────────────────── */
const KpiGrid = ({ overview }) => {
  const o = overview || {};
  return (
    <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" data-testid="owner-kpi-grid">
      <Stat icon={Users} label="Total users" value={o.users?.total?.toLocaleString?.() ?? '—'}
            hint={`+${o.users?.new_24h ?? 0} in 24h`} />
      <Stat icon={Wallet} label="Total wallet" value={`$${(o.wallet?.total_wallet_usd ?? 0).toLocaleString()}`}
            hint={`${o.wallet?.pending_withdrawals ?? 0} pending withdraw`}
            danger={(o.wallet?.pending_withdrawals ?? 0) > 0} />
      <Stat icon={TrendingUp} label="Points today" value={(o.engagement?.points_awarded_today ?? 0).toLocaleString()}
            hint={`${o.engagement?.score_events_today ?? 0} events`} />
      <Stat icon={Megaphone} label="Active ads" value={o.ads?.active_campaigns ?? 0}
            hint={`${o.ads?.claims_24h ?? 0} claims in 24h`} />
    </section>
  );
};

const OpsBanner = ({ overview }) => {
  const locked = overview?.wallet?.payout_locked;
  const schedule = usePayoutSchedule();
  if (!locked) return null;
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-start gap-3" data-testid="owner-ops-banner">
      <AlertTriangle size={16} className="text-amber-300 shrink-0 mt-0.5" />
      <div className="text-xs leading-relaxed">
        <p className="text-amber-100/80" data-testid="owner-ops-payout-message">{schedule?.message || 'Loading payout schedule…'}</p>
      </div>
    </div>
  );
};

/* ────────────────────────── Quick actions ──────────────────────────── */
const QuickActionGrid = () => (
  <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" data-testid="owner-quick-actions">
    <Tile to="/admin/sitemap" icon={Map} title="Site map" sub="Every feature · clickable map of the app" accent testid="qa-sitemap" />
    <Tile to="/admin/announce" icon={Megaphone} title="Official broadcast" sub="Email all verified members" accent testid="qa-announce" />
    <Tile to="/admin/outreach" icon={Mail} title="Invite non-users" sub="Outreach emails · 3 templates" accent testid="qa-outreach" />
    <Tile to="/admin/users" icon={Users} title="Manage users" sub="Filter, promote, restrict" testid="qa-users" />
    <Tile to="/admin/withdrawals" icon={Banknote} title="Withdrawals" sub="Approve / reject / refund" testid="qa-withdrawals" />
  </section>
);

/* ────────────────────────── Users & roles ──────────────────────────── */
const UsersRolesSection = ({ overview }) => {
  const r = overview?.users?.by_role || {};
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {['super_admin', 'admin', 'moderator', 'ambassador', 'user'].map((k) => (
          <Stat key={k} label={k.replace('_', ' ')} value={(r[k] || (k === 'ambassador' ? overview?.users?.ambassadors : 0)) ?? 0} />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Tile to="/admin/users" icon={Users} title="All users" sub="Search, filter by Network Score, change roles" testid="users-all" />
        <Tile to="/admin/ambassador-applications" icon={Star} title="Ambassador applications" sub="Approve / reject" badge={overview?.content?.pending_ambassador_apps || 0} accent={(overview?.content?.pending_ambassador_apps || 0) > 0} testid="users-amb-apps" />
        <Tile to="/admin/locked-accounts" icon={Lock} title="Locked accounts" sub="Released by admin · reset abuse lockout" danger testid="users-locked" />
        <Tile to="/admin/audit-log" icon={FileText} title="Audit log" sub="Every admin action ever taken" testid="users-audit" />
        <Tile to="/admin/owner/cleanup" icon={Trash2} title="User cleanup" sub="Hard-delete test users + content (irreversible)" danger testid="users-cleanup" />
        <Tile to="/admin/job-applications" icon={Briefcase} title="Job applications" sub="Global view · email applicants on review" accent testid="users-job-apps" />
      </div>
    </section>
  );
};

/* ────────────────────────── Wallet & financial ──────────────────────────── */
const WalletFinancialSection = ({ overview, onChange }) => {
  const [auditOpen, setAuditOpen] = useState(false);
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Total wallet (USD)" value={`$${(overview?.wallet?.total_wallet_usd ?? 0).toLocaleString()}`} />
        <Stat label="Grants (24h)" value={overview?.wallet?.grants_24h ?? 0} />
        <Stat label="Pending withdraw" value={overview?.wallet?.pending_withdrawals ?? 0} danger={(overview?.wallet?.pending_withdrawals ?? 0) > 0} />
        <Stat label="Paid (7d)" value={overview?.wallet?.completed_withdrawals_7d ?? 0} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Tile onClick={() => setAuditOpen(true)} icon={FileText} title="Wallet audit trail" sub="Every adjustment with prev/new balance · reverse" accent testid="wallet-audit-open" />
        <Tile to="/admin/withdrawals" icon={Banknote} title="Withdrawals queue" sub="Approve, reject, mark paid" testid="wallet-withdrawals" />
        <Tile to="/admin/credit-grants" icon={Wallet} title="Credit grants" sub="History of every grant" testid="wallet-grants" />
      </div>
      {auditOpen && <WalletAuditDrawer onClose={() => setAuditOpen(false)} onChange={onChange} />}
    </section>
  );
};

const WalletAuditDrawer = ({ onClose, onChange }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState('');
  const [reversing, setReversing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axiosInstance.get('/admin/wallet-audit', { params: { days, limit: 200 } });
      setRows(r.data?.rows || []);
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not load audit'); }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      (r.target_email || '').toLowerCase().includes(q)
      || (r.target_username || '').toLowerCase().includes(q)
      || (r.reason || '').toLowerCase().includes(q)
      || (r.actor_username || '').toLowerCase().includes(q));
  }, [rows, search]);

  const handleReverse = async (row) => {
    const reason = window.prompt(`Reverse $${row.amount_usd} from ${row.target_username || row.target_email}?\n\nEnter a reason (min 10 chars):`);
    if (!reason || reason.trim().length < 10) return;
    setReversing(row.id);
    try {
      await axiosInstance.post(`/admin/wallet-audit/${row.id}/reverse`, { reason: reason.trim() });
      toast.success('Adjustment reversed — counter-grant applied');
      load();
      if (onChange) onChange(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Reversal failed');
    } finally {
      setReversing(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose} data-testid="wallet-audit-drawer">
      <div onClick={(e) => e.stopPropagation()} className="bg-[#04101e] border border-white/10 w-full sm:max-w-3xl sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#04101e] border-b border-white/10 px-5 py-3 flex items-center gap-2">
          <FileText size={16} className="text-secondary" />
          <h3 className="font-heading font-bold text-base flex-1">Wallet adjustment audit trail</h3>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="text-xs bg-white/5 border border-white/10 rounded-full px-2 py-1 text-white" data-testid="wallet-audit-window">
            <option value={7}>7d</option>
            <option value={30}>30d</option>
            <option value={90}>90d</option>
            <option value={365}>12mo</option>
          </select>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/5 text-white/70" aria-label="Close"><XCircle size={14} /></button>
        </div>

        <div className="px-5 pt-3">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
                   placeholder="Search user, actor, reason…"
                   className="w-full bg-white/5 border border-white/10 rounded-full px-8 py-2 text-xs text-white placeholder-white/40 outline-none focus:border-secondary"
                   data-testid="wallet-audit-search" />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-white/55"><Loader2 className="mx-auto animate-spin" /></div>
        ) : (
          <div className="px-5 py-3 space-y-2">
            {filtered.length === 0 ? (
              <p className="text-xs text-white/55 text-center py-6">No adjustments in this window.</p>
            ) : filtered.map((row) => (
              <div key={row.id} className={`bg-white/[0.03] border ${row.reversed_at ? 'border-white/5 opacity-60' : 'border-white/10'} rounded-xl p-3`} data-testid={`audit-row-${row.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-bold ${row.amount_usd >= 0 ? 'text-secondary' : 'text-red-300'}`}>
                        {row.amount_usd >= 0 ? '+' : ''}${(row.amount_usd ?? 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-white/40">→ {row.target_username || row.target_email}</span>
                      {row.reversed_at && <span className="text-[10px] uppercase font-bold text-white/45 bg-white/5 px-1.5 py-0.5 rounded">Reversed</span>}
                    </div>
                    <p className="text-xs text-white/75 leading-snug">{row.reason}</p>
                    <p className="text-[10px] text-white/40 mt-1">
                      {new Date(row.created_at).toLocaleString()} · by <strong>{row.actor_username}</strong> ({row.actor_role}) · prev ${row.previous_balance_usd?.toFixed?.(2)} → new ${row.new_balance_usd?.toFixed?.(2)}
                    </p>
                  </div>
                  {!row.reversed_at && (
                    <button
                      onClick={() => handleReverse(row)}
                      disabled={reversing === row.id}
                      className="text-[11px] font-bold text-red-300 hover:text-red-200 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/30 disabled:opacity-50"
                      data-testid={`audit-reverse-${row.id}`}
                    >
                      <RotateCcw size={11} className={reversing === row.id ? 'animate-spin' : ''} /> Reverse
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ────────────────────────── Rewards & score ──────────────────────────── */
const RewardsSection = ({ overview }) => (
  <section className="space-y-3">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Events today" value={overview?.engagement?.score_events_today ?? 0} />
      <Stat label="Points awarded today" value={(overview?.engagement?.points_awarded_today ?? 0).toLocaleString()} />
      <Stat label="Top Contributors / month" value={overview?.engagement?.top_contributors_this_month ?? 0} />
      <Stat label="Active promotions" value={overview?.promotions?.active ?? 0} />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
      <Tile to="/admin/promotions" icon={Activity} title="Promotion windows" sub="Configure SAST cash-rewards windows" testid="rewards-promotions" />
      <Tile to="/admin/users" icon={BarChart3} title="Score audit by user" sub="Drill into any user's score events" testid="rewards-score-audit" />
      <Tile to="/admin/ads" icon={Sparkles} title="Ad reward inventory" sub="Set max_rewards on each campaign" testid="rewards-ad-inventory" />
    </div>
  </section>
);

/* ────────────────────────── Content & engagement ──────────────────────────── */
const ContentSection = ({ overview }) => (
  <section className="space-y-3">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Posts 24h" value={overview?.content?.posts_24h ?? overview?.engagement?.posts_24h ?? 0} />
      <Stat label="Official 7d" value={overview?.engagement?.official_posts_7d ?? 0} />
      <Stat label="Ambassador apps" value={overview?.content?.pending_ambassador_apps ?? 0} danger={(overview?.content?.pending_ambassador_apps ?? 0) > 0} />
      <Stat label="Active campaigns" value={overview?.ads?.active_campaigns ?? 0} />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
      <Tile to="/admin/announce" icon={Megaphone} title="New broadcast" sub="Post + email all verified users" accent testid="content-broadcast" />
      <Tile to="/admin/ambassador-applications" icon={Star} title="Ambassador queue" sub="Approve / reject pending applications" badge={overview?.content?.pending_ambassador_apps || 0} testid="content-ambassador" />
      <Tile to="/admin/stokvels" icon={Briefcase} title="Stokvels" sub="Manage savings circles" testid="content-stokvels" />
    </div>
  </section>
);

/* ────────────────────────── Ads ──────────────────────────── */
const AdsSection = ({ overview }) => (
  <section className="space-y-3">
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <Stat label="Active campaigns" value={overview?.ads?.active_campaigns ?? 0} />
      <Stat label="Claims (24h)" value={overview?.ads?.claims_24h ?? 0} />
      <Stat label="Status" value={(overview?.ads?.active_campaigns ?? 0) > 0 ? 'Live' : 'Off'} />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
      <Tile to="/admin/ads" icon={Sparkles} title="Manage campaigns" sub="Create, schedule, set reward inventory" accent testid="ads-manage" />
      <Tile to="/admin/ads" icon={BarChart3} title="Analytics" sub="Impressions, clicks, engagements" testid="ads-analytics" />
      <Tile to="/admin/audit-log" icon={FileText} title="Ad reward log" sub="Every claim, every user" testid="ads-log" />
    </div>
  </section>
);

/* ────────────────────────── Operational & feature flags ──────────────────────────── */
const OpsSection = () => {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const load = async () => {
    try {
      const r = await axiosInstance.get('/admin/feature-flags');
      setFlags(r.data?.flags || []);
    } catch (e) { /* silent */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (flag) => {
    setSaving(flag.key);
    try {
      await axiosInstance.put(`/admin/feature-flags/${flag.key}`, { value: !flag.value });
      toast.success(`Flag ${flag.key} = ${(!flag.value).toString()}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Toggle failed');
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Tile to="/admin/audit-log" icon={FileText} title="Full audit log" sub="Every admin action across the platform" testid="ops-audit" />
        <Tile to="/admin/metrics" icon={BarChart3} title="Platform metrics" sub="Time-series KPIs" testid="ops-metrics" />
      </div>
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4" data-testid="ops-feature-flags">
        <h4 className="font-heading font-bold text-sm text-white mb-2">Feature flags</h4>
        {loading ? (
          <Loader2 className="animate-spin text-white/55" />
        ) : flags.length === 0 ? (
          <p className="text-xs text-white/55">No flags configured.</p>
        ) : (
          <div className="space-y-2">
            {flags.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm text-white font-semibold">{f.key}</p>
                  <p className="text-[10px] text-white/45">default: {String(f.default)}{f.updated_at ? ` · updated ${new Date(f.updated_at).toLocaleDateString()}` : ''}</p>
                </div>
                <button
                  onClick={() => toggle(f)}
                  disabled={saving === f.key}
                  className={`relative w-11 h-6 rounded-full transition-colors ${f.value ? 'bg-secondary' : 'bg-white/15'} ${saving === f.key ? 'opacity-60' : ''}`}
                  data-testid={`flag-toggle-${f.key}`}
                >
                  <span className={`absolute top-0.5 ${f.value ? 'right-0.5' : 'left-0.5'} w-5 h-5 rounded-full bg-white shadow transition-all`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default OwnerControlCenterPage;
