import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { axiosInstance } from '../App';
import PasswordField, { scorePassword } from '../components/PasswordField';

/**
 * ResetPasswordPage — handles the `?token=...` deep-link from the reset email.
 * Submits the new password to /auth/reset-password.  Single-use, expires in 60min
 * (server-enforced). Shows a strength meter inline.
 */
const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) toast.error('Missing reset token. Request a new link.');
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pw1 !== pw2) { toast.error('Passwords do not match'); return; }
    const { score } = scorePassword(pw1);
    if (score < 2) { toast.error('Password is too weak. Use ≥ 8 chars with a letter and a digit.'); return; }
    if (!token) { toast.error('Missing reset token'); return; }

    setLoading(true);
    try {
      await axiosInstance.post('/auth/reset-password', { token, new_password: pw1 });
      setDone(true);
      toast.success('Password updated. You can now sign in.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reset failed. Request a fresh link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#04101e] via-[#04101e] to-[#0a1e3a] flex flex-col items-center justify-center px-6 py-10" data-testid="reset-password-page">
      <div className="w-full max-w-md">
        <button onClick={() => navigate('/auth')} className="text-white/70 hover:text-white inline-flex items-center gap-1.5 text-sm mb-5" data-testid="back-to-login-2">
          <ArrowLeft size={14} /> Back to sign in
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="bg-white rounded-3xl p-7 shadow-2xl"
        >
          {done ? (
            <div className="text-center" data-testid="reset-password-done">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={26} className="text-green-600" />
              </div>
              <h1 className="font-heading font-bold text-xl mb-2 text-primary">Password updated</h1>
              <p className="text-sm text-text-secondary leading-relaxed">
                Your password has been changed. A confirmation email has been sent to your inbox.
              </p>
              <button
                onClick={() => navigate('/auth')}
                className="mt-6 w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-full transition-all active:scale-95"
                data-testid="reset-password-go-login"
              >
                Sign in
              </button>
            </div>
          ) : !token ? (
            <div className="text-center" data-testid="reset-password-no-token">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={26} className="text-red-600" />
              </div>
              <h1 className="font-heading font-bold text-xl mb-2 text-primary">Invalid reset link</h1>
              <p className="text-sm text-text-secondary">
                This link is missing or malformed. Request a new reset link from the sign-in page.
              </p>
              <button
                onClick={() => navigate('/forgot-password')}
                className="mt-6 w-full bg-primary text-white font-bold py-3 rounded-full"
                data-testid="reset-password-request-new"
              >
                Request a new link
              </button>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-secondary/15 flex items-center justify-center mb-4">
                <ShieldCheck size={20} className="text-secondary" />
              </div>
              <h1 className="font-heading font-bold text-2xl mb-1 text-primary">Set a new password</h1>
              <p className="text-sm text-text-secondary mb-6">
                Use at least 8 characters with a letter and a digit. Mixing case and symbols makes it stronger.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <PasswordField
                  name="new_password"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  showStrength
                  testid="reset-pw-1"
                />
                <PasswordField
                  name="confirm_password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  testid="reset-pw-2"
                />
                {pw1 && pw2 && pw1 !== pw2 && (
                  <p className="text-xs text-red-500 px-1" data-testid="reset-mismatch">Passwords do not match</p>
                )}
                <button
                  type="submit" disabled={loading || !pw1 || pw1 !== pw2}
                  className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-full transition-all active:scale-95 disabled:opacity-50"
                  data-testid="reset-password-submit"
                >
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
