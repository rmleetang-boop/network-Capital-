import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, FileText, HelpCircle, Check, ExternalLink, ArrowLeft, ArrowRight, Users, Sparkles } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const AuthPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [signupStep, setSignupStep] = useState(1); // 1=credentials, 2=intent+profile
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    full_name: '',
    bio: '',
    intent: 'member', // "member" or "creator"
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
      // Store temp token so step 2 can authenticate
      localStorage.setItem('token', res.data.token);
      setTempToken(res.data.token);
      toast.success('Account created! One more step to go.');
      setSignupStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Signup failed');
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
    setLoading(true);
    try {
      const res = await axiosInstance.post('/auth/complete-profile', {
        full_name: formData.full_name,
        username: formData.username,
        bio: formData.bio,
        intent: formData.intent,
        terms_accepted: true,
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
              src="https://customer-assets.emergentagent.com/job_network-capital/artifacts/ujjy9ep3_185322.png"
              alt="Network Capital"
              className="h-24 w-auto relative logo-glow rounded-xl"
              style={{ background: 'linear-gradient(135deg, rgba(10,22,40,0.95) 0%, rgba(30,58,138,0.95) 100%)', padding: '10px' }}
            />
          </div>
          <p className="text-white/70 text-base">
            Build your network score and increase your networth
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
          {/* Tab switch (hide during signup step 2) */}
          {!(signupStep === 2 && !isLogin) && (
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
                  onClick={() => setSignupStep(1)}
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

                <button
                  type="submit"
                  disabled={loading || !formData.username || !formData.full_name}
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
