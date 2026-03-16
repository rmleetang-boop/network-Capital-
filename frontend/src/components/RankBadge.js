import React from 'react';
import { Trophy, TrendingUp, Zap } from 'lucide-react';

const RankBadge = ({ rank }) => {
  const badges = {
    'Rising Star': {
      icon: Zap,
      color: 'from-blue-100 to-blue-200 text-blue-600',
      border: 'border-blue-300',
    },
    'Influencer': {
      icon: TrendingUp,
      color: 'from-purple-100 to-purple-200 text-purple-600',
      border: 'border-purple-300',
    },
    'Builder': {
      icon: Trophy,
      color: 'from-orange-100 to-orange-200 text-orange-600',
      border: 'border-orange-300',
    },
  };

  const badge = badges[rank] || badges['Rising Star'];
  const Icon = badge.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-br ${badge.color} border ${badge.border}`}>
      <Icon size={16} />
      <span className="text-xs font-semibold">{rank}</span>
    </div>
  );
};

export default RankBadge;