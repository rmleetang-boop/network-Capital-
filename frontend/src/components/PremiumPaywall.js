import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Sparkles, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useCurrency } from '../context/CurrencyContext';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

/**
 * Shown in place of financial UIs when user has not paid the $10 premium fee.
 * Also works as a standalone banner / card (use `compact` for inline version).
 */
const PremiumPaywall = ({ featureName = 'this feature', compact = false, onUnlock }) => {
  const { currencies, premiumFeeUsd, premiumUnlocked, refreshUser } = useCurrency();
  const [chosen, setChosen] = useState('USD');
  const [loading, setLoading] = useState(false);

  if (premiumUnlocked) return null;

  const meta = currencies.find((c) => c.code === chosen) || { symbol: '$', rate: 1 };
  const localAmount = (premiumFeeUsd * meta.rate).toLocaleString(undefined, {
    minimumFractionDigits: chosen === 'JPY' || chosen === 'NGN' ? 0 : 2,
    maximumFractionDigits: chosen === 'JPY' || chosen === 'NGN' ? 0 : 2,
  });

  const handlePay = async () => {
    setLoading(true);
    try {
      await axiosInstance.post('/users/me/premium', { currency: chosen });
      toast.success('Premium unlocked! (mock payment)');
      await refreshUser();
      if (onUnlock) onUnlock();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const perks = [
    'Stokvel contributions',
    'Smart Access to pooled funds',
    'Group multi-sig withdrawals',
    'Product backing & group support',
    'Wallet deposits',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-br from-secondary/20 via-white to-primary/5 border border-secondary/30 rounded-2xl ${compact ? 'p-4' : 'p-6'}`}
      data-testid="premium-paywall"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
          <Lock className="text-primary" size={20} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-heading font-bold ${compact ? 'text-base' : 'text-lg'}`}>
              Premium required
            </h3>
            <Sparkles size={14} className="text-secondary" />
          </div>
          <p className={`text-text-secondary ${compact ? 'text-xs' : 'text-sm'}`}>
            Unlock all financial features to use {featureName}
          </p>
        </div>
      </div>

      {!compact && (
        <ul className="space-y-1.5 mb-4 ml-2">
          {perks.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm text-text-secondary">
              <Check size={14} className="text-secondary flex-shrink-0" />
              {p}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-[1fr_1fr] gap-2 mb-3">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-text-muted">Pay in</label>
          <Select value={chosen} onValueChange={setChosen}>
            <SelectTrigger data-testid="paywall-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((c) => (
                <SelectItem key={c.code} value={c.code} data-testid={`paywall-currency-${c.code}`}>
                  {c.code} · {c.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-text-muted">Amount</label>
          <div className="h-10 px-3 rounded-md border border-input bg-background flex items-center font-bold text-text-primary">
            {meta.symbol}{localAmount}
          </div>
        </div>
      </div>

      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full py-3 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-bold rounded-full disabled:opacity-50 flex items-center justify-center gap-2"
        data-testid="paywall-pay-button"
      >
        {loading ? 'Processing…' : `Pay ${meta.symbol}${localAmount} ${chosen} & Unlock`}
      </button>
      <p className="text-[10px] text-text-muted text-center mt-2">
        One-time fee. MOCK payment for prototype — real payment rail coming soon.
      </p>
    </motion.div>
  );
};

export default PremiumPaywall;
