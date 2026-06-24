// Iter 55 — Super-admin wallet adjustment modal.
// Posts to /api/admin/users/<uid>/wallet-adjust which requires the
// X-Super-PIN-Token header (handled by axiosInstance interceptor in App.js).
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ArrowUpRight, ArrowDownRight, Loader2, Wallet as WalletIcon, ShieldAlert } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const WalletAdjustModal = ({ user, onClose, onSuccess }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('credit');           // credit | debit
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const before = Number(user?.wallet_balance || 0);

  const numericAmount = Number(amount) || 0;
  const delta = mode === 'credit' ? numericAmount : -numericAmount;
  const projected = Math.max(0, before + delta);   // FE preview cap

  const submit = async () => {
    if (!numericAmount || numericAmount <= 0) {
      toast.error('Enter an amount greater than zero.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 4) {
      toast.error('Reason must be at least 4 characters.');
      return;
    }
    if (!window.confirm(`Confirm: ${mode === 'credit' ? 'CREDIT' : 'DEBIT'} R${numericAmount.toFixed(2)} on @${user.username}'s wallet?\n\nThis is logged and audited.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await axiosInstance.post(`/admin/users/${user.id}/wallet-adjust`, {
        delta,
        reason: reason.trim(),
        currency: 'ZAR',
      });
      const r = res.data;
      toast.success(
        r.capped
          ? `Capped — applied R ${Math.abs(r.delta_applied).toFixed(2)} (debit could not exceed balance). New balance: R ${r.balance_after.toFixed(2)}.`
          : `Wallet ${mode === 'credit' ? 'credited' : 'debited'}. New balance: R ${r.balance_after.toFixed(2)}.`
      );
      onSuccess?.(r);
      onClose();
    } catch (e) {
      const status = e.response?.status;
      if (status === 401) {
        toast.error('Super-admin PIN required. Re-enter your PIN.');
        navigate('/admin/super-pin');
      } else {
        toast.error(e.response?.data?.detail || 'Could not adjust wallet');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="wallet-adjust-modal"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <WalletIcon size={18} className="text-primary" />
            <h3 className="text-lg font-heading font-bold">Adjust wallet</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100" data-testid="wallet-adjust-close"><X size={18} /></button>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">User</p>
          <p className="font-semibold">@{user.username} <span className="text-text-muted text-xs font-normal">· {user.email}</span></p>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mt-2">Current balance</p>
          <p className="text-xl font-bold text-primary">R {before.toFixed(2)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setMode('credit')}
            className={`px-3 py-2.5 rounded-xl border text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
              mode === 'credit'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-gray-200 text-text-secondary hover:border-emerald-200'
            }`}
            data-testid="wallet-mode-credit"
          >
            <ArrowUpRight size={14} /> Credit (add)
          </button>
          <button
            type="button"
            onClick={() => setMode('debit')}
            className={`px-3 py-2.5 rounded-xl border text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
              mode === 'debit'
                ? 'bg-red-50 border-red-300 text-red-700'
                : 'bg-white border-gray-200 text-text-secondary hover:border-red-200'
            }`}
            data-testid="wallet-mode-debit"
          >
            <ArrowDownRight size={14} /> Debit (remove)
          </button>
        </div>

        <label className="block text-xs font-semibold text-text-secondary mb-1">Amount (ZAR)</label>
        <input
          type="number"
          step="0.01" min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-primary outline-none mb-3"
          data-testid="wallet-amount-input"
        />

        <label className="block text-xs font-semibold text-text-secondary mb-1">Reason (will be logged)</label>
        <textarea
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Manual top-up after support ticket NC-2418"
          maxLength={240}
          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-primary outline-none resize-none"
          data-testid="wallet-reason-input"
        />

        {numericAmount > 0 && (
          <div className="bg-gray-50 rounded-xl p-3 mt-3 text-sm" data-testid="wallet-preview">
            <p className="text-text-muted text-[11px] uppercase tracking-wider">After this adjustment</p>
            <p className="font-bold text-lg">
              R {before.toFixed(2)}
              <span className={`mx-2 ${mode === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                {mode === 'credit' ? '+' : '−'} R {numericAmount.toFixed(2)}
              </span>
              <span className="text-text-muted">=</span>{' '}
              <span className="text-primary">R {projected.toFixed(2)}</span>
            </p>
            {mode === 'debit' && numericAmount > before && (
              <p className="text-[11px] text-red-600 mt-1">
                <ShieldAlert size={11} className="inline mr-1" />
                Debit would exceed balance — will be capped at R {before.toFixed(2)} (no overdraft).
              </p>
            )}
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy || !numericAmount || !reason.trim() || reason.trim().length < 4}
          className="w-full mt-4 bg-primary text-white font-bold py-3 rounded-full disabled:opacity-50 inline-flex items-center justify-center gap-2"
          data-testid="wallet-adjust-submit"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : (mode === 'credit' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />)}
          {busy ? 'Adjusting…' : `${mode === 'credit' ? 'Credit' : 'Debit'} wallet`}
        </button>
        <p className="text-[10px] text-text-muted text-center mt-2">
          <ShieldAlert size={10} className="inline mr-1" /> Requires super-admin PIN. Logged to audit trail.
        </p>
      </motion.div>
    </div>
  );
};

export default WalletAdjustModal;
