import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Briefcase, MapPin, MessageSquare, Star, PiggyBank, TrendingUp, Shield, Award, Loader2, LogIn, X } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const StatCard = ({ icon: Icon, label, value, subline, tone = 'from-primary to-secondary', onClick, testId }) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${tone} text-white p-4 text-left w-full ${onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform' : 'cursor-default'}`}
    data-testid={testId}>
    <Icon size={18} className="opacity-70 mb-1.5" />
    <p className="text-3xl font-heading font-bold leading-none">{value}</p>
    <p className="text-[11px] uppercase tracking-wider font-bold opacity-90 mt-1">{label}</p>
    {subline && <p className="text-[10px] opacity-75 mt-0.5">{subline}</p>}
  </button>
);

const AdminMetricsDashboardPage = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState(false);
  const [adminPwd, setAdminPwd] = useState('');

  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator');

  const load = async () => {
    setLoading(true);
    try {
      const r = await axiosInstance.get('/admin/dashboard/metrics');
      setMetrics(r.data);
    } catch (e) {
      if (e.response?.status === 403) {
        // not admin → suggest bootstrap
      } else {
        toast.error('Could not load metrics');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (isAdmin) load();
    else setLoading(false);
  }, [user, isAdmin]); // eslint-disable-line

  const doBootstrap = async () => {
    if (!adminPwd) return toast.error('Enter the admin bootstrap password');
    try {
      await axiosInstance.post('/admin/bootstrap', {}, { headers: { 'X-Admin-Password': adminPwd } });
      toast.success('You are now an admin');
      setBootstrap(false);
      // refresh user
      const me = await axiosInstance.get('/users/me');
      if (setUser) setUser(me.data);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Invalid admin password');
    }
  };

  if (loading) return <div className="p-10 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background-DEFAULT p-6 flex items-center justify-center" data-testid="admin-not-authorized">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <Shield size={28} className="mx-auto text-primary mb-3" />
          <h2 className="font-heading font-bold text-lg text-primary">Admin access required</h2>
          <p className="text-sm text-text-secondary mb-4">
            Your account doesn't have admin privileges. If you are the platform owner, enter the bootstrap password to promote yourself.
          </p>
          <button
            onClick={() => setBootstrap(true)}
            className="bg-primary text-white font-semibold px-5 py-2.5 rounded-full text-sm inline-flex items-center gap-2"
            data-testid="bootstrap-cta">
            <LogIn size={14} /> I am the owner
          </button>
        </div>
        {bootstrap && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setBootstrap(false)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-sm w-full p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-heading font-bold">Owner bootstrap</h3>
                <button onClick={() => setBootstrap(false)}><X size={18} /></button>
              </div>
              <p className="text-xs text-text-muted mb-3">Enter the legacy admin password to grant your account the <strong>admin</strong> role. This is a one-time step.</p>
              <input
                type="password"
                value={adminPwd}
                onChange={(e) => setAdminPwd(e.target.value)}
                placeholder="Admin password"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary mb-3"
                data-testid="bootstrap-password-input"
              />
              <button
                onClick={doBootstrap}
                className="w-full bg-primary text-white font-bold py-2.5 rounded-full text-sm"
                data-testid="bootstrap-submit">
                Promote me to admin
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const M = metrics || {};
  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="admin-metrics-dashboard">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2 flex-wrap">
        <h1 className="text-base font-heading font-bold text-primary flex-1">Platform overview</h1>
        <button onClick={() => navigate('/admin/users')} className="text-xs font-semibold bg-secondary text-primary px-3 py-1.5 rounded-full" data-testid="admin-go-users">Users</button>
        <button onClick={() => navigate('/admin/stokvels')} className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full" data-testid="admin-go-stokvels">Stokvels</button>
        <button onClick={() => navigate('/admin/jobs')} className="text-xs font-semibold bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full" data-testid="admin-go-jobs">Jobs</button>
        <button onClick={() => navigate('/admin/places')} className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full" data-testid="admin-go-places">Places</button>
        <button onClick={() => navigate('/admin/activities')} className="text-xs font-semibold bg-pink-100 text-pink-700 px-3 py-1.5 rounded-full" data-testid="admin-go-activities">Activities</button>
        <button onClick={() => navigate('/admin/announce')} className="text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded-full" data-testid="admin-go-announce">Announce</button>
        <button onClick={() => navigate('/admin/promotions')} className="text-xs font-semibold bg-fuchsia-100 text-fuchsia-700 px-3 py-1.5 rounded-full" data-testid="admin-go-promotions">Promotions</button>
        <button onClick={() => navigate('/ambassadors/leaderboard')} className="text-xs font-semibold bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full" data-testid="admin-go-ambassadors">Ambassadors</button>
        <button onClick={() => navigate('/admin/audit-log')} className="text-xs font-semibold bg-gray-100 text-text-secondary px-3 py-1.5 rounded-full" data-testid="admin-go-audit">Audit</button>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={Users} label="Total members"
            value={M.users?.total || 0}
            subline={`+${M.users?.new_30d || 0} this month (${M.users?.growth_30d_pct || 0}% growth)`}
            tone="from-primary to-blue-600"
            onClick={() => navigate('/admin/users')}
            testId="tile-users"
          />
          <StatCard
            icon={Award} label="Premium"
            value={M.users?.premium || 0}
            subline={M.users?.total ? `${Math.round((M.users.premium / M.users.total) * 100)}% of members` : null}
            tone="from-yellow-600 to-secondary"
            onClick={() => navigate('/admin/users?role=')}
            testId="tile-premium"
          />
          <StatCard
            icon={PiggyBank} label="Stokvels"
            value={M.stokvels?.total || 0}
            subline={`+${M.stokvels?.new_30d || 0} this month`}
            tone="from-emerald-500 to-teal-600"
            onClick={() => navigate('/admin/stokvels')}
            testId="tile-stokvels"
          />
          <StatCard
            icon={Briefcase} label="Jobs · applications"
            value={`${M.jobs?.total || 0} · ${M.jobs?.applications || 0}`}
            tone="from-amber-500 to-orange-500"
            onClick={() => navigate('/admin/jobs')}
            testId="tile-jobs"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard
            icon={MessageSquare} label="Posts (7d)"
            value={M.feed?.posts_7d || 0}
            subline={`${M.feed?.total_posts || 0} all-time · Announce as NC`}
            tone="from-pink-500 to-rose-500"
            onClick={() => navigate('/admin/announce')}
            testId="tile-posts"
          />
          <StatCard
            icon={MapPin} label="Places"
            value={M.places?.total || 0}
            subline={`${M.places?.reviews || 0} reviews · +${M.places?.reviews_30d || 0} this month`}
            tone="from-indigo-500 to-purple-500"
            onClick={() => navigate('/admin/places')}
            testId="tile-places"
          />
          <StatCard
            icon={Users} label="Connections"
            value={M.network?.connections || 0}
            subline={`+${M.network?.connections_30d || 0} this month`}
            tone="from-cyan-500 to-blue-500"
            onClick={() => navigate('/admin/users')}
            testId="tile-connections"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-heading font-bold text-primary mb-3 inline-flex items-center gap-1.5">
            <TrendingUp size={16} /> Top contributors · {M.month_key}
          </h3>
          {Array.isArray(M.top_contributors) && M.top_contributors.length > 0 ? (
            <div className="space-y-2" data-testid="top-contributors">
              {M.top_contributors.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs font-bold text-text-muted w-5">#{i + 1}</span>
                  {c.photo ? (
                    <img src={c.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-xs font-bold flex items-center justify-center">
                      {(c.username || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.full_name || c.username}</p>
                    <p className="text-[10px] text-text-muted">@{c.username}</p>
                  </div>
                  <span className="text-sm font-bold text-primary inline-flex items-center gap-1">
                    <Star size={12} className="text-secondary fill-secondary" /> {c.monthly_score || 0}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-text-muted text-sm py-4">No activity this month yet.</p>
          )}
        </div>

        <p className="text-[10px] text-text-muted text-center">
          Generated at {metrics?.generated_at ? new Date(metrics.generated_at).toLocaleString() : '—'}
        </p>
      </div>
    </div>
  );
};

export default AdminMetricsDashboardPage;
