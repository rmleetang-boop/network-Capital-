// Iter 53 — Ambassador Dashboard 2.0 (Command Center)
//
// A futuristic referral growth command center: 8 KPI glass cards,
// SVG network graph with color-coded nodes, AI insights, conversion
// funnel, 30-day activity heatmap, hidden bonus teaser, gamification
// level, autopilot toggle, and per-referral engagement actions.
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, ArrowDownToLine, Users, Clock, Activity, Zap, Sparkles, Trophy,
  ChevronLeft, Flame, Loader2, X, Mail, MailCheck, AlertTriangle,
  Send, RefreshCw, Star, Brain, MapPin, Sun, CheckCircle2, Power,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const COLOR = {
  green:  '#34d399',
  yellow: '#fbbf24',
  orange: '#fb923c',
  red:    '#f87171',
};

const HEATMAP_PALETTE = ['#0e1a30', '#102a52', '#1f4980', '#3a78c8', '#5ea7ff'];

const heatColor = (count, max) => {
  if (!count) return HEATMAP_PALETTE[0];
  const idx = Math.min(HEATMAP_PALETTE.length - 1, 1 + Math.floor((count / Math.max(1, max)) * (HEATMAP_PALETTE.length - 2)));
  return HEATMAP_PALETTE[idx];
};

const fmtZar = (n) => `R ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

// ── Glass KPI card ─────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, hint, accent = '#5ea7ff', testid }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="relative rounded-2xl p-4 border border-white/8 overflow-hidden backdrop-blur-xl"
    style={{ background: 'linear-gradient(155deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }}
    data-testid={testid}
  >
    <div className="absolute -top-12 -right-10 w-28 h-28 rounded-full opacity-30 blur-2xl" style={{ background: accent }} />
    <div className="flex items-center justify-between relative">
      <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-white/55">{label}</span>
      <Icon size={14} style={{ color: accent }} />
    </div>
    <p className="text-xl sm:text-2xl font-bold mt-2 text-white tracking-tight relative">{value}</p>
    {hint && <p className="text-[10px] text-white/45 mt-1 relative">{hint}</p>}
  </motion.div>
);

// ── Network graph (SVG, circular layout) ───────────────────────────────────
const NetworkGraph = ({ ambassador, nodes, onSelect, selectedId }) => {
  const w = 560, h = 420, cx = w / 2, cy = h / 2;
  // Sort by engagement so the strongest sit on the inner ring
  const sorted = useMemo(
    () => [...nodes].sort((a, b) => b.engagement_score - a.engagement_score),
    [nodes]
  );

  // Layout: up to 12 on inner ring (r=110), next 18 on r=170, rest on r=210
  const layouts = sorted.map((n, i) => {
    let r = 110;
    let perRing = 12;
    let ringIdx = i;
    if (i >= 12 && i < 30) { r = 170; perRing = 18; ringIdx = i - 12; }
    else if (i >= 30)       { r = 210; perRing = Math.max(24, sorted.length - 30); ringIdx = i - 30; }
    const angle = (ringIdx / perRing) * Math.PI * 2 - Math.PI / 2;
    return {
      node: n,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    };
  });

  return (
    <div className="relative" data-testid="network-graph">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="bgglow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5ea7ff" stopOpacity="0.18" />
            <stop offset="55%" stopColor="#1e3a8a" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#0a1628" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hubcore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
          <filter id="softglow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* background glow */}
        <rect width={w} height={h} fill="url(#bgglow)" />

        {/* rings */}
        {[110, 170, 210].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 6" />
        ))}

        {/* edges */}
        {layouts.map(({ node, x, y }) => (
          <line
            key={`e-${node.id}`}
            x1={cx} y1={cy} x2={x} y2={y}
            stroke={COLOR[node.color] || COLOR.red}
            strokeOpacity="0.32"
            strokeWidth={node.engagement_score >= 75 ? 1.3 : 0.6}
          />
        ))}

        {/* nodes */}
        {layouts.map(({ node, x, y }) => (
          <g key={node.id} onClick={() => onSelect(node)} style={{ cursor: 'pointer' }} data-testid={`network-node-${node.id}`}>
            <circle cx={x} cy={y} r={node.size / 2 + 4} fill={COLOR[node.color] || COLOR.red} fillOpacity="0.18" />
            <circle
              cx={x} cy={y} r={node.size / 2}
              fill={COLOR[node.color] || COLOR.red}
              stroke={selectedId === node.id ? '#fff' : 'rgba(255,255,255,0.5)'}
              strokeWidth={selectedId === node.id ? 2 : 0.8}
              filter={selectedId === node.id ? 'url(#softglow)' : undefined}
            />
          </g>
        ))}

        {/* center hub */}
        <circle cx={cx} cy={cy} r="44" fill="url(#hubcore)" filter="url(#softglow)" />
        <circle cx={cx} cy={cy} r="44" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="9" fill="#0a1628" fontWeight="800" style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}>You</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="11" fill="#0a1628" fontWeight="700">@{ambassador?.username || '—'}</text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px] text-white/65" data-testid="network-legend">
        {[
          { c: 'green', label: 'Highly active' },
          { c: 'yellow', label: 'Partially active' },
          { c: 'orange', label: 'Low activity' },
          { c: 'red', label: 'Inactive' },
        ].map((l) => (
          <span key={l.c} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: COLOR[l.c] }} />
            {l.label}
          </span>
        ))}
        <span className="ml-auto opacity-60">{nodes.length} referral{nodes.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};

// ── Referral detail drawer (right side) ────────────────────────────────────
const RefDetail = ({ node, onClose, onEngage, busyType }) => {
  if (!node) return null;
  const actions = [
    { type: 'motivation',   label: 'Send motivation',          icon: Sparkles },
    { type: 'reminder',     label: 'Send reminder',            icon: Send },
    { type: 'profile',      label: 'Profile-completion email', icon: CheckCircle2 },
    { type: 'verification', label: 'Verification reminder',    icon: MailCheck },
    { type: 'reengagement', label: 'Re-engagement email',      icon: RefreshCw },
  ];
  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.aside
        key="drawer"
        initial={{ x: 380 }} animate={{ x: 0 }} exit={{ x: 380 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="fixed top-0 right-0 z-50 h-full w-[360px] max-w-[92vw] bg-[#0a1628]/95 backdrop-blur-2xl border-l border-white/10 text-white p-5 overflow-y-auto"
        data-testid="ref-detail-drawer"
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Referral</p>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10" data-testid="ref-detail-close">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-xs font-bold uppercase"
            style={{ borderColor: COLOR[node.color], background: `${COLOR[node.color]}1A`, color: COLOR[node.color] }}
          >
            {(node.full_name || node.username || '?').slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate" data-testid="ref-detail-name">{node.full_name}</p>
            <p className="text-[11px] text-white/55 truncate">@{node.username}</p>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          {[
            { label: 'Email',               value: node.email || '—' },
            { label: 'Registration date',   value: (node.registration_date || '—').slice(0, 10) },
            { label: 'Last activity',       value: (node.last_activity || '—').slice(0, 10) || '—' },
            { label: 'Points earned',       value: node.monthly_score },
            { label: 'Profile completion',  value: `${node.profile_completion_pct}%` },
            { label: 'Engagement score',    value: `${node.engagement_score} / 100` },
            { label: 'Referral stage',      value: <span className="capitalize">{String(node.stage).replace('_', ' ')}</span> },
            { label: 'Activity (30d)',      value: node.activity_30d },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between text-xs border-b border-white/5 pb-1.5">
              <span className="text-white/55">{row.label}</span>
              <span className="font-semibold text-right">{row.value}</span>
            </div>
          ))}
        </div>

        <p className="text-[10px] uppercase tracking-[0.18em] text-white/55 mb-2">Smart engagement actions</p>
        <div className="space-y-2">
          {actions.map(({ type, label, icon: Ico }) => (
            <button
              key={type}
              onClick={() => onEngage(node, type)}
              disabled={busyType === type}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/10 hover:border-secondary hover:bg-secondary/10 transition-all disabled:opacity-50 text-sm"
              data-testid={`engage-${type}`}
            >
              <span className="flex items-center gap-2">
                <Ico size={14} className="text-secondary" />
                {label}
              </span>
              {busyType === type ? <Loader2 size={14} className="animate-spin" /> : <Send size={12} className="opacity-60" />}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/40 mt-3">Emails are templated and personalized to the referral’s current stage. Delivery status appears in the log.</p>
      </motion.aside>
    </AnimatePresence>
  );
};

// ── Conversion funnel ──────────────────────────────────────────────────────
const Funnel = ({ steps }) => {
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <div className="space-y-1.5" data-testid="funnel">
      {steps.map((s, i) => {
        const width = `${(s.count / max) * 100}%`;
        return (
          <div key={s.stage} className="relative" data-testid={`funnel-stage-${s.stage.toLowerCase().replace(/ /g, '-')}`}>
            <div className="h-9 rounded-lg overflow-hidden border border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <motion.div
                initial={{ width: 0 }} animate={{ width }} transition={{ delay: i * 0.08, duration: 0.6 }}
                className="h-full rounded-lg"
                style={{ background: `linear-gradient(90deg, rgba(94,167,255,0.45), rgba(94,167,255,0.85))` }}
              />
            </div>
            <div className="absolute inset-0 px-3 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white">{s.stage}</span>
              <span className="text-white/80 tabular-nums">{s.count} · {s.pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Heatmap (last 30 days) ─────────────────────────────────────────────────
const Heatmap = ({ days }) => {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="grid grid-cols-10 sm:grid-cols-15 gap-1" data-testid="heatmap">
      {days.map((d) => (
        <div
          key={d.date}
          title={`${d.date}: ${d.count}`}
          className="aspect-square rounded-sm border border-white/5"
          style={{ background: heatColor(d.count, max) }}
        />
      ))}
    </div>
  );
};

// ── Insights panel ─────────────────────────────────────────────────────────
const Insights = ({ insights }) => {
  const toneStyle = {
    positive: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400', icon: Star },
    warning:  { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   dot: 'bg-amber-400',   icon: AlertTriangle },
    info:     { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    dot: 'bg-blue-400',    icon: Brain },
  };
  return (
    <div className="space-y-2" data-testid="insights">
      {insights.map((it, i) => {
        const s = toneStyle[it.tone] || toneStyle.info;
        const Ico = s.icon;
        return (
          <div key={i} className={`flex items-start gap-2 p-3 rounded-xl border ${s.bg} ${s.border}`} data-testid={`insight-${i}`}>
            <Ico size={14} className="mt-0.5 text-white/85 flex-shrink-0" />
            <span className="text-xs text-white/85 leading-snug">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────
const AmbassadorCommandCenterPage = ({ user }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [busyType, setBusyType] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [log, setLog] = useState([]);
  const [autopilotBusy, setAutopilotBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/ambassador/command-center');
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not load the command center');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadLog = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/ambassador/engagement-log?limit=50');
      setLog(res.data.items || []);
    } catch { /* ignore */ }
  }, []);

  const onEngage = async (node, type) => {
    setBusyType(type);
    try {
      const res = await axiosInstance.post(`/ambassador/referrals/${node.id}/engage`, { type });
      if (res.data.log?.status === 'delivered') {
        toast.success('Email delivered to ' + (node.email || 'referral'));
      } else {
        toast.message('Email queued', {
          description: 'Provider is currently unavailable — the send is logged and will retry.',
        });
      }
      if (showLog) await loadLog();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not send email');
    }
    setBusyType(null);
  };

  const toggleAutopilot = async () => {
    if (!data?.autopilot) return;
    setAutopilotBusy(true);
    const next = !data.autopilot.enabled;
    try {
      await axiosInstance.put('/ambassador/autopilot', { enabled: next });
      setData((d) => ({ ...d, autopilot: { ...d.autopilot, enabled: next } }));
      toast.success(next ? 'Auto-Pilot ON — daily nudges will fire.' : 'Auto-Pilot OFF.');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not toggle Auto-Pilot');
    }
    setAutopilotBusy(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070e1c] text-white">
        <Loader2 className="animate-spin text-secondary" size={28} />
      </div>
    );
  }

  if (!data) return null;
  const { kpis, network, insights, funnel, heatmap, hidden_bonus, level, autopilot } = data;
  const k = kpis;

  return (
    <div
      className="min-h-screen text-white pb-24 relative"
      style={{
        background:
          'radial-gradient(1100px 800px at 10% -10%, rgba(94,167,255,0.10), transparent 60%),' +
          'radial-gradient(900px 700px at 110% 0%, rgba(251,191,36,0.06), transparent 60%),' +
          'linear-gradient(180deg, #070e1c, #0a1628 40%, #050a18)',
      }}
      data-testid="command-center-page"
    >
      {/* Subtle African-city ticker */}
      <div className="absolute top-0 inset-x-0 overflow-hidden pointer-events-none opacity-30">
        <div className="text-[10px] uppercase tracking-[0.4em] text-white/30 py-1.5 text-center flex items-center justify-center gap-3">
          <MapPin size={10} /> Johannesburg · Nairobi · Lagos · Kinshasa · Lusaka · Harare · Cairo · Accra
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#0a1628]/55 border-b border-white/8 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/ambassador-dashboard')} className="p-1.5 rounded-full hover:bg-white/10" data-testid="cc-back">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-secondary">Command Center</p>
          <h1 className="text-base font-bold leading-tight">Referral Growth · {level.current}</h1>
        </div>
        <button
          onClick={() => { const next = !showLog; setShowLog(next); if (next) loadLog(); }}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/8 hover:bg-white/15 border border-white/10"
          data-testid="toggle-log"
        >
          <Mail size={12} /> <span className="hidden sm:inline">Email log</span>
        </button>
        <button
          onClick={toggleAutopilot}
          disabled={autopilotBusy}
          className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all disabled:opacity-50 ${
            autopilot.enabled
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : 'bg-white/8 border-white/10 text-white/75 hover:bg-white/12'
          }`}
          data-testid="autopilot-toggle"
        >
          <Power size={12} /> Auto-Pilot {autopilot.enabled ? 'ON' : 'OFF'}
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-4 space-y-5">
        {/* ── TOP STATS ─────────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="kpi-grid">
          <KpiCard testid="kpi-wallet"          icon={Wallet}        label="Wallet balance"      value={fmtZar(k.wallet_balance)}            hint={k.wallet_currency} accent="#fbbf24" />
          <KpiCard testid="kpi-available"       icon={ArrowDownToLine} label="Available withdraw" value={fmtZar(k.available_withdrawal_zar)} hint={k.june_payout_locked ? 'June lock active' : 'Ready'} accent="#34d399" />
          <KpiCard testid="kpi-qualified"       icon={CheckCircle2}  label="Qualified referrals" value={k.qualified_referrals}             hint={`${k.tier_referrals_required?.[0] || 10} needed for next tier`} accent="#5ea7ff" />
          <KpiCard testid="kpi-pending"         icon={Clock}         label="Pending referrals"   value={k.pending_referrals}               hint="Registered + verified, not active yet" accent="#a78bfa" />
          <KpiCard testid="kpi-active"          icon={Activity}      label="Active referrals"    value={k.active_referrals}                accent="#34d399" />
          <KpiCard testid="kpi-inactive"        icon={Users}         label="Inactive referrals"  value={k.inactive_referrals}              hint="No login for 14+ days" accent="#f87171" />
          <KpiCard testid="kpi-hidden-bonus"    icon={Sparkles}      label="Hidden bonus"        value={k.hidden_bonus_active ? '◆ Detected' : '—'} hint={k.hidden_bonus_streak ? 'Streak active' : 'Build engagement'} accent="#fcd34d" />
          <KpiCard testid="kpi-next-reward"     icon={Trophy}        label="Estimated next reward" value={fmtZar(k.estimated_next_reward_zar)} hint={`Tier 1: ${k.tier_referrals_required?.[0]} refs`} accent="#fb923c" />
        </section>

        {/* ── HIDDEN BONUS TEASER (only when active) ──────────── */}
        <section className="rounded-2xl p-4 border border-amber-500/30 backdrop-blur-xl"
          style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.10), rgba(217,119,6,0.05))' }} data-testid="hidden-bonus-card">
          <div className="flex items-center gap-2 text-amber-300 mb-1">
            <Flame size={14} /> <span className="text-[10px] uppercase tracking-[0.18em] font-semibold">Bonus Discovery</span>
          </div>
          <p className="text-sm leading-snug">{hidden_bonus.signal_text}</p>
          <div className="mt-3 h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${hidden_bonus.unlock_pct}%`, background: 'linear-gradient(90deg, #fcd34d, #f59e0b)' }} />
          </div>
          <p className="text-[10px] text-white/50 mt-1.5 tabular-nums">Reward Unlock Progress: {hidden_bonus.unlock_pct}%</p>
        </section>

        {/* ── NETWORK GRAPH + INSIGHTS ─────────────────────────── */}
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl p-4 border border-white/8 backdrop-blur-xl"
            style={{ background: 'linear-gradient(155deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Referral Network</p>
              <button onClick={load} className="text-[11px] text-white/55 hover:text-white inline-flex items-center gap-1" data-testid="network-refresh">
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
            {network.nodes.length > 0 ? (
              <NetworkGraph
                ambassador={network.ambassador}
                nodes={network.nodes}
                onSelect={setSelectedNode}
                selectedId={selectedNode?.id}
              />
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-center text-white/55 text-sm gap-2" data-testid="network-empty">
                <Users size={28} className="text-white/30" />
                <p className="font-semibold text-white/80">Your network graph will light up here</p>
                <p className="text-[11px] max-w-xs">Share your ambassador link to invite people. Every signup becomes a node — colored by engagement.</p>
                <button onClick={() => navigate('/referral')} className="mt-2 px-4 py-1.5 rounded-full bg-secondary text-primary font-bold text-xs">
                  Open my referral link
                </button>
              </div>
            )}
          </div>

          <aside className="space-y-3">
            <div className="rounded-2xl p-4 border border-white/8 backdrop-blur-xl"
              style={{ background: 'linear-gradient(155deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))' }}>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/55 mb-2 inline-flex items-center gap-1.5"><Brain size={11} /> Intelligence panel</p>
              <Insights insights={insights} />
            </div>
            {/* Level card */}
            <div className="rounded-2xl p-4 border border-white/8 backdrop-blur-xl text-center"
              style={{ background: 'linear-gradient(155deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))' }} data-testid="level-card">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Current level</p>
              <p className="text-lg font-bold mt-1 text-secondary">{level.current}</p>
              {level.next && (
                <>
                  <p className="text-[11px] text-white/55 mt-1">Next: {level.next}</p>
                  <div className="mt-2 h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-secondary to-amber-400 transition-all" style={{ width: `${level.progress_pct}%` }} />
                  </div>
                  <p className="text-[10px] text-white/45 mt-1">{level.progress_pct}% to next level</p>
                </>
              )}
              <div className="grid grid-cols-2 gap-2 mt-3 text-left">
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-white/55">Lifetime earnings</p>
                  <p className="text-xs font-bold">{fmtZar(level.lifetime_earnings_zar)}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-white/55">Lifetime referrals</p>
                  <p className="text-xs font-bold">{level.lifetime_referrals}</p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        {/* ── FUNNEL + HEATMAP ─────────────────────────────────── */}
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-2xl p-4 border border-white/8 backdrop-blur-xl"
            style={{ background: 'linear-gradient(155deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))' }}>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/55 mb-3">Conversion Pipeline</p>
            <Funnel steps={funnel} />
          </div>

          <div className="rounded-2xl p-4 border border-white/8 backdrop-blur-xl"
            style={{ background: 'linear-gradient(155deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/55 inline-flex items-center gap-1.5"><Sun size={11} /> 30-day Heatmap</p>
              <span className="text-[10px] text-white/45">Per-day referral activity</span>
            </div>
            <Heatmap days={heatmap} />
            <div className="flex items-center gap-2 mt-3 text-[10px] text-white/55">
              <span>Less</span>
              {HEATMAP_PALETTE.map((c) => <span key={c} className="w-3 h-3 rounded-sm" style={{ background: c }} />)}
              <span>More</span>
            </div>
          </div>
        </section>
      </main>

      {/* Selected referral drawer */}
      <RefDetail
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onEngage={onEngage}
        busyType={busyType}
      />

      {/* Email log slide-in */}
      <AnimatePresence>
        {showLog && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm" onClick={() => setShowLog(false)} />
            <motion.aside
              initial={{ x: 380 }} animate={{ x: 0 }} exit={{ x: 380 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="fixed top-0 right-0 z-50 h-full w-[380px] max-w-[92vw] bg-[#0a1628]/95 backdrop-blur-2xl border-l border-white/10 text-white p-5 overflow-y-auto"
              data-testid="email-log-drawer"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Email Log</p>
                <button onClick={() => setShowLog(false)} className="p-1.5 rounded-full hover:bg-white/10"><X size={16} /></button>
              </div>
              {log.length === 0 ? (
                <p className="text-xs text-white/50 text-center py-8">No engagement emails sent yet.</p>
              ) : (
                <div className="space-y-2">
                  {log.map((row) => (
                    <div key={row.id} className="rounded-xl border border-white/8 p-3 text-xs" data-testid={`log-row-${row.id}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold capitalize">{row.type}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          row.delivered ? 'bg-emerald-500/15 text-emerald-300' :
                          row.failed ? 'bg-red-500/15 text-red-300' :
                          'bg-amber-500/15 text-amber-300'
                        }`}>{row.status}</span>
                      </div>
                      <p className="text-white/70 truncate">{row.subject}</p>
                      <p className="text-white/40 mt-1">to {row.referral_email || '—'}</p>
                      {row.last_error && <p className="text-[10px] text-red-300 mt-1 truncate">{row.last_error}</p>}
                      <p className="text-[10px] text-white/35 mt-1">{(row.created_at || '').slice(0, 16).replace('T', ' ')}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AmbassadorCommandCenterPage;
