import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, FileText, HelpCircle, Check, ExternalLink, ArrowLeft, ArrowRight, Users, Sparkles, ShieldCheck, Building2, Hash, Briefcase } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import BrandAttribution from '../components/BrandAttribution';
import LocationPicker from '../components/LocationPicker';
import { LOGO_SECONDARY } from '../constants/brand';

const MONTHS = [
  { v: 1, l: 'January' }, { v: 2, l: 'February' }, { v: 3, l: 'March' },
  { v: 4, l: 'April' }, { v: 5, l: 'May' }, { v: 6, l: 'June' },
  { v: 7, l: 'July' }, { v: 8, l: 'August' }, { v: 9, l: 'September' },
  { v: 10, l: 'October' }, { v: 11, l: 'November' }, { v: 12, l: 'December' },
];

const AuthPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [signupStep, setSignupStep] = useState(1); // 1=credentials, 1.5=OTP, 2=intent+profile
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpHint, setOtpHint] = useState(''); // mock-mode dev hint
  const [resendCooldown, setResendCooldown] = useState(0);
  const [founderRank, setFounderRank] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    full_name: '',
    bio: '',
    intent: 'member', // "member" or "creator"
    user_kind: 'social', // "social" or "professional"
    birth_month: '',
    country: '',
    province: '',
    city: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axiosInstance.post('/auth/login', {
        email: formData.email,
        password: formData.password,
      });
      toast.success('Welcome back!');
      onLogin(res.data.token, res.data.user);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupStep1 = async (e) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast.error('Please accept the Terms & Conditions and Privacy Policy to continue');
      return;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.post('/auth/progressive-signup', {
        email: formData.email,
        password: formData.password,
        step: 1,
      });
      // Store temp token so OTP / step 2 can authenticate
      localStorage.setItem('token', res.data.token);
      setTempToken(res.data.token);
      if (res.data.founder?.is_founder) {
        setFounderRank(res.data.founder.rank);
      }
      toast.success('Account created! Verify your email.');
      // Trigger OTP send and move to verification step
      try {
        const otpRes = await axiosInstance.post('/auth/send-otp', { email: formData.email });
        if (otpRes.data?._mock_code) setOtpHint(otpRes.data._mock_code);
        startResendCooldown(30);
      } catch {}
      setSignupStep(1.5);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const startResendCooldown = (seconds) => {
    setResendCooldown(seconds);
    const id = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || otpSending) return;
    setOtpSending(true);
    try {
      const otpRes = await axiosInstance.post('/auth/send-otp', { email: formData.email });
      if (otpRes.data?._mock_code) setOtpHint(otpRes.data._mock_code);
      toast.success('Verification code sent.');
      startResendCooldown(30);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not resend code.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = (otpCode || '').trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      toast.error('Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.post('/auth/verify-otp', { email: formData.email, code });
      // Capture pending referral attribution if present
      try {
        const stored = localStorage.getItem('nc_referrer');
        if (stored) {
          const { ref, joined, bm } = JSON.parse(stored);
          if (ref) {
            await axiosInstance.post('/referrals/capture', { ref, joined, bm }).catch(() => {});
            localStorage.removeItem('nc_referrer');
          }
        }
      } catch {}
      toast.success('Email verified — let\'s finish your profile.');
      setSignupStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupStep2 = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.full_name) {
      toast.error('Please fill in your name and username');
      return;
    }
    if (!formData.birth_month) {
      toast.error('Please select your birth month');
      return;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.post('/auth/complete-profile', {
        full_name: formData.full_name,
        username: formData.username,
        bio: formData.bio,
        intent: formData.intent,
        terms_accepted: true,
        birth_month: parseInt(formData.birth_month, 10),
        user_kind: formData.user_kind,
        country: formData.country || undefined,
        province: formData.province || undefined,
        city: formData.city || undefined,
      });
      toast.success(
        formData.intent === 'creator'
          ? 'Welcome, Creator! Let\'s build your first product.'
          : 'All set! Welcome to Network Capital.'
      );
      onLogin(tempToken, res.data.user);
      // Creator-first redirect
      if (formData.intent === 'creator') {
        setTimeout(() => navigate('/products/create'), 300);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Profile completion failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4 relative logo-container">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 to-transparent blur-3xl scale-150 rounded-full" />
            <img
              src={LOGO_SECONDARY}
              alt="Network Capital"
              className="h-32 sm:h-36 w-auto relative drop-shadow-[0_0_24px_rgba(232,168,23,0.25)]"
            />
          </div>
          <p className="text-white/70 text-base">
            Increasing your network · Building shared access
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
          {/* Tab switch (hide during signup steps 1.5 and 2) */}
          {!(signupStep !== 1 && !isLogin) && (
            <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-full">
              <button
                onClick={() => { setIsLogin(true); setSignupStep(1); }}
                className={`flex-1 py-2.5 rounded-full font-medium transition-all ${isLogin ? 'bg-secondary text-white' : 'text-white/60'}`}
                data-testid="login-tab"
              >
                Login
              </button>
              <button
                onClick={() => { setIsLogin(false); setSignupStep(1); }}
                className={`flex-1 py-2.5 rounded-full font-medium transition-all ${!isLogin ? 'bg-secondary text-white' : 'text-white/60'}`}
                data-testid="signup-tab"
              >
                Sign Up
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {isLogin ? (
              <motion.form
                key="login"
                onSubmit={handleLogin}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <InputField icon={Mail} name="email" type="email" placeholder="your@email.com" label="Email" value={formData.email} onChange={handleChange} testId="email-input" required />
                <InputField icon={Lock} name="password" type="password" placeholder="••••••••" label="Password" value={formData.password} onChange={handleChange} testId="password-input" required />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full font-semibold py-3.5 rounded-full transition-all bg-gradient-to-r from-secondary to-yellow-500 text-primary disabled:opacity-50"
                  data-testid="auth-submit-button"
                >
                  {loading ? 'Please wait...' : 'Sign In'}
                </button>
              </motion.form>
            ) : signupStep === 1 ? (
              <motion.form
                key="signup-1"
                onSubmit={handleSignupStep1}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <div className="mb-2">
                  <p className="text-white/60 text-sm">Step 1 of 2 · Quick start</p>
                </div>
                <InputField icon={Mail} name="email" type="email" placeholder="your@email.com" label="Email" value={formData.email} onChange={handleChange} testId="email-input" required />
                <InputField icon={Lock} name="password" type="password" placeholder="Create a password" label="Password" value={formData.password} onChange={handleChange} testId="password-input" required />

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div className="relative flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="sr-only"
                        data-testid="terms-checkbox"
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${termsAccepted ? 'bg-secondary border-secondary' : 'border-white/30 hover:border-secondary/50'}`}>
                        {termsAccepted && <Check className="text-white" size={14} />}
                      </div>
                    </div>
                    <span className="text-sm text-white/60 leading-relaxed">
                      I agree to the{' '}
                      <button type="button" onClick={() => navigate('/legal?tab=terms')} className="text-secondary font-medium underline inline-flex items-center gap-0.5" data-testid="terms-link">
                        Terms <ExternalLink size={12} />
                      </button>{' '}and{' '}
                      <button type="button" onClick={() => navigate('/legal?tab=privacy')} className="text-secondary font-medium underline inline-flex items-center gap-0.5" data-testid="privacy-link">
                        Privacy Policy <ExternalLink size={12} />
                      </button>
                    </span>
                  </label>
                </div>

                {/* POPIA / data-protection trust nudge — honest & specific */}
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-secondary/10 border border-secondary/20" data-testid="auth-popia-nudge">
                  <ShieldCheck size={14} className="text-secondary flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    We track specific activity data exclusively to calculate your <strong className="text-white">Network Score</strong> and personalise your ecosystem benefits. POPIA-protected. Never sold.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !termsAccepted}
                  className={`w-full font-semibold py-3.5 rounded-full transition-all flex items-center justify-center gap-2 ${
                    !termsAccepted ? 'bg-white/20 text-white/40' : 'bg-gradient-to-r from-secondary to-yellow-500 text-primary disabled:opacity-50'
                  }`}
                  data-testid="auth-submit-button"
                >
                  {loading ? 'Creating...' : 'Continue'}
                  {!loading && <ArrowRight size={18} />}
                </button>
              </motion.form>
            ) : signupStep === 1.5 ? (
              <motion.form
                key="signup-otp"
                onSubmit={handleVerifyOtp}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <div className="mb-3">
                  <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    <ShieldCheck size={20} className="text-secondary" /> Verify your email
                  </h3>
                  <p className="text-white/60 text-sm">Step 1.5 of 2 · We sent a 6-digit code to <span className="text-white font-semibold">{formData.email}</span></p>
                </div>

                {founderRank && (
                  <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-3 text-center" data-testid="founder-badge">
                    <p className="text-secondary font-bold text-sm">🎉 Founding Member #{founderRank}</p>
                    <p className="text-white/70 text-[11px] mt-0.5">You'll earn 2× Network Score for your first 30 days.</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">Verification code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full text-center text-2xl tracking-[0.6em] py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 font-mono focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                    data-testid="otp-input"
                    required
                  />
                </div>

                {otpHint && (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-[11px] text-white/60 leading-relaxed" data-testid="otp-mock-hint">
                    <span className="text-secondary font-semibold">Dev mode:</span> real email isn't wired yet. Your code is <span className="font-mono text-white font-bold tracking-wider">{otpHint}</span>.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full font-semibold py-3.5 rounded-full transition-all bg-gradient-to-r from-secondary to-yellow-500 text-primary disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="otp-verify-button"
                >
                  {loading ? 'Verifying…' : 'Verify & continue'}
                  {!loading && <Check size={18} />}
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || otpSending}
                  className="w-full text-white/70 hover:text-white text-sm py-2 disabled:opacity-50"
                  data-testid="otp-resend-button"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : (otpSending ? 'Sending…' : 'Resend code')}
                </button>

                <button
                  type="button"
                  onClick={() => setSignupStep(1)}
                  className="text-white/50 hover:text-white text-xs flex items-center justify-center gap-1 w-full"
                  data-testid="otp-back-to-step1"
                >
                  <ArrowLeft size={12} /> Use a different email
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="signup-2"
                onSubmit={handleSignupStep2}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <button
                  type="button"
                  onClick={() => setSignupStep(1.5)}
                  className="text-white/60 hover:text-white text-sm flex items-center gap-1 mb-2"
                  data-testid="back-to-step-1"
                >
                  <ArrowLeft size={14} /> Back
                </button>

                <div className="mb-3">
                  <h3 className="text-white font-bold text-lg">Tell us who you are</h3>
                  <p className="text-white/60 text-sm">Step 2 of 2 · Almost there</p>
                </div>

                {/* Intent Selector */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">I'm joining as a...</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, intent: 'member' })}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${formData.intent === 'member' ? 'bg-secondary/20 border-secondary' : 'bg-white/5 border-white/20'}`}
                      data-testid="intent-member"
                    >
                      <Users className="text-secondary mb-2" size={24} />
                      <p className="text-white font-semibold">Member</p>
                      <p className="text-white/60 text-xs mt-1">Save, support, earn rewards</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, intent: 'creator' })}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${formData.intent === 'creator' ? 'bg-secondary/20 border-secondary' : 'bg-white/5 border-white/20'}`}
                      data-testid="intent-creator"
                    >
                      <Sparkles className="text-secondary mb-2" size={24} />
                      <p className="text-white font-semibold">Creator</p>
                      <p className="text-white/60 text-xs mt-1">Launch a product, build audience</p>
                    </button>
                  </div>
                </div>

                <InputField icon={User} name="full_name" type="text" placeholder="Your full name" label="Full Name" value={formData.full_name} onChange={handleChange} testId="full-name-input" required />
                <InputField icon={User} name="username" type="text" placeholder="Pick a unique username" label="Username" value={formData.username} onChange={handleChange} testId="username-input" required />

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">Bio (optional)</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-white/40" size={20} />
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      rows={2}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none resize-none"
                      placeholder={formData.intent === 'creator' ? 'What do you create?' : 'Tell us about yourself'}
                      data-testid="bio-input"
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="pt-1">
                  <p className="text-sm font-semibold text-white/85 mb-2">Where are you based?</p>
                  <LocationPicker
                    value={{ country: formData.country, province: formData.province, city: formData.city }}
                    onChange={(loc) => setFormData((p) => ({ ...p, ...loc }))}
                    theme="dark"
                    testIdPrefix="signup-location"
                  />
                </div>

                {/* User kind toggle — drives Profile layout & Jobs feature visibility */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">I'm signing up as a…</label>
                  <div className="grid grid-cols-2 gap-2" data-testid="user-kind-toggle">
                    {[
                      { v: 'social', label: 'Social User', desc: 'Connect, post, and engage' },
                      { v: 'professional', label: 'Professional', desc: 'Showcase skills, find jobs' },
                    ].map((k) => (
                      <button
                        key={k.v}
                        type="button"
                        onClick={() => setFormData({ ...formData, user_kind: k.v })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          formData.user_kind === k.v
                            ? 'bg-secondary/20 border-secondary text-white'
                            : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'
                        }`}
                        data-testid={`user-kind-${k.v}`}
                      >
                        <p className="font-semibold text-sm">{k.label}</p>
                        <p className="text-[11px] text-white/55 mt-0.5">{k.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Birth Month — used for personalised referral links + birthday recognition */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">Birth Month</label>
                  <div className="relative">
                    <select
                      name="birth_month"
                      value={formData.birth_month}
                      onChange={handleChange}
                      required
                      className="w-full pl-4 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all appearance-none cursor-pointer"
                      data-testid="birth-month-input"
                    >
                      <option value="" disabled className="bg-[#0a1628] text-white/50">Select your birth month</option>
                      {MONTHS.map((m) => (
                        <option key={m.v} value={m.v} className="bg-[#0a1628] text-white">{m.l}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-white/50 mt-1">Used to personalise your referral link and celebrate your birthday month.</p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !formData.username || !formData.full_name || !formData.birth_month}
                  className="w-full font-semibold py-3.5 rounded-full transition-all bg-gradient-to-r from-secondary to-yellow-500 text-primary disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="auth-submit-button"
                >
                  {loading ? 'Finishing...' : `Enter as ${formData.intent === 'creator' ? 'Creator' : 'Member'}`}
                  {!loading && <Check size={18} />}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-4 text-center">
            <button
              onClick={() => (window.location.href = '/onboarding')}
              className="text-sm text-white/60 hover:text-secondary font-medium flex items-center justify-center gap-1 mx-auto transition-colors"
              data-testid="learn-more-button"
            >
              <HelpCircle size={16} />
              New here? Learn how it works
            </button>
          </div>
        </div>
      </motion.div>
      <BrandAttribution tone="dark" />
    </div>
  );
};

const InputField = ({ icon: Icon, name, type, placeholder, label, value, onChange, testId, required }) => (
  <div>
    <label className="block text-sm font-medium text-white/80 mb-1">{label}</label>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
        placeholder={placeholder}
        data-testid={testId}
      />
    </div>
  </div>
);

export default AuthPage;
