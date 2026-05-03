import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Sparkles, Users, TrendingUp, Trophy, ArrowRight,
  CheckCircle2, Target, Network, Lock, Eye, Coins, Hand,
} from 'lucide-react';
import { axiosInstance } from '../App';
import LiveActivityFeed from '../components/LiveActivityFeed';
import Footer from '../components/Footer';

const LandingPage = ({ onContinue }) => {
  const navigate = useNavigate();
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    axiosInstance.get('/leaderboard/public?limit=10').then((r) => setLeaders(r.data.leaders || [])).catch(() => {});
  }, []);

  const cta = () => {
    if (onContinue) onContinue();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-[#0a1628] text-white" data-testid="landing-page">
      {/* Top utility bar */}
      <header className="sticky top-0 z-30 bg-[#0a1628]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="https://customer-assets.emergentagent.com/job_network-capital/artifacts/ujjy9ep3_185322.png"
              alt="Network Capital"
              className="h-8 w-auto"
            />
            <span className="font-heading font-bold tracking-tight">Network Capital</span>
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

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 opacity-50 pointer-events-none" style={{
          background: 'radial-gradient(60% 80% at 80% 0%, rgba(245,215,110,0.18) 0%, transparent 60%), radial-gradient(50% 60% at 0% 100%, rgba(124,58,237,0.18) 0%, transparent 60%)',
        }} />
        <div className="max-w-6xl mx-auto px-6 py-14 sm:py-20 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7">
              {/* Trust pill */}
              <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] uppercase tracking-wider" data-testid="hero-trust-pill">
                <ShieldCheck size={13} className="text-secondary" /> POPIA-aligned · Transparent · Community-first
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold leading-[1.05] mb-5">
                Build Value Through<br />
                <span className="bg-gradient-to-r from-secondary via-yellow-300 to-secondary bg-clip-text text-transparent">Community Participation</span>
              </h1>

              <p className="text-base sm:text-lg text-white/75 max-w-2xl mb-5 leading-relaxed" data-testid="hero-subheading">
                Network Capital lets communities coordinate <strong className="text-white">access to opportunities, tools, and group benefits</strong>{' '}
                through shared participation — not through capital, speculation, or financial products.
              </p>

              {/* Clarity statement */}
              <div className="rounded-2xl border border-secondary/30 bg-secondary/10 px-4 py-3 mb-7 max-w-2xl" data-testid="hero-clarity">
                <p className="text-sm leading-relaxed">
                  <strong className="text-secondary">No financial services. No promised returns.</strong>{' '}
                  Just structured participation that turns networks into real-world value.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={cta}
                  className="bg-secondary hover:brightness-110 text-primary px-6 py-3 rounded-full font-bold inline-flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-secondary/20"
                  data-testid="hero-cta-primary"
                >
                  Start Participating <ArrowRight size={18} />
                </button>
                <button
                  onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-5 py-3 rounded-full border border-white/20 hover:bg-white/5 text-sm"
                  data-testid="hero-cta-secondary"
                >
                  See how it works
                </button>
              </div>

              {/* Trust signals row */}
              <div className="mt-8 grid grid-cols-3 gap-3 max-w-xl text-center" data-testid="trust-row">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <ShieldCheck size={16} className="mx-auto mb-1 text-secondary" />
                  <p className="text-[11px] font-semibold">POPIA Aligned</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <Eye size={16} className="mx-auto mb-1 text-secondary" />
                  <p className="text-[11px] font-semibold">Open by Design</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <Lock size={16} className="mx-auto mb-1 text-secondary" />
                  <p className="text-[11px] font-semibold">Your Data, Yours</p>
                </div>
              </div>
            </div>

            {/* Right column — live activity feed */}
            <div className="lg:col-span-5">
              <LiveActivityFeed limit={10} theme="dark" />
              <p className="text-[11px] text-white/50 mt-2 text-center">Real-time community activity (sample data shown when quiet)</p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT YOU GET */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-b border-white/10" data-testid="what-you-get">
        <div className="max-w-2xl mb-10">
          <p className="text-[11px] uppercase tracking-[0.2em] text-secondary mb-2">What You Get</p>
          <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-3">Real value, earned through participation.</h2>
          <p className="text-white/70">No capital required to get started. Your engagement, contribution, and consistency build access for you and your community.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: Users,
              title: 'Group Access to Opportunities',
              body: 'Join a Stokvel circle and coordinate access to suppliers, deals, training, and tools that no individual could unlock alone.',
              tag: 'Collective Participation',
            },
            {
              icon: TrendingUp,
              title: 'Measurable Contribution',
              body: 'Posting, sharing, attending, and referring all add to your Network Score — a transparent measure of how much you contribute.',
              tag: 'Shared Value',
            },
            {
              icon: Sparkles,
              title: 'Unlocked Group Benefits',
              body: 'Higher participation tiers grant access to community products, discounts, group tools, and visibility — based on activity, not capital.',
              tag: 'Product Access',
            },
          ].map((c) => {
            const I = c.icon;
            return (
              <motion.div
                key={c.title}
                whileHover={{ y: -4 }}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6"
              >
                <div className="w-11 h-11 rounded-xl bg-secondary/20 flex items-center justify-center mb-4">
                  <I size={22} className="text-secondary" />
                </div>
                <p className="text-[10px] uppercase tracking-widest text-secondary mb-1">{c.tag}</p>
                <h3 className="font-heading font-bold text-lg mb-2">{c.title}</h3>
                <p className="text-sm text-white/70 leading-relaxed">{c.body}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* MEMBER JOURNEY */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-16 border-b border-white/10" data-testid="member-journey">
        <div className="max-w-2xl mb-10">
          <p className="text-[11px] uppercase tracking-[0.2em] text-secondary mb-2">Member Journey</p>
          <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-3">Three steps. Outcome-driven.</h2>
          <p className="text-white/70">Designed to feel obvious. Designed to reward consistency.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              step: '01', icon: Hand, title: 'Join the Circle',
              outcome: 'You become a participation member of a network — local, professional, or interest-based.',
              concrete: 'Sign up, pick your city or interest hub, get matched into your first Stokvel circle.',
            },
            {
              step: '02', icon: Network, title: 'Build Your Network Score',
              outcome: 'Every action that helps the community translates into points on your visible Network Score.',
              concrete: 'Post +20 · Share +10 · Refer +200 · 7-day streak +10 · Watch a community ad +500',
            },
            {
              step: '03', icon: Trophy, title: 'Unlock Group Benefits',
              outcome: 'Score thresholds unlock real, concrete benefits and Product Access tiers.',
              concrete: 'Multi-currency wallet · Stokvel multi-sig · Creator product backing · Premium 2× multiplier',
            },
          ].map((s, i) => {
            const I = s.icon;
            return (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="relative rounded-2xl border border-white/10 bg-white/5 p-6"
                data-testid={`journey-step-${i + 1}`}
              >
                <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-secondary text-primary font-bold text-sm flex items-center justify-center shadow-lg">
                  {s.step}
                </div>
                <I size={20} className="text-secondary mb-3" />
                <h3 className="font-heading font-bold text-lg mb-1">{s.title}</h3>
                <p className="text-sm text-white/80 mb-3">{s.outcome}</p>
                <p className="text-xs text-white/55 leading-relaxed">{s.concrete}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* NETWORK SCORE EXPLAINER */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-b border-white/10" data-testid="network-score-section">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-secondary mb-2">Network Score</p>
            <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-3">A transparent measure of your participation.</h2>
            <p className="text-white/70 mb-5">
              Every member starts at 0 and earns points up to a monthly cap of <strong className="text-white">10,000</strong>.
              Your score reflects consistency, contribution, and network growth — never capital.
            </p>

            <div className="rounded-2xl border border-secondary/30 bg-gradient-to-br from-secondary/15 to-transparent p-5 mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-white/60">Your monthly cap</span>
                <span className="text-2xl font-bold text-secondary">10,000 pts</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-secondary to-yellow-400" style={{ width: '74%' }} />
              </div>
              <p className="text-xs text-white/55 mt-2">Resets every calendar month so consistency wins, not one-off spikes.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <Target size={18} className="text-secondary mb-2" />
              <h4 className="font-bold mb-2 text-sm">What earns points</h4>
              <ul className="text-xs text-white/70 space-y-1.5">
                <li>+20 · post a contribution update</li>
                <li>+10 · share a post</li>
                <li>+5 · daily story</li>
                <li>+200 · referral that joins</li>
                <li>+10 · 3-hour participation streak</li>
                <li>+100 · watch + share a community ad</li>
                <li>+500 · engage with a community product</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <Sparkles size={18} className="text-secondary mb-2" />
              <h4 className="font-bold mb-2 text-sm">What higher scores unlock</h4>
              <ul className="text-xs text-white/70 space-y-1.5">
                <li>500+ · Stokvel circle eligibility</li>
                <li>2,000+ · Creator product backing</li>
                <li>5,000+ · Hub leaderboard placement</li>
                <li>10,000 · free Premium claim, 2× multiplier</li>
                <li>10,000 · 90-day Premium grace at the top</li>
                <li>Tier-based · group benefits + visibility</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* LEADERBOARD */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-b border-white/10" data-testid="leaderboard-section">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-secondary mb-2">Community Leaderboard</p>
            <h2 className="text-3xl font-heading font-bold">Top participants this month.</h2>
          </div>
          <button
            onClick={cta}
            className="text-sm text-secondary hover:underline"
            data-testid="leaderboard-cta"
          >
            Join to climb the board →
          </button>
        </div>
        <ul className="rounded-2xl border border-white/10 bg-white/5 divide-y divide-white/5 overflow-hidden">
          {leaders.slice(0, 8).map((l) => (
            <li key={`${l.username}-${l.rank}`} className="flex items-center gap-3 px-4 py-3" data-testid={`leader-${l.rank}`}>
              <div className={`w-8 h-8 rounded-full font-bold text-sm flex items-center justify-center ${l.rank <= 3 ? 'bg-secondary text-primary' : 'bg-white/10 text-white/70'}`}>{l.rank}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">@{l.username} {l.seeded && <span className="text-[10px] text-white/40 italic ml-1">demo</span>}</p>
                <p className="text-[11px] text-white/50">{l.city || 'Network'}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-secondary">{l.network_score.toLocaleString()}</p>
                <p className="text-[10px] text-white/50">pts</p>
              </div>
            </li>
          ))}
          {leaders.length === 0 && <li className="px-4 py-6 text-center text-sm text-white/50">Loading leaderboard…</li>}
        </ul>
      </section>

      {/* TRANSPARENCY */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-b border-white/10" data-testid="transparency-section">
        <div className="rounded-3xl border-2 border-secondary/30 bg-gradient-to-br from-secondary/10 to-transparent p-8 sm:p-10">
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck size={22} className="text-secondary" />
            <p className="text-[11px] uppercase tracking-[0.2em] text-secondary font-bold">Transparency</p>
          </div>
          <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-6 max-w-3xl">What Network Capital is — and isn't.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: Coins, label: 'NOT a financial product', body: 'We do not offer investment products, securities, savings accounts, or credit instruments.' },
              { icon: TrendingUp, label: 'NO promised returns', body: 'There is no guaranteed income, profit-share, or interest. Rewards depend on activity and platform terms.' },
              { icon: Users, label: 'A coordination layer', body: 'We coordinate participation, group access, and shared benefits — turning community engagement into real-world value.' },
            ].map((t) => {
              const I = t.icon;
              return (
                <div key={t.label} className="rounded-2xl bg-[#0a1628]/50 border border-white/10 p-5">
                  <I size={18} className="text-secondary mb-2" />
                  <p className="font-bold text-sm mb-1.5">{t.label}</p>
                  <p className="text-xs text-white/65 leading-relaxed">{t.body}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs text-white/55">
            <CheckCircle2 size={14} className="text-secondary" />
            <span>Read our full <a href="/legal" className="underline hover:text-white">terms &amp; compliance documents</a> any time.</span>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <Sparkles size={28} className="mx-auto text-secondary mb-4" />
        <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-3">Your network is your value.</h2>
        <p className="text-white/70 mb-6">Join the Circle, build your Network Score, unlock group benefits — together.</p>
        <button
          onClick={cta}
          className="bg-secondary hover:brightness-110 text-primary px-8 py-4 rounded-full font-bold inline-flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-secondary/20"
          data-testid="final-cta"
        >
          Join the Circle <ArrowRight size={18} />
        </button>
        <p className="text-[11px] text-white/40 mt-4">By joining you agree to our <a href="/legal" className="underline">Terms</a>, <a href="/legal" className="underline">Privacy Policy</a>, and POPIA-aligned data handling.</p>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
