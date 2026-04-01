import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Plus, TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const WalletPage = ({ user }) => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const [walletRes, transactionsRes] = await Promise.all([
        axiosInstance.get('/wallet'),
        axiosInstance.get('/wallet/transactions'),
      ]);
      setWallet(walletRes.data);
      setTransactions(transactionsRes.data);
    } catch (error) {
      toast.error('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="min-h-screen bg-background-DEFAULT">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-primary">Wallet</h1>
            <p className="text-sm text-text-secondary">Manage your funds</p>
          </div>
          <button
            onClick={() => setShowDepositModal(true)}
            className="bg-primary hover:bg-primary-hover text-white p-3 rounded-full shadow-md hover:shadow-lg active:scale-95 transition-all"
            data-testid="add-funds-button"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
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
          <p className="text-5xl font-bold tracking-tighter mb-6">
            ${wallet.balance.toFixed(2)}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} />
                <p className="text-xs text-white/80">Total Earned</p>
              </div>
              <p className="text-xl font-bold">${wallet.total_earned.toFixed(2)}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown size={16} />
                <p className="text-xs text-white/80">Total Spent</p>
              </div>
              <p className="text-xl font-bold">${wallet.total_spent.toFixed(2)}</p>
            </div>
          </div>
        </motion.div>

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
                    {isPositive ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
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
    </div>
  );
};

export default WalletPage;
