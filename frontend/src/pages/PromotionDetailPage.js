import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Trophy, Users, TrendingUp, Clock, DollarSign, Activity, Sparkles } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const PromotionDetailPage = ({ user }) => {
  const { promotionId } = useParams();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [feed, setFeed] = useState([]);
  const [tab, setTab] = useState('overview'); // overview | leaderboard | feed
  const [loading, setLoading] = useState(true);

  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');

  const load = async () => {
    setLoading(true);
    try {
      const [s, p, f] = await Promise.all([
        axiosInstance.get(`/admin/promotions/${promotionId}/summary`),
        axiosInstance.get(`/admin/promotions/${promotionId}/participants`),
        axiosInstance.get(`/admin/promotions/${promotionId}/feed`),
      ]);
      setSummary(s.data);
      setParticipants(p.data?.participants || []);
      setFeed(f.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not load');
    }
    setLoading(false);
  };
  useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line */ }, [promotionId, isAdmin]);

  if (!isAdmin) return <div className="p-10 text-center text-text-muted">Admin only.</div>;
  if (loading || !summary) return <div className="p-10 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>;
  const p = summary.promotion;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="promotion-detail-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate('/admin/promotions')} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
        <h1 className="text-base font-heading font-bold text-primary flex-1 truncate">{p.name}</h1>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <div className={`rounded-3xl p-5 text-white ${p.is_window_active ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-primary to-[#0a1628]'}`}>
          <div className="flex items-start gap-2 mb-2">
            <Sparkles size={18} className="text-secondary" />
            <p className="text-[10px] uppercase tracking-widest font-bold">
              {p.is_window_active ? 'Window OPEN now · earn live' : 'Window closed'}
              {p.minutes_until_window != null && !p.is_window_active && ` · opens in ${Math.floor(p.minutes_until_window / 60)}h ${p.minutes_until_window % 60}m`}
            </p>
          </div>
          <p className="text-sm opacity-90 mb-4">{p.description}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
            <Stat label="Participants" value={summary.total_participants} />
            <Stat label="Points generated" value={summary.total_points.toLocaleString()} />
            <Stat label="ZAR allocated" value={`R${summary.total_zar_allocated.toLocaleString()}`} highlight />
            <Stat label="Avg / user" value={summary.avg_points_per_user} />
          </div>
          <div className="flex items-center gap-2 flex-wrap text-[11px] opacity-90">
            <span className="inline-flex items-center gap-1"><Clock size={11} /> {p.schedule.start_time}–{p.schedule.end_time} SAST</span>
            <span className="inline-flex gap-0.5">{DAY_LABELS.map((d, i) => <span key={i} className={p.schedule.days_of_week.includes(i) ? 'font-bold' : 'opacity-40'}>{d}</span>)}</span>
            <span className="inline-flex items-center gap-1"><DollarSign size={11} /> R{(p.zar_per_point || 0).toFixed(2)}/pt</span>
            {p.min_network_score > 0 && <span>Min {p.min_network_score} pts</span>}
          </div>
        </div>

        {/* Tab nav */}
        <div className="inline-flex bg-white p-1 rounded-full border border-gray-100">
          {[['overview', 'Daily trends', TrendingUp], ['leaderboard', 'Leaderboard', Trophy], ['feed', 'Live feed', Activity]].map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${tab === k ? 'bg-primary text-white' : 'text-text-secondary'}`} data-testid={`promo-tab-${k}`}>
              <Icon size={11} /> {l}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4" data-testid="promo-daily-trend">
            <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-3">Daily participation</p>
            {summary.daily_trend.length === 0 ? (
              <p className="text-center text-text-muted text-sm py-6">No data yet — runs on the next active window.</p>
            ) : (
              <div className="space-y-2">
                {summary.daily_trend.map((d) => (
                  <div key={d.day} className="flex items-center gap-3" data-testid={`trend-${d.day}`}>
                    <span className="text-xs text-text-secondary w-20">{d.day}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-secondary" style={{ width: `${Math.min(100, (d.pts / Math.max(1, summary.total_points)) * 100 * 5)}%` }} />
                    </div>
                    <span className="text-xs font-bold text-primary w-20 text-right">{d.pts} pts · {d.users} users</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'leaderboard' && (
          <div className="bg-white rounded-2xl border border-gray-100" data-testid="promo-leaderboard">
            {participants.length === 0 ? (
              <p className="p-6 text-center text-text-muted text-sm">No participants yet.</p>
            ) : participants.map((u, i) => (
              <div key={u.user_id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0" data-testid={`participant-${u.user_id}`}>
                <span className="text-xs font-bold text-text-muted w-6">#{i + 1}</span>
                {u.photo ? (
                  <img src={u.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-xs font-bold flex items-center justify-center">{(u.username || '?')[0].toUpperCase()}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{u.full_name || u.username}</p>
                  <p className="text-[10px] text-text-muted">
                    {u.posts} posts · {u.comments} comments · {u.referrals} ref · streak {u.streak_days}d · last {u.last_activity ? new Date(u.last_activity).toLocaleString() : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">{u.points} pts</p>
                  <p className="text-[10px] text-secondary font-bold">R{u.zar_estimate.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'feed' && (
          <div className="bg-white rounded-2xl border border-gray-100" data-testid="promo-live-feed">
            {feed.length === 0 ? (
              <p className="p-6 text-center text-text-muted text-sm">No events yet.</p>
            ) : feed.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 text-xs" data-testid={`feed-event-${ev.id}`}>
                {ev.photo ? (
                  <img src={ev.photo} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-[10px] font-bold flex items-center justify-center">{(ev.username || '?')[0].toUpperCase()}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">@{ev.username} <span className="text-text-muted font-normal">{ev.action.replace(/_/g, ' ')}</span></p>
                  <p className="text-[10px] text-text-muted">{new Date(ev.created_at).toLocaleString()}</p>
                </div>
                <span className="text-xs font-bold text-primary">+{ev.points}</span>
                <span className="text-[10px] text-secondary font-bold">R{ev.zar_estimate.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, value, highlight }) => (
  <div>
    <p className={`text-2xl font-heading font-bold leading-none ${highlight ? 'text-secondary' : ''}`}>{value}</p>
    <p className="text-[10px] uppercase tracking-wider opacity-80 mt-1">{label}</p>
  </div>
);

export default PromotionDetailPage;
