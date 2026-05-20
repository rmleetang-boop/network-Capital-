import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Award, Zap, Users, Target, Activity } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { useParams } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';

const ScoreDashboardPage = ({ user }) => {
  const { stokvelId } = useParams();
  const [score, setScore] = useState(null);
  const [groupScore, setGroupScore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (stokvelId) {
      fetchScores();
    }
  }, [stokvelId]);

  const fetchScores = async () => {
    try {
      const [scoreRes, groupRes] = await Promise.all([
        axiosInstance.get(`/stokvels/${stokvelId}/my-score`),
        axiosInstance.get(`/stokvels/${stokvelId}/group-score`),
      ]);
      setScore(scoreRes.data);
      setGroupScore(groupRes.data);
    } catch (error) {
      toast.error('Failed to load scores');
    } finally {
      setLoading(false);
    }
  };

  const getTierInfo = (tier) => {
    const tiers = {
      none: { color: 'text-gray-600', bg: 'bg-gray-100', label: 'None', rewards: 'No rewards yet' },
      basic: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Basic', rewards: '3% bonus, 1% cashback' },
      boosted: { color: 'text-purple-600', bg: 'bg-purple-100', label: 'Boosted', rewards: '7% bonus, 3% cashback' },
      premium: { color: 'text-secondary', bg: 'bg-secondary/20', label: 'Premium', rewards: '10% bonus, 5% cashback' },
    };
    return tiers[tier] || tiers.none;
  };

  const getNextTier = (currentScore) => {
    if (currentScore < 41) return { score: 41, tier: 'Basic' };
    if (currentScore < 71) return { score: 71, tier: 'Boosted' };
    if (currentScore < 86) return { score: 86, tier: 'Premium' };
    return { score: 100, tier: 'Maximum' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-text-secondary">Please select a Stokvel to view scores</p>
      </div>
    );
  }

  const tierInfo = getTierInfo(score.tier);
  const nextTier = getNextTier(score.individual_score);
  const progressToNext = ((score.individual_score - (nextTier.score - 30)) / 30) * 100;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-20">
      <div className="sticky top-0 z-10 dark-header px-4 py-4">
        <div className="flex items-center gap-3">
          <img 
            src="/brand/logo-mark.png" 
            alt="Network Capital" 
            className="h-10 w-10 rounded-lg object-cover"
          />
          <div>
            <h1 className="text-xl font-heading font-bold text-white">Network Score</h1>
            <p className="text-xs text-white/60">Performance Dashboard</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Main Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-primary to-primary-light rounded-2xl shadow-lg p-8 text-white text-center"
        >
          <p className="text-white/80 text-sm mb-2">Your Network Score</p>
          
          {/* Circular Score Display */}
          <div className="relative w-48 h-48 mx-auto mb-4">
            <svg className="transform -rotate-90 w-48 h-48">
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="12"
                fill="none"
              />
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke="white"
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${(score.individual_score / 100) * 553} 553`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-6xl font-bold">{score.individual_score.toFixed(0)}</span>
              <span className="text-white/80 text-sm">/ 100</span>
            </div>
          </div>

          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${tierInfo.bg} ${tierInfo.color} font-semibold`}>
            <Award size={20} />
            {tierInfo.label} Tier
          </div>
          
          <p className="text-white/70 text-sm mt-2">{tierInfo.rewards}</p>

          {score.tier !== 'premium' && (
            <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-white/80 text-sm mb-2">
                {nextTier.score - score.individual_score.toFixed(0)} points to {nextTier.tier}
              </p>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, progressToNext))}%` }}
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* Score Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h2 className="text-lg font-heading font-bold text-text-primary mb-4 flex items-center gap-2">
            <Activity size={20} />
            Score Breakdown
          </h2>

          <div className="space-y-4">
            {/* Consistency */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-primary">Contribution Consistency</span>
                <span className="text-sm font-bold text-primary">{score.contribution_consistency_score.toFixed(1)}/30</span>
              </div>
              <Progress value={(score.contribution_consistency_score / 30) * 100} className="h-2" />
              {score.streak_days > 0 && (
                <p className="text-xs text-text-muted mt-1">
                  🔥 {score.streak_days}-day streak!
                </p>
              )}
            </div>

            {/* Amount */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-primary">Contribution Amount</span>
                <span className="text-sm font-bold text-primary">{score.contribution_amount_score.toFixed(1)}/20</span>
              </div>
              <Progress value={(score.contribution_amount_score / 20) * 100} className="h-2" />
              <p className="text-xs text-text-muted mt-1">
                Total: ${score.total_contributions.toFixed(2)}
              </p>
            </div>

            {/* Engagement */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-primary">Platform Engagement</span>
                <span className="text-sm font-bold text-primary">{score.engagement_score.toFixed(1)}/15</span>
              </div>
              <Progress value={(score.engagement_score / 15) * 100} className="h-2" />
            </div>

            {/* Referrals */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-primary">Referrals</span>
                <span className="text-sm font-bold text-primary">{score.referral_score.toFixed(1)}/15</span>
              </div>
              <Progress value={(score.referral_score / 15) * 100} className="h-2" />
              <p className="text-xs text-text-muted mt-1">
                {Math.floor(score.referral_score / 3)} referrals made
              </p>
            </div>

            {/* Group Health */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-primary">Group Health</span>
                <span className="text-sm font-bold text-primary">{score.group_health_score.toFixed(1)}/20</span>
              </div>
              <Progress value={(score.group_health_score / 20) * 100} className="h-2" />
            </div>
          </div>
        </motion.div>

        {/* Group Score */}
        {groupScore && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
          >
            <h2 className="text-lg font-heading font-bold text-text-primary mb-4 flex items-center gap-2">
              <Users size={20} />
              Group Performance
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-background-subtle rounded-xl">
                <p className="text-3xl font-bold text-primary">{groupScore.group_score.toFixed(1)}</p>
                <p className="text-sm text-text-secondary">Group Score</p>
              </div>
              <div className="text-center p-4 bg-background-subtle rounded-xl">
                <p className="text-3xl font-bold text-secondary">{groupScore.tier.toUpperCase()}</p>
                <p className="text-sm text-text-secondary">Group Tier</p>
              </div>
              <div className="text-center p-4 bg-background-subtle rounded-xl">
                <p className="text-3xl font-bold text-text-primary">{groupScore.member_count}</p>
                <p className="text-sm text-text-secondary">Members</p>
              </div>
              <div className="text-center p-4 bg-background-subtle rounded-xl">
                <p className="text-3xl font-bold text-text-primary">${groupScore.total_pool.toFixed(0)}</p>
                <p className="text-sm text-text-secondary">Total Pool</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tips to Improve */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-secondary/10 to-primary/10 rounded-2xl border border-primary/20 p-6"
        >
          <h3 className="font-heading font-bold text-text-primary mb-3 flex items-center gap-2">
            <Zap className="text-secondary" size={20} />
            Boost Your Score
          </h3>
          <div className="space-y-2 text-sm text-text-secondary">
            {score.contribution_consistency_score < 25 && (
              <p>• Make regular contributions to improve consistency (up to +{(30 - score.contribution_consistency_score).toFixed(1)} pts)</p>
            )}
            {score.contribution_amount_score < 15 && (
              <p>• Increase contribution amounts toward target (up to +{(20 - score.contribution_amount_score).toFixed(1)} pts)</p>
            )}
            {score.engagement_score < 10 && (
              <p>• Post and comment more on the platform (up to +{(15 - score.engagement_score).toFixed(1)} pts)</p>
            )}
            {score.referral_score < 10 && (
              <p>• Invite friends to join Network Capital (up to +{(15 - score.referral_score).toFixed(1)} pts)</p>
            )}
            {score.group_health_score < 15 && (
              <p>• Help grow your group's performance (up to +{(20 - score.group_health_score).toFixed(1)} pts)</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ScoreDashboardPage;
