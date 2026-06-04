import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Clock, Trophy, TrendingUp, ChevronDown, ChevronUp, Megaphone, Users } from 'lucide-react';
import { axiosInstance } from '../App';

const STORAGE_KEY = 'nc_promo_modal_last_shown';
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const PromotionsWelcomeModal = ({ user }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [ticker, setTicker] = useState(0); // re-render every 30s for countdown

  useEffect(() => {
    if (!user) return;
    const last = (() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } })();
    if (last === todayKey()) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await axiosInstance.get('/promotions/me/login-summary');
        if (!cancelled) {
          setData(r.data);
          if ((r.data?.active_promotions || []).length > 0) setOpen(true);
        }
      } catch (e) { /* silent — modal stays closed */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setTicker((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, [open]);

  const close = () => {
    try { localStorage.setItem(STORAGE_KEY, todayKey()); } catch { /* ignore */ }
    setOpen(false);
  };

  if (!open || !data) return null;

  const liveNow = (data.active_promotions || []).filter((p) => p.is_window_active);
  const upcoming = (data.active_promotions || []).filter((p) => !p.is_window_active);

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={close} data-testid="promo-welcome-modal">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl"
      >
        {/* Hero */}
        <div className="relative bg-gradient-to-br from-primary via-[#0f1d3a] to-[#0a1628] text-white p-6 sm:rounded-t-3xl rounded-t-3xl">
          <button onClick={close} className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20" data-testid="promo-modal-close">
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-secondary" />
            <span className="text-[10px] uppercase tracking-widest font-bold opacity-80">Welcome back, {data.user.full_name?.split(' ')[0] || data.user.username}</span>
          </div>
          <h2 className="font-heading text-2xl font-bold leading-tight mb-1">Community participation pays.</h2>
          <p className="text-sm opacity-85 mb-4">{data.philosophy}</p>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-white/10 rounded-xl p-2.5" data-testid="promo-modal-monthly-score">
              <p className="text-lg font-heading font-bold leading-none">{data.user.monthly_score.toLocaleString()}</p>
              <p className="text-[9px] uppercase tracking-wider opacity-75 mt-1">Monthly score</p>
            </div>
            <div className="bg-white/10 rounded-xl p-2.5" data-testid="promo-modal-network-score">
              <p className="text-lg font-heading font-bold leading-none">{data.user.network_score.toLocaleString()}</p>
              <p className="text-[9px] uppercase tracking-wider opacity-75 mt-1">Lifetime</p>
            </div>
            <div className="bg-secondary/95 text-primary rounded-xl p-2.5" data-testid="promo-modal-zar-value">
              <p className="text-lg font-heading font-bold leading-none">R{data.user.estimated_zar_value.toFixed(2)}</p>
              <p className="text-[9px] uppercase tracking-wider font-semibold opacity-90 mt-1">Estimated</p>
            </div>
          </div>

          <div className="bg-white/10 rounded-full px-3 py-1.5 inline-flex items-center gap-2 text-[11px] font-semibold" data-testid="promo-modal-conversion">
            <Sparkles size={11} className="text-secondary" />
            {data.conversion.label}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* LIVE NOW */}
          {liveNow.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live now
                </span>
                <p className="text-[11px] uppercase tracking-wider font-bold text-text-muted">{liveNow.length} window{liveNow.length > 1 ? 's' : ''} open</p>
              </div>
              <div className="space-y-2">
                {liveNow.map((p) => <PromoTile key={p.id} p={p} live now={data.now_sast} />)}
              </div>
            </div>
          )}

          {/* UPCOMING */}
          {upcoming.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider font-bold text-text-muted mb-2">Upcoming windows (SAST)</p>
              <div className="space-y-2">
                {upcoming.map((p) => <PromoTile key={p.id} p={p} now={data.now_sast} />)}
              </div>
            </div>
          )}

          {/* TOP AMBASSADORS */}
          {(data.top_ambassadors || []).length > 0 && (
            <div className="bg-background-subtle rounded-2xl p-3" data-testid="promo-modal-ambassadors">
              <p className="text-[11px] uppercase tracking-wider font-bold text-text-muted mb-2 flex items-center gap-1.5"><Trophy size={11} className="text-secondary" /> Top community ambassadors</p>
              <div className="space-y-1.5">
                {data.top_ambassadors.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-2 text-xs" data-testid={`promo-modal-amb-${i}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-secondary text-primary' : i === 1 ? 'bg-gray-300 text-gray-800' : 'bg-amber-200 text-amber-900'}`}>{i + 1}</span>
                    {a.photo ? <img src={a.photo} alt="" className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-[9px] font-bold flex items-center justify-center">{(a.username || '?')[0].toUpperCase()}</div>}
                    <span className="flex-1 font-semibold truncate">{a.full_name || a.username}</span>
                    <span className="text-[10px] text-text-muted">{a.ambassador_rank}</span>
                    <span className="text-[10px] font-bold text-primary">{(a.network_score || 0).toLocaleString()} pts</span>
                  </div>
                ))}
              </div>
              <button onClick={() => { close(); navigate('/ambassadors/leaderboard'); }} className="mt-2 text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1" data-testid="promo-modal-amb-link">
                View full leaderboard →
              </button>
            </div>
          )}

          {/* LEARN MORE (expandable) */}
          <button onClick={() => setLearnOpen((x) => !x)} className="w-full flex items-center justify-between text-sm font-bold text-primary py-2 border-t border-gray-100" data-testid="promo-modal-learn-toggle">
            <span className="inline-flex items-center gap-1.5"><Megaphone size={14} /> Learn how it works</span>
            {learnOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {learnOpen && (
            <div className="text-xs text-text-secondary space-y-2.5 -mt-2" data-testid="promo-modal-learn-content">
              <LearnRow num="1" title="How Network Scores work">
                Every meaningful action — posting, sharing, commenting, hosting activities, referring friends — earns you Network Points. Your score grows uncapped; reaching 10,000 in a month unlocks the Top Contributor badge with diminishing returns to keep it fair.
              </LearnRow>
              <LearnRow num="2" title="How points accumulate">
                Points are added in real time as you participate. Quality comments, completed referrals, and verified place reviews earn the most. Daily check-ins and profile completion give early boosts.
              </LearnRow>
              <LearnRow num="3" title="How promotions operate">
                Admins schedule time-windows in SAST (e.g., M/W/F 08:00–12:00). Points you earn inside an open window are tracked separately and convert to community rewards at {data.conversion.label}.
              </LearnRow>
              <LearnRow num="4" title="What contribution unlocks">
                Your participation strengthens your network and unlocks collective benefits — leaderboards, ambassador rank, community recognition, and ZAR-equivalent reward tracking. This is shared participation, not profit-taking.
              </LearnRow>
            </div>
          )}

          {/* CTAs */}
          <div className="flex gap-2 pt-2">
            <button onClick={() => { close(); navigate('/promotions/me'); }} className="flex-1 bg-primary text-white font-bold py-2.5 rounded-full text-sm" data-testid="promo-modal-cta-primary">
              View my promotions
            </button>
            <button onClick={close} className="px-4 bg-gray-100 text-text-secondary font-semibold py-2.5 rounded-full text-sm" data-testid="promo-modal-cta-dismiss">
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PromoTile = ({ p, live, now }) => {
  const nowDate = now ? new Date(now) : new Date();
  // Compute remaining minutes in window for "live" tiles
  let countdownLabel = '';
  if (live && p.schedule) {
    const [eh, em] = (p.schedule.end_time || '00:00').split(':').map(Number);
    const end = new Date(nowDate);
    end.setHours(eh, em, 0, 0);
    const mins = Math.max(0, Math.floor((end - nowDate) / 60000));
    countdownLabel = `${Math.floor(mins / 60)}h ${mins % 60}m left`;
  } else if (p.minutes_until_window != null) {
    countdownLabel = `opens in ${Math.floor(p.minutes_until_window / 60)}h ${p.minutes_until_window % 60}m`;
  }

  return (
    <div className={`rounded-2xl p-3 border ${live ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'}`} data-testid={`promo-modal-tile-${p.id}`}>
      <div className="flex items-start gap-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${live ? 'bg-emerald-500 text-white' : 'bg-primary/10 text-primary'}`}>
          <Sparkles size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-text-primary truncate">{p.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px]">
            <span className="bg-white/80 text-text-secondary px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
              {DAY_LABELS.map((d, i) => (
                <span key={i} className={(p.schedule?.days_of_week || []).includes(i) ? 'font-bold text-primary' : 'opacity-30'}>{d}</span>
              ))}
              <span className="ml-1">{p.schedule?.start_time}–{p.schedule?.end_time}</span>
            </span>
            <span className={`px-1.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1 ${live ? 'bg-emerald-600 text-white' : 'bg-blue-50 text-blue-700'}`}>
              <Clock size={9} /> {countdownLabel}
            </span>
          </div>
          {(p.user_points > 0 || p.user_today_points > 0) && (
            <div className="flex items-center gap-3 mt-2 text-[10px] text-text-muted">
              <span data-testid={`promo-modal-tile-${p.id}-mypts`}><strong className="text-primary">{p.user_points}</strong> pts · <strong className="text-secondary">R{p.user_zar_estimate.toFixed(2)}</strong></span>
              {p.user_streak_days > 0 && <span>🔥 {p.user_streak_days}d streak</span>}
              {p.user_today_points > 0 && <span>+{p.user_today_points} today</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LearnRow = ({ num, title, children }) => (
  <div className="flex gap-2.5">
    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">{num}</span>
    <div>
      <p className="font-bold text-text-primary text-xs mb-0.5">{title}</p>
      <p className="leading-relaxed">{children}</p>
    </div>
  </div>
);

export default PromotionsWelcomeModal;
