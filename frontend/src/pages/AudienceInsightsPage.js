import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Users,
  DollarSign,
  Mail,
  Phone,
  User,
  Lock,
  Unlock,
  Sparkles,
  TrendingUp,
  Eye
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const TIERS = [
  {
    key: 'free',
    label: 'Free',
    price: 0,
    perks: ['Total supporter count', 'Total support amount'],
    color: 'bg-white/10 border-white/20',
  },
  {
    key: 'basic',
    label: 'Basic',
    price: 5,
    perks: ['See 25% of supporters', 'Names & emails', 'Engagement trend'],
    color: 'bg-secondary/10 border-secondary/30',
  },
  {
    key: 'pro',
    label: 'Pro',
    price: 15,
    perks: ['Full supporter list', 'Contact details (email + phone)', 'Export ready'],
    color: 'bg-gradient-to-br from-secondary/20 to-yellow-500/20 border-secondary/50',
  },
];

const AudienceInsightsPage = ({ user }) => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [insights, setInsights] = useState(null);
  const [currentTier, setCurrentTier] = useState('free');
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    fetchInitial();
  }, [productId]);

  const fetchInitial = async () => {
    try {
      const prodRes = await axiosInstance.get(`/products/${productId}`);
      setProduct(prodRes.data.product);
      await loadInsights('free');
    } catch (e) {
      toast.error('Failed to load product');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async (tier) => {
    try {
      const res = await axiosInstance.get(`/products/${productId}/insights`, {
        params: { tier },
      });
      setInsights(res.data);
      setCurrentTier(tier);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load insights');
    }
  };

  const handleUnlock = async (tier) => {
    setUnlocking(true);
    try {
      await axiosInstance.post(`/products/${productId}/unlock-insights`, null, {
        params: { tier },
      });
      toast.success(`${tier.toUpperCase()} insights unlocked!`);
      await loadInsights(tier);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Unlock failed');
    } finally {
      setUnlocking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalFollowers = insights?.total_followers || 0;
  const totalSupport = insights?.total_support || 0;
  const followers = insights?.followers || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] pb-24" data-testid="audience-insights-page">
      <div className="sticky top-0 z-10 bg-[#0a1628]/95 backdrop-blur-lg border-b border-white/10 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(`/products/${productId}`)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            data-testid="back-to-product"
          >
            <ArrowLeft className="text-white" size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-heading font-bold text-white">Audience Insights</h1>
            <p className="text-xs text-white/60 truncate">{product?.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-4"
        >
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
            <Users className="text-blue-400 mb-2" size={24} />
            <p className="text-3xl font-bold text-white" data-testid="total-followers">{totalFollowers}</p>
            <p className="text-white/60 text-sm">Total Supporters</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
            <DollarSign className="text-green-400 mb-2" size={24} />
            <p className="text-3xl font-bold text-white" data-testid="total-support">
              ${totalSupport.toLocaleString()}
            </p>
            <p className="text-white/60 text-sm">Community Backing</p>
          </div>
        </motion.div>

        {/* Tier Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="text-secondary" size={20} />
            <h2 className="text-lg font-bold text-white">Insight Tiers</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {TIERS.map((tier) => {
              const isCurrent = currentTier === tier.key;
              const isFree = tier.key === 'free';
              return (
                <div
                  key={tier.key}
                  className={`rounded-xl p-4 border-2 transition-all ${tier.color} ${
                    isCurrent ? 'ring-2 ring-secondary' : ''
                  }`}
                  data-testid={`tier-${tier.key}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-bold">{tier.label}</h3>
                    {isCurrent && <span className="text-xs bg-secondary text-primary px-2 py-0.5 rounded-full font-semibold">Active</span>}
                  </div>
                  <p className="text-2xl font-bold text-white mb-3">
                    {tier.price === 0 ? 'Free' : `$${tier.price}`}
                  </p>
                  <ul className="text-white/70 text-xs space-y-1 mb-4 min-h-[60px]">
                    {tier.perks.map((p, i) => (
                      <li key={i}>• {p}</li>
                    ))}
                  </ul>
                  {isFree ? (
                    <button
                      onClick={() => loadInsights('free')}
                      className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium transition-all"
                    >
                      View Free
                    </button>
                  ) : isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2 bg-secondary/30 rounded-lg text-secondary text-sm font-medium"
                    >
                      Unlocked
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnlock(tier.key)}
                      disabled={unlocking}
                      className="w-full py-2 bg-gradient-to-r from-secondary to-yellow-500 text-primary rounded-lg text-sm font-semibold transition-all hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-1"
                      data-testid={`unlock-${tier.key}`}
                    >
                      <Unlock size={14} />
                      Unlock ${tier.price}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Followers List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20"
        >
          <div className="flex items-center gap-2 mb-4">
            <Eye className="text-secondary" size={20} />
            <h2 className="text-lg font-bold text-white">Supporter Directory</h2>
          </div>

          {currentTier === 'free' ? (
            <div className="text-center py-10 bg-white/5 rounded-xl">
              <Lock className="mx-auto mb-3 text-white/40" size={40} />
              <p className="text-white font-medium mb-1">Supporter details are locked</p>
              <p className="text-white/60 text-sm mb-4">
                {insights?.unlock_message || 'Unlock a higher tier to see supporter info'}
              </p>
            </div>
          ) : followers.length === 0 ? (
            <p className="text-center text-white/60 py-8">No supporters yet</p>
          ) : (
            <div className="space-y-2">
              {followers.map((f, idx) => (
                <div
                  key={f.id || idx}
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
                  data-testid={`follower-row-${idx}`}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-secondary to-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="text-white" size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{f.name}</p>
                    <div className="flex items-center gap-3 text-white/60 text-xs mt-0.5">
                      {f.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail size={12} />
                          {f.email}
                        </span>
                      )}
                      {currentTier === 'pro' && f.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {f.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {currentTier === 'basic' && totalFollowers > followers.length && (
                <div className="text-center py-4 border-t border-white/10 mt-3">
                  <p className="text-white/60 text-sm mb-2">
                    Showing {followers.length} of {totalFollowers} supporters
                  </p>
                  <button
                    onClick={() => handleUnlock('pro')}
                    disabled={unlocking}
                    className="text-secondary font-medium text-sm hover:underline"
                  >
                    Unlock Pro to see all →
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Compliance Footer */}
        <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-4">
          <p className="text-white/70 text-xs">
            <strong className="text-secondary">Privacy Notice:</strong> Supporter data is shared only for product updates and community engagement.
            Keep contact info confidential and respect their opt-in preferences.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AudienceInsightsPage;
