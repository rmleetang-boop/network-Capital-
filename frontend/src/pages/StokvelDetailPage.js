import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, TrendingUp, Plus, Activity, UserPlus, DollarSign, Award, Gift, Trophy, Package, Heart, ArrowRight, Zap, KeyRound, ShieldCheck, Check as CheckIcon, X as XIcon, Clock } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const StokvelDetailPage = ({ user }) => {
  const { stokvelId } = useParams();
  const navigate = useNavigate();
  const [stokvel, setStokvel] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [strength, setStrength] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGroupSupportModal, setShowGroupSupportModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [supportAmount, setSupportAmount] = useState('');
  const [supportNote, setSupportNote] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionNote, setContributionNote] = useState('');
  const [inviteUserId, setInviteUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Smart Access
  const [showSmartAccess, setShowSmartAccess] = useState(false);
  const [smartEligibility, setSmartEligibility] = useState(null);
  const [smartAmount, setSmartAmount] = useState('');

  // Multi-sig withdrawals
  const [withdrawals, setWithdrawals] = useState([]);
  const [signatories, setSignatories] = useState([]);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawDraft, setWithdrawDraft] = useState({ amount: '', purpose: '' });
  const [showSignatoriesModal, setShowSignatoriesModal] = useState(false);
  const [selectedSignatories, setSelectedSignatories] = useState([]);

  useEffect(() => {
    fetchStokvelData();
  }, [stokvelId]);

  const fetchStokvelData = async () => {
    try {
      const [stokvelRes, contributionsRes, strengthRes, productsRes, withdrawalsRes, smartRes] = await Promise.all([
        axiosInstance.get(`/stokvels/${stokvelId}`),
        axiosInstance.get(`/stokvels/${stokvelId}/contributions`),
        axiosInstance.get(`/stokvels/${stokvelId}/strength`),
        axiosInstance.get(`/products`),
        axiosInstance.get(`/stokvels/${stokvelId}/withdrawals`).catch(() => ({ data: { withdrawals: [], signatories: [] } })),
        axiosInstance.get(`/stokvels/${stokvelId}/smart-access-eligibility`).catch(() => ({ data: null })),
      ]);
      
      setStokvel(stokvelRes.data);
      setContributions(contributionsRes.data);
      setStrength(strengthRes.data);
      setProducts(productsRes.data.products || []);
      setWithdrawals(withdrawalsRes.data.withdrawals || []);
      setSignatories(withdrawalsRes.data.signatories || []);
      setSmartEligibility(smartRes.data);
    } catch (error) {
      toast.error('Failed to load stokvel details');
      navigate('/stokvels');
    } finally {
      setLoading(false);
    }
  };

  const handleSmartAccessRequest = async () => {
    const amount = parseFloat(smartAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setSubmitting(true);
    try {
      await axiosInstance.post(`/stokvels/${stokvelId}/smart-access`, { stokvel_id: stokvelId, requested_amount: amount });
      toast.success('Smart Access approved! Funds in wallet.');
      setShowSmartAccess(false);
      setSmartAmount('');
      fetchStokvelData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    } finally { setSubmitting(false); }
  };

  const handleCreateWithdrawal = async () => {
    const amount = parseFloat(withdrawDraft.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (!withdrawDraft.purpose.trim()) { toast.error('Purpose required'); return; }
    setSubmitting(true);
    try {
      await axiosInstance.post(`/stokvels/${stokvelId}/withdrawals`, { amount, purpose: withdrawDraft.purpose });
      toast.success('Withdrawal proposed — awaiting signatories');
      setShowWithdrawModal(false);
      setWithdrawDraft({ amount: '', purpose: '' });
      fetchStokvelData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    } finally { setSubmitting(false); }
  };

  const handleVoteWithdrawal = async (wid, vote) => {
    try {
      const res = await axiosInstance.post(`/stokvels/${stokvelId}/withdrawals/${wid}/${vote}`);
      toast.success(res.data.status === 'executed' ? 'Approved & executed!' : `Vote recorded (${res.data.status})`);
      fetchStokvelData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Vote failed');
    }
  };

  const handleSaveSignatories = async () => {
    if (selectedSignatories.length < 1 || selectedSignatories.length > 3) {
      toast.error('Pick 1–3 signatories'); return;
    }
    try {
      await axiosInstance.put(`/stokvels/${stokvelId}/signatories`, { signatory_ids: selectedSignatories });
      toast.success('Signatories updated');
      setShowSignatoriesModal(false);
      fetchStokvelData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    }
  };

  const openSignatoriesModal = () => {
    setSelectedSignatories(signatories.length > 0 ? [...signatories] : [stokvel?.created_by]);
    setShowSignatoriesModal(true);
  };

  const toggleSignatory = (userId) => {
    setSelectedSignatories((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : prev.length < 3 ? [...prev, userId] : prev
    );
  };

  const openGroupSupport = (product) => {
    setSelectedProduct(product);
    setSupportAmount(String(product.min_support || 10));
    setSupportNote('');
    setShowGroupSupportModal(true);
  };

  const handleGroupSupport = async () => {
    if (!selectedProduct) return;
    const amount = parseFloat(supportAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSubmitting(true);
    try {
      await axiosInstance.post(
        `/stokvels/${stokvelId}/support-product/${selectedProduct.id}`,
        { amount, note: supportNote }
      );
      toast.success('Group support recorded!');
      setShowGroupSupportModal(false);
      setSelectedProduct(null);
      setSupportAmount('');
      setSupportNote('');
      fetchStokvelData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to back product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContribute = async () => {
    if (!contributionAmount || parseFloat(contributionAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      await axiosInstance.post(`/stokvels/${stokvelId}/contribute`, {
        amount: parseFloat(contributionAmount),
        note: contributionNote,
      });
      
      toast.success('Contribution added! +15 points');
      setContributionAmount('');
      setContributionNote('');
      setShowContributeModal(false);
      fetchStokvelData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to contribute');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteUserId) {
      toast.error('Please enter a user ID');
      return;
    }

    setSubmitting(true);
    try {
      await axiosInstance.post(`/stokvels/${stokvelId}/invite`, {
        user_id: inviteUserId,
      });
      
      toast.success('Member invited successfully!');
      setInviteUserId('');
      setShowInviteModal(false);
      fetchStokvelData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to invite member');
    } finally {
      setSubmitting(false);
    }
  };

  const getStrengthConfig = () => {
    if (!strength) return { label: 'Low', color: 'text-red-600', bgColor: 'bg-red-50', barColor: 'bg-red-500' };
    
    if (strength.level === 'Low') return { label: 'Low', color: 'text-red-600', bgColor: 'bg-red-50', barColor: 'bg-red-500' };
    if (strength.level === 'Medium') return { label: 'Medium', color: 'text-yellow-600', bgColor: 'bg-yellow-50', barColor: 'bg-yellow-500' };
    if (strength.level === 'High') return { label: 'High', color: 'text-blue-600', bgColor: 'bg-blue-50', barColor: 'bg-blue-500' };
    return { label: 'Strong', color: 'text-secondary', bgColor: 'bg-secondary/10', barColor: 'bg-secondary' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!stokvel) return null;

  const strengthConfig = getStrengthConfig();
  const progress = stokvel.target_amount > 0 ? (stokvel.total_pool / stokvel.target_amount) * 100 : 0;
  const isCreator = stokvel.created_by === user.id;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-20">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/stokvels')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            data-testid="back-button"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-heading font-bold text-primary">{stokvel.name}</h1>
            <p className="text-xs text-text-secondary">{stokvel.payout_cycle} Payout</p>
          </div>
          <div className={`px-3 py-1 rounded-full ${strengthConfig.bgColor}`}>
            <span className={`text-xs font-semibold ${strengthConfig.color}`}>
              {strengthConfig.label}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-lg p-6 text-white"
        >
          <div className="text-center mb-4">
            <p className="text-white/80 text-sm mb-1">Total Pool</p>
            <p className="text-5xl font-bold tracking-tighter">R{stokvel.total_pool.toFixed(2)}</p>
            <p className="text-white/70 text-sm mt-1">Target: R{stokvel.target_amount.toFixed(2)}</p>
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between text-sm text-white/90 mb-2">
              <span>Progress</span>
              <span>{Math.min(progress, 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-white rounded-full shadow-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={() => setShowContributeModal(true)}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-medium py-3 rounded-full transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Contribute
            </button>
            {isCreator && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-medium py-3 rounded-full transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <UserPlus size={18} />
                Invite
              </button>
            )}
          </div>
        </motion.div>

        {strength && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Activity className="text-primary" size={20} />
              <h2 className="text-lg font-heading font-bold text-text-primary">Group Strength</h2>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-2xl font-bold ${strengthConfig.color}`}>{strengthConfig.label}</span>
                <span className="text-lg font-semibold text-text-primary">{strength.score}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full ${strengthConfig.barColor} transition-all duration-500 rounded-full`}
                  style={{ width: `${strength.score}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-background-subtle rounded-xl">
                <p className="text-lg font-bold text-text-primary">{strength.member_count}</p>
                <p className="text-xs text-text-muted">Members</p>
              </div>
              <div className="text-center p-3 bg-background-subtle rounded-xl">
                <p className="text-lg font-bold text-text-primary">{strength.total_contributions}</p>
                <p className="text-xs text-text-muted">Contributions</p>
              </div>
              <div className="text-center p-3 bg-background-subtle rounded-xl">
                <p className="text-lg font-bold text-text-primary">{strength.pool_progress}%</p>
                <p className="text-xs text-text-muted">Pool Progress</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Access Links for Score, Rewards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-3 gap-3"
        >
          <button
            onClick={() => navigate(`/stokvels/${stokvelId}/score`)}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all text-center"
            data-testid="view-my-score"
          >
            <Award className="mx-auto mb-2 text-primary" size={24} />
            <p className="text-sm font-semibold text-text-primary">My Score</p>
          </button>
          <button
            onClick={() => navigate(`/stokvels/${stokvelId}/rewards`)}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all text-center"
            data-testid="view-my-rewards"
          >
            <Gift className="mx-auto mb-2 text-secondary" size={24} />
            <p className="text-sm font-semibold text-text-primary">Rewards</p>
          </button>
          <button
            onClick={() => navigate('/leaderboards')}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all text-center"
            data-testid="view-leaderboards"
          >
            <Trophy className="mx-auto mb-2 text-accent-gold" size={24} />
            <p className="text-sm font-semibold text-text-primary">Leaders</p>
          </button>
        </motion.div>

        {/* Smart Access Card */}
        {smartEligibility && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
            data-testid="smart-access-card"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-heading font-bold text-text-primary flex items-center gap-2">
                <Zap className="text-secondary" size={20} />
                Smart Access
              </h2>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                smartEligibility.eligible ? 'bg-secondary/10 text-secondary' : 'bg-gray-100 text-text-muted'
              }`}>
                {smartEligibility.eligible ? 'Eligible' : 'Not yet'}
              </span>
            </div>

            <p className="text-xs text-text-secondary mb-3">
              Early access to your own pooled savings. Not a loan — no interest, no debt.
            </p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-background-subtle rounded-xl p-3 text-center">
                <p className="text-base font-bold text-text-primary">{smartEligibility.user_score?.toFixed(0)}</p>
                <p className="text-[10px] text-text-muted uppercase">Score</p>
              </div>
              <div className="bg-background-subtle rounded-xl p-3 text-center">
                <p className="text-base font-bold text-text-primary capitalize">{smartEligibility.tier}</p>
                <p className="text-[10px] text-text-muted uppercase">Tier</p>
              </div>
              <div className="bg-background-subtle rounded-xl p-3 text-center">
                <p className="text-base font-bold text-secondary">${smartEligibility.max_access_amount?.toFixed(0)}</p>
                <p className="text-[10px] text-text-muted uppercase">Max ({smartEligibility.access_percentage}%)</p>
              </div>
            </div>

            <button
              onClick={() => setShowSmartAccess(true)}
              disabled={!smartEligibility.eligible || smartEligibility.max_access_amount <= 0}
              className="w-full py-3 bg-gradient-to-r from-secondary to-yellow-500 text-white font-semibold rounded-full disabled:opacity-50 disabled:bg-gray-200 disabled:bg-none disabled:text-text-muted flex items-center justify-center gap-2"
              data-testid="open-smart-access"
            >
              <Zap size={16} /> Request Smart Access
            </button>
            {!smartEligibility.eligible && (
              <p className="text-xs text-text-muted text-center mt-2">{smartEligibility.reason}</p>
            )}
          </motion.div>
        )}

        {/* Multi-sig Withdrawals Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
          data-testid="withdrawals-card"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-heading font-bold text-text-primary flex items-center gap-2">
              <ShieldCheck className="text-primary" size={20} />
              Group Withdrawals
            </h2>
            {isCreator && (
              <button
                onClick={openSignatoriesModal}
                className="text-xs text-primary hover:text-primary-hover font-medium flex items-center gap-1"
                data-testid="manage-signatories"
              >
                <KeyRound size={12} /> Signatories ({signatories.length || 1})
              </button>
            )}
          </div>

          <p className="text-xs text-text-secondary mb-3">
            Group-pool withdrawals require multi-signature approval. {signatories.length > 1 ? `2 of ${signatories.length} signatories must approve.` : 'Single signatory mode (creator).'}
          </p>

          <button
            onClick={() => setShowWithdrawModal(true)}
            className="w-full py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary font-medium rounded-full flex items-center justify-center gap-2 mb-4"
            data-testid="propose-withdrawal"
          >
            <Plus size={16} /> Propose Withdrawal
          </button>

          {withdrawals.length === 0 ? (
            <p className="text-center text-text-muted text-sm py-3">No withdrawal proposals yet</p>
          ) : (
            <div className="space-y-2">
              {withdrawals.slice(0, 5).map((w) => {
                const myUserId = user?.id;
                const isSig = (w.signatories || []).includes(myUserId);
                const hasVoted = (w.approvals || []).includes(myUserId) || (w.rejections || []).includes(myUserId);
                const statusColor = w.status === 'executed' ? 'green' : w.status === 'rejected' ? 'red' : 'yellow';
                return (
                  <div key={w.id} className="border border-gray-100 rounded-xl p-3" data-testid={`withdrawal-${w.id}`}>
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-semibold text-text-primary text-sm">${w.amount.toFixed(2)}</p>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-${statusColor}-100 text-${statusColor}-700`}>
                        {w.status}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mb-1">"{w.purpose}"</p>
                    <p className="text-[10px] text-text-muted mb-2">
                      by @{w.requester_username} · {w.approvals?.length || 0}/{w.required_approvals} approvals
                    </p>
                    {w.status === 'pending' && isSig && !hasVoted && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVoteWithdrawal(w.id, 'reject')}
                          className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg flex items-center justify-center gap-1"
                          data-testid={`reject-withdrawal-${w.id}`}
                        >
                          <XIcon size={12} /> Reject
                        </button>
                        <button
                          onClick={() => handleVoteWithdrawal(w.id, 'approve')}
                          className="flex-1 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium rounded-lg flex items-center justify-center gap-1"
                          data-testid={`approve-withdrawal-${w.id}`}
                        >
                          <CheckIcon size={12} /> Approve
                        </button>
                      </div>
                    )}
                    {w.status === 'pending' && isSig && hasVoted && (
                      <p className="text-[10px] text-text-muted flex items-center gap-1"><Clock size={10} /> Awaiting other signatories</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
        >
          <h2 className="text-lg font-heading font-bold text-text-primary mb-4 flex items-center gap-2">
            <Users size={20} />
            Members ({stokvel.members.length})
          </h2>
          <div className="space-y-3">
            {stokvel.members.map((member, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-background-subtle rounded-xl">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={member.photo} />
                  <AvatarFallback>{member.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold text-text-primary">{member.username}</p>
                  <p className="text-sm text-text-secondary">
                    Contributed: R{member.total_contributed.toFixed(2)}
                  </p>
                </div>
                {member.user_id === stokvel.created_by && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                    Creator
                  </span>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
          data-testid="opportunities-to-support"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-text-primary flex items-center gap-2">
              <Package size={20} />
              Opportunities to Support
            </h2>
            <button
              onClick={() => navigate('/products')}
              className="text-primary text-sm font-medium hover:underline flex items-center gap-1"
            >
              Explore all <ArrowRight size={14} />
            </button>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-6 bg-background-subtle rounded-xl">
              <Package className="mx-auto mb-2 text-text-muted" size={32} />
              <p className="text-text-secondary text-sm">
                No products available for group support yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.slice(0, 3).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-background-subtle transition-all"
                  data-testid={`opportunity-${product.id}`}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                    <Package className="text-white" size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-primary text-sm truncate">{product.name}</p>
                    <p className="text-xs text-text-muted truncate">by {product.creator_name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {product.total_supporters || 0}
                      </span>
                      <span className="text-primary font-medium">
                        ${product.min_support}-${product.max_support}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => navigate(`/products/${product.id}`)}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      View
                    </button>
                    <button
                      onClick={() => openGroupSupport(product)}
                      className="bg-secondary hover:bg-secondary-hover text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1"
                      data-testid={`back-product-${product.id}`}
                    >
                      <Heart size={12} />
                      Back
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-3 bg-primary/5 rounded-xl border border-primary/10">
            <p className="text-xs text-text-secondary">
              <strong className="text-primary">Group Backing:</strong> Members can agree to support an approved product from the Stokvel pool.
              This is community contribution, not an investment — no returns are offered.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
        >
          <h2 className="text-lg font-heading font-bold text-text-primary mb-4 flex items-center gap-2">
            <TrendingUp size={20} />
            Recent Contributions
          </h2>
          <div className="space-y-3">
            {contributions.slice(0, 10).map((contribution) => (
              <div key={contribution.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={contribution.user_photo} />
                  <AvatarFallback>{contribution.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold text-text-primary text-sm">{contribution.username}</p>
                  <p className="text-xs text-text-secondary">
                    {new Date(contribution.created_at).toLocaleDateString()}
                  </p>
                  {contribution.note && (
                    <p className="text-xs text-text-muted mt-1">{contribution.note}</p>
                  )}
                </div>
                <p className="text-lg font-bold text-secondary">+R{contribution.amount.toFixed(2)}</p>
              </div>
            ))}
            {contributions.length === 0 && (
              <p className="text-center text-text-secondary py-8">No contributions yet</p>
            )}
          </div>
        </motion.div>
      </div>

      {showContributeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowContributeModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-heading font-bold mb-4">Contribute Funds</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-primary mb-2">Amount (R)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                <input
                  type="number"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="100.00"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-text-primary mb-2">Note (optional)</label>
              <textarea
                value={contributionNote}
                onChange={(e) => setContributionNote(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                placeholder="Add a note..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowContributeModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-text-primary font-medium py-3 rounded-full transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleContribute}
                disabled={submitting}
                className="flex-1 bg-primary hover:bg-primary-hover text-white font-medium py-3 rounded-full transition-all active:scale-95 disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Contribute (+15 pts)'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowInviteModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-heading font-bold mb-4">Invite Member</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-primary mb-2">User ID</label>
              <input
                type="text"
                value={inviteUserId}
                onChange={(e) => setInviteUserId(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="Enter user ID to invite"
              />
              <p className="text-xs text-text-muted mt-2">Tip: Users can find their ID in their profile</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-text-primary font-medium py-3 rounded-full transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={submitting}
                className="flex-1 bg-primary hover:bg-primary-hover text-white font-medium py-3 rounded-full transition-all active:scale-95 disabled:opacity-50"
              >
                {submitting ? 'Inviting...' : 'Invite'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showGroupSupportModal && selectedProduct && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowGroupSupportModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
            data-testid="group-support-modal"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                <Package className="text-white" size={22} />
              </div>
              <div>
                <h2 className="text-lg font-heading font-bold">Back from Group Pool</h2>
                <p className="text-sm text-text-secondary">{selectedProduct.name}</p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-background-subtle rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Group pool</span>
                <span className="font-semibold text-text-primary">
                  R{stokvel?.total_pool?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-text-secondary">Allowed range</span>
                <span className="font-semibold text-text-primary">
                  ${selectedProduct.min_support} - ${selectedProduct.max_support}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-text-primary mb-2">Amount ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                <input
                  type="number"
                  value={supportAmount}
                  onChange={(e) => setSupportAmount(e.target.value)}
                  min={selectedProduct.min_support}
                  max={selectedProduct.max_support}
                  step="0.01"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="10.00"
                  data-testid="group-support-amount"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-text-primary mb-2">Note (optional)</label>
              <textarea
                value={supportNote}
                onChange={(e) => setSupportNote(e.target.value)}
                rows={2}
                className="w-full p-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                placeholder="Why are we backing this?"
              />
            </div>

            <div className="bg-primary/5 rounded-xl p-3 mb-4 border border-primary/10">
              <p className="text-xs text-text-secondary">
                Group contribution. No returns or profit sharing — pure community backing.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowGroupSupportModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-text-primary font-medium py-3 rounded-full transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleGroupSupport}
                disabled={submitting}
                className="flex-1 bg-secondary hover:bg-secondary-hover text-white font-medium py-3 rounded-full transition-all active:scale-95 disabled:opacity-50"
                data-testid="confirm-group-support"
              >
                {submitting ? 'Submitting...' : 'Back from Pool'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {showSmartAccess && smartEligibility && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSmartAccess(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
            data-testid="smart-access-modal"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center">
                <Zap className="text-secondary" size={22} />
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold">Smart Access</h2>
                <p className="text-sm text-text-secondary">Early access to your pooled funds</p>
              </div>
            </div>

            <div className="bg-secondary/10 rounded-xl p-3 mb-4 text-xs text-text-secondary">
              You can access up to <strong className="text-secondary">${smartEligibility.max_access_amount?.toFixed(2)}</strong> ({smartEligibility.access_percentage}% of contributions). Future rewards reduced by 30% until replenished.
            </div>

            <label className="block text-sm font-medium text-text-primary mb-2">Amount ($)</label>
            <div className="relative mb-4">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
              <input
                type="number"
                value={smartAmount}
                onChange={(e) => setSmartAmount(e.target.value)}
                min="1"
                max={smartEligibility.max_access_amount}
                step="0.01"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-primary"
                placeholder="100.00"
                data-testid="smart-access-amount"
              />
            </div>

            <p className="text-[10px] text-text-muted mb-4">
              <strong>Compliance:</strong> This is NOT a loan. You're accessing your own savings early.
            </p>

            <div className="flex gap-3">
              <button onClick={() => setShowSmartAccess(false)} className="flex-1 py-3 bg-gray-100 rounded-full font-medium">Cancel</button>
              <button
                onClick={handleSmartAccessRequest}
                disabled={submitting}
                className="flex-1 py-3 bg-secondary hover:bg-secondary-hover text-white font-semibold rounded-full disabled:opacity-50"
                data-testid="confirm-smart-access"
              >
                {submitting ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowWithdrawModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
            data-testid="withdraw-modal"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <ShieldCheck className="text-primary" size={22} />
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold">Propose Withdrawal</h2>
                <p className="text-sm text-text-secondary">Requires {signatories.length > 1 ? `2 of ${signatories.length}` : '1'} signatory approval</p>
              </div>
            </div>

            <label className="block text-sm font-medium text-text-primary mb-2">Amount ($)</label>
            <div className="relative mb-4">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
              <input
                type="number"
                value={withdrawDraft.amount}
                onChange={(e) => setWithdrawDraft({ ...withdrawDraft, amount: e.target.value })}
                min="1"
                step="0.01"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-primary"
                placeholder="500.00"
                data-testid="withdraw-amount"
              />
              <p className="text-[10px] text-text-muted mt-1">Pool balance: R{stokvel?.total_pool?.toFixed(2)}</p>
            </div>

            <label className="block text-sm font-medium text-text-primary mb-2">Purpose</label>
            <textarea
              value={withdrawDraft.purpose}
              onChange={(e) => setWithdrawDraft({ ...withdrawDraft, purpose: e.target.value })}
              rows={3}
              placeholder="Why is this withdrawal needed?"
              className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:border-primary resize-none"
              data-testid="withdraw-purpose"
            />

            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowWithdrawModal(false)} className="flex-1 py-3 bg-gray-100 rounded-full font-medium">Cancel</button>
              <button
                onClick={handleCreateWithdrawal}
                disabled={submitting}
                className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-full disabled:opacity-50"
                data-testid="confirm-withdraw"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showSignatoriesModal && stokvel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSignatoriesModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
            data-testid="signatories-modal"
          >
            <h2 className="text-xl font-heading font-bold mb-2 flex items-center gap-2">
              <KeyRound size={20} /> Manage Signatories
            </h2>
            <p className="text-sm text-text-secondary mb-4">
              Pick 1–3 trusted members. Withdrawals require {selectedSignatories.length >= 2 ? '2-of-' + selectedSignatories.length : 'one'} approval.
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto mb-4">
              {stokvel.members.map((m) => {
                const checked = selectedSignatories.includes(m.user_id);
                return (
                  <label
                    key={m.user_id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      checked ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid={`signatory-${m.user_id}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSignatory(m.user_id)}
                      className="w-4 h-4 accent-primary"
                    />
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={m.photo} />
                      <AvatarFallback>{m.username[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 font-medium text-text-primary">{m.username}</span>
                    {m.user_id === stokvel.created_by && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">Creator</span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowSignatoriesModal(false)} className="flex-1 py-3 bg-gray-100 rounded-full font-medium">Cancel</button>
              <button
                onClick={handleSaveSignatories}
                className="flex-1 py-3 bg-primary text-white font-semibold rounded-full"
                data-testid="save-signatories"
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default StokvelDetailPage;
