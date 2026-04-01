import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Users, Crown, Medal, Award as AwardIcon } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';

const LeaderboardsPage = ({ user }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [userLeaderboard, setUserLeaderboard] = useState([]);
  const [groupLeaderboard, setGroupLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLeaderboards();
  }, []);

  const fetchLeaderboards = async () => {
    try {
      const [usersRes, groupsRes] = await Promise.all([
        axiosInstance.get('/leaderboard/users?limit=50'),
        axiosInstance.get('/leaderboard/groups?limit=50'),
      ]);
      setUserLeaderboard(usersRes.data);
      setGroupLeaderboard(groupsRes.data);
    } catch (error) {
      toast.error('Failed to load leaderboards');
    } finally {
      setLoading(false);
    }
  };

  const getMedalIcon = (rank) => {
    if (rank === 1) return <Crown className="text-accent-gold" size={24} />;
    if (rank === 2) return <Medal className="text-accent-silver" size={24} />;
    if (rank === 3) return <AwardIcon className="text-accent-bronze" size={24} />;
    return <span className="text-lg font-bold text-text-muted">#{rank}</span>;
  };

  const getRankStyle = (rank) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-accent-gold';
    if (rank === 2) return 'bg-gradient-to-r from-gray-50 to-slate-50 border-2 border-accent-silver';
    if (rank === 3) return 'bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-accent-bronze';
    return 'bg-white border border-gray-100';
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
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <img 
            src="https://customer-assets.emergentagent.com/job_network-capital/artifacts/ujjy9ep3_185322.png" 
            alt="Network Capital" 
            className="h-10 w-auto"
          />
          <div>
            <h1 className="text-xl font-heading font-bold text-primary">Leaderboards</h1>
            <p className="text-xs text-text-secondary">Top performers</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'users'
                ? 'bg-primary text-white shadow-md'
                : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
            }`}
          >
            <Users className="inline mr-2" size={18} />
            Users
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'groups'
                ? 'bg-primary text-white shadow-md'
                : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
            }`}
          >
            <TrendingUp className="inline mr-2" size={18} />
            Groups
          </button>
        </div>

        {/* User Leaderboard */}
        {activeTab === 'users' && (
          <div className="space-y-3">
            {userLeaderboard.map((entry, idx) => {
              const isCurrentUser = entry.user_id === user.id;
              return (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`rounded-2xl p-4 hover:shadow-lg transition-all cursor-pointer ${
                    getRankStyle(entry.rank)
                  } ${isCurrentUser ? 'ring-2 ring-secondary' : ''}`}
                  onClick={() => navigate(`/profile/${entry.user_id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12">
                      {getMedalIcon(entry.rank)}
                    </div>

                    <Avatar className="w-14 h-14">
                      <AvatarImage src={entry.photo} />
                      <AvatarFallback>{entry.username[0].toUpperCase()}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-text-primary truncate">
                          {entry.username}
                        </h3>
                        {isCurrentUser && (
                          <span className="text-xs bg-secondary text-white px-2 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted">{entry.tier}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-bold text-secondary">{entry.score}</p>
                      <p className="text-xs text-text-muted">points</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Group Leaderboard */}
        {activeTab === 'groups' && (
          <div className="space-y-3">
            {groupLeaderboard.map((entry, idx) => (
              <motion.div
                key={entry.stokvel_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`rounded-2xl p-4 hover:shadow-lg transition-all cursor-pointer ${getRankStyle(entry.rank)}`}
                onClick={() => navigate(`/stokvels/${entry.stokvel_id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12">
                    {getMedalIcon(entry.rank)}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-text-primary mb-1">{entry.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span>{entry.member_count} members</span>
                      <span>•</span>
                      <span>${entry.total_pool.toFixed(0)} pool</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{entry.group_score.toFixed(1)}</p>
                    <p className="text-xs text-text-muted">{entry.tier}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {((activeTab === 'users' && userLeaderboard.length === 0) ||
          (activeTab === 'groups' && groupLeaderboard.length === 0)) && (
          <div className="text-center py-12">
            <Trophy className="mx-auto mb-4 text-text-muted" size={48} />
            <p className="text-text-secondary">No entries yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardsPage;
