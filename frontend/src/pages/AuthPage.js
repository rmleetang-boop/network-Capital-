import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, User, FileText, HelpCircle, Check, ExternalLink } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const AuthPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    bio: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate terms acceptance for signup
    if (!isLogin && !termsAccepted) {
      toast.error('Please accept the Terms & Conditions and Privacy Policy to continue');
      return;
    }
    
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : { 
            ...formData, 
            terms_accepted: true,
            terms_accepted_at: new Date().toISOString()
          };

      const response = await axiosInstance.post(endpoint, payload);
      const { token, user } = response.data;

      toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
      onLogin(token, user);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
          <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-full">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2.5 rounded-full font-medium transition-all ${
                isLogin
                  ? 'bg-secondary text-white'
                  : 'text-white/60'
              }`}
              data-testid="login-tab"
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2.5 rounded-full font-medium transition-all ${
                !isLogin
                  ? 'bg-secondary text-white'
                  : 'text-white/60'
              }`}
              data-testid="signup-tab"
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
                    placeholder="Choose a username"
                    data-testid="username-input"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
                  placeholder="your@email.com"
                  data-testid="email-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
                  placeholder="••••••••"
                  data-testid="password-input"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Bio (optional)
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 text-white/40" size={20} />
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    rows={3}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all resize-none"
                    placeholder="Tell us about yourself"
                    data-testid="bio-input"
                  />
                </div>
              </div>
            )}

            {/* Terms & Conditions Consent (Sign Up only) */}
            {!isLogin && (
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
                    <div 
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        termsAccepted 
                          ? 'bg-secondary border-secondary' 
                          : 'border-white/30 hover:border-secondary/50'
                      }`}
                    >
                      {termsAccepted && <Check className="text-white" size={14} />}
                    </div>
                  </div>
                  <span className="text-sm text-white/60 leading-relaxed">
                    I have read and agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/legal?tab=terms');
                      }}
                      className="text-secondary hover:text-yellow-400 font-medium underline inline-flex items-center gap-0.5"
                      data-testid="terms-link"
                    >
                      Terms & Conditions
                      <ExternalLink size={12} />
                    </button>
                    {' '}and{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/legal?tab=privacy');
                      }}
                      className="text-secondary hover:text-yellow-400 font-medium underline inline-flex items-center gap-0.5"
                      data-testid="privacy-link"
                    >
                      Privacy Policy
                      <ExternalLink size={12} />
                    </button>
                    {' '}of Mici (Pty) Ltd.
                  </span>
                </label>
                <p className="text-xs text-white/40 mt-2 ml-8">
                  Your consent will be recorded for compliance purposes.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (!isLogin && !termsAccepted)}
              className={`w-full font-semibold py-3.5 rounded-full transition-all hover:shadow-lg active:scale-95 disabled:cursor-not-allowed ${
                !isLogin && !termsAccepted
                  ? 'bg-white/20 text-white/40'
                  : 'bg-gradient-to-r from-secondary to-yellow-500 text-primary disabled:opacity-50'
              }`}
              data-testid="auth-submit-button"
            >
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Learn More Link */}
          <div className="mt-4 text-center">
            <button
              onClick={() => window.location.href = '/onboarding'}
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

export default AuthPage;