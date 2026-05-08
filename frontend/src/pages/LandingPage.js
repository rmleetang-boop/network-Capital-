import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Users, TrendingUp, Sparkles, Star } from 'lucide-react';
import Footer from '../components/Footer';
import { axiosInstance } from '../App';

const LandingPage = ({ onContinue }) => {
  const navigate = useNavigate();
  const cta = () => { if (onContinue) onContinue(); navigate('/auth'); };
  const [founder, setFounder] = useState(null);

  useEffect(() => {
    axiosInstance.get('/founders/status')
      .then((r) => setFounder(r.data))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#0a1628] text-white" data-testid="landing-page">
      {/* Top utility bar */}
      <header className="sticky top-0 z-30 bg-[#0a1628]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="https://customer-assets.emergentagent.com/job_fc3cb5f0-3a8d-48cd-b3b3-8fcdd6e615e4/artifacts/q3f2xfwr_Network%20Capital_%20Logo%20Mark.png"
              alt="Network Capital"
              className="h-9 w-9 rounded-lg object-cover"
            />
            <span className="font-heading font-bold tracking-tight text-sm">Network Capital</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/auth')}
              className="hidden sm:inline-flex text-sm text-white/80 hover:text-white px-3 py-2"
              data-testid="landing-login-link"
            >
              Log in
            </button>
            <button
              onClick={cta}
              className="bg-secondary hover:brightness-110 text-primary text-sm font-bold px-4 py-2 rounded-full active:scale-95 transition-all"
              data-testid="landing-get-started"
            >
              Join the Circle
            </button>
          </div>
        </div>
      </header>

      {/* HERO — single, clean focal point */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-60 pointer-events-none" style={{
          background: 'radial-gradient(60% 80% at 80% 0%, rgba(245,215,110,0.20) 0%, transparent 60%), radial-gradient(50% 60% at 0% 100%, rgba(124,58,237,0.18) 0%, transparent 60%)',
        }} />
        <div className="max-w-4xl mx-auto px-6 py-20 sm:py-28 relative text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] uppercase tracking-wider" data-testid="hero-trust-pill">
              <ShieldCheck size={13} className="text-secondary" /> POPIA-aligned · Community-first
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold leading-[1.05] mb-5">
              Build Value Through<br />
              <span className="bg-gradient-to-r from-secondary via-yellow-300 to-secondary bg-clip-text text-transparent">Community Participation</span>
            </h1>

            <p className="text-base sm:text-lg text-white/75 max-w-2xl mx-auto mb-8 leading-relaxed" data-testid="hero-subheading">
              A <strong className="text-white">Community Resource Ecosystem</strong>. We coordinate social capital and economic participation — so groups can access opportunities together that no one could unlock alone.
            </p>

            <button
              onClick={cta}
              className="bg-secondary hover:brightness-110 text-primary px-8 py-4 rounded-full font-bold inline-flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-secondary/20"
              data-testid="hero-cta-primary"
            >
              Join the Circle <ArrowRight size={18} />
            </button>

            <p className="text-[12px] text-white/50 mt-4 max-w-md mx-auto" data-testid="hero-clarity">
              Not a financial service. No promised returns. Real coordination of shared access.
            </p>

            {founder && founder.active && (
              <div className="mt-6 inline-flex flex-col items-center gap-1 px-4 py-3 rounded-2xl bg-secondary/10 border border-secondary/30" data-testid="founder-counter">
                <div className="flex items-center gap-2 text-secondary font-semibold text-sm">
                  <Star size={14} />
                  Founding Member · {founder.available} of {founder.limit} spots left
                </div>
                <p className="text-[11px] text-white/65">
                  First {founder.limit} members get a <strong className="text-secondary">2× Network Score</strong> for {founder.duration_days} days.
                </p>
              </div>
            )}

            <p className="text-[11px] text-white/40 mt-6" data-testid="cross-platform-note">
              Web today · <strong className="text-white/60">iOS + Android apps coming soon</strong>
            </p>
          </motion.div>
        </div>
      </section>

      {/* THREE BENEFITS — clean, minimal */}
      <section className="max-w-5xl mx-auto px-6 pb-20" data-testid="benefits-section">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Users, title: 'Coordinate as a group', body: 'Join a circle and access suppliers, events, tools, and benefits that take a community to unlock — not a balance sheet.' },
            { icon: TrendingUp, title: 'Earn reputation, not returns', body: 'Your Network Score measures contribution — consistency, sharing, referrals, milestones. It is a social-capital signal, not a payout.' },
            { icon: Sparkles, title: 'Unlock real shared access', body: 'Higher tiers unlock group products, event privileges, and Stokvel eligibility — access you hold because you showed up, not because you paid more.' },
          ].map((c, i) => {
            const I = c.icon;
            return (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left"
                data-testid={`benefit-${i + 1}`}
              >
                <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center mb-3">
                  <I size={20} className="text-secondary" />
                </div>
                <h3 className="font-heading font-bold text-base mb-2">{c.title}</h3>
                <p className="text-sm text-white/65 leading-relaxed">{c.body}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
