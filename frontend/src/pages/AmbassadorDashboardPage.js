import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Star, TrendingUp, Users, Award, CheckCircle2, Circle, Trophy, Coins, Lock, AlertTriangle, Share2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { axiosInstance } from '../App';

const AmbassadorDashboardPage = ({ user }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [incentive, setIncentive] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const loadIncentive = async () => {
    try {
      const r = await axiosInstance.get('/ambassador/incentive');
      setIncentive(r.data);
    } catch (e) { /* silent — non-ambassadors get 404/403 here */ }
  };

  useEffect(() => {
    axiosInstance.get('/ambassadors/me')
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || 'Could not load ambassador dashboard'));
    loadIncentive();
  }, []);

  const handleWithdraw = async () => {
    if (!window.confirm(
      `Request withdrawal of R${incentive?.next_amount_zar?.toLocaleString()}?\n\n` +
      `This will queue a payout for admin approval. Funds are released on/after 30 June 2026.`
    )) return;
    setWithdrawing(true);
    try {
      const r = await axiosInstance.post('/ambassador/incentive/withdraw');
      toast.success(`Withdrawal queued — R${r.data.amount_zar.toLocaleString()}`);
      loadIncentive();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not submit withdrawal');
    } finally {
      setWithdrawing(false);
    }
  };

  if (error) {
    return (
      <div className="p-10 text-center text-text-muted" data-testid="ambassador-no-access">
        <Award size={28} className="mx-auto text-primary mb-2" />
        <p className="text-sm">{error}</p>
        <p className="text-[11px] text-text-muted mt-2">Contact an admin to request Ambassador status.</p>
      </div>
    );
  }
  if (!data) return <div className="p-10 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="ambassador-dashboard-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
        <h1 className="text-base font-heading font-bold text-primary flex-1">Ambassador dashboard</h1>
        <button
          onClick={() => navigate('/ambassadors/leaderboard')}
          className="text-xs font-semibold bg-secondary text-primary px-3 py-1.5 rounded-full inline-flex items-center gap-1"
          data-testid="ambassador-go-leaderboard">
          <Trophy size={12} /> Leaderboard
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Hero rank card */}
        <div className="bg-gradient-to-br from-primary via-[#0a1628] to-secondary text-white rounded-3xl p-5">
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">Ambassador rank</p>
          <p className="text-3xl font-heading font-bold mt-1 inline-flex items-center gap-2" data-testid="ambassador-rank">
            <Star size={22} className="text-secondary fill-secondary" /> {data.rank}
          </p>
          <div className="grid grid-cols-4 gap-3 mt-4 text-center">
            <div>
              <p className="text-2xl font-heading font-bold">{data.recruit_count}</p>
              <p className="text-[10px] uppercase tracking-wider opacity-80">Onboarded</p>
            </div>
            <div>
              <p className="text-2xl font-heading font-bold">{data.completed_count}</p>
              <p className="text-[10px] uppercase tracking-wider opacity-80">Active</p>
            </div>
            <div>
              <p className="text-2xl font-heading font-bold">{data.new_30d}</p>
              <p className="text-[10px] uppercase tracking-wider opacity-80">New 30d</p>
            </div>
            <div>
              <p className="text-2xl font-heading font-bold text-secondary">{data.total_contribution}</p>
              <p className="text-[10px] uppercase tracking-wider opacity-80">Score contrib.</p>
            </div>
          </div>
        </div>

        {incentive && incentive.is_ambassador && (
          <IncentivePanel incentive={incentive} onWithdraw={handleWithdraw} loading={withdrawing} />
        )}

        {/* Monthly targets */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-3 inline-flex items-center gap-1.5">
            <TrendingUp size={12} /> Monthly targets · activity goals
          </p>
          {data.targets.map((t) => {
            const pct = Math.min(100, Math.round((t.current / Math.max(t.target, 1)) * 100));
            const done = t.current >= t.target;
            return (
              <div key={t.key} className="py-2.5 border-b border-gray-50 last:border-0" data-testid={`target-${t.key}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm inline-flex items-center gap-1.5">
                    {done ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Circle size={14} className="text-gray-300" />}
                    {t.label}
                  </p>
                  <span className={`text-xs font-bold ${done ? 'text-emerald-700' : 'text-text-primary'}`}>{t.current}/{t.target}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${done ? 'bg-emerald-500' : 'bg-secondary'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Performance breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-3">Network activity this month</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(data.performance || {}).map(([k, v]) => (
              <div key={k} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xl font-heading font-bold text-primary">{v}</p>
                <p className="text-[10px] uppercase tracking-wider text-text-muted">{k.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent recruits */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-2 inline-flex items-center gap-1.5">
            <Users size={12} /> Recent recruits
          </p>
          {Array.isArray(data.recent_recruits) && data.recent_recruits.length > 0 ? (
            data.recent_recruits.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0" data-testid={`recruit-${r.id}`}>
                {r.photo ? (
                  <img src={r.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-xs font-bold flex items-center justify-center">
                    {(r.username || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.full_name || r.username}</p>
                  <p className="text-[11px] text-text-muted truncate">
                    Joined {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'} · {r.monthly_score || 0} pts
                  </p>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${r.profile_completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {r.profile_completed ? 'Active' : 'Pending'}
                </span>
              </div>
            ))
          ) : (
            <p className="text-center text-text-muted text-sm py-4">No recruits yet. Share your invite link from <strong className="text-primary">My Network → Invites</strong>.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AmbassadorDashboardPage;

/* ────────────────────── Share Link Card ──────────────────────────── */
const ShareLinkCard = () => {
  const [link, setLink] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    axiosInstance.get('/ambassador/share-link')
      .then((r) => setLink(r.data))
      .catch(() => { /* non-ambassadors won't render this card anyway */ });
  }, []);

  if (!link) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed — please copy manually');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Network Capital', text: link.share_text, url: link.url });
      } catch { /* user cancelled */ }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="bg-gradient-to-br from-primary via-[#0a1628] to-[#1e3a8a] text-white rounded-3xl p-4 sm:p-5 shadow-lg" data-testid="ambassador-share-card">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
          <Share2 size={18} className="text-secondary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-secondary mb-0.5">Your invite link</p>
          <p className="text-sm sm:text-base font-heading font-bold leading-tight">Grow faster — every signup counts toward your next tier</p>
        </div>
      </div>
      <div className="bg-black/30 rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2 border border-white/10">
        <p className="text-xs font-mono text-white/90 truncate flex-1" data-testid="ambassador-share-url">{link.url}</p>
        <button
          onClick={handleCopy}
          className="text-[11px] font-bold inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 text-white border border-white/10 shrink-0"
          data-testid="ambassador-share-copy"
        >
          {copied ? <Check size={11} className="text-emerald-300" /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <button
        onClick={handleShare}
        className="w-full bg-secondary text-primary font-bold py-2.5 rounded-full inline-flex items-center justify-center gap-2 text-sm hover:opacity-95"
        data-testid="ambassador-share-btn"
      >
        <Share2 size={14} /> Share my link
      </button>
    </div>
  );
};

/* ────────────────────── Incentive Panel ──────────────────────────── */
const IncentivePanel = ({ incentive, onWithdraw, loading }) => {
  const disp = incentive.display || {};
  const sym = disp.symbol || 'R';
  const cur = disp.currency || 'ZAR';
  const fmt = (v) => `${sym}${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtZar = (v) => `R${Number(v || 0).toLocaleString()}`;
  const act = incentive.activity_progress || { posts: [0, 20], likes: [0, 100], ad_shares: [0, 5] };
  const tiers = incentive.tier_referrals_required || [20, 40, 60, 80, 100];
  const completed = incentive.tiers_completed || 0;
  const qcount = incentive.qualified_referrals_count || 0;

  return (
    <div className="space-y-3" data-testid="ambassador-incentive-panel">
      {/* Share-link CTA — turns the dashboard into a growth tool */}
      <ShareLinkCard />

      {/* Balance hero */}
      <div className="bg-gradient-to-br from-secondary/20 via-white to-white border-2 border-secondary/30 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-text-muted inline-flex items-center gap-1.5">
            <Coins size={12} className="text-secondary" /> Ambassador incentive balance
          </p>
          {cur !== 'ZAR' && (
            <span className="text-[10px] text-text-muted">≈ {cur} · stored in ZAR</span>
          )}
        </div>
        <p className="text-4xl font-heading font-bold text-primary leading-tight" data-testid="incentive-available">
          {fmt(disp.available ?? incentive.available_zar)}
        </p>
        {cur !== 'ZAR' && (
          <p className="text-[11px] text-text-muted mt-0.5">{fmtZar(incentive.available_zar)} (ZAR)</p>
        )}
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="bg-white rounded-xl p-2 border border-gray-100">
            <p className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">Starting</p>
            <p className="text-sm font-bold text-primary">{fmt(disp.starting_balance ?? incentive.starting_balance_zar)}</p>
          </div>
          <div className="bg-white rounded-xl p-2 border border-gray-100">
            <p className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">Withdrawn</p>
            <p className="text-sm font-bold text-emerald-600">{fmt(disp.paid ?? incentive.paid_zar)}</p>
          </div>
          <div className={`rounded-xl p-2 border ${incentive.activity_unlocked ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">Activity pot</p>
            <p className={`text-sm font-bold ${incentive.activity_unlocked ? 'text-emerald-700' : 'text-amber-700'}`}>
              {incentive.activity_unlocked ? 'Unlocked' : fmt(disp.activity_pot ?? incentive.activity_pot_zar)}
            </p>
          </div>
        </div>
      </div>

      {/* Activity targets */}
      {!incentive.activity_unlocked && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4" data-testid="incentive-activity-targets">
          <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-3 inline-flex items-center gap-1.5">
            <TrendingUp size={12} /> Unlock the {fmt(disp.activity_pot ?? incentive.activity_pot_zar)} activity pot
          </p>
          {[
            { key: 'posts', label: 'Create posts', cur: act.posts[0], goal: act.posts[1] },
            { key: 'likes', label: 'Like other posts', cur: act.likes[0], goal: act.likes[1] },
            { key: 'ad_shares', label: 'Share ads', cur: act.ad_shares[0], goal: act.ad_shares[1] },
          ].map((t) => {
            const pct = Math.min(100, Math.round((t.cur / Math.max(t.goal, 1)) * 100));
            const done = t.cur >= t.goal;
            return (
              <div key={t.key} className="py-2 border-b border-gray-50 last:border-0" data-testid={`incentive-${t.key}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm inline-flex items-center gap-1.5">
                    {done ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Circle size={14} className="text-gray-300" />}
                    {t.label}
                  </p>
                  <span className={`text-xs font-bold ${done ? 'text-emerald-700' : 'text-text-primary'}`}>{t.cur}/{t.goal}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${done ? 'bg-emerald-500' : 'bg-secondary'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Referral tiers */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4" data-testid="incentive-tiers">
        <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-3 inline-flex items-center gap-1.5">
          <Users size={12} /> Withdrawal tiers · {qcount} qualified referrals
        </p>
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {tiers.map((t, idx) => {
            const reached = qcount >= t;
            const isNext = completed === idx;
            const used = idx < completed;
            return (
              <div key={t} className={`text-center rounded-xl p-2 border ${
                used ? 'bg-emerald-50 border-emerald-200' :
                reached && isNext ? 'bg-secondary/15 border-secondary' :
                reached ? 'bg-gray-50 border-gray-200' :
                'bg-gray-50 border-gray-100 opacity-60'
              }`} data-testid={`tier-${t}`}>
                <p className="text-base font-heading font-bold text-primary">{t}</p>
                <p className="text-[9px] uppercase tracking-wider text-text-muted">
                  {idx === 0 ? `${sym}500` : idx === tiers.length - 1 ? '100%' : '20%'}
                </p>
                {used && <CheckCircle2 size={10} className="mx-auto text-emerald-600 mt-1" />}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-text-muted">
          Direct referrals must reach a Network Score of <strong>{incentive.config_snapshot?.referral_min_score?.toLocaleString?.() ?? '1,000'}</strong> to count.
        </p>
      </div>

      {/* Withdraw CTA */}
      <div className="bg-white rounded-2xl border-2 border-secondary/30 p-4" data-testid="incentive-withdraw-section">
        {incentive.june_payout_locked && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5 mb-3">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-snug">
              Payouts release on <strong>30 June 2026</strong>. You can still queue requests now — they&apos;ll be processed automatically after that date.
            </p>
          </div>
        )}
        {incentive.eligible_to_withdraw ? (
          <>
            <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">Ready to claim</p>
            <p className="text-2xl font-heading font-bold text-primary mb-2" data-testid="incentive-next-amount">
              {fmt(disp.next_amount ?? incentive.next_amount_zar)}
            </p>
            <button
              onClick={onWithdraw}
              disabled={loading}
              className="w-full bg-secondary text-primary font-bold py-3 rounded-full hover:opacity-95 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              data-testid="incentive-withdraw-btn"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Coins size={16} />}
              Request {fmt(disp.next_amount ?? incentive.next_amount_zar)} withdrawal
            </button>
          </>
        ) : (
          <div className="text-center py-2">
            <Lock size={20} className="mx-auto text-text-muted mb-2" />
            <p className="text-sm font-semibold text-text-primary">Not yet eligible</p>
            <p className="text-[11px] text-text-muted mt-1">
              {incentive.next_tier_required
                ? `Refer ${incentive.next_tier_required - qcount} more qualified members to unlock the next withdrawal.`
                : 'You have claimed all available withdrawal tiers.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
