import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, Trophy, Zap, Sparkles, Calendar, Flame, Eye, Share2, MessageCircle, Heart, Clock, Lock } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import FeatureIntroModal from '../components/FeatureIntroModal';

const PERIODS = [
  { key: 'daily', label: 'Daily', days: 30 },
  { key: 'weekly', label: 'Weekly', days: 12 },
  { key: 'monthly', label: 'Monthly', days: 0 },
];

const ActionIcon = ({ action }) => {
  const map = {
    post: Sparkles, share: Share2, share_received: Share2,
    comment_milestone: MessageCircle, comment_received: MessageCircle,
    like_milestone: Heart, time_on_app: Clock,
    ad_share: Eye, ad_engagement: Flame,
    referral: Trophy, stokvel_create: TrendingUp,
    stokvel_join: TrendingUp, stokvel_contribute: TrendingUp,
  };
  const Icon = map[action] || Zap;
  return <Icon size={14} className="text-secondary" />;
};

const actionLabel = (action) => ({
  post: 'Posted content',
  share: 'Shared a post',
  share_received: 'Your post was shared',
  comment_milestone: 'Comment milestone',
  comment_received: 'Comment on your post',
  like_milestone: '50-likes milestone',
  time_on_app: '3 hours on app',
  ad_share: 'Watched ad + shared',
  ad_engagement: 'Watched ad + engaged',
  referral: 'Referral joined',
  stokvel_create: 'Created Stokvel',
  stokvel_join: 'Joined Stokvel',
  stokvel_contribute: 'Stokvel contribution',
  legacy: 'Activity',
}[action] || action);

const ActivityTrackerPage = ({ user }) => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('daily');
  const [summary, setSummary] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => { load(); }, [period]);

  const load = async () => {
    setLoading(true);
    try {
      const days = PERIODS.find((p) => p.key === period).days;
      const [s, a, e] = await Promise.all([
        axiosInstance.get('/score/summary'),
        axiosInstance.get('/score/activity', { params: { period, days } }),
        axiosInstance.get('/score/events', { params: { limit: 25 } }),
      ]);
      setSummary(s.data);
      setBuckets(a.data.buckets || []);
      setEvents(e.data.events || []);
    } catch {
      toast.error('Failed to load activity');
    } finally { setLoading(false); }
  };

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await axiosInstance.post('/score/claim-premium');
      toast.success('Premium unlocked — congratulations!');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    } finally { setClaiming(false); }
  };

  if (loading || !summary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxBucket = Math.max(1, ...buckets.map((b) => b.points));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] pb-24" data-testid="activity-tracker-page">
      <FeatureIntroModal
        featureKey="score-tracker"
        icon={<Activity size={20} />}
        title="Your Score Tracker"
        subtitle="Track how your participation builds your Network Score this month."
        bullets={[
          { icon: <Flame size={14} />, label: 'Daily check-ins & streaks', body: 'Log in every day to keep your streak alive — streaks unlock soft-cap boosts.' },
          { icon: <TrendingUp size={14} />, label: 'Top Contributor threshold: 10,000 / month', body: 'Your score grows uncapped. Reaching 10,000 in a month unlocks the Top Contributor badge and Premium-for-free claim. Daily and weekly soft caps protect against gaming.' },
          { icon: <Sparkles size={14} />, label: 'Premium 2× multiplier', body: 'Premium members earn double on qualifying actions during their active period.' },
        ]}
      />
      <div className="sticky top-0 z-10 bg-[#0a1628]/95 backdrop-blur-lg border-b border-white/10 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
            <Activity className="text-primary" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-white">Score Tracker</h1>
            <p className="text-xs text-white/60">Network Score — score grows uncapped · 10,000/month = Top Contributor</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-5">
        {/* Hero - Network Score (monthly — matches Profile) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
          data-testid="score-hero"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60 text-sm">Network Score · this month</span>
            {summary.premium_multiplier_active && (
              <span className="text-xs bg-secondary/20 text-secondary px-2 py-1 rounded-full font-bold flex items-center gap-1">
                <Sparkles size={12} /> 2× active
              </span>
            )}
          </div>
          <div className="flex items-end gap-3">
            <p className="text-5xl font-bold text-white" data-testid="network-score">
              {summary.monthly_score.toLocaleString()}
            </p>
            <p className="text-white/40 text-lg pb-1">/ {summary.monthly_cap.toLocaleString()}</p>
          </div>

          {/* Progress bar — monthly */}
          <div className="mt-3 h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-secondary to-yellow-500"
              style={{ width: `${Math.min(summary.percentage, 100)}%` }}
            />
          </div>
          <p className="text-white/60 text-sm mt-2 font-medium" data-testid="score-percentage">
            {summary.percentage}% of monthly target
          </p>

          {/* Premium grace */}
          {summary.premium_grace?.active && (
            <div className="mt-3 bg-secondary/10 border border-secondary/30 rounded-xl p-3 flex items-center gap-2">
              <Trophy size={16} className="text-secondary" />
              <p className="text-secondary text-xs font-medium">
                Top score grace: {summary.premium_grace.days_remaining} days remaining (premium)
              </p>
            </div>
          )}

          {/* Claim Premium CTA */}
          {summary.can_claim_premium && (
            <div className="mt-4 bg-gradient-to-r from-secondary/20 to-yellow-500/20 border border-secondary rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="text-secondary" size={20} />
                <p className="text-white font-bold">You hit the cap!</p>
              </div>
              <p className="text-white/80 text-sm mb-3">
                Claim Premium for free as a reward for reaching the 10,000 monthly Top Contributor threshold.
              </p>
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="w-full py-3 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-bold rounded-full disabled:opacity-50"
                data-testid="claim-premium-button"
              >
                {claiming ? 'Claiming...' : 'Claim Free Premium'}
              </button>
            </div>
          )}
        </motion.div>

        {/* Today / Week stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Today" value={summary.daily_score} icon={Flame} testId="daily-score" />
          <StatCard label="This Week" value={summary.weekly_score} icon={Calendar} testId="weekly-score" />
          <StatCard label="Lifetime" value={summary.lifetime_score} icon={Trophy} testId="lifetime-score" />
        </div>

        {/* Period switcher + chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20"
        >
          <div className="flex gap-2 mb-4 bg-white/5 p-1 rounded-full">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`flex-1 py-2 rounded-full font-medium text-sm transition-all ${
                  period === p.key ? 'bg-secondary text-primary' : 'text-white/60 hover:text-white'
                }`}
                data-testid={`period-${p.key}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {buckets.length === 0 ? (
            <p className="text-center text-white/50 py-8">No activity yet — start posting and engaging!</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto" data-testid="activity-chart">
              {buckets.slice(-30).reverse().map((b) => (
                <div key={b.key} className="flex items-center gap-3">
                  <span className="text-xs text-white/60 w-20 flex-shrink-0">{b.key.slice(-5)}</span>
                  <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-light to-secondary"
                      style={{ width: `${(b.points / maxBucket) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-white font-medium w-14 text-right">+{b.points}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent events */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20"
        >
          <h2 className="text-white font-bold mb-3 flex items-center gap-2">
            <Activity size={16} /> Recent points
          </h2>
          {events.length === 0 ? (
            <p className="text-center text-white/50 py-6">Nothing yet</p>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 15).map((e) => (
                <div key={e.id} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                  <ActionIcon action={e.action} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm">{actionLabel(e.action)}</p>
                    <p className="text-white/40 text-[10px]">{new Date(e.created_at).toLocaleString()}</p>
                  </div>
                  <span className="text-secondary font-bold text-sm">+{e.points}</span>
                  {e.multiplier > 1 && (
                    <span className="text-[10px] text-secondary/80">×{e.multiplier}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Scoring rules */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white/5 rounded-2xl p-5 border border-white/10"
        >
          <h2 className="text-white font-bold mb-3 text-sm">How to earn points · uncapped growth · 10,000/month = Top Contributor</h2>
          <p className="text-white/50 text-[10px] uppercase tracking-wider font-bold mb-1.5">Tier 1 · Ad engagement</p>
          <ul className="space-y-1 text-white/70 text-xs mb-3">
            <li>• Watch ad + engage with product: <strong className="text-white">+500</strong> <span className="opacity-60">(5/day)</span></li>
            <li>• Share an ad (diminishing): <strong className="text-white">300 / 150 / 50 / 50 / 50</strong> per unique ad</li>
          </ul>
          <p className="text-white/50 text-[10px] uppercase tracking-wider font-bold mb-1.5">Tier 2 · Referrals</p>
          <ul className="space-y-1 text-white/70 text-xs mb-3">
            <li>• Referred member hits 1,000 same month: <strong className="text-white">+400</strong></li>
            <li>• Referred friend activates a feature: <strong className="text-white">+200</strong></li>
            <li>• Referred friend posts in 7 days: <strong className="text-white">+150</strong></li>
          </ul>
          <p className="text-white/50 text-[10px] uppercase tracking-wider font-bold mb-1.5">Tier 3 · Standard activity</p>
          <ul className="space-y-1 text-white/70 text-xs mb-3">
            <li>• Create a post: <strong className="text-white">+50</strong> <span className="opacity-60">(5/day)</span></li>
            <li>• Share a post: <strong className="text-white">+20</strong> <span className="opacity-60">(10/day)</span></li>
            <li>• Quality comment (AI ≥ 0.6): <strong className="text-white">+30</strong> <span className="opacity-60">(10/day)</span></li>
            <li>• Like a post: <strong className="text-white">+5</strong> <span className="opacity-60">(20/day)</span></li>
            <li>• Watch a video: <strong className="text-white">+10</strong> <span className="opacity-60">(10/day)</span></li>
          </ul>
          <p className="text-white/50 text-[10px] uppercase tracking-wider font-bold mb-1.5">Community · Stokvels, Activities, People</p>
          <ul className="space-y-1 text-white/70 text-xs mb-3">
            <li>• First time joining a Stokvel: <strong className="text-secondary">+250</strong></li>
            <li>• Create an Activity: <strong className="text-secondary">+150</strong></li>
            <li>• Join an Activity: <strong className="text-secondary">+25</strong></li>
            <li>• Post a Place review (with rating): <strong className="text-secondary">+40</strong> <span className="opacity-60">(10/day)</span></li>
            <li>• Make a new connection (both sides earn): <strong className="text-secondary">+25</strong> <span className="opacity-60">(20/day)</span></li>
            <li>• Share a Job: <strong className="text-secondary">+20</strong> <span className="opacity-60">(10/day)</span></li>
          </ul>
          <p className="text-white/50 text-[10px] uppercase tracking-wider font-bold mb-1.5">Milestones · one-time & streaks</p>
          <ul className="space-y-1 text-white/70 text-xs mb-3">
            <li>• Complete your profile: <strong className="text-white">+250</strong> <span className="opacity-60">(once)</span></li>
            <li>• Premium welcome bonus: <strong className="text-white">+500</strong> <span className="opacity-60">(once)</span></li>
            <li>• Daily check-in: <strong className="text-white">+10</strong> <span className="opacity-60">(1/day)</span></li>
            <li>• Monthly streak: <strong className="text-white">+100</strong></li>
            <li>• Weekly resource drop: <strong className="text-white">+30</strong></li>
          </ul>
          <div className="pt-3 border-t border-white/10 space-y-1.5">
            <p className="text-white/50 text-[10px] uppercase tracking-wider font-bold mb-1.5">Anti-abuse safeguards</p>
            <p className="text-white/65 text-[11px] leading-relaxed">
              • <strong>24h cooldown</strong> on same source (one reward per post/ad/place).
              <br />• <strong>Ad share ladder:</strong> same ad pays 300 → 150 → 50 → 50 → 50, then 0.
              <br />• Score auto-flagged for review if <strong>{'>'}80%</strong> of monthly points come from one action type.
              <br />• Real-ad-only: no points for opening an empty ad slot.
            </p>
            <p className="text-secondary text-[11px] pt-2 flex items-center gap-1">
              <Sparkles size={12} /> Premium &amp; Founder windows multiply all gains 2× (stacking capped).
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, testId }) => (
  <div className="bg-white/10 rounded-xl p-3 border border-white/10" data-testid={testId}>
    <Icon size={14} className="text-secondary mb-1" />
    <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
    <p className="text-white/50 text-[10px] uppercase tracking-wide">{label}</p>
  </div>
);

export default ActivityTrackerPage;
