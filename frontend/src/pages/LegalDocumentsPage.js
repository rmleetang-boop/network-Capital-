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

const EFFECTIVE = '2026-02-20';

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
    <P>By creating an account or using the Network Capital mobile or web platform (the "Platform"), you agree to these Terms. The Platform is operated by <strong>Mici Business Pty Ltd</strong>.</P>

    <H2>1. What Network Capital is</H2>
    <P>Network Capital is a <strong>community coordination and participation platform</strong>. It is a <strong>Community Resource Ecosystem</strong> — not a financial services provider, not a bank, not a credit provider, and not an investment scheme. We do not promise, guarantee, or pay any returns. Everything on the Platform is framed around <em>shared access</em>, <em>collective participation</em>, and <em>community contribution</em>.</P>

    <H2>2. Features you can access</H2>
    <UL>
      <li><strong>Social Feed</strong> — posts, stories, likes, comments, shares, hashtags, mentions, and explore. Posts can be edited or deleted; deleting a post revokes the points originally earned for it.</li>
      <li><strong>Network Score</strong> — points earned through engagement, referrals, daily check-ins, profile completion, and consistency. Monthly cap is 10,000 points with diminishing returns and anti-abuse controls.</li>
      <li><strong>Stokvel groups</strong> — community savings circles. $20 once to create, $5 per member to join. Fees pool quarterly to the top-performing group; Network Capital adds an additional R1,000,000 to that quarterly pool. Contributions are held by an independent banking partner; Network Capital never touches member contributions. Stokvel+ premium tiers are released in phases via feature flags.</li>
      <li><strong>African Regional Hubs</strong> — Country → Province → City discovery and matching across 13 hubs.</li>
      <li><strong>Activities</strong> — member-organised in-person experiences (dinners, concerts, travel, retreats) with optional costs disclosed by the organiser.</li>
      <li><strong>Direct Messages</strong> — text and multimedia chat between members, with automated compliance word checks.</li>
      <li><strong>My Network</strong> — three-category connection graph (Social · Professional · Financial). Both parties earn points when a connection is accepted; either party can disconnect at any time.</li>
      <li><strong>My Places</strong> — Trustpilot-style community reviews of physical places. Members can create places, leave one review per place (worth points), and place owners can claim listings and reply to reviews after verification by an admin.</li>
      <li><strong>Jobs</strong> — a Social/Professional jobs board. Posting requires a one-time $50 unlock via Stripe. Members can react (like/dislike), share (earning points), apply, and follow up via DM.</li>
      <li><strong>Promotions</strong> — admin-scheduled time-windowed reward campaigns operating in South African Standard Time (SAST). Eligible Network Score points earned inside an active window are tracked separately and converted using the published rate: <strong>100 Network Points = R10 ZAR</strong>. Promotion rewards represent shared community recognition, not an investment return.</li>
      <li><strong>Ambassador programme</strong> — members who recruit and support new members can earn an Ambassador rank (Rising Star → Ambassador → Senior → Elite → Network Legend). Public leaderboards highlight top contributors.</li>
      <li><strong>Creator / Product layer</strong> — creators publish products and the community backs them through participation.</li>
      <li><strong>Wallet &amp; Premium</strong> — optional $10 one-time Premium unlock via Stripe. Includes a 2× Network Score multiplier window plus additional feature unlocks. Premium does not buy points.</li>
      <li><strong>Notifications &amp; email</strong> — essential account, promotion-window, and community notifications are delivered in-app and via email (transactional email via Resend). Marketing email only with explicit opt-in.</li>
    </UL>

    <H2>3. Your account and conduct</H2>
    <UL>
      <li>You must be 18 or older to use financial, Stokvel, Jobs, or Promotions features.</li>
      <li>Provide accurate registration details, including location (country / province / city). Email is verified via a 6-digit OTP.</li>
      <li>Keep your credentials confidential. You are responsible for activity on your account.</li>
      <li>No fraud, harassment, spam, hate speech, sexual content involving minors, or content that violates local law.</li>
      <li>Regulated financial words ("invest", "returns", "profit", "guaranteed") are auto-flagged in posts and DMs. Repeated violations may lead to suspension.</li>
      <li>You may not run multiple accounts to inflate Network Score, referral rewards, promotion participation, or leaderboard ranking. Detected abuse results in point revocation and possible permanent suspension.</li>
    </UL>

    <H2>4. Network Score, Promotions and rewards</H2>
    <UL>
      <li>Network Score is a <strong>community engagement signal</strong>, not a currency. It powers reputation, leaderboards, badges, and unlocks.</li>
      <li>Points are awarded for posts, shares, quality comments (≥ 0.6 AI-scored relevance), likes, video watches, daily check-ins, profile completion, referrals, place reviews, connections made, and job shares — at rates documented inside the app on the Score Dashboard.</li>
      <li>Monthly cap: <strong>10,000 points</strong> per member, resetting at the start of every calendar month. Diminishing returns apply to repeated identical actions.</li>
      <li><strong>Promotion windows</strong> run on South African Standard Time (SAST / GMT+2). Points earned inside an active window are also recorded against that promotion and converted at <strong>100 Network Points = R10 ZAR</strong> for the purpose of community reward tracking.</li>
      <li>Promotion rewards are <strong>community recognition</strong>, not a financial return. They may be distributed through community vouchers, shared experiences, or recognition tiers and are <strong>never</strong> guaranteed cash payouts unless explicitly stated in writing by Network Capital for a specific campaign.</li>
      <li>If a post, comment, review, or connection that earned points is later deleted, removed by moderation, or proven to be abusive, the points awarded for it are revoked.</li>
    </UL>

    <H2>5. Fees and payments</H2>
    <UL>
      <li>Creating a Stokvel group: <strong>$20 once</strong>. Joining: <strong>$5 per member</strong>.</li>
      <li>Premium unlock: <strong>$10 one-time</strong>, via Stripe.</li>
      <li>Job posting unlock: <strong>$50 one-time</strong>, via Stripe.</li>
      <li>All prices are server-defined; the client cannot change them.</li>
      <li>Fees are not refundable once the corresponding feature is unlocked, save where South African consumer law requires.</li>
      <li>Local card processing for African corridors (NGN/GHS/KES/ZAR) is being rolled out via Paystack.</li>
    </UL>

    <H2>6. The quarterly Stokvel prize pool</H2>
    <UL>
      <li>Collected Stokvel fees pool and distribute every quarter to the top-performing group.</li>
      <li>Network Capital adds <strong>R1,000,000</strong> on top of the fee pool every quarter.</li>
      <li>Performance is scored on group engagement, members' Network Score growth, and activity. The scoring formula is documented and available on request.</li>
      <li>The pool is not an investment. Eligibility and distribution rules are entirely transparent and may be updated with reasonable notice.</li>
    </UL>

    <H2>7. Member contributions &amp; control of funds</H2>
    <UL>
      <li><strong>Network Capital does not take or hold member Stokvel contributions.</strong></li>
      <li>Contributions are held by an <strong>independent banking partner</strong>.</li>
      <li>Your Stokvel group maintains <strong>full control</strong> and writes its own constitution.</li>
    </UL>

    <H2>8. Banking details</H2>
    <P>Banking details are collected <strong>only</strong> inside the Stokvel feature, and are used <strong>solely for distribution of pool money</strong> back to members. See the Privacy Policy and POPIA section for storage and access details.</P>

    <H2>9. Content ownership &amp; moderation</H2>
    <UL>
      <li>You own what you post (text, images, video, articles, place reviews, products, job postings).</li>
      <li>You grant Network Capital a non-exclusive licence to host and display your content on the Platform.</li>
      <li>Administrators may remove content, restrict messaging, flag profiles for review, suspend, or permanently close accounts that breach these Terms, applicable law, or community moderation rules. All admin actions are recorded in an internal audit log.</li>
      <li>Verified businesses may claim a place listing; once approved, the owner may reply to reviews on their listing.</li>
    </UL>

    <H2>10. Privacy controls &amp; account lifecycle</H2>
    <UL>
      <li>You may <strong>deactivate</strong> your account at any time from Profile → Settings. Deactivation is reversible — your data is preserved.</li>
      <li>You may request <strong>deletion</strong>. Deletion runs on a 30-day grace period during which you can cancel. After the grace window, your account, posts, messages, connections, place reviews, job postings, and promotion records are removed; banking details are scrubbed within 30 days; payment records are retained per tax obligations.</li>
    </UL>

    <H2>11. Disclaimers</H2>
    <P>The Platform is provided "as is". To the maximum extent permitted by law, Network Capital and Mici Business Pty Ltd disclaim all warranties and are not liable for indirect or consequential loss. Nothing on the Platform is financial, tax, legal, or investment advice.</P>

    <H2>12. Changes to these Terms</H2>
    <P>We may update these Terms when features change. Material changes are notified in-app and by email at least 14 days before they take effect.</P>

    <H2>13. Contact</H2>
    <P>Support: <a className="text-accent-link" href="mailto:support@networkcapitalapp.co.za">support@networkcapitalapp.co.za</a> · General: <a className="text-accent-link" href="mailto:info@networkcapitalapp.co.za">info@networkcapitalapp.co.za</a></P>
  </>
);

const Privacy = () => (
  <>
    <H1>Privacy Policy</H1>
    <P><strong>Honest disclosure.</strong> We <em>do</em> collect activity data — we couldn't calculate your Network Score, surface relevant communities, or personalise your ecosystem benefits without it. What we <em>don't</em> do is sell it, trade it, or use it to build advertising profiles.</P>

    <H2>Data we collect</H2>
    <UL>
      <li><strong>Account:</strong> email, username, password (hashed), full name, bio, profile photo, gender (optional), birth month, intent (member / creator).</li>
      <li><strong>Location:</strong> country, province, city — used for Regional Hub matching, nearby Activities, place reviews, and leaderboards.</li>
      <li><strong>Engagement:</strong> posts, stories, comments, likes, shares, direct messages, mentions, hashtags, follows, blocks.</li>
      <li><strong>Network Score events:</strong> every action that awards or revokes points (including promotion-window participation in SAST).</li>
      <li><strong>Connections:</strong> social, professional, and financial connections you accept or send.</li>
      <li><strong>Places:</strong> places you create, reviews you leave, replies you write as a verified owner.</li>
      <li><strong>Jobs:</strong> postings you publish, applications you send, reactions and shares.</li>
      <li><strong>Promotions:</strong> per-promotion participation events, including action type, points earned, SAST timestamp, ZAR-equivalent estimate, and streaks.</li>
      <li><strong>Ambassadors:</strong> recruit counts, rank, monthly target progress.</li>
      <li><strong>Banking (Stokvel only):</strong> bank name, account number, SWIFT/branch — held encrypted; full numbers are never returned by the API (only last-4 + masked dots).</li>
      <li><strong>Payment metadata:</strong> Stripe (and Paystack, where rolled out) session id, amount, currency, status. We never see full card numbers.</li>
      <li><strong>Device data:</strong> IP, user agent, and limited crash telemetry.</li>
    </UL>

    <H2>How we use it</H2>
    <UL>
      <li>Operate the Platform, match members into Regional Hubs, surface Activities, places, and jobs near you.</li>
      <li>Score participation via the Network Score algorithm and track Promotion-window contributions in SAST.</li>
      <li>Power the Ambassador programme and public leaderboards.</li>
      <li>Prevent abuse, fraud, multi-account inflation, and breaches of community rules.</li>
      <li>Send essential account, OTP, promotion-window, and community notifications.</li>
      <li>Marketing email only with your explicit opt-in.</li>
    </UL>

    <H2>Who we share it with</H2>
    <UL>
      <li><strong>Independent banking partner</strong> — only the banking details you submit for Stokvel disbursements.</li>
      <li><strong>Stripe (and Paystack for African card rails)</strong> — payment processing only.</li>
      <li><strong>Resend</strong> — transactional email delivery (OTP, password reset, promotion-window notifications). Resend only receives your email address and the message contents.</li>
      <li>Law enforcement where legally required, under a valid order.</li>
      <li>We do <strong>not</strong> share data with advertisers, data brokers, or marketing networks.</li>
    </UL>

    <H2>Your rights</H2>
    <P>You may request a copy of your data or its deletion by emailing <a className="text-accent-link" href="mailto:info@networkcapitalapp.co.za">info@networkcapitalapp.co.za</a>. We respond within 30 days. You can also self-serve account <strong>deactivation</strong> (reversible) and <strong>deletion</strong> (30-day grace) from Profile → Settings.</P>

    <H2>Retention</H2>
    <P>Account data is kept while your account is active. After deletion the 30-day grace window starts; once it expires, account, posts, messages, connections, place reviews, job postings, ambassador records, and promotion events are removed. Banking details are scrubbed within 30 days of closure. Payment records are retained per tax &amp; regulatory obligations.</P>

    <H2>International transfers</H2>
    <P>Some sub-processors (Stripe, Resend, optionally Paystack) are based outside South Africa. Transfers use approved safeguards under POPIA §72 (adequate protection).</P>
  </>
);

const Compliance = () => (
  <>
    <H1>Compliance &amp; Transparency</H1>
    <P>Network Capital is deliberately built <strong>not to be a financial service</strong>. Here's what that means in practice.</P>

    <H2>What we DO</H2>
    <UL>
      <li>Coordinate participation, shared access, and collective benefits.</li>
      <li>Host community groups (Stokvels) and score engagement transparently.</li>
      <li>Provide a social layer, Direct Messages, Regional Hubs, Activities, My Network, My Places, and Jobs.</li>
      <li>Operate time-windowed Promotions in South African Standard Time with a published reward equivalence (<strong>100 Network Points = R10 ZAR</strong>) and full leaderboard transparency.</li>
      <li>Recognise top contributors through the Ambassador programme and public leaderboards.</li>
      <li>Publish every scoring rule, every fee, every prize-pool calculation, and every admin action via an internal audit log.</li>
    </UL>

    <H2>What we DO NOT</H2>
    <UL>
      <li>Offer investment products, securities, savings accounts, or credit.</li>
      <li>Promise returns, interest, profit-sharing, or guaranteed income.</li>
      <li>Hold member Stokvel contributions — those are with an independent banking partner.</li>
      <li>Pay Promotion rewards as guaranteed cash. Promotion rewards are <strong>community recognition</strong> and may be delivered as vouchers, shared experiences, or recognition tiers unless a specific campaign documents a cash distribution.</li>
      <li>Give financial, tax, or legal advice.</li>
      <li>Sell, trade, or share member data with advertising networks.</li>
    </UL>

    <H2>Moderation language rules</H2>
    <P>Posts, comments, place reviews, job descriptions, and DMs are auto-scanned for regulated finance words (invest, returns, profit, guaranteed, interest, etc.). The sender is shown a soft warning with a compliant alternative. Repeated violations may trigger a review, restriction (post / comment / DM), or suspension.</P>

    <H2>Transparent reporting</H2>
    <UL>
      <li>The Stokvel quarterly prize-pool distribution is published openly.</li>
      <li>The Network Score formula (points in, points out) is listed on Legal → Terms §4 and on the Score Dashboard.</li>
      <li>Promotion campaigns publish their schedule (SAST), eligible actions, minimum-score threshold, and ZAR-per-point rate before they go live.</li>
      <li>Ambassador rank thresholds and recruit targets are documented on the Ambassador Dashboard.</li>
    </UL>
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
