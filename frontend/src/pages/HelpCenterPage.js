import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, HelpCircle, Mail, ChevronDown } from 'lucide-react';

const CATEGORIES = [
  { key: 'all', label: 'All topics' },
  { key: 'account', label: 'Account & profile' },
  { key: 'feed', label: 'Feed, Stories & DMs' },
  { key: 'stokvels', label: 'Stokvels' },
  { key: 'activities', label: 'Activities' },
  { key: 'hubs', label: 'Hubs & location' },
  { key: 'score', label: 'Network Score' },
  { key: 'premium', label: 'Premium & payments' },
  { key: 'privacy', label: 'Privacy & data' },
];

const FAQS = [
  // Account
  { cat: 'account', q: 'How do I sign up?', a: 'Tap "Join the Circle" on the landing page, enter email + password, then complete your profile (name, username, country, province, city). You can skip the bio; you can add a profile photo from the Profile page later.' },
  { cat: 'account', q: 'How do I change my profile photo?', a: 'Go to Profile → tap the avatar → upload. When you change it, your photo updates automatically on all your past posts, stories, comments, and DMs.' },
  { cat: 'account', q: 'Can I delete my account?', a: 'Yes — email info@networkcapitalapp.co.za from the address on the account. Banking details are scrubbed within 30 days; payment records are retained per tax obligations.' },
  { cat: 'account', q: 'How do I reset my password?', a: 'Log in screen → "Forgot password?" — we\'ll email you a reset link.' },

  // Feed, stories, DMs
  { cat: 'feed', q: 'How do hashtags work?', a: 'Type #word in a post and it becomes tappable. You can browse /explore for trending tags and tap any tag for a grid of recent posts.' },
  { cat: 'feed', q: 'What are Stories?', a: 'Short-lived posts (24h) that appear at the top of Feed. Create with the "+" in your story ring; tap any story to view.' },
  { cat: 'feed', q: 'Can anyone DM me?', a: 'Yes — any user can DM any other user. DMs support text, images, voice notes, and shared posts. Compliance-flagged wording (invest/returns/guaranteed/…) prompts the sender with a suggested alternative before sending.' },
  { cat: 'feed', q: 'Why did my message flag?', a: 'Regulated financial terms trigger a soft warning to keep the Platform compliant. Tap the suggestion to replace the word, or tap Send a second time to send anyway.' },

  // Stokvels
  { cat: 'stokvels', q: 'What does a Stokvel cost?', a: 'Creating a group is $20 once. Joining a group is $5 per member. Both are one-time platform fees.' },
  { cat: 'stokvels', q: 'Where does the fee money go?', a: 'Into a quarterly Prize Pool distributed to the top-performing group, measured by group engagement, members\' Network Score growth, and activity. Network Capital adds R1,000,000 every quarter on top of collected fees.' },
  { cat: 'stokvels', q: 'Who holds group member contributions?', a: 'An independent banking partner. Network Capital does not take or hold any member contributions. Your group has full control.' },
  { cat: 'stokvels', q: 'What is the group constitution?', a: 'Each group writes its own internal rules: contribution schedule, pay-out order, dispute resolution, etc. Network Capital provides the platform; the group governs itself.' },
  { cat: 'stokvels', q: 'Why do I need banking details to join?', a: 'So your share of pool distributions can reach you. Banking details are encrypted at rest, never displayed in full, and used only for legitimate group disbursements.' },
  { cat: 'stokvels', q: 'Can I see a group\'s performance?', a: 'Yes — each group has a Dashboard that shows aggregate engagement, active members, and score growth.' },

  // Activities
  { cat: 'activities', q: 'What is an Activity?', a: 'A member-organised in-person experience: dinner, concert, travel, holiday, or any curated get-together. Pick country + city to browse what\'s near you.' },
  { cat: 'activities', q: 'How do I host one?', a: 'Activities → Create. Enter title, description, country/city, venue (optional), date, time, cost, and max guests. You can add a cover image.' },
  { cat: 'activities', q: 'Is there a fee?', a: 'Network Capital does not charge for hosting an activity. If the host lists a participation cost (e.g. "$50 dinner — 3 courses"), that cost is settled between host and guests outside the Platform.' },
  { cat: 'activities', q: 'What happens if I join?', a: 'You earn +25 Network Score points. The host can see who has joined.' },

  // Hubs
  { cat: 'hubs', q: 'What is a Hub?', a: 'A city-based community view. Pick your country first, then your city. See who\'s nearby, connect with them socially, professionally, or financially, and find Activities and Stokvels in that city.' },
  { cat: 'hubs', q: 'Which countries are supported?', a: 'At launch: South Africa, Nigeria, Kenya, Ghana, Zimbabwe, Tanzania, Uganda, Senegal, Egypt, Morocco, Ethiopia, Rwanda, plus "Other". We add more on request — email info@networkcapitalapp.co.za.' },

  // Network Score
  { cat: 'score', q: 'What increases my Network Score?', a: 'Post +20, share +10, story +5, daily 3-hour streak +10, refer a new member who joins +200, watch + share a community ad +100, engage with a community product +500, create an Activity +50, join an Activity +25.' },
  { cat: 'score', q: 'Is there a cap?', a: 'Yes — 10,000 points per calendar month so consistency wins over one-off spikes. Premium doubles all point gains.' },
  { cat: 'score', q: 'What does a high score unlock?', a: '500+ Stokvel eligibility · 2,000+ Creator product backing · 5,000+ Hub leaderboard placement · 10,000 free Premium claim and 2× multiplier.' },

  // Premium
  { cat: 'premium', q: 'How much is Premium?', a: '$10 one-time (or equivalent in your selected currency). Paid via Stripe checkout. Unlocks Wallet actions, Stokvel multi-sig, Creator product backing, 2× score, and +500 welcome bonus.' },
  { cat: 'premium', q: 'Which currencies work on Stripe?', a: 'USD, EUR, GBP, CAD, AUD, JPY. For NGN, GHS, KES, ZAR we fall back to Paystack (wire-up pending — currently a test/mock path).' },
  { cat: 'premium', q: 'Can I get a refund?', a: 'Premium is non-refundable once features unlock. If you were charged but Premium didn\'t activate, email support@networkcapitalapp.co.za with your session id.' },

  // Privacy
  { cat: 'privacy', q: 'Is my data sold?', a: 'No. Ever. See the Privacy Policy on /legal.' },
  { cat: 'privacy', q: 'Where are banking details stored?', a: 'In our database encrypted at rest. They are only ever transmitted to our independent banking partner for legitimate disbursements. The API never returns a full account number — only last-4 with masked dots.' },
  { cat: 'privacy', q: 'Is the app POPIA-aligned?', a: 'Yes. See /legal → POPIA & Data Protection for the full compliance posture.' },
];

const HelpCenterPage = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return FAQS.filter((f) => (cat === 'all' || f.cat === cat) && (!term || f.q.toLowerCase().includes(term) || f.a.toLowerCase().includes(term)));
  }, [q, cat]);

  return (
    <div className="min-h-screen bg-background-subtle" data-testid="help-page">
      <div className="sticky top-0 z-10 bg-primary text-white border-b border-white/10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 text-white/80 hover:text-white"><ArrowLeft size={18} /></button>
          <HelpCircle size={20} className="text-secondary" />
          <h1 className="text-lg font-heading font-bold">Help Centre</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-accent-navyTint p-4 shadow-sm">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search help topics…"
              className="w-full pl-9 pr-3 py-2.5 rounded-full bg-background-subtle border border-accent-navyTint outline-none focus:border-secondary text-sm"
              data-testid="help-search"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors ${c.key === cat ? 'bg-primary text-white' : 'bg-background-subtle text-text-primary hover:bg-secondary-soft'}`}
                data-testid={`help-cat-${c.key}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-accent-navyTint overflow-hidden shadow-sm"
              data-testid={`help-qa-${i}`}
            >
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary-soft transition-colors">
                <span className="mt-0.5 text-secondary font-bold">Q.</span>
                <span className="flex-1 font-semibold text-text-primary text-sm">{f.q}</span>
                <ChevronDown size={16} className={`text-text-muted transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-4 pb-4 border-t border-accent-navyTint bg-background-subtle">
                  <p className="text-sm text-text-primary leading-relaxed mt-2">{f.a}</p>
                </div>
              )}
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-accent-navyTint p-10 text-center">
              <p className="text-sm text-text-secondary">No articles match. Try a different search or email us.</p>
            </div>
          )}
        </div>

        <div className="bg-primary text-white rounded-2xl p-5 shadow-md" data-testid="help-contact">
          <div className="flex items-center gap-2 mb-2"><Mail size={16} className="text-secondary" /><h3 className="font-heading font-bold">Still stuck?</h3></div>
          <p className="text-sm text-white/80 mb-3">We reply within 24 hours on business days.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a href="mailto:support@networkcapitalapp.co.za" className="bg-secondary text-primary px-4 py-2.5 rounded-full text-sm font-bold text-center">support@networkcapitalapp.co.za</a>
            <a href="mailto:info@networkcapitalapp.co.za" className="bg-white/10 border border-white/20 text-white px-4 py-2.5 rounded-full text-sm font-bold text-center">info@networkcapitalapp.co.za</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenterPage;
