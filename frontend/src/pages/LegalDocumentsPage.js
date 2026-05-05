import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, ShieldCheck, Lock, Info } from 'lucide-react';

const SECTIONS = [
  { key: 'terms', label: 'Terms of Service', icon: FileText },
  { key: 'privacy', label: 'Privacy Policy', icon: ShieldCheck },
  { key: 'compliance', label: 'Compliance & Transparency', icon: Info },
  { key: 'popia', label: 'POPIA & Data Protection', icon: Lock },
];

const EFFECTIVE = '2026-02-01';

const LegalDocumentsPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [active, setActive] = useState(params.get('tab') || 'terms');

  return (
    <div className="min-h-screen bg-background-subtle text-text-primary" data-testid="legal-page">
      <div className="sticky top-0 z-10 bg-primary text-white border-b border-white/10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 text-white/80 hover:text-white"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-heading font-bold">Legal &amp; Trust</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
        <nav className="space-y-1 md:sticky md:top-20 h-max">
          {SECTIONS.map((s) => {
            const I = s.icon;
            const on = s.key === active;
            return (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${on ? 'bg-primary text-white font-semibold' : 'bg-white text-text-primary hover:bg-secondary-soft'}`}
                data-testid={`legal-tab-${s.key}`}
              >
                <I size={16} className={on ? 'text-secondary' : 'text-primary'} /> {s.label}
              </button>
            );
          })}
          <div className="mt-4 p-3 rounded-xl border border-accent-navyTint bg-white text-[11px] text-text-secondary leading-relaxed">
            Effective {EFFECTIVE}. Questions? Email <a href="mailto:info@networkcapitalapp.co.za" className="text-accent-link font-medium">info@networkcapitalapp.co.za</a>.
          </div>
        </nav>

        <motion.article
          key={active}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-accent-navyTint p-6 sm:p-8 shadow-sm"
        >
          {active === 'terms' && <Terms />}
          {active === 'privacy' && <Privacy />}
          {active === 'compliance' && <Compliance />}
          {active === 'popia' && <POPIA />}
        </motion.article>
      </div>
    </div>
  );
};

const H1 = ({ children }) => <h2 className="text-2xl font-heading font-bold text-primary mb-3">{children}</h2>;
const H2 = ({ children }) => <h3 className="text-base font-heading font-bold text-primary mt-6 mb-2">{children}</h3>;
const P = ({ children }) => <p className="text-sm text-text-primary leading-relaxed mb-2">{children}</p>;
const UL = ({ children }) => <ul className="text-sm text-text-primary space-y-1.5 mb-3 list-disc pl-5">{children}</ul>;

const Terms = () => (
  <>
    <H1>Terms of Service</H1>
    <P>By creating an account or using the Network Capital mobile/web app (the "Platform"), you agree to these Terms. The Platform is operated by <strong>Mici Business Pty Ltd</strong>.</P>
    <H2>1. What Network Capital is</H2>
    <P>Network Capital is a <strong>community coordination platform</strong>. It is <strong>not a financial services provider, not a bank, not a credit provider, and not an investment scheme</strong>. We do not promise, guarantee, or pay any returns.</P>
    <H2>2. The features you can access</H2>
    <UL>
      <li><strong>Social Feed</strong> — posts, stories, likes, comments, shares, hashtags, explore.</li>
      <li><strong>Network Score</strong> — points earned through engagement, referrals, and consistency (monthly cap 10,000).</li>
      <li><strong>Stokvel groups</strong> — $20 once to create, $5 per member to join. Fees pool quarterly to the top-performing group; Network Capital adds an additional R1,000,000 to that quarterly pool. Contributions are held by an independent partner; Network Capital never touches member contributions.</li>
      <li><strong>Regional Hubs</strong> — country + city-based community discovery and connections (social, financial, professional).</li>
      <li><strong>Activities</strong> — member-organised in-person experiences (dinners, concerts, travel, holidays) with optional costs disclosed by the organiser.</li>
      <li><strong>Direct Messages</strong> — any two users can chat; multimedia supported with automated compliance word-checks.</li>
      <li><strong>Creator / Product layer</strong> — creators publish products and the community backs them through participation.</li>
      <li><strong>Wallet &amp; Premium</strong> — optional $10 one-time Premium unlock via Stripe (USD/EUR/GBP/CAD/AUD/JPY). 2× Network Score multiplier plus feature unlocks.</li>
    </UL>
    <H2>3. Your account and conduct</H2>
    <UL>
      <li>You must be 18+ to use financial or group features.</li>
      <li>Provide accurate registration details, including location (country / province / city).</li>
      <li>Keep your credentials confidential. You are responsible for activity on your account.</li>
      <li>No fraud, harassment, spam, hate speech, or content that violates local law.</li>
      <li>Regulated financial words ("invest", "returns", "profit", "guaranteed") are auto-flagged in posts and DMs. Repeated violations may lead to suspension.</li>
    </UL>
    <H2>4. Fees and payments</H2>
    <UL>
      <li>Creating a Stokvel group: <strong>$20 once</strong>. Joining: <strong>$5 per member</strong>.</li>
      <li>Premium unlock: <strong>$10 one-time</strong>, via Stripe. Test environment uses Stripe's test cards.</li>
      <li>All prices server-defined; the client cannot change them.</li>
      <li>Fees are not refundable once the corresponding feature is unlocked, save where South African law requires.</li>
    </UL>
    <H2>5. The quarterly prize pool (Stokvels)</H2>
    <UL>
      <li>Collected group fees pool and distribute every quarter to the top-performing group.</li>
      <li>Network Capital adds R1,000,000 on top of the fee pool every quarter.</li>
      <li>Performance is scored on group engagement, members' Network Score growth, and activity. The scoring formula is documented and available on request.</li>
      <li>The pool is not an investment. Eligibility and distribution rules are entirely transparent and may be updated with notice.</li>
    </UL>
    <H2>6. Member contributions &amp; control of funds</H2>
    <UL>
      <li><strong>Network Capital does not take or hold member contributions.</strong></li>
      <li>Contributions are held by an <strong>independent partner</strong>.</li>
      <li>Your group maintains <strong>full control</strong> and writes its own constitution.</li>
    </UL>
    <H2>7. Banking details</H2>
    <P>Banking details are collected <strong>only</strong> inside the Stokvel feature, and are used <strong>solely for distribution of pool money</strong> back to members. See the Privacy Policy and POPIA section for storage and access details.</P>
    <H2>8. Content ownership &amp; moderation</H2>
    <P>You own what you post. You grant Network Capital a non-exclusive licence to host and display your content on the Platform. We may remove content that breaches these Terms or applicable law.</P>
    <H2>9. Disclaimers</H2>
    <P>The Platform is provided "as is". To the maximum extent permitted by law, Network Capital and Mici Business Pty Ltd disclaim all warranties and are not liable for indirect or consequential loss. Nothing on the Platform is financial, tax, legal or investment advice.</P>
    <H2>10. Termination</H2>
    <P>You may close your account at any time from Profile → Settings. We may suspend or close accounts that breach these Terms.</P>
    <H2>11. Contact</H2>
    <P>Support: <a className="text-accent-link" href="mailto:support@networkcapitalapp.co.za">support@networkcapitalapp.co.za</a> · General: <a className="text-accent-link" href="mailto:info@networkcapitalapp.co.za">info@networkcapitalapp.co.za</a></P>
  </>
);

const Privacy = () => (
  <>
    <H1>Privacy Policy</H1>
    <P><strong>Honest disclosure.</strong> We <em>do</em> collect activity data — we couldn't calculate your Network Score or personalise your ecosystem benefits without it. What we <em>don't</em> do is sell it, trade it, or use it to build advertising profiles.</P>
    <H2>Data we collect</H2>
    <UL>
      <li>Account: email, username, password (hashed), full name, bio.</li>
      <li>Location: country, province, city — used for Hub filtering, Activities nearby, and leaderboards.</li>
      <li>Engagement: posts, stories, messages, likes, comments, Network Score events, referrals.</li>
      <li>Banking (Stokvel only): bank name, account number, SWIFT, branch number — held encrypted.</li>
      <li>Payment metadata: Stripe session id, amount, currency, status. We never see full card numbers.</li>
      <li>Device data: IP, user agent, limited crash telemetry.</li>
    </UL>
    <H2>How we use it</H2>
    <UL>
      <li>Operate the Platform, match members into Hubs, and surface relevant Activities.</li>
      <li>Score participation via the Network Score algorithm.</li>
      <li>Prevent abuse, fraud, and violations of community rules.</li>
      <li>Send essential account notifications; marketing email only with your opt-in.</li>
    </UL>
    <H2>Who we share it with</H2>
    <UL>
      <li><strong>Independent banking partner</strong> — only the banking details you submit for Stokvel disbursements.</li>
      <li><strong>Stripe (or Paystack for local cards)</strong> — payment processing only.</li>
      <li>Law enforcement where legally required.</li>
    </UL>
    <H2>Your rights</H2>
    <P>You may request a copy of your data or its deletion by emailing <a className="text-accent-link" href="mailto:info@networkcapitalapp.co.za">info@networkcapitalapp.co.za</a>. We respond within 30 days.</P>
    <H2>Retention</H2>
    <P>Account data is kept while your account is active. Banking details are removed within 30 days of account closure. Payment records are retained per tax &amp; regulatory obligations.</P>
    <H2>International transfers</H2>
    <P>Some sub-processors (e.g. Stripe) are based outside South Africa. Transfers use approved safeguards under POPIA §72 (adequate protection).</P>
  </>
);

const Compliance = () => (
  <>
    <H1>Compliance &amp; Transparency</H1>
    <P>Network Capital is deliberately built <strong>not to be a financial service</strong>. Here's what that means in practice.</P>
    <H2>What we DO</H2>
    <UL>
      <li>Coordinate participation, access, and shared benefits.</li>
      <li>Host community groups (Stokvels) and score engagement transparently.</li>
      <li>Provide a social layer, Direct Messages, Hubs, and Activities.</li>
      <li>Publish every scoring rule, every fee, every prize pool calculation.</li>
    </UL>
    <H2>What we DO NOT</H2>
    <UL>
      <li>Offer investment products, securities, savings accounts, or credit.</li>
      <li>Promise returns, interest, profit-sharing, or guaranteed income.</li>
      <li>Hold member contributions — those are with an independent banking partner.</li>
      <li>Give financial, tax, or legal advice.</li>
    </UL>
    <H2>Moderation language rules</H2>
    <P>Posts, comments, and DMs are auto-scanned for regulated finance words (invest, returns, profit, guaranteed, interest, etc.). The sender is shown a soft warning with a compliant alternative. Repeated violations may trigger a review.</P>
    <H2>Transparent reporting</H2>
    <P>The Stokvel quarterly prize pool distribution is published openly. The Network Score formula (points in, points out) is listed on Legal → Terms §2 and on the Dashboard.</P>
  </>
);

const POPIA = () => (
  <>
    <H1>POPIA &amp; Data Protection</H1>
    <P>Network Capital complies with the <strong>Protection of Personal Information Act 4 of 2013 (POPIA)</strong> and equivalent regional laws (Nigeria NDPR, Kenya DPA 2019, Ghana DPA, etc.) for members based outside South Africa.</P>
    <H2>Lawful basis for processing</H2>
    <UL>
      <li>Contract — delivering the Platform you signed up for.</li>
      <li>Consent — marketing, analytics beyond essentials.</li>
      <li>Legal obligation — fraud prevention, anti-money-laundering screening of fees.</li>
    </UL>
    <H2>Technical and organisational safeguards</H2>
    <UL>
      <li>Passwords hashed with bcrypt.</li>
      <li>Banking details encrypted at rest; full account numbers never returned via the API (only last-4 + masked dots).</li>
      <li>HTTPS in transit everywhere.</li>
      <li>Internal access is least-privilege and audited.</li>
    </UL>
    <H2>Your rights under POPIA</H2>
    <UL>
      <li>Access a copy of your data.</li>
      <li>Correction of inaccurate data.</li>
      <li>Objection to processing / direct marketing.</li>
      <li>Deletion once the processing basis has ended.</li>
      <li>Complaint to the <em>Information Regulator (South Africa)</em>.</li>
    </UL>
    <H2>Information Officer</H2>
    <P>
      <strong>Mici Business Pty Ltd</strong><br />
      Information Officer — <a className="text-accent-link" href="mailto:info@networkcapitalapp.co.za">info@networkcapitalapp.co.za</a><br />
      Support — <a className="text-accent-link" href="mailto:support@networkcapitalapp.co.za">support@networkcapitalapp.co.za</a>
    </P>
  </>
);

export default LegalDocumentsPage;
