import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { axiosInstance } from '../App';

/**
 * ForgotPasswordPage — collects an email and asks the backend to issue a single-use
 * reset link. Always shows a generic confirmation so we don't leak which emails
 * exist on the platform.
 */
const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await axiosInstance.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send reset link. Try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#04101e] via-[#04101e] to-[#0a1e3a] flex flex-col items-center justify-center px-6 py-10" data-testid="forgot-password-page">
      <div className="w-full max-w-md">
        <button onClick={() => navigate('/auth')} className="text-white/70 hover:text-white inline-flex items-center gap-1.5 text-sm mb-5" data-testid="back-to-login">
          <ArrowLeft size={14} /> Back to sign in
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="bg-white rounded-3xl p-7 shadow-2xl"
        >
          {sent ? (
            <div className="text-center" data-testid="forgot-password-sent">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={26} className="text-green-600" />
              </div>
              <h1 className="font-heading font-bold text-xl mb-2 text-primary">Check your inbox</h1>
              <p className="text-sm text-text-secondary leading-relaxed">
                If an account exists for <strong>{email}</strong>, a password-reset link has been sent.
                It expires in <strong>60 minutes</strong> and can only be used once.
              </p>
              <p className="text-[11px] text-text-muted mt-3">Don't see it? Check your spam folder.</p>
              <button
                onClick={() => navigate('/auth')}
                className="mt-6 w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-full transition-all active:scale-95"
                data-testid="forgot-password-done"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-secondary/15 flex items-center justify-center mb-4">
                <ShieldCheck size={20} className="text-secondary" />
              </div>
              <h1 className="font-heading font-bold text-2xl mb-1 text-primary">Forgot password?</h1>
              <p className="text-sm text-text-secondary mb-6">
                Enter the email on your account and we'll send you a single-use reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                  <input
                    type="email" required autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-12 pr-4 py-3 rounded-full border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    data-testid="forgot-password-email"
                  />
                </div>
                <button
                  type="submit" disabled={loading}
                  className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-full transition-all active:scale-95 disabled:opacity-50"
                  data-testid="forgot-password-submit"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <p className="text-[11px] text-text-muted text-center mt-5">
                Too many reset requests will temporarily lock your account.
                If that happens, email <strong>support@networkcapitalapp.co.za</strong> to unlock.
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
