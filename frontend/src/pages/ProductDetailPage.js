import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  Users, 
  Clock, 
  DollarSign, 
  Heart,
  Share2,
  ArrowLeft,
  Calendar,
  Target,
  Lightbulb,
  User,
  Mail,
  Phone,
  Check,
  AlertCircle
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { useCurrency } from '../context/CurrencyContext';

const ProductDetailPage = ({ user }) => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { format, premiumUnlocked } = useCurrency();
  const [product, setProduct] = useState(null);
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [supportAmount, setSupportAmount] = useState('');
  const [supportNote, setSupportNote] = useState('');
  const [followerData, setFollowerData] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sharing, setSharing] = useState(false);

  const shareProduct = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const r = await axiosInstance.post(`/products/${productId}/share`, {});
      const url = r.data.url;
      const text = `${r.data.title} · Network Capital`;
      if (navigator.share) {
        try { await navigator.share({ title: text, url }); } catch { /* user cancelled */ }
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Product link copied to clipboard');
      }
      if (r.data.awarded > 0) toast.success(`+${r.data.awarded} points for sharing!`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not share');
    } finally {
      setSharing(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const res = await axiosInstance.get(`/products/${productId}`);
      setProduct(res.data.product);
      setCreator(res.data.creator);
    } catch (error) {
      toast.error('Product not found');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const handleSupport = async () => {
    if (!user) {
      toast.error('Please login to support this product');
      return;
    }

    setSubmitting(true);
    try {
      await axiosInstance.post(`/products/${productId}/support`, {
        amount: parseFloat(supportAmount),
        note: supportNote
      });
      toast.success('Support contribution recorded!');
      setShowSupportModal(false);
      setSupportAmount('');
      setSupportNote('');
      fetchProduct();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit support');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFollow = async () => {
    setSubmitting(true);
    try {
      await axiosInstance.post(`/products/${productId}/follow`, followerData);
      toast.success('You are now a supporter!');
      setShowFollowModal(false);
      setFollowerData({ name: '', email: '', phone: '' });
      fetchProduct();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to register');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) return null;

  const isPending = product.status === 'pending_review';
  const isCreator = user && user.id === product.creator_id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a1628]/95 backdrop-blur-lg border-b border-white/10 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="text-white" size={20} />
          </button>
          <h1 className="text-lg font-bold text-white">Product Details</h1>
          <button
            onClick={shareProduct}
            disabled={sharing}
            data-testid="product-share-button"
            className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
          >
            <Share2 className="text-white" size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {/* Status Banner */}
        {isPending && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 flex items-center gap-3"
          >
            <AlertCircle className="text-yellow-400" size={24} />
            <div>
              <p className="text-yellow-400 font-medium">Pending Review</p>
              <p className="text-yellow-400/70 text-sm">This product is awaiting moderation approval (24-72 hours)</p>
            </div>
          </motion.div>
        )}

        {/* Product Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
        >
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-secondary to-primary rounded-2xl flex items-center justify-center">
              <Package className="text-white" size={32} />
            </div>
            <div className="flex-1">
              <span className="text-secondary text-xs font-medium uppercase tracking-wide">
                {product.category}
              </span>
              <h1 className="text-2xl font-bold text-white mt-1">{product.name}</h1>
              <p className="text-white/60 text-sm mt-1">by {product.creator_name}</p>
            </div>
          </div>

          {product.description && (
            <p className="text-white/80 mb-4">{product.description}</p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-secondary">${product.estimated_cost?.toLocaleString()}</p>
              <p className="text-white/50 text-xs">Est. Cost</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-white">{product.total_supporters || 0}</p>
              <p className="text-white/50 text-xs">Supporters</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-400">${product.total_support_amount?.toLocaleString() || '0'}</p>
              <p className="text-white/50 text-xs">Total Support</p>
            </div>
          </div>
        </motion.div>

        {/* Problem & Solution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
        >
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Lightbulb className="text-secondary" size={20} />
            Problem & Solution
          </h2>
          <p className="text-white/80 leading-relaxed">{product.problem_solved}</p>
        </motion.div>

        {/* Details Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-4"
        >
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <Clock className="text-white/60 mb-2" size={20} />
            <p className="text-white font-medium capitalize">{product.timeline?.replace('_', ' ')}</p>
            <p className="text-white/50 text-xs">Timeline</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <Target className="text-white/60 mb-2" size={20} />
            <p className="text-white font-medium capitalize">{product.interest_level?.replace('_', ' ')}</p>
            <p className="text-white/50 text-xs">Current Stage</p>
          </div>
          {product.release_date && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 col-span-2">
              <Calendar className="text-white/60 mb-2" size={20} />
              <p className="text-white font-medium">{new Date(product.release_date).toLocaleDateString()}</p>
              <p className="text-white/50 text-xs">Expected Release</p>
            </div>
          )}
        </motion.div>

        {/* Support Range */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-secondary/10 border border-secondary/30 rounded-xl p-4"
        >
          <p className="text-white text-sm">
            <strong className="text-secondary">Support Range:</strong> {format(product.min_support)} - {format(product.max_support)} per contribution
          </p>
          <p className="text-white/60 text-xs mt-1">
            Support is community backing, not an investment. No returns or profit-sharing offered.
          </p>
        </motion.div>

        {/* Action Buttons */}
        {!isPending && !isCreator && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowFollowModal(true)}
              className="flex-1 py-4 bg-white/10 hover:bg-white/20 rounded-xl text-white font-semibold transition-all flex items-center justify-center gap-2 border border-white/20"
            >
              <Heart size={20} />
              Follow Product
            </button>
            {user && (
              <button
                onClick={() => {
                  if (!premiumUnlocked) { toast.error('Unlock premium to back products'); return; }
                  setShowSupportModal(true);
                }}
                className="flex-1 py-4 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                data-testid="support-product"
              >
                <DollarSign size={20} />
                Support
              </button>
            )}
          </div>
        )}

        {isCreator && (
          <button
            onClick={() => navigate(`/products/${productId}/insights`)}
            className="w-full py-4 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Users size={20} />
            View Audience Insights
          </button>
        )}
      </div>

      {/* Follow Modal */}
      {showFollowModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0a1628] rounded-2xl border border-white/20 max-w-md w-full p-6"
          >
            <h2 className="text-xl font-bold text-white mb-4">Join as Supporter</h2>
            <p className="text-white/60 text-sm mb-6">
              Register to follow this product and receive updates. The creator may contact you with news and opportunities.
            </p>

            <div className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <input
                  type="text"
                  value={followerData.name}
                  onChange={(e) => setFollowerData({ ...followerData, name: e.target.value })}
                  placeholder="Your Name"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <input
                  type="email"
                  value={followerData.email}
                  onChange={(e) => setFollowerData({ ...followerData, email: e.target.value })}
                  placeholder="Email Address"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <input
                  type="tel"
                  value={followerData.phone}
                  onChange={(e) => setFollowerData({ ...followerData, phone: e.target.value })}
                  placeholder="Phone Number"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowFollowModal(false)}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleFollow}
                disabled={!followerData.name || !followerData.email || submitting}
                className="flex-1 py-3 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {submitting ? 'Registering...' : 'Join'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0a1628] rounded-2xl border border-white/20 max-w-md w-full p-6"
          >
            <h2 className="text-xl font-bold text-white mb-4">Support This Product</h2>
            <p className="text-white/60 text-sm mb-2">
              Your wallet balance: <span className="text-secondary font-bold">{format(user?.wallet_balance || 0)}</span>
            </p>
            <p className="text-white/50 text-xs mb-6">
              Support range: {format(product.min_support)} - {format(product.max_support)}
            </p>

            <div className="space-y-4">
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <input
                  type="number"
                  value={supportAmount}
                  onChange={(e) => setSupportAmount(e.target.value)}
                  placeholder="Amount"
                  min={product.min_support}
                  max={product.max_support}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                />
              </div>
              <textarea
                value={supportNote}
                onChange={(e) => setSupportNote(e.target.value)}
                placeholder="Add a note (optional)"
                rows={3}
                className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none resize-none"
              />
            </div>

            <div className="bg-primary/30 rounded-xl p-3 mt-4 border border-primary/50">
              <p className="text-white/80 text-xs">
                Support contributions are community backing. This is not an investment and no returns are offered.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSupportModal(false)}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSupport}
                disabled={!supportAmount || submitting}
                className="flex-1 py-3 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Contribute'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ProductDetailPage;
