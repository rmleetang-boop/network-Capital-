import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Heart, MessageCircle, Share2, FileText, Users } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import NetworkScore from '../components/NetworkScore';
import RankBadge from '../components/RankBadge';
import { Progress } from '@/components/ui/progress';

const DashboardPage = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await axiosInstance.get('/dashboard');
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const getNextRankScore = (currentScore) => {
    if (currentScore < 500) return 500;
    if (currentScore < 2000) return 2000;
    return 5000;
  };

  const calculateProgress = (score) => {
    if (score < 500) return (score / 500) * 100;
    if (score < 2000) return ((score - 500) / 1500) * 100;
    return Math.min(((score - 2000) / 3000) * 100, 100);
  };

  const activityData = [
    { label: 'Posts', value: stats.total_posts, icon: FileText, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Likes', value: stats.total_likes, icon: Heart, color: 'text-red-500', bgColor: 'bg-red-50' },
    { label: 'Comments', value: stats.total_comments, icon: MessageCircle, color: 'text-blue-500', bgColor: 'bg-blue-50' },
    { label: 'Shares', value: stats.total_shares, icon: Share2, color: 'text-secondary', bgColor: 'bg-secondary/10' },
    { label: 'Referrals', value: stats.total_referrals, icon: Users, color: 'text-purple-500', bgColor: 'bg-purple-50' },
  ];

  return (
    <div className="min-h-screen bg-background-DEFAULT">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 py-4">
        <h1 className="text-2xl font-heading font-bold text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary">Your network analytics</p>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-lg p-6 text-white"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/80 text-sm mb-1">Current Network Score</p>
              <div className="text-5xl font-bold tracking-tighter">
                {stats.current_score.toLocaleString()}
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
              <RankBadge rank={stats.rank} />
            </div>
          </div>

          <div className="mb-2">
            <div className="flex items-center justify-between text-sm text-white/90 mb-2">
              <span>Progress to next rank</span>
              <span>
                {stats.current_score} / {getNextRankScore(stats.current_score)}
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${calculateProgress(stats.current_score)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-white rounded-full shadow-lg"
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-secondary" size={24} />
            <h2 className="text-xl font-heading font-bold text-text-primary">Weekly Growth</h2>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-secondary">
              +{stats.weekly_growth}
            </span>
            <span className="text-text-secondary">points this week</span>
          </div>
        </motion.div>

        <div>
          <h2 className="text-lg font-heading font-bold text-text-primary mb-3 px-1">
            Activity Breakdown
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {activityData.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + index * 0.05 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
                  data-testid={`activity-${item.label.toLowerCase()}`}
                >
                  <div className={`inline-flex p-3 rounded-xl ${item.bgColor} mb-3`}>
                    <Icon className={item.color} size={24} />
                  </div>
                  <div className="text-3xl font-bold text-text-primary mb-1">
                    {item.value}
                  </div>
                  <div className="text-sm text-text-secondary">{item.label}</div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-secondary/10 to-primary/10 rounded-2xl border border-secondary/20 p-6"
        >
          <h3 className="font-heading font-bold text-text-primary mb-2">Keep Growing!</h3>
          <p className="text-sm text-text-secondary">
            Engage more with the community to increase your Network Score and unlock new ranks.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardPage;