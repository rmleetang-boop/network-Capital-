import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, ArrowRight, Users, MessageSquare, Trophy, TrendingUp,
  Lock, ShieldCheck as ShieldIcon, Users2, Star, Crown, Bell, Wallet,
  Activity, BarChart3, Briefcase, UserPlus, Megaphone, Home, Compass,
  Globe2, User, Store, MapPin, PiggyBank, Package,
} from 'lucide-react';
import Footer from '../components/Footer';
import BrandImg from '../components/BrandImg';
import { axiosInstance } from '../App';

/** Premium landing — Deep Navy + Brand Gold (#E8A817).  Composition mirrors the
 *  reference: dark hero with phone mockup → light "How It Works" steps → dark
 *  Ambassador band → light trust strip → footer.  All copy stays
 *  compliance-safe (no "investing", "returns", "profit"). */
const LandingPage = ({ onContinue }) => {
  const navigate = useNavigate();
  const cta = () => { if (onContinue) onContinue(); navigate('/auth'); };
  const [founder, setFounder] = useState(null);

  useEffect(() => {
    axiosInstance.get('/founders/status')
      .then((r) => setFounder(r.data))
      .catch(() => {});
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#04101e] text-white" data-testid="landing-page">
      {/* ─── NAV ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#04101e]/85 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3"
            data-testid="landing-logo"
          >
            <BrandImg src="/brand/logo-mark.png" alt="" className="h-10 w-10 rounded-lg" />
            <span className="font-heading font-bold tracking-wide text-base hidden sm:inline">
              NETWORK <span className="font-light">CAPITAL</span>
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-8 text-sm text-white/80">
            <button onClick={() => scrollTo('about')} className="hover:text-white" data-testid="nav-about">About Us</button>
            <button onClick={() => scrollTo('features')} className="hover:text-white" data-testid="nav-features">Features</button>
            <button onClick={() => scrollTo('ambassador')} className="hover:text-white" data-testid="nav-ambassador">Ambassador</button>
            <button onClick={() => scrollTo('contact')} className="hover:text-white" data-testid="nav-contact">Contact</button>
          </nav>

          <button
            onClick={cta}
            className="bg-[#E8A817] hover:bg-[#F0B800] text-[#04101e] text-sm font-bold px-5 py-2.5 rounded-full active:scale-95 transition-all shadow-[0_8px_24px_-8px_rgba(232,168,23,0.55)]"
            data-testid="nav-get-started"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* ─── HERO ────────────────────────────────────────────────── */}
      <section id="about" className="relative overflow-hidden">
        {/* Skyline / network glow backdrop */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(80% 60% at 90% 20%, rgba(59,130,246,0.18) 0%, transparent 60%),'
                + 'radial-gradient(70% 60% at 10% 90%, rgba(232,168,23,0.10) 0%, transparent 60%),'
                + 'linear-gradient(180deg, #04101e 0%, #061a30 60%, #04101e 100%)',
            }}
          />
          {/* Subtle network grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.18]" preserveAspectRatio="none" viewBox="0 0 1200 700">
            <defs>
              <linearGradient id="ln" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#E8A817" stopOpacity="0" />
                <stop offset="50%" stopColor="#E8A817" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#E8A817" stopOpacity="0" />
              </linearGradient>
            </defs>
            {Array.from({ length: 14 }).map((_, i) => (
              <line key={i} x1={-100 + i * 110} y1="700" x2={100 + i * 130} y2="380"
                    stroke="url(#ln)" strokeWidth="0.6" />
            ))}
            {Array.from({ length: 30 }).map((_, i) => (
              <circle key={i} cx={(i * 53) % 1200} cy={420 + (i * 19) % 280} r={1.2}
                      fill="#E8A817" opacity={0.35 + ((i * 7) % 50) / 100} />
            ))}
          </svg>
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-24 lg:py-28 grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-7"
          >
            <div className="text-[11px] font-bold tracking-[0.25em] text-[#E8A817] mb-5" data-testid="hero-kicker">
              DIGITAL INFRASTRUCTURE
            </div>

            <h1 className="font-heading font-bold leading-[0.95] tracking-tight text-[44px] sm:text-6xl lg:text-7xl mb-6">
              Build A Better<br />Future<br />
              <span className="bg-gradient-to-r from-[#F0B800] via-[#E8A817] to-[#F0B800] bg-clip-text text-transparent">
                Through Your Network
              </span>
            </h1>

            <p className="text-base sm:text-lg text-white/70 max-w-xl mb-9 leading-relaxed" data-testid="hero-subheading">
              Network Capital is the digital infrastructure that helps you
              connect, engage, access opportunities, and grow through meaningful
              participation.
            </p>

            <div className="flex flex-wrap gap-3 mb-6">
              <button
                onClick={cta}
                className="bg-[#E8A817] hover:bg-[#F0B800] text-[#04101e] font-bold px-8 py-4 rounded-xl inline-flex items-center gap-2 active:scale-95 transition-all shadow-[0_12px_30px_-12px_rgba(232,168,23,0.7)]"
                data-testid="hero-cta-primary"
              >
                Get Started <ArrowRight size={18} />
              </button>
              <button
                onClick={() => scrollTo('how')}
                className="border-2 border-white/25 hover:border-[#E8A817] hover:text-[#E8A817] text-white font-semibold px-8 py-4 rounded-xl transition-all"
                data-testid="hero-cta-secondary"
              >
                Learn More
              </button>
            </div>

            <div className="inline-flex items-center gap-2 text-[12px] text-white/55" data-testid="hero-compliance">
              <ShieldCheck size={13} className="text-[#E8A817]" />
              POPIA-aligned · Not a financial service · No promised returns
            </div>

            {founder && founder.active && (
              <div className="mt-7 inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#E8A817]/10 border border-[#E8A817]/30" data-testid="founder-counter">
                <Star size={14} className="text-[#E8A817]" />
                <span className="text-[#E8A817] font-semibold text-sm">
                  Founding Member · {founder.available} of {founder.limit} spots · 2× score for {founder.duration_days} days
                </span>
              </div>
            )}
          </motion.div>

          {/* Right — phone mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="lg:col-span-5 flex justify-center lg:justify-end"
          >
            <PhoneMockup />
          </motion.div>
        </div>
      </section>

      {/* ─── FEATURES (premium) ─────────────────────────────────── */}
      <section
        id="features"
        className="relative bg-[#04101e] text-white py-20 lg:py-24 overflow-hidden"
        data-testid="landing-features-section"
      >
        {/* Halo accents */}
        <div
          className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full pointer-events-none opacity-50 blur-3xl"
          style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(232,168,23,0.18) 0%, transparent 65%)' }}
        />
        <div
          className="absolute -bottom-40 right-0 w-[420px] h-[420px] rounded-full pointer-events-none opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(30,79,165,0.35) 0%, transparent 65%)' }}
        />
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),'
              + 'linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        <div className="relative max-w-6xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-12 lg:mb-16">
            <div className="text-[11px] font-bold tracking-[0.3em] text-[#E8A817] mb-3">FEATURES</div>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl mb-4 leading-tight">
              Everything you need to <span className="text-[#E8A817]">build influence</span><br className="hidden sm:block" />
              across <span className="italic font-light">54</span> African countries.
            </h2>
            <p className="text-sm sm:text-base text-white/65 max-w-2xl mx-auto">
              Network Capital pairs world-class community tools with locally-relevant rewards.
              Every feature is built for engagement, recognition, and shared progression.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4" data-testid="features-grid">
            {FEATURES.map((f, i) => <FeatureTile key={f.title} {...f} delay={i * 0.05} />)}
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto" data-testid="features-trust">
            {[
              { icon: ShieldCheck, k: 'POPIA-aligned' },
              { icon: Globe2, k: 'Pan-African (54 countries)' },
              { icon: Crown, k: 'Premium for $10' },
            ].map((b) => (
              <div key={b.k} className="bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 inline-flex items-center justify-center gap-2 text-xs sm:text-sm text-white/80">
                <b.icon size={14} className="text-[#E8A817]" />
                <span className="font-semibold">{b.k}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ───────────────────────────────────────── */}
      <section id="how" className="bg-[#F4F6FA] text-[#04101e] py-20 lg:py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-14">
            <div className="text-[11px] font-bold tracking-[0.3em] text-[#E8A817] mb-3">HOW IT WORKS</div>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl text-[#04101e]">
              Simple Actions. Real Progress.
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-6 lg:hidden">
            {STEPS.map((s, i) => <StepCard key={s.label} step={i + 1} {...s} />)}
          </div>
          <div className="hidden lg:flex items-start justify-between gap-2">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.label}>
                <div className="flex-1 max-w-[200px]">
                  <StepCard step={i + 1} {...s} />
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex items-center pt-7 shrink-0">
                    <ArrowRight size={20} className="text-[#C4CDD9]" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AMBASSADOR BAND ────────────────────────────────────── */}
      <section id="ambassador" className="bg-[#F4F6FA] pb-12 lg:pb-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div
            className="relative overflow-hidden rounded-3xl border border-[#E8A817]/20 shadow-2xl"
            style={{
              background:
                'radial-gradient(80% 100% at 0% 100%, rgba(232,168,23,0.18) 0%, transparent 60%),'
                + 'linear-gradient(135deg, #04101e 0%, #0a1f3a 100%)',
            }}
            data-testid="ambassador-band"
          >
            <div className="relative grid lg:grid-cols-12 gap-8 lg:gap-12 p-8 sm:p-12 lg:p-16 items-center">
              {/* Shield */}
              <div className="lg:col-span-5 flex justify-center lg:justify-start">
                <AmbassadorBadge />
              </div>
              {/* Copy */}
              <div className="lg:col-span-7">
                <div className="text-[11px] font-bold tracking-[0.25em] text-[#E8A817] mb-3">MAKE AN IMPACT</div>
                <h3 className="font-heading font-bold text-3xl sm:text-4xl lg:text-[40px] leading-tight text-white mb-4">
                  Become A Network Capital Ambassador
                </h3>
                <p className="text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mb-7">
                  Help grow the community, invite new members, build your influence,
                  and unlock exclusive rewards through the Network Capital Ambassador
                  Program.
                </p>
                <button
                  onClick={() => navigate('/ambassadors/apply')}
                  className="bg-[#E8A817] hover:bg-[#F0B800] text-[#04101e] font-bold px-7 py-3.5 rounded-xl inline-flex items-center gap-2 active:scale-95 transition-all shadow-[0_12px_28px_-10px_rgba(232,168,23,0.7)]"
                  data-testid="ambassador-cta"
                >
                  Become An Ambassador <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST STRIP ────────────────────────────────────────── */}
      <section id="contact" className="bg-[#F4F6FA] pb-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-white border border-[#E5E9F0] rounded-2xl p-6 lg:p-8 shadow-sm">
            {TRUST.map((t) => {
              const I = t.icon;
              return (
                <div key={t.title} className="flex items-start gap-4" data-testid={`trust-${t.testid}`}>
                  <div className="w-12 h-12 rounded-full bg-[#F4F6FA] border border-[#E5E9F0] flex items-center justify-center shrink-0">
                    <I size={20} className="text-[#04101e]" />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-[#04101e] text-base mb-0.5">{t.title}</h4>
                    <p className="text-sm text-[#6B7C93] leading-snug">{t.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="border-t border-white/10 bg-[#04101e] px-6 py-8" data-testid="powered-by-aridja">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 text-center">
          <img src="/network-capital-symbol.png" alt="Aridja AI symbol" className="h-8 w-8 rounded-lg object-contain" />
          <span className="text-xs font-semibold tracking-wide text-white/55">
            Powered by <span className="text-white/85">Aridja AI</span>
          </span>
        </div>
      </div>

      <Footer />
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   Step data — Step 1 = "Create A Profile" per requirement.
   ─────────────────────────────────────────────────────────── */
const STEPS = [
  {
    label: 'CREATE A PROFILE',
    body: 'Set up your account and join the community.',
    icon: UserPlus,
    bg: 'bg-[#04101e]',
    iconColor: 'text-white',
  },
  {
    label: 'CONNECT',
    body: 'Build meaningful relationships.',
    icon: Users,
    bg: 'bg-[#1E4FA5]',
    iconColor: 'text-white',
  },
  {
    label: 'ENGAGE',
    body: 'Participate in activities and communities.',
    icon: MessageSquare,
    bg: 'bg-[#2563EB]',
    iconColor: 'text-white',
  },
  {
    label: 'EARN SCORE',
    body: 'Your engagement is recognized and rewarded.',
    icon: Trophy,
    bg: 'bg-[#E8A817]',
    iconColor: 'text-[#04101e]',
  },
  {
    label: 'UNLOCK OPPORTUNITIES',
    body: 'Access opportunities that help you grow.',
    icon: TrendingUp,
    bg: 'bg-[#04101e]',
    iconColor: 'text-white',
  },
];

const StepCard = ({ step, label, body, icon: Icon, bg, iconColor }) => (
  <div className="flex flex-col items-center text-center px-2" data-testid={`step-${step}`}>
    <div className={`relative w-20 h-20 rounded-full ${bg} flex items-center justify-center mb-5 shadow-lg`}>
      <Icon size={32} className={iconColor} />
      <span className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-white text-[#04101e] border-2 border-[#04101e] text-[11px] font-bold flex items-center justify-center">
        {step}
      </span>
    </div>
    <div className="font-heading font-bold text-sm tracking-wide text-[#04101e] mb-2">{label}</div>
    <p className="text-sm text-[#6B7C93] leading-relaxed max-w-[180px]">{body}</p>
  </div>
);

const TRUST = [
  { title: 'Secure Platform', body: 'Your data, your trust. Protected always.', icon: Lock, testid: 'secure' },
  { title: 'Compliance Focused', body: 'Built with compliance, governance and transparency.', icon: ShieldIcon, testid: 'compliance' },
  { title: 'Built For Communities', body: 'Empowering individuals and communities to grow.', icon: Users2, testid: 'communities' },
];

/* ──────────────────────────────────────────────────────────────
   Premium features grid — mirrors in-app modules, dark palette,
   gold accents. Each tile has icon halo + chevron + hover-lift.
   ─────────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: Users,         title: 'My Network',      body: 'Three-lane connection graph: social, financial, professional.',           tag: 'CORE' },
  { icon: Store,         title: 'My Store',        body: 'Spin up a free storefront. Sell products, services, or digital downloads.', tag: 'NEW' },
  { icon: Package,       title: 'Creator System',  body: 'Publish products in under 2 minutes — independent or with platform support.', tag: 'NEW' },
  { icon: PiggyBank,     title: 'Stokvels',        body: 'Group savings circles with shared backing pools and milestone payouts.',  tag: 'COMMUNITY' },
  { icon: Activity,      title: 'Activities',      body: 'Discover events, meetups and community moments near you.',                tag: 'COMMUNITY' },
  { icon: MapPin,        title: 'My Places',       body: 'Trustpilot-style reviews for local businesses across 54 countries.',      tag: 'COMMUNITY' },
  { icon: Wallet,        title: 'Stokvel+ Wallet', body: 'Multi-currency wallet, group savings & shared backing pools.',           tag: 'PREMIUM' },
  { icon: BarChart3,     title: 'Net Worth',       body: 'Track your network capital across every relationship lane.',             tag: 'INSIGHTS' },
  { icon: Trophy,        title: 'Score Tracker',   body: 'Earn Network Score from real engagement — uncapped & ranked.',          tag: 'GAMIFIED' },
  { icon: Briefcase,     title: 'Jobs',            body: 'Post & apply for roles — admins moderate every application.',           tag: 'OPPORTUNITY' },
  { icon: MessageSquare, title: 'Direct Messages', body: 'Encrypted in-app messaging with media and stokvel handoffs.',           tag: 'COMMS' },
  { icon: Crown,         title: 'Ambassador',      body: 'R8,500 ZAR allocation + tiered withdrawals on referral milestones.',    tag: 'TOP TIER' },
  { icon: Megaphone,     title: 'Promotions',      body: 'Time-windowed SAST campaigns. Earn at R10/100 pts conversion.',         tag: 'REWARDS' },
];

const FeatureTile = ({ icon: Icon, title, body, tag, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.4 }}
    transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    whileHover={{ y: -4 }}
    className="group relative bg-gradient-to-br from-white/[0.06] to-white/[0.02] hover:from-[#E8A817]/[0.10] hover:to-white/[0.04] border border-white/10 hover:border-[#E8A817]/40 rounded-3xl p-5 sm:p-6 transition-all duration-300 cursor-default overflow-hidden"
    data-testid={`feature-tile-${title.toLowerCase().replace(/\s+/g, '-')}`}
  >
    {/* gold halo on hover */}
    <div
      className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
      style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(232,168,23,0.35) 0%, transparent 70%)' }}
    />
    <div className="relative flex items-start justify-between mb-4">
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#E8A817]/30 to-[#E8A817]/5 border border-[#E8A817]/30 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform duration-300">
        <Icon size={20} className="text-[#E8A817]" />
      </div>
      <span className="text-[9px] font-bold tracking-widest text-[#E8A817]/80 bg-[#E8A817]/10 border border-[#E8A817]/20 px-2 py-0.5 rounded-full">
        {tag}
      </span>
    </div>
    <h3 className="relative font-heading font-bold text-base sm:text-lg text-white mb-1.5">{title}</h3>
    <p className="relative text-xs sm:text-sm text-white/60 leading-relaxed">{body}</p>
    <ArrowRight size={14} className="relative mt-3 text-white/30 group-hover:text-[#E8A817] group-hover:translate-x-1 transition-all duration-300" />
  </motion.div>
);


/* ──────────────────────────────────────────────────────────────
   Phone mockup — pure CSS, mirrors the in-app dashboard tile grid.
   ─────────────────────────────────────────────────────────── */
const PhoneMockup = () => (
  <div className="relative" data-testid="hero-phone-mockup">
    {/* Soft halo behind phone */}
    <div
      className="absolute -inset-12 rounded-[60px] blur-3xl opacity-50 pointer-events-none"
      style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(232,168,23,0.30) 0%, transparent 70%)' }}
    />
    <div
      className="relative w-[300px] sm:w-[330px] h-[640px] rounded-[48px] p-[3px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)]"
      style={{ background: 'linear-gradient(160deg, #C9A24A 0%, #4a3a18 30%, #1a1408 60%, #C9A24A 100%)' }}
    >
      {/* Phone body */}
      <div className="relative w-full h-full rounded-[45px] bg-[#04101e] overflow-hidden border border-black/40">
        {/* Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-10" />
        {/* Status bar */}
        <div className="flex items-center justify-between px-7 pt-3 pb-1 text-[11px] text-white/90">
          <span className="font-semibold">9:41</span>
          <span className="opacity-80">●●●● 5G</span>
        </div>

        <div className="px-4 pt-6 pb-4 h-full overflow-hidden">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-[#1E4FA5] flex items-center justify-center text-white text-lg font-bold">+</div>
              <div className="leading-tight">
                <div className="text-[10px] text-white/55">Welcome back,</div>
                <div className="text-sm font-bold">Networker <span>👋</span></div>
              </div>
            </div>
            <Bell size={18} className="text-white/70" />
          </div>

          {/* Invite friends banner */}
          <div className="flex items-center justify-between bg-[#0f1d35]/80 border border-white/5 rounded-xl px-3 py-2.5 mb-4">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-white/75" />
              <span className="text-xs text-white/85">Invite Friends</span>
            </div>
            <span className="text-[10px] font-bold text-[#E8A817]">+200 pts</span>
          </div>

          {/* Tile grid — 3×3 */}
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            <Tile icon={Users} label="My Network" />
            <Tile icon={Activity} label="Activities" />
            <Tile icon={Wallet} label="Wallet" />
            <Tile icon={BarChart3} label="Net Worth" />
            <Tile icon={Trophy} label="Score Tracker" highlight />
            <Tile icon={Briefcase} label="Jobs" />
            <Tile icon={ShieldCheck} label="Stokvel+" />
            <Tile icon={Crown} label="Become Ambassador" gold />
            <Tile icon={Megaphone} label="Promotions" />
          </div>

          {/* Progress overview */}
          <div className="bg-[#0f1d35]/80 border border-white/5 rounded-xl p-3">
            <div className="text-[10px] text-white/55 mb-2">Your Progress Overview</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-white/55">Total Score</div>
                <div className="text-base font-bold text-white">12,450 <span className="text-[10px] text-white/55 font-medium">pts</span></div>
              </div>
              <ProgressRing pct={85} />
            </div>
          </div>
        </div>

        {/* Bottom tab bar */}
        <div className="absolute bottom-0 inset-x-0 bg-[#04101e]/95 border-t border-white/5 px-3 py-2.5 flex items-center justify-between text-[9px] text-white/60">
          <TabIcon icon={Home} label="Feed" />
          <TabIcon icon={Compass} label="Explore" />
          <TabIcon icon={Globe2} label="Hubs" />
          <TabIcon icon={ShieldCheck} label="Stokvel+" />
          <TabIcon icon={User} label="Profile" active />
        </div>
      </div>
    </div>
  </div>
);

const Tile = ({ icon: Icon, label, highlight, gold }) => (
  <div
    className={`rounded-xl px-1.5 py-3 flex flex-col items-center gap-1.5 border ${
      gold
        ? 'bg-[#E8A817]/15 border-[#E8A817]/40'
        : highlight
          ? 'bg-[#1E4FA5]/30 border-[#1E4FA5]/50'
          : 'bg-[#0f1d35]/80 border-white/5'
    }`}
  >
    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${gold ? 'bg-[#E8A817]/30' : 'bg-white/5'}`}>
      <Icon size={16} className={gold ? 'text-[#E8A817]' : 'text-white/80'} />
    </div>
    <div className="text-[8.5px] text-center text-white/80 leading-tight">{label}</div>
  </div>
);

const TabIcon = ({ icon: Icon, label, active }) => (
  <div className="flex flex-col items-center gap-0.5">
    <Icon size={16} className={active ? 'text-[#E8A817]' : 'text-white/55'} />
    <span className={active ? 'text-[#E8A817]' : ''}>{label}</span>
  </div>
);

const ProgressRing = ({ pct }) => {
  const r = 22; const c = 2 * Math.PI * r;
  return (
    <div className="relative w-14 h-14">
      <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
        <circle cx="30" cy="30" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="5" fill="none" />
        <circle
          cx="30" cy="30" r={r}
          stroke="#E8A817" strokeWidth="5" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">{pct}%</div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   Ambassador shield badge — pure SVG/CSS for crispness.
   ─────────────────────────────────────────────────────────── */
const AmbassadorBadge = () => (
  <div
    className="relative w-[240px] h-[290px] sm:w-[280px] sm:h-[330px]"
    data-testid="ambassador-shield"
  >
    {/* Glow */}
    <div
      className="absolute -inset-6 rounded-full blur-3xl opacity-60"
      style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(232,168,23,0.45) 0%, transparent 70%)' }}
    />
    <svg viewBox="0 0 240 290" className="relative w-full h-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
      <defs>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0B800" />
          <stop offset="50%" stopColor="#E8A817" />
          <stop offset="100%" stopColor="#8a6210" />
        </linearGradient>
        <linearGradient id="shieldFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a2042" />
          <stop offset="100%" stopColor="#04101e" />
        </linearGradient>
      </defs>
      {/* Crown */}
      <g transform="translate(120 18)">
        <polygon points="-26,12 -18,-8 -8,8 0,-14 8,8 18,-8 26,12 22,16 -22,16" fill="url(#goldGrad)" stroke="#8a6210" strokeWidth="1.5" />
        <circle cx="-18" cy="-12" r="3" fill="#F0B800" />
        <circle cx="0" cy="-18" r="3" fill="#F0B800" />
        <circle cx="18" cy="-12" r="3" fill="#F0B800" />
      </g>
      {/* Shield body */}
      <path
        d="M 120 38 L 30 60 L 30 170 Q 30 210 120 250 Q 210 210 210 170 L 210 60 Z"
        fill="url(#shieldFill)" stroke="url(#goldGrad)" strokeWidth="5"
      />
      {/* Inner accent line */}
      <path
        d="M 120 50 L 42 68 L 42 168 Q 42 200 120 235 Q 198 200 198 168 L 198 68 Z"
        fill="none" stroke="url(#goldGrad)" strokeWidth="1.4" opacity="0.6"
      />
      {/* N monogram */}
      <text x="120" y="172" textAnchor="middle"
            fontFamily="Manrope, sans-serif" fontWeight="900" fontSize="115"
            fill="url(#goldGrad)">N</text>
      {/* Ribbon */}
      <g>
        <polygon points="40,200 200,200 210,225 200,250 40,250 30,225" fill="url(#goldGrad)" stroke="#8a6210" strokeWidth="1.5" />
        <polygon points="30,225 10,250 40,250" fill="#8a6210" />
        <polygon points="210,225 230,250 200,250" fill="#8a6210" />
        <text x="120" y="232" textAnchor="middle"
              fontFamily="Manrope, sans-serif" fontWeight="900" fontSize="20"
              letterSpacing="3" fill="#04101e">AMBASSADOR</text>
      </g>
      {/* Stars */}
      <g fill="#F0B800">
        <polygon points="100,270 102,275 107,275 103,278 105,283 100,280 95,283 97,278 93,275 98,275" />
        <polygon points="120,272 122,277 127,277 123,280 125,285 120,282 115,285 117,280 113,277 118,277" />
        <polygon points="140,270 142,275 147,275 143,278 145,283 140,280 135,283 137,278 133,275 138,275" />
      </g>
    </svg>
  </div>
);

export default LandingPage;
