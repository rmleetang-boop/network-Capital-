import React, { useState } from 'react';
import { X, Loader2, AlertTriangle, DollarSign } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const CURRENCIES = ['USD', 'ZAR', 'NGN', 'GHS', 'KES'];

/**
 * Admin credit-grant modal. Use for either user wallets or Stokvel pools.
 * Props:
 *  - targetType: 'user' | 'stokvel'
 *  - targetId
 *  - targetLabel — shown in heading (e.g. username or stokvel name)
 *  - onClose, onApplied
 */
const CreditGrantModal = ({ targetType, targetId, targetLabel, onClose, onApplied }) => {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmNegative, setConfirmNegative] = useState(false);

  const isNegative = parseFloat(amount) < 0;

  const submit = async () => {
    const n = parseFloat(amount);
    if (!n || isNaN(n)) return toast.error('Enter an amount');
    if (reason.trim().length < 10) return toast.error('Reason must be at least 10 characters');
    if (n < 0 && !confirmNegative) {
      setConfirmNegative(true);
      return;
    }
    setSubmitting(true);
    try {
      const r = await axiosInstance.post('/admin/credit-grants', {
        amount: n,
        currency,
        reason: reason.trim(),
        target_type: targetType,
        target_id: targetId,
      });
      if (r.data.status === 'pending_co_approval') {
        toast.success(`Queued for co-approval (over $5,000 cap)`);
      } else {
        toast.success(`${n >= 0 ? 'Credited' : 'Deducted'} ${Math.abs(n)} ${currency} successfully`);
      }
      if (onApplied) onApplied(r.data);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not apply grant');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="credit-grant-modal"
    >
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-md w-full p-5 relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100" data-testid="credit-grant-close">
          <X size={18} />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <DollarSign size={20} className="text-primary" />
          <h3 className="font-heading font-bold text-lg text-primary">Adjust balance</h3>
        </div>
        <p className="text-xs text-text-muted mb-4">
          {targetType === 'user' ? 'Member: ' : 'Stokvel: '}
          <strong className="text-text-primary">{targetLabel}</strong>
        </p>

        <div className="grid grid-cols-3 gap-2 mb-2">
          <input
            type="number" step="0.01"
            value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="±0.00"
            className="col-span-2 px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
            data-testid="credit-amount-input"
          />
          <select
            value={currency} onChange={(e) => setCurrency(e.target.value)}
            className="px-2 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
            data-testid="credit-currency-select">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <p className="text-[10px] text-text-muted mb-3">
          Use positive to credit, negative to deduct. Grants over $5,000 USD require a second admin's co-approval.
        </p>

        <textarea
          value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (minimum 10 characters) — e.g., 'Founder bonus for Q1 contribution'"
          rows={3} maxLength={500}
          className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary resize-none mb-3"
          data-testid="credit-reason-input"
        />

        {isNegative && confirmNegative && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 flex items-start gap-2">
            <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-700">
              You are about to <strong>deduct</strong> from this {targetType}. Click <strong>Apply</strong> again to confirm.
            </p>
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting}
          className={`w-full font-bold py-2.5 rounded-full inline-flex items-center justify-center gap-2 disabled:opacity-50 ${
            isNegative ? 'bg-red-600 text-white' : 'bg-primary text-white'
          }`}
          data-testid="credit-submit-button">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
          {isNegative ? (confirmNegative ? 'Confirm deduction' : 'Review deduction') : 'Apply credit'}
        </button>
      </div>
    </div>
  );
};

export default CreditGrantModal;
