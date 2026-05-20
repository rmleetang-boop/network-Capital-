import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Target, Calendar, FileText, DollarSign, Hourglass } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const CreateStokvelPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [flagLoading, setFlagLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_amount: '',
    payout_cycle: 'Monthly',
    purpose: 'savings',
  });

  useEffect(() => {
    axiosInstance.get('/feature-flags')
      .then((r) => setEnabled(!!r.data?.stokvel_plus_enabled))
      .catch(() => setEnabled(false))
      .finally(() => setFlagLoading(false));
  }, []);

  if (flagLoading) {
    return <div className="min-h-screen flex items-center justify-center text-text-muted">Loading…</div>;
  }
  if (!enabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] text-white flex items-center justify-center p-6" data-testid="stokvel-coming-soon">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-secondary/20 flex items-center justify-center mb-5">
            <Hourglass size={28} className="text-secondary" />
          </div>
          <h1 className="font-heading font-bold text-3xl mb-2">Stokvel+ is coming soon</h1>
          <p className="text-white/70 text-sm leading-relaxed mb-6">
            We're putting the finishing touches on Stokvel+ — collective participation circles with shared access,
            multi-currency support, and group governance. Creation and registration will be enabled at launch.
          </p>
          <p className="text-secondary text-xs uppercase tracking-widest font-bold mb-6">Notify members on launch day</p>
          <button
            onClick={() => navigate('/stokvels')}
            className="bg-secondary text-primary font-bold px-6 py-3 rounded-full inline-flex items-center gap-2 active:scale-95"
            data-testid="stokvel-coming-soon-back">
            <ArrowLeft size={14} /> Back to Stokvels
          </button>
        </div>
      </div>
    );
  }

  const PURPOSES = [
    { v: 'savings', label: 'Savings', emoji: '💰', desc: 'Build wealth together — classic Stokvel.' },
    { v: 'holiday', label: 'Holiday', emoji: '🌴', desc: 'Pool funds for a group getaway.' },
    { v: 'event', label: 'Event / Night Out', emoji: '🎉', desc: 'Plan a dinner, party, or celebration.' },
    { v: 'gift', label: 'Group Gift', emoji: '🎁', desc: 'Buy a meaningful gift, together.' },
    { v: 'group_trip', label: 'Group Trip', emoji: '✈️', desc: 'Plan a trip with friends — flights, stays, activities.' },
    { v: 'wedding', label: 'Wedding', emoji: '💍', desc: 'Coordinate contributions for a wedding.' },
    { v: 'funeral', label: 'Funeral', emoji: '🕯️', desc: 'Family-led pool to honour and support.' },
    { v: 'other', label: 'Other', emoji: '✨', desc: "Custom purpose — describe it in the description." },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.target_amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await axiosInstance.post('/stokvels', {
        ...formData,
        target_amount: parseFloat(formData.target_amount),
      });
      
      toast.success('Stokvel created! +50 points');
      navigate(`/stokvels/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create stokvel');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-background-DEFAULT">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/stokvels')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            data-testid="back-button"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-heading font-bold text-primary">Create Stokvel+</h1>
            <p className="text-sm text-text-secondary">Pool money together for any shared goal</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5"
        >
          {/* Purpose selector — Stokvel+ is for any shared goal, not just savings */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              What's this Stokvel+ for? *
            </label>
            <div className="grid grid-cols-2 gap-2" data-testid="stokvel-purpose-grid">
              {PURPOSES.map((p) => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setFormData({ ...formData, purpose: p.v })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    formData.purpose === p.v
                      ? 'bg-secondary/15 border-secondary text-text-primary ring-2 ring-secondary/40'
                      : 'bg-background-subtle border-gray-200 text-text-primary hover:bg-gray-50'
                  }`}
                  data-testid={`stokvel-purpose-${p.v}`}
                >
                  <p className="font-semibold text-sm">{p.emoji} {p.label}</p>
                  <p className="text-[11px] text-text-secondary mt-0.5 leading-tight">{p.desc}</p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-text-secondary mt-2">
              Friends pooling for any shared goal — holiday, night out, group gift, classic savings, or anything else.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Stokvel Name *
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="e.g., Family Savings Circle"
                data-testid="stokvel-name-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Description
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 text-text-muted" size={20} />
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                placeholder="Describe the purpose of this stokvel..."
                data-testid="stokvel-description-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Target Amount (R) *
            </label>
            <div className="relative">
              <Target className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
              <input
                type="number"
                name="target_amount"
                value={formData.target_amount}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="10000.00"
                data-testid="target-amount-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Payout Cycle
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
              <select
                name="payout_cycle"
                value={formData.payout_cycle}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none bg-white"
                data-testid="payout-cycle-select"
              >
                <option value="Weekly">Weekly</option>
                <option value="Bi-weekly">Bi-weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
              </select>
            </div>
          </div>

          <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
            <h4 className="font-semibold text-text-primary mb-2 flex items-center gap-2">
              <DollarSign className="text-secondary" size={18} />
              Score Rewards
            </h4>
            <ul className="text-sm text-text-secondary space-y-1">
              <li>• Create Stokvel+: <span className="font-semibold text-primary">+50 points</span></li>
              <li>• Contribute funds: <span className="font-semibold text-primary">+15 points</span> per contribution</li>
              <li>• Invite members: <span className="font-semibold text-primary">+20 points</span> per member</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-medium py-3 rounded-full shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="create-stokvel-submit"
          >
            {loading ? 'Creating...' : 'Create Stokvel (+50 pts)'}
          </button>
        </motion.form>
      </div>
    </div>
  );
};

export default CreateStokvelPage;