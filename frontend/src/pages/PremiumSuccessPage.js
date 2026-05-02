import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Check, ArrowRight, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { axiosInstance } from '../App';
import { useCurrency } from '../context/CurrencyContext';

const MAX_POLLS = 8;
const POLL_INTERVAL_MS = 2000;

/**
 * Post-Stripe-redirect celebration page. Polls /payments/checkout/status/:sid
 * until payment_status === 'paid' (or max attempts), then fires confetti.
 */
const PremiumSuccessPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useCurrency();
  const sessionId = params.get('session_id');
  const [state, setState] = useState('checking'); // checking | paid | pending_timeout | error | missing
  const [data, setData] = useState(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setState('missing');
      return;
    }
    let attempts = 0;
    let cancelled = false;

    const fireConfetti = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      const end = Date.now() + 1500;
      const colors = ['#f5d76e', '#c79a2a', '#0a1628', '#ffffff'];
      (function frame() {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    };

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const res = await axiosInstance.get(`/payments/checkout/status/${sessionId}`);
        setData(res.data);
        if (res.data.payment_status === 'paid') {
          setState('paid');
          fireConfetti();
          refreshUser();
          return;
        }
        if (res.data.status === 'expired') {
          setState('error');
          return;
        }
        if (attempts >= MAX_POLLS) {
          setState('pending_timeout');
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      } catch (e) {
        setState('error');
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId, refreshUser]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] flex items-center justify-center p-4" data-testid="premium-success-page">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl text-center"
      >
        {state === 'checking' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-secondary border-t-transparent animate-spin" />
            <h1 className="text-2xl font-heading font-bold text-primary mb-2">Finalising your payment…</h1>
            <p className="text-text-secondary text-sm">We're confirming the transaction with Stripe. This usually takes a few seconds.</p>
          </>
        )}

        {state === 'paid' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-secondary to-yellow-500 flex items-center justify-center shadow-lg"
            >
              <Sparkles className="text-primary" size={36} />
            </motion.div>
            <h1 className="text-3xl font-heading font-bold text-primary mb-2">Welcome to Premium!</h1>
            <p className="text-text-secondary mb-4">Your financial features are live.</p>

            <div className="bg-gradient-to-r from-secondary/10 to-primary/5 border border-secondary/30 rounded-xl p-4 mb-5 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-secondary" />
                <span className="text-sm font-bold text-primary">+{data?.welcome_bonus_points || 500} welcome bonus pts</span>
              </div>
              <ul className="space-y-1.5 text-sm text-text-secondary">
                <li className="flex items-center gap-2"><Check size={14} className="text-secondary flex-shrink-0" /> 2× Network Score multiplier</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-secondary flex-shrink-0" /> Stokvel contributions + Smart Access</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-secondary flex-shrink-0" /> Multi-sig group withdrawals</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-secondary flex-shrink-0" /> Back creator products</li>
              </ul>
            </div>

            <button
              onClick={() => navigate('/')}
              className="w-full py-3 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-bold rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all"
              data-testid="success-continue-button"
            >
              Explore Premium <ArrowRight size={18} />
            </button>
          </>
        )}

        {state === 'pending_timeout' && (
          <>
            <AlertCircle size={40} className="mx-auto mb-3 text-yellow-500" />
            <h1 className="text-xl font-heading font-bold text-primary mb-2">Still processing</h1>
            <p className="text-text-secondary text-sm mb-4">
              Your payment is taking longer than usual to confirm. You'll be notified once it clears — no need to pay again.
            </p>
            <button
              onClick={() => navigate('/profile')}
              className="w-full py-3 bg-primary text-white font-bold rounded-full"
              data-testid="success-timeout-back"
            >
              Back to profile
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertCircle size={40} className="mx-auto mb-3 text-red-500" />
            <h1 className="text-xl font-heading font-bold text-primary mb-2">Payment not completed</h1>
            <p className="text-text-secondary text-sm mb-4">
              The payment could not be confirmed. If you were charged, contact support with session ID: <code className="text-xs">{sessionId}</code>
            </p>
            <button
              onClick={() => navigate('/profile')}
              className="w-full py-3 bg-primary text-white font-bold rounded-full"
              data-testid="success-error-back"
            >
              Back to profile
            </button>
          </>
        )}

        {state === 'missing' && (
          <>
            <AlertCircle size={40} className="mx-auto mb-3 text-red-500" />
            <h1 className="text-xl font-heading font-bold text-primary mb-2">Missing session ID</h1>
            <p className="text-text-secondary text-sm mb-4">This page is reached after a Stripe checkout redirect.</p>
            <button onClick={() => navigate('/profile')} className="w-full py-3 bg-primary text-white font-bold rounded-full">
              Back to profile
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default PremiumSuccessPage;
