import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Flame, Target, Sparkles, ArrowRight, Heart, MessageCircle, Share2, Users, FileText, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import LiveActivityFeed from '../components/LiveActivityFeed';
import RankBadge from '../components/RankBadge';
import { Progress } from '@/components/ui/progress';

const DashboardPage = ({ user }) => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [stats, setStats] = useState(null);
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    Promise.all([
      axiosInstance.get('/score/summary'),
      axiosInstance.get('/dashboard'),
      axiosInstance.get('/leaderboard/public?limit=5'),
    ]).then(([s, d, l]) => {
      setSummary(s.data);
      setStats(d.data);
      setLeaders(l.data?.leaders || []);
    }).catch(() => toast.error('Failed to load dashboard'));
  }, []);

  if (!summary || !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const monthly = summary.monthly_score || 0;
  const cap = summary.monthly_cap || 10000;
  const pct = Math.min(100, (monthly / cap) * 100);
  const today = summary.daily_score || 0;
  const weekly = summary.weekly_score || 0;
  const streak = summary.streak_days || 0;

  const quickActions = [
    { icon: FileText, label: 'Post update', sub: '+20 pts', path: '/' },
    { icon: Share2, label: 'Share a post', sub: '+10 pts', path: '/' },
    { icon: Users, label: 'Refer a member', sub: '+200 pts', path: '/referral' },
    { icon: Sparkles, label: 'Watch & engage', sub: '+500 pts', path: '/' },
    { icon: MessageCircle, label: 'Message a connection', sub: 'engagement', path: '/messages' },
    { icon: Heart, label: 'Like & comment', sub: '+2 / +5 pts', path: '/' },
  ];

  return (
    <div className="min-h-screen bg-background-DEFAULT">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-[#0a1628] via-primary to-[#0a1628] border-b border-white/10 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/60">Your dashboard</p>
            <h1 className="text-xl font-heading font-bold text-white">Daily Activity Tracker</h1>
          </div>
          <button
            onClick={() => navigate('/activity')}
            className="text-xs sm:text-sm text-secondary hover:underline inline-flex items-center gap-1"
            data-testid="dashboard-full-tracker"
          >
            Full tracker <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* CENTRAL TRACKER */}
        <div className="lg:col-span-2 space-y-5">
          {/* Hero card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] text-white p-6 shadow-xl border border-white/10"
            data-testid="tracker-hero"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/60">Network Score · this month</p>
                <p className="text-5xl font-heading font-bold text-secondary leading-tight" data-testid="tracker-monthly-score">
                  {monthly.toLocaleString()}
                  <span className="text-base text-white/50 font-normal"> / {cap.toLocaleString()}</span>
                </p>
              </div>
              <RankBadge rank={user.rank} />
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-3">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-secondary to-yellow-400"
              />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="rounded-xl bg-white/5 px-3 py-2.5 border border-white/10" data-testid="tracker-today">
                <div className="flex items-center gap-1.5 text-white/60 text-[11px] mb-1"><Target size={12} /> Today</div>
                <p className="text-lg font-bold">+{today}</p>
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-2.5 border border-white/10" data-testid="tracker-week">
                <div className="flex items-center gap-1.5 text-white/60 text-[11px] mb-1"><Activity size={12} /> 7-day</div>
                <p className="text-lg font-bold">+{weekly}</p>
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-2.5 border border-white/10" data-testid="tracker-streak">
                <div className="flex items-center gap-1.5 text-white/60 text-[11px] mb-1"><Flame size={12} /> Streak</div>
                <p className="text-lg font-bold">{streak}d</p>
              </div>
            </div>
            <p className="text-[11px] text-white/55 mt-3">
              Consistency wins. Score resets every calendar month — small daily actions compound.
            </p>
          </motion.div>

          {/* Quick actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5" data-testid="quick-actions">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading font-bold text-text-primary">Earn points today</h2>
              <span className="text-xs text-text-muted">Small actions, repeated daily</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {quickActions.map((a) => {
                const I = a.icon;
                return (
                  <button
                    key={a.label}
                    onClick={() => navigate(a.path)}
                    className="text-left rounded-xl bg-background-subtle hover:bg-gray-100 transition-colors p-3 active:scale-95"
                    data-testid={`quick-action-${a.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <I size={18} className="text-primary mb-2" />
                    <p className="text-sm font-semibold text-text-primary leading-tight">{a.label}</p>
                    <p className="text-[11px] text-secondary font-bold mt-0.5">{a.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent contribution stats */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-heading font-bold text-text-primary mb-3">Your contribution so far</h2>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'Posts', value: stats.total_posts, color: 'text-primary' },
                { label: 'Likes', value: stats.total_likes, color: 'text-red-500' },
                { label: 'Comments', value: stats.total_comments, color: 'text-blue-500' },
                { label: 'Shares', value: stats.total_shares, color: 'text-secondary' },
                { label: 'Referrals', value: stats.total_referrals, color: 'text-purple-500' },
              ].map((m) => (
                <div key={m.label} className="rounded-xl bg-background-subtle px-2 py-3 text-center">
                  <p className={`text-2xl font-bold ${m.color}`}>{m.value || 0}</p>
                  <p className="text-[11px] text-text-muted">{m.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <p className="text-[11px] text-text-muted mb-1">Progress to next rank</p>
              <Progress value={pct} className="h-2" />
            </div>
          </div>
        </div>

        {/* RIGHT RAIL */}
        <div className="space-y-5">
          <LiveActivityFeed limit={10} theme="light" />

          {/* Mini leaderboard */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" data-testid="dashboard-leaderboard">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-secondary" />
                <h3 className="font-heading font-bold text-sm">Top participants</h3>
              </div>
              <button onClick={() => navigate('/leaderboards')} className="text-xs text-primary hover:underline">All</button>
            </div>
            <ul className="divide-y divide-gray-100">
              {leaders.slice(0, 5).map((l) => (
                <li key={`${l.username}-${l.rank}`} className="flex items-center gap-3 px-4 py-2.5" data-testid={`leader-${l.rank}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${l.rank <= 3 ? 'bg-secondary text-primary' : 'bg-background-subtle text-text-secondary'}`}>{l.rank}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">@{l.username}</p>
                    <p className="text-[11px] text-text-muted">{l.city || 'Network'}</p>
                  </div>
                  <p className="text-sm font-bold text-secondary">{l.network_score.toLocaleString()}</p>
                </li>
              ))}
              {leaders.length === 0 && <li className="px-4 py-6 text-center text-sm text-text-muted">No leaders yet</li>}
            </ul>
          </div>

          {/* Trust nudge */}
          <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-primary/5 to-secondary/5 p-4 text-xs text-text-secondary" data-testid="trust-nudge">
            <p className="font-bold text-text-primary mb-1">Network Capital is a community coordination platform.</p>
            <p>We don't offer financial products and don't promise returns. Your data is protected under POPIA.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
