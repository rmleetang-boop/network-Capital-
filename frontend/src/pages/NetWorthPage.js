import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Wallet, 
  Users, 
  Package, 
  Network,
  DollarSign,
  Activity,
  Award,
  UserPlus,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../App';

const NetWorthPage = ({ user }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNetWorth();
  }, []);

  const fetchNetWorth = async () => {
    try {
      const res = await axiosInstance.get('/dashboard/net-worth');
      setData(res.data);
    } catch (error) {
      console.error('Error fetching net worth:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const netWorth = data?.net_worth || {};
  const networkValue = data?.network_value || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a1628]/95 backdrop-blur-lg border-b border-white/10 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
            <TrendingUp className="text-primary" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-white">Net Worth</h1>
            <p className="text-xs text-white/60">Your financial overview</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {/* Total Net Worth Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-secondary/20 to-yellow-500/20 rounded-3xl p-6 border border-secondary/30"
        >
          <p className="text-white/70 text-sm mb-2">Total Net Worth</p>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-5xl font-bold text-white">
              ${netWorth.total?.toLocaleString() || '0'}
            </span>
            <span className="text-secondary text-sm mb-2">.00</span>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <Wallet className="text-green-400 mx-auto mb-1" size={20} />
              <p className="text-lg font-bold text-white">${netWorth.wallet_balance?.toFixed(2) || '0'}</p>
              <p className="text-white/50 text-xs">Wallet</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <Users className="text-blue-400 mx-auto mb-1" size={20} />
              <p className="text-lg font-bold text-white">${netWorth.stokvel_participation?.toFixed(2) || '0'}</p>
              <p className="text-white/50 text-xs">In Stokvels</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <Package className="text-purple-400 mx-auto mb-1" size={20} />
              <p className="text-lg font-bold text-white">${netWorth.products_supported?.toFixed(2) || '0'}</p>
              <p className="text-white/50 text-xs">Supporting</p>
            </div>
          </div>
        </motion.div>

        {/* Network Value Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Network className="text-secondary" size={24} />
              <h2 className="text-lg font-bold text-white">Network Value</h2>
            </div>
            <div className="bg-secondary/20 px-3 py-1 rounded-full">
              <span className="text-secondary font-bold">{networkValue.score || 0} pts</span>
            </div>
          </div>

          <p className="text-white/60 text-sm mb-4">
            Your network value is calculated from your activity, engagement, and community participation.
          </p>

          {/* Network Value Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="text-blue-400" size={16} />
                <span className="text-white/70 text-sm">Posts</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{networkValue.breakdown?.posts || 0}</span>
                <span className="text-white/40 text-xs">× 5 pts</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="text-green-400" size={16} />
                <span className="text-white/70 text-sm">Stokvels</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{networkValue.breakdown?.stokvels || 0}</span>
                <span className="text-white/40 text-xs">× 20 pts</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="text-purple-400" size={16} />
                <span className="text-white/70 text-sm">Products Supported</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{networkValue.breakdown?.products_supported || 0}</span>
                <span className="text-white/40 text-xs">× 10 pts</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="text-yellow-400" size={16} />
                <span className="text-white/70 text-sm">Referrals</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{networkValue.breakdown?.referrals || 0}</span>
                <span className="text-white/40 text-xs">× 50 pts</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="text-secondary" size={16} />
                <span className="text-white/70 text-sm">Network Score</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{networkValue.breakdown?.network_score || 0}</span>
                <span className="text-white/40 text-xs">× 2 pts</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-4"
        >
          <div 
            onClick={() => navigate('/stokvels')}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 cursor-pointer hover:bg-white/15 transition-all"
          >
            <Users className="text-blue-400 mb-2" size={24} />
            <p className="text-2xl font-bold text-white">{netWorth.active_stokvels || 0}</p>
            <p className="text-white/50 text-sm">Active Stokvels</p>
          </div>
          
          <div 
            onClick={() => navigate('/products')}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 cursor-pointer hover:bg-white/15 transition-all"
          >
            <Package className="text-purple-400 mb-2" size={24} />
            <p className="text-2xl font-bold text-white">{networkValue.breakdown?.products_supported || 0}</p>
            <p className="text-white/50 text-sm">Products Supported</p>
          </div>
        </motion.div>

        {/* Tips Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-secondary/10 border border-secondary/30 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="text-secondary" size={20} />
            <h3 className="text-white font-medium">Grow Your Network Value</h3>
          </div>
          <ul className="text-white/70 text-sm space-y-1">
            <li>• Post and engage with the community</li>
            <li>• Join and contribute to Stokvels</li>
            <li>• Support products you believe in</li>
            <li>• Refer friends to the platform</li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
};

export default NetWorthPage;
