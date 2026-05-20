import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gift, TrendingUp, DollarSign, Award, Sparkles } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { useParams } from 'react-router-dom';
import FeatureIntroModal from '../components/FeatureIntroModal';

const RewardsPage = () => {
  const { stokvelId } = useParams();
  const [rewards, setRewards] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (stokvelId) {
      fetchRewards();
    }
  }, [stokvelId]);

  const fetchRewards = async () => {
    try {
      const response = await axiosInstance.get(`/stokvels/${stokvelId}/my-rewards`);
      setRewards(response.data.rewards);
      setSummary(response.data.summary);
    } catch (error) {
      toast.error('Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

  const getRewardIcon = (type) => {
    switch (type) {
      case 'bonus_contribution':
        return <TrendingUp className="text-primary" size={20} />;
      case 'cashback':
        return <DollarSign className="text-secondary" size={20} />;
      default:
        return <Gift className="text-purple-600" size={20} />;
    }
  };

  const getRewardColor = (type) => {
    switch (type) {
      case 'bonus_contribution':
        return 'bg-primary/10 border-primary/30';
      case 'cashback':
        return 'bg-secondary/10 border-secondary/30';
      default:
        return 'bg-purple-50 border-purple-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-20">
      <FeatureIntroModal
        featureKey="rewards"
        icon={<Gift size={20} />}
        title="Stokvel Rewards"
        subtitle="See the access and benefits unlocked by your group's Network Score tier."
        bullets={[
          { icon: <Award size={14} />, label: 'Tier-based access', body: 'Higher group tier = better shared access and more group benefits.' },
          { icon: <Sparkles size={14} />, label: 'Reputation, not interest', body: 'Rewards are access and recognition — never guaranteed financial returns.' },
          { icon: <TrendingUp size={14} />, label: 'Boost your tier', body: 'Encourage consistent participation across all members to climb tiers together.' },
        ]}
      />
      <div className="sticky top-0 z-10 dark-header px-4 py-4">
        <div className="flex items-center gap-3">
          <img 
            src="/brand/logo-mark.png" 
            alt="Network Capital" 
            className="h-10 w-10 rounded-lg object-cover"
          />
          <div>
            <h1 className="text-xl font-heading font-bold text-white">Rewards</h1>
            <p className="text-xs text-white/60">Your earnings & benefits</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Summary Cards */}
        {summary && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-secondary to-secondary-hover rounded-2xl shadow-lg p-6 text-white"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-white/20 rounded-full">
                  <Sparkles size={24} />
                </div>
                <div>
                  <p className="text-white/80 text-sm">Total Rewards Earned</p>
                  <p className="text-4xl font-bold">${summary.total_rewards.toFixed(2)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                  <p className="text-white/70 text-xs mb-1">Bonus to Pool</p>
                  <p className="text-2xl font-bold">${summary.total_bonus.toFixed(2)}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                  <p className="text-white/70 text-xs mb-1">Cashback to You</p>
                  <p className="text-2xl font-bold">${summary.total_cashback.toFixed(2)}</p>
                </div>
              </div>
            </motion.div>

            {/* Reward Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-3 gap-3"
            >
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
                <Award className="text-primary mx-auto mb-2" size={24} />
                <p className="text-2xl font-bold text-text-primary">{summary.reward_count}</p>
                <p className="text-xs text-text-muted">Total Rewards</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
                <TrendingUp className="text-primary mx-auto mb-2" size={24} />
                <p className="text-2xl font-bold text-text-primary">${(summary.total_bonus / (summary.reward_count || 1)).toFixed(2)}</p>
                <p className="text-xs text-text-muted">Avg Bonus</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
                <DollarSign className="text-secondary mx-auto mb-2" size={24} />
                <p className="text-2xl font-bold text-text-primary">${(summary.total_cashback / (summary.reward_count || 1)).toFixed(2)}</p>
                <p className="text-xs text-text-muted">Avg Cashback</p>
              </div>
            </motion.div>
          </>
        )}

        {/* Rewards History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h2 className="text-lg font-heading font-bold text-text-primary mb-4">
            Reward History
          </h2>

          <div className="space-y-3">
            {rewards.map((reward, idx) => (
              <motion.div
                key={reward.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`p-4 rounded-xl border ${getRewardColor(reward.reward_type)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-full">
                    {getRewardIcon(reward.reward_type)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-text-primary text-sm">
                      {reward.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        reward.tier === 'premium' ? 'bg-secondary/20 text-secondary' :
                        reward.tier === 'boosted' ? 'bg-purple-100 text-purple-600' :
                        reward.tier === 'basic' ? 'bg-blue-100 text-blue-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {reward.tier.toUpperCase()}
                      </span>
                      <span className="text-xs text-text-muted">
                        {new Date(reward.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-secondary">
                      +${reward.amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}

            {rewards.length === 0 && (
              <div className="text-center py-12">
                <Gift className="mx-auto mb-4 text-text-muted" size={48} />
                <p className="text-text-secondary mb-2">No rewards yet</p>
                <p className="text-sm text-text-muted">
                  Reach score 41+ to start earning rewards!
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* How Rewards Work */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-primary/5 rounded-2xl border border-primary/20 p-6"
        >
          <h3 className="font-heading font-bold text-text-primary mb-3">
            How Rewards Work
          </h3>
          <div className="space-y-3 text-sm text-text-secondary">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary text-xs">
                1
              </div>
              <div>
                <p className="font-medium text-text-primary">Earn Your Score</p>
                <p className="text-xs">Contribute consistently, engage, and refer friends to build your Network Score (0-100)</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary text-xs">
                2
              </div>
              <div>
                <p className="font-medium text-text-primary">Unlock Tiers</p>
                <p className="text-xs">
                  Basic (41-70): 3% bonus<br/>
                  Boosted (71-85): 7% bonus<br/>
                  Premium (86-100): 10% bonus
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-secondary/20 rounded-full flex items-center justify-center font-bold text-secondary text-xs">
                3
              </div>
              <div>
                <p className="font-medium text-text-primary">Get Rewarded</p>
                <p className="text-xs">Every contribution earns you bonus to pool + cashback based on your tier</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default RewardsPage;
