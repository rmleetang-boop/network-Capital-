import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Users, Trophy, Coins, FileText, Lock, Mail, ArrowRight, Check, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'nc_stokvel_intro_seen';

export const markStokvelIntroSeen = () => {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
};
export const hasSeenStokvelIntro = () => {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
};

const Section = ({ icon: Icon, title, children, testid }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-5" data-testid={testid}>
    <div className="flex items-center gap-2.5 mb-2.5">
      <div className="w-9 h-9 rounded-lg bg-secondary/20 flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-secondary" />
      </div>
      <h3 className="font-heading font-bold text-white text-base">{title}</h3>
    </div>
    <div className="text-[13.5px] text-white/75 leading-relaxed pl-[46px]">{children}</div>
  </div>
);

const StokvelIntroPage = ({ onAcknowledge }) => {
  const navigate = useNavigate();

  const continueIn = () => {
    markStokvelIntroSeen();
    if (onAcknowledge) onAcknowledge();
    else navigate('/stokvels');
  };

  return (
    <div className="min-h-screen bg-[#0a1628] text-white" data-testid="stokvel-intro-page">
      <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-secondary/15 border border-secondary/30 text-[11px] uppercase tracking-wider">
            <ShieldCheck size={13} className="text-secondary" /> Stokvel · Community Coordination
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-bold mb-3">How Stokvels Work on Network Capital</h1>
          <p className="text-white/70 max-w-xl mx-auto leading-relaxed">
            A simple, transparent overview before you create or join a group. Read once — then participate with full clarity.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3.5"
        >
          {/* 1. Fees */}
          <Section icon={Coins} title="1. Fee Structure" testid="intro-fees">
            <ul className="space-y-1.5">
              <li>• <strong className="text-white">$20 once</strong> to create a group.</li>
              <li>• <strong className="text-white">$5 per member</strong> to join.</li>
              <li>• Fees are platform participation costs — they do not pay for any financial service.</li>
            </ul>
          </Section>

          {/* 2. Prize Pool */}
          <Section icon={Trophy} title="2. Quarterly Prize Pool" testid="intro-prize-pool">
            <p>All collected fees are pooled and distributed <strong className="text-white">every quarter</strong> to the top-performing group, scored on:</p>
            <ul className="mt-1.5 space-y-1.5">
              <li>• Group engagement</li>
              <li>• Members' Network Score growth</li>
              <li>• Activity and consistency</li>
            </ul>
          </Section>

          {/* 3. Extra Capital */}
          <Section icon={Sparkles} title="3. Extra Capital from Network Capital" testid="intro-extra-capital">
            <p>
              On top of the fees collected, Network Capital adds <strong className="text-white">R1,000,000 every quarter</strong> to the prize pool that is shared with the top-performing group.
            </p>
            <p className="mt-1.5 text-[12.5px] text-white/55">Distribution is governed by transparent, published rules.</p>
          </Section>

          {/* 4. Control of Funds */}
          <Section icon={Lock} title="4. Control of Funds — held by partner, not us" testid="intro-control">
            <ul className="space-y-1.5">
              <li>• <strong className="text-white">Network Capital does not take any of the contributions.</strong></li>
              <li>• Member contributions are held by an <strong className="text-white">independent partner</strong> — not Network Capital.</li>
              <li>• Your group retains <strong className="text-white">full control</strong> of those funds at all times.</li>
            </ul>
          </Section>

          {/* 5. Group Autonomy */}
          <Section icon={FileText} title="5. Group Autonomy & Constitution" testid="intro-autonomy">
            <p>Each group writes its own <strong className="text-white">constitution</strong> deciding how to manage, share and distribute money internally.</p>
            <p className="mt-1.5">Network Capital simply provides the platform for digital collaboration, opportunities and visibility.</p>
          </Section>

          {/* 6. Banking */}
          <Section icon={Users} title="6. Banking Details (in the Stokvel feature)" testid="intro-banking">
            <p>
              When you create or join a Stokvel, you'll be asked to securely provide banking details.
              They are used <strong className="text-white">strictly for the distribution of pool money</strong> from your group — nothing else.
            </p>
            <ul className="mt-1.5 space-y-1 text-white/70">
              <li>• Bank name</li>
              <li>• Account number</li>
              <li>• SWIFT code</li>
              <li>• Branch number</li>
            </ul>
            <p className="mt-2 text-[12.5px] text-white/55">Stored encrypted, accessible only for legitimate group disbursements, and protected under POPIA.</p>
          </Section>

          {/* 7. Compliance */}
          <Section icon={ShieldCheck} title="7. Compliance" testid="intro-compliance">
            <p>Network Capital is <strong className="text-white">not a financial services provider</strong>. We do not promise returns, guarantee profits, or offer investment products. We coordinate participation and access — full stop.</p>
          </Section>
        </motion.div>

        {/* Support */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5" data-testid="intro-support">
          <div className="flex items-center gap-2 mb-2">
            <Mail size={16} className="text-secondary" />
            <h4 className="font-heading font-bold text-sm">Support &amp; Contact</h4>
          </div>
          <ul className="text-[13.5px] text-white/75 space-y-1 pl-[24px]">
            <li>• <a className="text-secondary hover:underline" href="mailto:support@networkcapitalapp.co.za">support@networkcapitalapp.co.za</a> — account &amp; technical issues</li>
            <li>• <a className="text-secondary hover:underline" href="mailto:info@networkcapitalapp.co.za">info@networkcapitalapp.co.za</a> — general enquiries &amp; partnerships</li>
          </ul>
        </div>

        {/* Acknowledge CTA */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-start gap-2 text-[12px] text-white/55 max-w-md">
            <Check size={14} className="text-secondary flex-shrink-0 mt-0.5" />
            <span>By continuing you confirm you've read how Stokvels work on Network Capital.</span>
          </div>
          <button
            onClick={continueIn}
            className="bg-secondary hover:brightness-110 text-primary px-6 py-3 rounded-full font-bold inline-flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-secondary/20"
            data-testid="intro-continue"
          >
            Got it — continue <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Sparkles imported above with the rest of lucide-react

export default StokvelIntroPage;
