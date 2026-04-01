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
    <div className="min-h-screen bg-background-DEFAULT flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src="https://customer-assets.emergentagent.com/job_network-capital/artifacts/ujjy9ep3_185322.png" 
              alt="Network Capital" 
              className="h-32 w-auto"
            />
          </div>
          <p className="text-text-secondary text-base">
            Build your network score and increase your networth
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-full font-medium transition-all ${
                isLogin
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
              }`}
              data-testid="login-tab"
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-full font-medium transition-all ${
                !isLogin
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
              }`}
              data-testid="signup-tab"
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Choose a username"
                    data-testid="username-input"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="your@email.com"
                  data-testid="email-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="••••••••"
                  data-testid="password-input"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Bio (optional)
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 text-text-muted" size={20} />
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    rows={3}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                    placeholder="Tell us about yourself"
                    data-testid="bio-input"
                  />
                </div>
              </div>
            )}

            {/* Terms & Conditions Consent (Sign Up only) */}
            {!isLogin && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
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
                          ? 'bg-primary border-primary' 
                          : 'border-gray-300 bg-white hover:border-primary/50'
                      }`}
                    >
                      {termsAccepted && <Check className="text-white" size={14} />}
                    </div>
                  </div>
                  <span className="text-sm text-text-secondary leading-relaxed">
                    I have read and agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/legal?tab=terms');
                      }}
                      className="text-primary hover:text-primary-hover font-medium underline inline-flex items-center gap-0.5"
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
                      className="text-primary hover:text-primary-hover font-medium underline inline-flex items-center gap-0.5"
                      data-testid="privacy-link"
                    >
                      Privacy Policy
                      <ExternalLink size={12} />
                    </button>
                    {' '}of Mici (Pty) Ltd.
                  </span>
                </label>
                <p className="text-xs text-text-muted mt-2 ml-8">
                  Your consent will be recorded for compliance purposes.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (!isLogin && !termsAccepted)}
              className={`w-full font-medium py-3 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95 disabled:cursor-not-allowed ${
                !isLogin && !termsAccepted
                  ? 'bg-gray-300 text-gray-500'
                  : 'bg-primary hover:bg-primary-hover text-white disabled:opacity-50'
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
              className="text-sm text-primary hover:text-primary-hover font-medium flex items-center justify-center gap-1 mx-auto transition-colors"
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