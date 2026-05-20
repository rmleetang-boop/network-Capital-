import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Clock, Trophy, TrendingUp, Loader2, Users, Flame, Calendar } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const MyPromotionsPage = ({ user }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [me, ev] = await Promise.all([
        axiosInstance.get('/users/me/promotions'),
        axiosInstance.get('/users/me/promotion-events?limit=30'),
      ]);
      setData(me.data);
      setHistory(ev.data || []);
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not load'); }
    setLoading(false);
  };
  useEffect(() => { if (user) load(); }, [user]);

  if (loading || !data) {
    return <div className="p-10 text-center text-text-muted" data-testid="my-promotions-loading"><Loader2 className="mx-auto animate-spin" /></div>;
  }
  const s = data.user_summary;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="my-promotions-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
        <h1 className="text-base font-heading font-bold text-primary flex-1 inline-flex items-center gap-2"><Sparkles size={16} className="text-secondary" /> My Promotions</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Hero */}
        <div className="bg-gradient-to-br from-primary via-[#0f1d3a] to-[#0a1628] text-white rounded-3xl p-5">
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-80 mb-1">Your participation</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Stat label="Monthly score" value={s.monthly_score.toLocaleString()} />
            <Stat label="Lifetime points" value={s.network_score.toLocaleString()} />
            <Stat label="Promo points" value={s.total_points_in_promotions.toLocaleString()} highlight />
            <Stat label="Estimated value" value={`R${s.total_zar_estimate.toFixed(2)}`} highlight />
          </div>
          <div className="bg-white/10 rounded-full px-3 py-1.5 inline-flex items-center gap-2 text-[11px] font-semibold" data-testid="my-promotions-conversion">
            <Sparkles size={11} className="text-secondary" /> {s.conversion.label}
          </div>
        </div>

        {/* Active promos */}
        <div>
          <p className="text-[11px] uppercase tracking-wider font-bold text-text-muted mb-2">Active promotions</p>
          {data.promotions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-text-muted text-sm" data-testid="my-promotions-empty">No active promotions right now. Check back soon.</div>
          ) : (
            <div className="space-y-3">
              {data.promotions.map((row) => <PromoCard key={row.promotion.id} row={row} navigate={navigate} />)}
            </div>
          )}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-text-muted mb-2 flex items-center gap-1"><Calendar size={11} /> Recent participation</p>
            <div className="bg-white rounded-2xl border border-gray-100" data-testid="my-promotions-history">
              {history.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 last:border-0 text-xs" data-testid={`history-${ev.id}`}>
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Sparkles size={11} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-primary truncate capitalize">{ev.action.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-text-muted">{new Date(ev.created_at).toLocaleString()} · SAST</p>
                  </div>
                  <span className="text-xs font-bold text-primary">+{ev.points}</span>
                  <span className="text-[10px] text-secondary font-bold">R{ev.zar_estimate.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PromoCard = ({ row, navigate }) => {
  const p = row.promotion;
  const st = row.stats;
  const rank = row.rank;
  const liveClass = p.is_window_active ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-white' : 'border-gray-100 bg-white';
  return (
    <div className={`rounded-2xl border p-4 ${liveClass}`} data-testid={`my-promo-card-${p.id}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${p.is_window_active ? 'bg-emerald-500 text-white' : 'bg-primary/10 text-primary'}`}>
          <Sparkles size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-text-primary">{p.name}</p>
            {p.is_window_active && <span className="bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"><span className="w-1 h-1 bg-white rounded-full animate-pulse" /> Live</span>}
          </div>
          <p className="text-[11px] text-text-muted mt-0.5">{p.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap text-[10px]">
        <span className="bg-white/80 text-text-secondary px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 border border-gray-100">
          {DAY_LABELS.map((d, i) => (
            <span key={i} className={(p.schedule?.days_of_week || []).includes(i) ? 'font-bold text-primary' : 'opacity-30'}>{d}</span>
          ))}
          <span className="ml-1">{p.schedule?.start_time}–{p.schedule?.end_time} SAST</span>
        </span>
        <span className="bg-secondary/15 text-primary px-1.5 py-0.5 rounded-full font-bold">R{p.zar_per_point.toFixed(2)}/pt</span>
        {(p.minutes_until_window != null) && !p.is_window_active && (
          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"><Clock size={9} /> opens in {Math.floor(p.minutes_until_window / 60)}h {p.minutes_until_window % 60}m</span>
        )}
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        <MiniStat icon={TrendingUp} label="Earned" value={st.points} sub={`R${st.zar_estimate.toFixed(2)}`} />
        <MiniStat icon={Trophy} label="Rank" value={rank ? `#${rank}` : '—'} />
        <MiniStat icon={Flame} label="Streak" value={`${st.streak_days}d`} />
        <MiniStat icon={Users} label="Refs" value={st.breakdown.referrals} />
      </div>

      {/* Progress bar (visual: this user's points vs 1000 cap visualization) */}
      {st.points > 0 && (
        <div className="mt-3" data-testid={`my-promo-progress-${p.id}`}>
          <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
            <span>Today: <strong className="text-primary">{st.today_points} pts</strong> · <strong className="text-secondary">R{st.today_zar.toFixed(2)}</strong></span>
            <span>Total: {st.points} pts</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${Math.min(100, (st.points / 1000) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Breakdown chips */}
      {st.events > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {Object.entries(st.breakdown).filter(([, v]) => v > 0).map(([k, v]) => (
            <span key={k} className="text-[10px] bg-gray-50 text-text-secondary px-1.5 py-0.5 rounded-full capitalize">{k.replace(/_/g, ' ')}: <strong className="text-primary">{v}</strong></span>
          ))}
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value, highlight }) => (
  <div className={`rounded-xl p-2.5 ${highlight ? 'bg-secondary/95 text-primary' : 'bg-white/10'}`}>
    <p className="text-xl font-heading font-bold leading-none">{value}</p>
    <p className="text-[10px] uppercase tracking-wider font-semibold opacity-90 mt-1">{label}</p>
  </div>
);

const MiniStat = ({ icon: Icon, label, value, sub }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-2 text-center">
    <Icon size={11} className="mx-auto text-text-muted mb-0.5" />
    <p className="text-sm font-bold text-primary leading-none">{value}</p>
    <p className="text-[9px] uppercase tracking-wider font-semibold text-text-muted mt-0.5">{label}</p>
    {sub && <p className="text-[9px] text-secondary font-bold mt-0.5">{sub}</p>}
  </div>
);

export default MyPromotionsPage;
