import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, Medal, Award } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import NetworkScore from '../components/NetworkScore';
import RankBadge from '../components/RankBadge';
import { useNavigate } from 'react-router-dom';

const LeaderboardPage = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await axiosInstance.get('/leaderboard?limit=50');
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const getMedalIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Crown className="text-accent-gold" size={24} />;
      case 2:
        return <Medal className="text-accent-silver" size={24} />;
      case 3:
        return <Award className="text-accent-bronze" size={24} />;
      default:
        return <span className="text-lg font-bold text-text-muted">#{rank}</span>;
    }
  };

  const getRankStyle = (rank) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-accent-gold shadow-lg';
      case 2:
        return 'bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-accent-silver shadow-md';
      case 3:
        return 'bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-accent-bronze shadow-md';
      default:
        return 'bg-white border border-gray-100';
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
    <div className="min-h-screen bg-background-DEFAULT">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 py-4">
        <h1 className="text-2xl font-heading font-bold text-primary">Leaderboard</h1>
        <p className="text-sm text-text-secondary">Top contributors on Network Capital</p>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {users.map((user, index) => {
          const rank = index + 1;
          const isCurrentUser = user.id === currentUser.id;

          return (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`rounded-2xl p-4 hover:shadow-lg transition-all cursor-pointer ${
                getRankStyle(rank)
              } ${isCurrentUser ? 'ring-2 ring-primary' : ''}`}
              onClick={() => navigate(`/profile/${user.id}`)}
              data-testid={`leaderboard-user-${index}`}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12">
                  {getMedalIcon(rank)}
                </div>

                <Avatar className="w-14 h-14">
                  <AvatarImage src={user.photo} />
                  <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-text-primary truncate">
                      {user.username}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs bg-primary text-white px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </h3>
                  </div>
                  <RankBadge rank={user.rank} />
                </div>

                <div className="text-right">
                  <NetworkScore score={user.network_score} size="medium" animate={false} />
                  <p className="text-xs text-text-muted mt-1">points</p>
                </div>
              </div>
            </motion.div>
          );
        })}

        {users.length === 0 && (
          <div className="text-center py-12">
            <p className="text-text-secondary">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardPage;