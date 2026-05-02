import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Sparkles, Check, CreditCard, Globe } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useCurrency } from '../context/CurrencyContext';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const STRIPE_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'];
const PAYSTACK_CURRENCIES = ['NGN', 'GHS', 'KES', 'ZAR'];

/**
 * Premium paywall — routes by currency:
 *  - Stripe (real test checkout): USD, EUR, GBP, CAD, AUD, JPY
 *  - Paystack (MOCK until keys): NGN, GHS, KES, ZAR
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

  const provider = STRIPE_CURRENCIES.includes(chosen)
    ? 'stripe'
    : PAYSTACK_CURRENCIES.includes(chosen)
    ? 'paystack'
    : 'unknown';

  const handlePay = async () => {
    setLoading(true);
    try {
      if (provider === 'stripe') {
        const origin = window.location.origin;
        const response = await axiosInstance.post('/payments/checkout/session', {
          package_id: 'premium_unlock',
          currency: chosen,
          origin_url: origin,
        });
        if (response.data?.url) {
          window.location.href = response.data.url;
          return; // browser redirects
        }
        toast.error('Checkout URL missing');
      } else if (provider === 'paystack') {
        // MOCK until Paystack keys provided
        await axiosInstance.post('/users/me/premium', { currency: chosen });
        toast.success('Premium unlocked! +500 bonus points (Paystack MOCK)');
        await refreshUser();
        if (onUnlock) onUnlock();
      } else {
        toast.error('Currency not supported');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const perks = [
    'Stokvel contributions & Smart Access',
    'Group multi-sig withdrawals',
    'Product backing & group support',
    '2× Network Score multiplier',
    '+500 welcome bonus points',
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

      {/* Provider badge */}
      <div className="flex items-center gap-2 mb-3 text-[11px] text-text-muted">
        {provider === 'stripe' ? (
          <>
            <CreditCard size={13} className="text-primary" />
            <span>Secure checkout via <strong className="text-primary">Stripe</strong> · cards, Apple Pay, Google Pay</span>
          </>
        ) : (
          <>
            <Globe size={13} className="text-primary" />
            <span><strong className="text-primary">Paystack</strong> · local cards + mobile money · <span className="italic">MOCK until keys added</span></span>
          </>
        )}
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
        One-time fee. You'll be redirected to Stripe's secure checkout.
      </p>
    </motion.div>
  );
};

export default PremiumPaywall;
