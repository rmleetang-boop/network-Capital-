import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Plus, TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, Banknote } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { useCurrency } from '../context/CurrencyContext';
import CurrencySwitcher from '../components/CurrencySwitcher';
import PremiumPaywall from '../components/PremiumPaywall';
import FeatureIntroModal from '../components/FeatureIntroModal';
import WithdrawalRequestModal from '../components/WithdrawalRequestModal';

const WalletPage = ({ user }) => {
  const { format, premiumUnlocked } = useCurrency();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  useEffect(() => {
    fetchWalletData();
    axiosInstance.get('/payouts/status').then((r) => setPayoutLock(r.data)).catch(() => {});
  }, []);

  const fetchWalletData = async () => {
    setLoading(true);
    // Fetch independently so a failure in /wallet/transactions doesn't blank the page.
    let walletOk = false;
    try {
      const r = await axiosInstance.get('/wallet');
      setWallet(r.data);
      walletOk = true;
    } catch (error) {
      // Network/auth blip — leave wallet null so the error UI renders with Retry.
      // Console-log so it shows up in production crash diagnostics without a noisy toast.
      console.error('[wallet] fetch failed:', error?.response?.status, error?.response?.data);
    }
    try {
      const r = await axiosInstance.get('/wallet/transactions');
      setTransactions(Array.isArray(r.data) ? r.data : []);
    } catch (error) {
      // Transactions are optional — fall back to empty list so the page still renders.
      setTransactions([]);
      console.error('[wallet] transactions fetch failed:', error?.response?.status);
    }
    if (!walletOk) {
      // Only toast the user if BOTH attempts gave nothing they can act on.
      toast.error('Failed to load wallet data');
    }
    setLoading(false);
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      await axiosInstance.post('/wallet/deposit', {
        amount: parseFloat(depositAmount),
      });
      toast.success('Funds added successfully!');
      setDepositAmount('');
      setShowDepositModal(false);
      fetchWalletData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add funds');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Defensive: API errors should NOT crash the page. Render a friendly retry state.
  if (!wallet) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center" data-testid="wallet-error-state">
        <Wallet size={32} className="text-text-muted mb-2" />
        <p className="font-bold text-text-primary mb-1">Could not load your wallet</p>
        <p className="text-sm text-text-muted mb-4">Please check your connection and try again.</p>
        <button onClick={fetchWalletData} className="bg-primary text-white font-bold px-5 py-2.5 rounded-full text-sm" data-testid="wallet-retry">Retry</button>
      </div>
    );
  }

  const balance = Number(wallet?.balance ?? 0);
  const totalEarned = Number(wallet?.total_earned ?? 0);
  const totalSpent = Number(wallet?.total_spent ?? 0);

  return (
    <div className="min-h-screen bg-background-DEFAULT">
      <FeatureIntroModal
        featureKey="wallet"
        icon={<Wallet size={20} />}
        title="Your Wallet"
        subtitle="Track funds, premium-tier access, and your contribution history."
        bullets={[
          { icon: <Plus size={14} />, label: 'Add funds (Premium)', body: 'Premium members can top up to participate in Stokvels and pooled access.' },
          { icon: <TrendingUp size={14} />, label: 'Transparent ledger', body: 'Every contribution and shared-access disbursement is itemised below.' },
          { icon: <DollarSign size={14} />, label: 'Multi-currency', body: 'Switch displayed currency across 10 supported regions in the header.' },
        ]}
      />
      <div className="sticky top-0 z-10 dark-header px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/brand/logo-mark.png" 
              alt="Network Capital" 
              className="h-10 w-10 rounded-lg object-cover"
            />
            <div>
              <h1 className="text-xl font-heading font-bold text-white">Wallet</h1>
              <p className="text-xs text-white/60">Manage your funds</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (!premiumUnlocked) { toast.error('Unlock premium to add funds'); return; }
              setShowDepositModal(true);
            }}
            className="bg-secondary hover:bg-secondary-hover text-primary p-3 rounded-full shadow-md hover:shadow-lg active:scale-95 transition-all"
            data-testid="add-funds-button"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-text-secondary text-sm">Displayed in your chosen currency</p>
          <CurrencySwitcher compact testId="wallet-currency-switcher" />
        </div>

        {!premiumUnlocked && <PremiumPaywall featureName="wallet deposits" />}

        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary to-primary-light rounded-2xl shadow-lg p-6 text-white"
        >
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={24} />
            <p className="text-white/80 text-sm">Available Balance</p>
          </div>
          <p className="text-5xl font-bold tracking-tighter mb-6" data-testid="wallet-balance">
            {format(balance)}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} />
                <p className="text-xs text-white/80">Total Earned</p>
              </div>
              <p className="text-xl font-bold">{format(totalEarned)}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown size={16} />
                <p className="text-xs text-white/80">Total Spent</p>
              </div>
              <p className="text-xl font-bold">{format(totalSpent)}</p>
            </div>
          </div>
        </motion.div>

        {/* Request Withdrawal CTA */}
        <button
          onClick={() => setShowWithdrawModal(true)}
          className="w-full bg-white hover:bg-gray-50 border border-secondary/40 text-primary font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all"
          data-testid="open-withdrawal-modal">
          <Banknote size={18} className="text-secondary" />
          Request withdrawal
          <span className="text-[10px] font-semibold bg-secondary/15 text-primary px-2 py-0.5 rounded-full">24–48h</span>
        </button>

        {/* Important Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-secondary/10 border border-secondary/30 rounded-2xl p-4"
        >
          <h3 className="font-semibold text-text-primary mb-2 flex items-center gap-2">
            <DollarSign className="text-secondary" size={20} />
            Stokvel+ Fees
          </h3>
          <div className="text-sm text-text-secondary space-y-1">
            <p>• Creating a Stokvel+: <span className="font-semibold text-secondary">$10.00</span> activation fee</p>
            <p>• Joining a Stokvel+: <span className="font-semibold text-secondary">$2.00</span> membership fee</p>
            <p className="text-xs text-text-muted mt-2">Fees are one-time charges deducted from your wallet balance</p>
          </div>
        </motion.div>

        {/* Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
        >
          <h2 className="text-lg font-heading font-bold text-text-primary mb-4">
            Recent Transactions
          </h2>
          <div className="space-y-3">
            {transactions.map((transaction) => {
              const isDeposit = transaction.type === 'deposit';
              const isPositive = transaction.amount > 0;
              
              return (
                <div
                  key={transaction.id}
                  className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className={`p-2 rounded-full ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
                    {isPositive ? (
                      <ArrowUpRight className="text-green-600" size={20} />
                    ) : (
                      <ArrowDownRight className="text-red-600" size={20} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-text-primary text-sm">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-text-muted">
                      {new Date(transaction.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? '+' : ''}{format(Math.abs(transaction.amount))}
                  </p>
                </div>
              );
            })}
            {transactions.length === 0 && (
              <p className="text-center text-text-secondary py-8">No transactions yet</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDepositModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-heading font-bold mb-4">Add Funds</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-text-primary mb-2">
                Amount (USD)
              </label>
              <div className="relative">
                <DollarSign
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                  size={20}
                />
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="10.00"
                  data-testid="deposit-amount-input"
                />
              </div>
              <p className="text-xs text-text-muted mt-2">
                Minimum deposit: $1.00
              </p>
            </div>

            <div className="bg-primary/5 rounded-xl p-3 mb-4">
              <p className="text-xs text-text-secondary">
                In a real application, this would integrate with a payment processor like Stripe or PayPal. For this demo, funds are added instantly.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDepositModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-text-primary font-medium py-3 rounded-full transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                disabled={submitting}
                className="flex-1 bg-primary hover:bg-primary-hover text-white font-medium py-3 rounded-full transition-all active:scale-95 disabled:opacity-50"
                data-testid="confirm-deposit-button"
              >
                {submitting ? 'Processing...' : 'Add Funds'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showWithdrawModal && (
        <WithdrawalRequestModal
          onClose={() => setShowWithdrawModal(false)}
          onSubmitted={() => fetchWalletData()}
        />
      )}
    </div>
  );
};

export default WalletPage;
