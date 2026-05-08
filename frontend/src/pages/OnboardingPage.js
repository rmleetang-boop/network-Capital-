import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronLeft, 
  Network, 
  TrendingUp, 
  Users, 
  Gift, 
  Shield,
  Zap,
  Heart,
  MessageCircle,
  Phone,
  Mail,
  Lock,
  User,
  Check,
  ExternalLink,
  Share2,
  Award,
  Wallet,
  MessageSquare,
  Globe
} from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BrandAttribution from '../components/BrandAttribution';

const OnboardingPage = ({ onComplete, onLogin }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLogin, setIsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [authMethod, setAuthMethod] = useState('phone'); // 'phone' or 'email'
  const [userReferralCode, setUserReferralCode] = useState('');
  
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    countryCode: '+27',
    email: '',
    password: '',
    username: '',
    referralCode: searchParams.get('ref') || '',
  });

  // Country codes for South Africa focus
  const countryCodes = [
    { code: '+27', flag: '🇿🇦', country: 'South Africa' },
    { code: '+1', flag: '🇺🇸', country: 'USA' },
    { code: '+44', flag: '🇬🇧', country: 'UK' },
    { code: '+234', flag: '🇳🇬', country: 'Nigeria' },
    { code: '+254', flag: '🇰🇪', country: 'Kenya' },
    { code: '+255', flag: '🇹🇿', country: 'Tanzania' },
    { code: '+256', flag: '🇺🇬', country: 'Uganda' },
    { code: '+233', flag: '🇬🇭', country: 'Ghana' },
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    
    if (!isLogin && !termsAccepted) {
      toast.error('Please accept the Terms & Conditions');
      return;
    }
    
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      
      // Generate username from full name or phone for signup
      const generatedUsername = formData.fullName 
        ? formData.fullName.toLowerCase().replace(/\s+/g, '_') + Math.floor(Math.random() * 1000)
        : 'user_' + Date.now();
      
      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : { 
            email: formData.email || `${formData.phone.replace(/\D/g, '')}@phone.networkcapital.app`,
            password: formData.password,
            username: generatedUsername,
            bio: '',
            phone: formData.countryCode + formData.phone,
            full_name: formData.fullName,
            referred_by_code: formData.referralCode || null,
            terms_accepted: true,
            terms_accepted_at: new Date().toISOString()
          };

      const response = await axiosInstance.post(endpoint, payload);
      const { token, user } = response.data;
      
      // Store user's referral code for the final screen
      setUserReferralCode(user.referral_code || user.id?.substring(0, 8) || 'NC' + Date.now().toString().slice(-6));
      
      toast.success(isLogin ? 'Welcome back!' : 'Account created!');
      
      if (isLogin) {
        onLogin(token, user);
        onComplete();
      } else {
        // Move to next slide after signup (to show referral screen)
        localStorage.setItem('token', token);
        localStorage.setItem('pendingUser', JSON.stringify(user));
        setCurrentSlide(currentSlide + 1);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppShare = () => {
    const message = `🚀 Join me on Network Capital and start earning rewards! Your activity finally counts for something.\n\nUse my referral code: ${userReferralCode}\n\n👉 Sign up now: https://networkcapital.app/?ref=${userReferralCode}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleEnterApp = () => {
    const pendingUser = localStorage.getItem('pendingUser');
    if (pendingUser) {
      const user = JSON.parse(pendingUser);
      const token = localStorage.getItem('token');
      localStorage.removeItem('pendingUser');
      onLogin(token, user);
    }
    onComplete();
  };

  // Mock feed post for preview
  const MockFeedPost = ({ username, action, amount, likes, comments }) => (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-gradient-to-br from-secondary to-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
          {username[0]}
        </div>
        <div className="flex-1">
          <p className="text-white text-xs font-medium">{username}</p>
          <p className="text-white/60 text-[10px]">Just now</p>
        </div>
        <div className="bg-secondary/20 px-2 py-0.5 rounded-full">
          <span className="text-secondary text-[10px] font-bold">+{amount}</span>
        </div>
      </div>
      <p className="text-white/80 text-xs mb-2">{action}</p>
      <div className="flex items-center gap-4 text-white/50 text-[10px]">
        <span className="flex items-center gap-1"><Heart size={10} /> {likes}</span>
        <span className="flex items-center gap-1"><MessageCircle size={10} /> {comments}</span>
      </div>
    </div>
  );

  const slides = [
    // SCREEN 1: AUTH (Dark Theme)
    {
      id: 'auth',
      render: () => (
        <div className="flex-1 flex flex-col px-6 pb-6">
          {/* Logo - with glow effect blending into dark background */}
          <div className="text-center pt-4 pb-6">
            <div className="logo-container">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/30 to-transparent blur-3xl scale-150 rounded-full" />
              <img 
                src="https://customer-assets.emergentagent.com/job_fc3cb5f0-3a8d-48cd-b3b3-8fcdd6e615e4/artifacts/3x79ttpx_Network%20Capital_Secondary%20Logo.png" 
                alt="Network Capital" 
                className="h-28 mx-auto mb-3 relative drop-shadow-[0_0_20px_rgba(232,168,23,0.3)]"
              />
            </div>
            <p className="text-white/70 text-sm">Transform your network into net worth</p>
          </div>

          {/* Auth Toggle */}
          <div className="flex gap-2 mb-5 bg-white/5 p-1 rounded-full">
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-all ${
                !isLogin ? 'bg-secondary text-white' : 'text-white/60'
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-all ${
                isLogin ? 'bg-secondary text-white' : 'text-white/60'
              }`}
            >
              Login
            </button>
          </div>

          {/* Auth Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-3 flex-1">
            {!isLogin && (
              <>
                {/* Full Name */}
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required={!isLogin}
                    className="w-full pl-10 pr-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                    placeholder="Full Name"
                    data-testid="fullname-input"
                  />
                </div>

                {/* Auth Method Toggle */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('phone')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                      authMethod === 'phone' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50'
                    }`}
                  >
                    <Phone size={14} /> Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMethod('email')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                      authMethod === 'email' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50'
                    }`}
                  >
                    <Mail size={14} /> Email
                  </button>
                </div>
              </>
            )}

            {/* Phone Input (Primary for Signup) */}
            {(authMethod === 'phone' && !isLogin) && (
              <div className="flex gap-2">
                <select
                  value={formData.countryCode}
                  onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                  className="w-24 py-3 px-2 bg-white/10 rounded-xl border border-white/20 text-white text-sm focus:border-secondary outline-none"
                >
                  {countryCodes.map(c => (
                    <option key={c.code} value={c.code} className="bg-gray-800">
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required={authMethod === 'phone' && !isLogin}
                    className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                    placeholder="Phone Number"
                    data-testid="phone-input"
                  />
                </div>
              </div>
            )}

            {/* Email Input */}
            {(authMethod === 'email' || isLogin) && (
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required={authMethod === 'email' || isLogin}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  placeholder="Email Address"
                  data-testid="email-input"
                />
              </div>
            )}

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                placeholder="Password"
                data-testid="password-input"
              />
            </div>

            {/* Referral Code (Signup only) */}
            {!isLogin && (
              <div className="relative">
                <Gift className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                <input
                  type="text"
                  name="referralCode"
                  value={formData.referralCode}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 rounded-xl border-2 border-secondary/50 text-white placeholder-white/40 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  placeholder="Referral Code (Optional)"
                  data-testid="referral-input"
                />
              </div>
            )}

            {/* Terms (Signup only) */}
            {!isLogin && (
              <label className="flex items-start gap-2 cursor-pointer">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="sr-only"
                    data-testid="terms-checkbox"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    termsAccepted ? 'bg-secondary border-secondary' : 'border-white/30'
                  }`}>
                    {termsAccepted && <Check className="text-white" size={12} />}
                  </div>
                </div>
                <span className="text-white/60 text-xs">
                  I agree to the{' '}
                  <button type="button" onClick={() => navigate('/legal?tab=terms')} className="text-secondary underline">
                    Terms
                  </button>
                  {' '}and{' '}
                  <button type="button" onClick={() => navigate('/legal?tab=privacy')} className="text-secondary underline">
                    Privacy Policy
                  </button>
                </span>
              </label>
            )}

            {/* Submit Button - GOLD */}
            <button
              type="submit"
              disabled={loading || (!isLogin && !termsAccepted)}
              className="w-full py-3.5 rounded-full font-semibold transition-all bg-gradient-to-r from-secondary to-yellow-500 text-primary hover:shadow-lg hover:shadow-secondary/30 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="auth-submit"
            >
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>

            {/* Social Login Divider */}
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-white/40 text-xs">or continue with</span>
              <div className="flex-1 h-px bg-white/20" />
            </div>

            {/* Social Login Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 py-3 bg-white/10 rounded-xl border border-white/20 text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-white/15 transition-all"
              >
                <Globe size={18} /> Google
              </button>
              <button
                type="button"
                className="flex-1 py-3 bg-white/10 rounded-xl border border-white/20 text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-white/15 transition-all"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg> Apple
              </button>
            </div>
          </form>
        </div>
      ),
    },

    // SCREEN 2: WELCOME (Enhanced with App Preview)
    {
      id: 'welcome',
      render: () => (
        <div className="flex-1 flex flex-col justify-center px-6">
          {/* Visual */}
          <div className="relative w-40 h-40 mx-auto mb-6">
            <div className="absolute inset-0 bg-secondary/20 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-4 bg-secondary/30 rounded-full animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
            <div className="absolute inset-8 bg-secondary/40 rounded-full animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Network className="text-secondary" size={56} />
            </div>
          </div>

          <p className="text-secondary text-sm font-medium text-center mb-2">Welcome to Network Capital</p>
          <h1 className="text-3xl font-heading font-bold text-white text-center mb-4">Your Network Has Value</h1>
          <p className="text-white/70 text-center mb-8 max-w-xs mx-auto">
            Every connection, every action, every group you join builds your Network Score.
          </p>

          {/* App Preview Section */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-white/50 text-xs text-center mb-3">What's inside</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: MessageSquare, label: 'Social Feed', color: 'text-blue-400' },
                { icon: Users, label: 'Community', color: 'text-purple-400' },
                { icon: TrendingUp, label: 'Earnings', color: 'text-secondary' },
              ].map((item, idx) => (
                <div key={idx} className="text-center">
                  <div className="w-12 h-12 mx-auto bg-white/10 rounded-xl flex items-center justify-center mb-1">
                    <item.icon className={item.color} size={22} />
                  </div>
                  <p className="text-white/70 text-[10px]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },

    // SCREEN 3: THE SHIFT (with Feed Preview)
    {
      id: 'shift',
      render: () => (
        <div className="flex-1 flex flex-col justify-center px-6">
          <p className="text-secondary text-sm font-medium text-center mb-2">The Shift</p>
          <h1 className="text-3xl font-heading font-bold text-white text-center mb-3">Make Your Time Count</h1>
          <p className="text-white/70 text-center mb-6 max-w-xs mx-auto">
            Your engagement now creates measurable value. See how others are earning.
          </p>

          {/* Mini Feed Preview */}
          <div className="space-y-3 mb-4">
            <MockFeedPost 
              username="Thabo M." 
              action="🎉 Just earned a referral bonus!" 
              amount="R50" 
              likes={24} 
              comments={8} 
            />
            <MockFeedPost 
              username="Sarah K." 
              action="Made my weekly contribution to Family Savers stokvel" 
              amount="R200" 
              likes={45} 
              comments={12} 
            />
            <MockFeedPost 
              username="David O." 
              action="Reached Premium tier! 🏆 Now earning 10% rewards" 
              amount="R125" 
              likes={89} 
              comments={23} 
            />
          </div>

          <p className="text-white/50 text-xs text-center">
            Real activity from our community
          </p>
        </div>
      ),
    },

    // SCREEN 4: HOW IT WORKS (Enhanced with descriptions + features)
    {
      id: 'how-it-works',
      render: () => (
        <div className="flex-1 flex flex-col justify-center px-6">
          <p className="text-secondary text-sm font-medium text-center mb-2">Simple Steps</p>
          <h1 className="text-3xl font-heading font-bold text-white text-center mb-6">How It Works</h1>

          {/* Steps with descriptions */}
          <div className="space-y-4 mb-6">
            {[
              { step: '1', icon: Users, label: 'Connect', desc: 'Join the community & find your tribe', color: 'from-blue-500 to-blue-600' },
              { step: '2', icon: Zap, label: 'Engage', desc: 'Post, comment, and participate daily', color: 'from-purple-500 to-purple-600' },
              { step: '3', icon: TrendingUp, label: 'Build', desc: 'Watch your Network Score grow', color: 'from-green-500 to-green-600' },
              { step: '4', icon: Gift, label: 'Unlock', desc: 'Access rewards & financial features', color: 'from-secondary to-yellow-500' },
            ].map((item, idx) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-center gap-4"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0`}>
                  <item.icon className="text-white" size={22} />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{item.label}</p>
                  <p className="text-white/60 text-xs">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Feature Preview Cards */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-white/50 text-xs text-center mb-3">Key Features</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: MessageSquare, label: 'Social Feed' },
                { icon: MessageCircle, label: 'Messaging' },
                { icon: Wallet, label: 'Stokvel+' },
              ].map((item, idx) => (
                <div key={idx} className="bg-white/5 rounded-xl p-3 text-center">
                  <item.icon className="text-secondary mx-auto mb-1" size={20} />
                  <p className="text-white/70 text-[10px]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },

    // SCREEN 5: NETWORK SCORE + REWARDS (MERGED)
    {
      id: 'score-rewards',
      render: () => (
        <div className="flex-1 flex flex-col justify-center px-6">
          <p className="text-secondary text-sm font-medium text-center mb-2">Your Value System</p>
          <h1 className="text-3xl font-heading font-bold text-white text-center mb-2">Network Score & Rewards</h1>
          <p className="text-white/70 text-center mb-6 text-sm">
            Higher score = higher % rewards on your contributions
          </p>

          {/* Score Display */}
          <div className="bg-gradient-to-br from-primary-light to-primary rounded-2xl p-5 mb-4 border border-white/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/80 text-sm">Your Network Score</span>
              <span className="text-3xl font-bold text-secondary">78<span className="text-lg text-white/60">/100</span></span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3 mb-2">
              <div className="h-full bg-gradient-to-r from-secondary to-yellow-400 rounded-full transition-all" style={{ width: '78%' }} />
            </div>
            <p className="text-white/60 text-xs text-right">Boosted Tier</p>
          </div>

          {/* Reward Tiers - Clear explanation */}
          <div className="space-y-2">
            <p className="text-white/50 text-xs mb-2">Reward tiers on your contributions:</p>
            {[
              { tier: 'Basic', range: '41-70', bonus: '3%', desc: 'rewards on contributions', color: 'border-blue-500 bg-blue-500/10' },
              { tier: 'Boosted', range: '71-85', bonus: '7%', desc: 'rewards on contributions', color: 'border-purple-500 bg-purple-500/10', active: true },
              { tier: 'Premium', range: '86-100', bonus: '10%', desc: 'rewards on contributions', color: 'border-secondary bg-secondary/10' },
            ].map((item, idx) => (
              <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border ${item.color} ${item.active ? 'ring-2 ring-secondary' : ''}`}>
                <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">{item.bonus}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm">{item.tier}</p>
                    {item.active && <span className="text-[10px] bg-secondary text-primary px-2 py-0.5 rounded-full font-bold">YOU</span>}
                  </div>
                  <p className="text-white/60 text-xs">Score {item.range} • {item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },

    // SCREEN 6: TRUST + REFERRAL
    {
      id: 'trust-referral',
      render: () => (
        <div className="flex-1 flex flex-col justify-center px-6">
          {/* Trust Section - Simplified */}
          <div className="mb-6">
            <p className="text-secondary text-sm font-medium text-center mb-2">Built on Trust</p>
            <h1 className="text-2xl font-heading font-bold text-white text-center mb-4">Community-Driven System</h1>
            
            <div className="flex gap-3 mb-4">
              {[
                { icon: Shield, label: 'No Guaranteed Returns', color: 'text-blue-400' },
                { icon: Users, label: 'Community-Driven', color: 'text-purple-400' },
                { icon: Zap, label: 'Rewards, Not Profits', color: 'text-secondary' },
              ].map((item, idx) => (
                <div key={idx} className="flex-1 bg-white/5 rounded-xl p-3 text-center border border-white/10">
                  <item.icon className={`${item.color} mx-auto mb-1`} size={20} />
                  <p className="text-white/70 text-[9px] leading-tight">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Referral Section */}
          <div className="bg-gradient-to-br from-secondary/20 to-yellow-500/20 rounded-2xl p-5 border border-secondary/30">
            <div className="text-center mb-4">
              <Share2 className="text-secondary mx-auto mb-2" size={32} />
              <h2 className="text-xl font-bold text-white mb-1">Share & Earn</h2>
              <p className="text-secondary font-bold text-lg">Share with 20 people → Earn $200 USD</p>
            </div>

            {/* Referral Code Display */}
            <div className="bg-white/10 rounded-xl p-4 mb-4 text-center border border-white/20">
              <p className="text-white/60 text-xs mb-1">Your Referral Code</p>
              <p className="text-2xl font-mono font-bold text-secondary tracking-wider">
                {userReferralCode || 'NC' + Date.now().toString().slice(-6)}
              </p>
            </div>

            {/* WhatsApp Share Button */}
            <button
              onClick={handleWhatsAppShare}
              className="w-full py-3.5 rounded-full font-semibold bg-[#25D366] text-white flex items-center justify-center gap-2 hover:bg-[#20BD5A] transition-all mb-3"
              data-testid="whatsapp-share"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Share via WhatsApp
            </button>

            {/* Enter App Button */}
            <button
              onClick={handleEnterApp}
              className="w-full py-3.5 rounded-full font-semibold bg-gradient-to-r from-secondary to-yellow-500 text-primary hover:shadow-lg transition-all"
              data-testid="enter-app"
            >
              Enter App
            </button>
          </div>
        </div>
      ),
    },
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleEnterApp();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const isAuthSlide = currentSlide === 0;
  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] flex flex-col">
      {/* Skip button (not on auth or last slide) */}
      {!isAuthSlide && !isLastSlide && (
        <div className="flex justify-end p-4">
          <button
            onClick={onComplete}
            className="text-white/60 hover:text-white text-sm font-medium transition-colors"
            data-testid="skip-onboarding"
          >
            Skip
          </button>
        </div>
      )}

      {/* Back button on auth slide */}
      {isAuthSlide && (
        <div className="flex justify-start p-4">
          <div className="w-10" /> {/* Spacer */}
        </div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex flex-col"
        >
          {slides[currentSlide].render()}
        </motion.div>
      </AnimatePresence>

      {/* Navigation (not on auth slide or last slide) */}
      {!isAuthSlide && !isLastSlide && (
        <div className="px-6 pb-8 safe-area-pb">          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {slides.slice(1, -1).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx + 1)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx + 1 === currentSlide 
                    ? 'w-8 bg-secondary' 
                    : 'w-2 bg-white/30 hover:bg-white/50'
                }`}
                data-testid={`onboarding-dot-${idx}`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            {currentSlide > 1 && (
              <button
                onClick={prevSlide}
                className="flex-shrink-0 w-14 h-14 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all border border-white/20"
                data-testid="onboarding-prev"
              >
                <ChevronLeft className="text-white" size={24} />
              </button>
            )}
            
            <button
              onClick={nextSlide}
              className="flex-1 h-14 rounded-full font-semibold transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-secondary to-yellow-500 text-primary hover:shadow-lg hover:shadow-secondary/30"
              data-testid="onboarding-next"
            >
              Continue
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
      <BrandAttribution tone="dark" />
    </div>
  );
};

export default OnboardingPage;
