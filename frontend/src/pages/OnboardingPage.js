import React, { useState } from 'react';
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
  Target,
  ArrowRight
} from 'lucide-react';

const OnboardingPage = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 'welcome',
      icon: Network,
      iconColor: 'text-secondary',
      title: 'Your Network Has Value',
      subtitle: 'Welcome to Network Capital',
      description: 'Every connection you make, every action you take, and every group you join builds your Network Score. Transform your social activity into real opportunities.',
      visual: (
        <div className="relative w-48 h-48 mx-auto mb-6">
          <div className="absolute inset-0 bg-secondary/20 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-4 bg-secondary/30 rounded-full animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
          <div className="absolute inset-8 bg-secondary/40 rounded-full animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Network className="text-secondary" size={64} />
          </div>
        </div>
      ),
    },
    {
      id: 'problem-shift',
      icon: Zap,
      iconColor: 'text-primary',
      title: 'Make Your Time Count',
      subtitle: 'The Shift',
      description: 'Hours spent on social media often yield nothing in return. Network Capital changes that. Your engagement, participation, and community contributions now create measurable value.',
      visual: (
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-700 rounded-2xl flex items-center justify-center mb-2 opacity-50">
              <span className="text-3xl">0</span>
            </div>
            <p className="text-xs text-text-muted">Before</p>
          </div>
          <ArrowRight className="text-secondary" size={32} />
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-secondary to-primary rounded-2xl flex items-center justify-center mb-2">
              <TrendingUp className="text-white" size={32} />
            </div>
            <p className="text-xs text-secondary font-medium">Now</p>
          </div>
        </div>
      ),
    },
    {
      id: 'how-it-works',
      icon: Target,
      iconColor: 'text-secondary',
      title: 'How It Works',
      subtitle: 'Simple Steps to Success',
      description: 'Connect with your community, engage consistently, build your Network Score, and unlock opportunities based on your participation.',
      visual: (
        <div className="grid grid-cols-4 gap-2 mb-6">
          {[
            { step: '1', label: 'Connect', icon: Users },
            { step: '2', label: 'Engage', icon: Zap },
            { step: '3', label: 'Build', icon: TrendingUp },
            { step: '4', label: 'Unlock', icon: Gift },
          ].map((item, idx) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.15 }}
              className="text-center"
            >
              <div className="w-14 h-14 mx-auto bg-white/10 rounded-xl flex items-center justify-center mb-2 border border-white/20">
                <item.icon className="text-secondary" size={24} />
              </div>
              <p className="text-xs text-white/80">{item.label}</p>
            </motion.div>
          ))}
        </div>
      ),
    },
    {
      id: 'score-stokvel',
      icon: TrendingUp,
      iconColor: 'text-secondary',
      title: 'Network Score & Stokvel+',
      subtitle: 'Your Activity Matters',
      description: 'Your Network Score (0-100) reflects your contribution consistency, engagement, and group participation. Join Stokvel+ savings groups to pool resources with your community and grow together.',
      visual: (
        <div className="space-y-4 mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/80">Network Score</span>
              <span className="text-xl font-bold text-secondary">78/100</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div className="h-full bg-secondary rounded-full" style={{ width: '78%' }} />
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <Users className="text-primary" size={24} />
              <div>
                <p className="text-sm font-medium text-white">Stokvel+ Groups</p>
                <p className="text-xs text-white/60">Community savings pools</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'rewards-access',
      icon: Gift,
      iconColor: 'text-secondary',
      title: 'Rewards & Smart Access',
      subtitle: 'Activity-Based Incentives',
      description: 'Earn tier-based incentives through consistent participation. Higher scores may qualify for Smart Access to pooled funds. All benefits are based on your activity and platform performance.',
      visual: (
        <div className="space-y-3 mb-6">
          {[
            { tier: 'Basic', range: '41-70', bonus: '3%', color: 'bg-blue-500' },
            { tier: 'Boosted', range: '71-85', bonus: '7%', color: 'bg-purple-500' },
            { tier: 'Premium', range: '86-100', bonus: '10%', color: 'bg-secondary' },
          ].map((item, idx) => (
            <motion.div
              key={item.tier}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-center gap-3 bg-white/10 rounded-xl p-3 border border-white/20"
            >
              <div className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center`}>
                <span className="text-white text-xs font-bold">{item.bonus}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">{item.tier}</p>
                <p className="text-xs text-white/60">Score {item.range}</p>
              </div>
            </motion.div>
          ))}
          <p className="text-xs text-white/50 text-center mt-3 px-4">
            Rewards are activity-based incentives, not guaranteed income. Benefits depend on participation and platform performance.
          </p>
        </div>
      ),
    },
    {
      id: 'trust',
      icon: Shield,
      iconColor: 'text-primary',
      title: 'Built on Trust',
      subtitle: 'Community-Driven System',
      description: 'Network Capital is not a bank or investment platform. We do not guarantee returns or profits. All benefits are earned through genuine participation and are subject to platform terms.',
      visual: (
        <div className="space-y-3 mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-start gap-3">
              <Shield className="text-primary flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-white mb-1">No Guaranteed Returns</p>
                <p className="text-xs text-white/60">Benefits depend on your activity and group performance</p>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-start gap-3">
              <Users className="text-secondary flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-white mb-1">Community-Driven</p>
                <p className="text-xs text-white/60">Powered by member participation and engagement</p>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-start gap-3">
              <Zap className="text-secondary flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-white mb-1">Rewards, Not Profits</p>
                <p className="text-xs text-white/60">Incentives based on your contribution, not investments</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const currentSlideData = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary to-[#0a1628] flex flex-col">
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <button
          onClick={onComplete}
          className="text-white/60 hover:text-white text-sm font-medium transition-colors"
          data-testid="skip-onboarding"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            {/* Visual */}
            {currentSlideData.visual}

            {/* Subtitle */}
            <p className="text-secondary text-sm font-medium mb-2">
              {currentSlideData.subtitle}
            </p>

            {/* Title */}
            <h1 className="text-3xl font-heading font-bold text-white mb-4">
              {currentSlideData.title}
            </h1>

            {/* Description */}
            <p className="text-white/70 text-base leading-relaxed max-w-sm mx-auto">
              {currentSlideData.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="px-6 pb-8 safe-area-pb">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === currentSlide 
                  ? 'w-8 bg-secondary' 
                  : 'w-2 bg-white/30 hover:bg-white/50'
              }`}
              data-testid={`onboarding-dot-${idx}`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {currentSlide > 0 && (
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
            className={`flex-1 h-14 rounded-full font-medium transition-all flex items-center justify-center gap-2 ${
              isLastSlide
                ? 'bg-secondary hover:bg-secondary-hover text-white'
                : 'bg-white hover:bg-white/90 text-primary'
            }`}
            data-testid="onboarding-next"
          >
            {isLastSlide ? 'Get Started' : 'Continue'}
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
