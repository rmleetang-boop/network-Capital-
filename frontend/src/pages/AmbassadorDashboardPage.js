import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Star, TrendingUp, Users, Award, CheckCircle2, Circle, Trophy, Sparkles } from 'lucide-react';
import { axiosInstance } from '../App';

const AmbassadorDashboardPage = ({ user }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    axiosInstance.get('/ambassadors/me')
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || 'Could not load ambassador dashboard'));
  }, []);

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
          <div className="mt-3 bg-white/10 rounded-full px-3 py-1.5 inline-flex items-center gap-2 text-[10px] font-semibold" data-testid="ambassador-conversion-pill">
            <Sparkles size={10} className="text-secondary" /> 100 Network Points = R10 ZAR
          </div>
        </div>

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
