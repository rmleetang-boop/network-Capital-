// Iter 58 — Admin Site Map.
// Premium, glassmorphism-feel directory of every feature in the app + a
// one-line description of what each does. Every icon is clickable and
// navigates to the route. Visible to admin + super_admin only.
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Shield, Sparkles,
  // Public surfaces
  Home, Compass, Hash, Users, MessageCircle, Bell, Settings, HelpCircle,
  // Profile + social
  User, Trophy, Activity, TrendingUp, Wallet, Star, Crown,
  // Commerce
  Store, Package, ShoppingBag,
  // Stokvels / Money
  PiggyBank,
  // Places / Jobs / Activities
  MapPin, Briefcase, CalendarHeart,
  // Ambassador
  Award, Network, Megaphone,
  // Admin
  LayoutDashboard, FileText, Lock, ListChecks, BarChart3,
  Mail, AlertTriangle, Send, ScrollText,
} from 'lucide-react';

const SECTIONS = [
  {
    key: 'core',
    title: 'Core experience',
    accent: 'from-[#1e4fa5]/30 to-[#1e4fa5]/5 border-[#1e4fa5]/40',
    items: [
      { icon: Home,          label: 'Feed',             path: '/',              desc: 'Home feed: posts, carousels, reels, native ads.' },
      { icon: Compass,       label: 'Explore',          path: '/explore',       desc: 'Discover trending posts and people.' },
      { icon: Hash,          label: 'Hashtags',         path: '/hashtag/network', desc: 'Topic-based discovery (sample tag).' },
      { icon: User,          label: 'My Profile',       path: '/profile',       desc: 'Editable view of your own profile.' },
      { icon: Bell,          label: 'Notifications',    path: '/notifications', desc: 'Activity inbox: reactions, mentions, score events.' },
      { icon: MessageCircle, label: 'Messages',         path: '/messages',      desc: 'Direct messages with users + group threads.' },
      { icon: Settings,      label: 'Settings',         path: '/settings',      desc: 'Account, currency, privacy, deactivation.' },
      { icon: HelpCircle,    label: 'Help & FAQ',       path: '/help',          desc: 'Help centre and support contacts.' },
    ],
  },
  {
    key: 'score',
    title: 'Score & rewards',
    accent: 'from-[#E8A817]/25 to-[#E8A817]/5 border-[#E8A817]/40',
    items: [
      { icon: Activity,   label: 'Score Tracker',    path: '/tracker',      desc: 'Itemised score history with cooldowns and caps.' },
      { icon: Trophy,     label: 'Leaderboards',     path: '/leaderboards', desc: 'Global + regional contributor rankings.' },
      { icon: Star,       label: 'Activities',       path: '/activities',   desc: 'All score-earning actions and daily limits.' },
      { icon: TrendingUp, label: 'Net Worth',        path: '/net-worth',    desc: 'Network-capital snapshot across all lanes.' },
      { icon: Wallet,     label: 'Wallet',           path: '/wallet',       desc: 'Multi-currency balance + withdrawal flow.' },
    ],
  },
  {
    key: 'commerce',
    title: 'Commerce & creator',
    accent: 'from-emerald-500/25 to-emerald-500/5 border-emerald-500/40',
    items: [
      { icon: Store,       label: 'My Store',         path: '/my-store',         desc: 'Seller dashboard: stats, products, store link.' },
      { icon: Package,     label: 'Create Product',   path: '/products/create',  desc: 'Lean 4-step wizard or single-screen Quick Sell.' },
      { icon: ShoppingBag, label: 'All Products',     path: '/products',         desc: 'Marketplace browse of every published product.' },
    ],
  },
  {
    key: 'community',
    title: 'Community',
    accent: 'from-violet-500/25 to-violet-500/5 border-violet-500/40',
    items: [
      { icon: Users,         label: 'My Network',        path: '/network',     desc: 'Three-lane connection graph: social / pro / financial.' },
      { icon: PiggyBank,     label: 'Stokvels',          path: '/stokvels',    desc: 'Group savings circles + collective participation pools.' },
      { icon: MapPin,        label: 'Places',            path: '/places',      desc: 'Trustpilot-style local-business reviews.' },
      { icon: Briefcase,     label: 'Jobs',              path: '/jobs',        desc: 'Browse + apply to public job postings.' },
      { icon: CalendarHeart, label: 'Regional Hubs',     path: '/hubs',        desc: '54 African countries · city-level community hubs.' },
    ],
  },
  {
    key: 'ambassador',
    title: 'Ambassador & promotions',
    accent: 'from-pink-500/25 to-pink-500/5 border-pink-500/40',
    items: [
      { icon: Award,    label: 'Become Ambassador',   path: '/ambassadors/apply',           desc: 'Apply to the R8,500 ambassador programme.' },
      { icon: Network,  label: 'Command Center',      path: '/ambassadors/command-center',  desc: 'KPIs, network graph, AI insights, engage drawer.' },
      { icon: Megaphone, label: 'Promotions',         path: '/promotions/me',              desc: 'Active campaigns + share-to-earn buttons.' },
    ],
  },
  {
    key: 'admin',
    title: 'Admin tools',
    accent: 'from-blue-500/25 to-blue-500/5 border-blue-500/40',
    items: [
      { icon: LayoutDashboard, label: 'Admin Dashboard',    path: '/admin/dashboard',     desc: 'High-level metrics + key admin actions.' },
      { icon: Users,           label: 'Users',              path: '/admin/users',         desc: 'Search, role management, profile drilldown.' },
      { icon: ListChecks,      label: 'Audit Log',          path: '/admin/audit-log',     desc: 'Every privileged action, timestamped.' },
      { icon: PiggyBank,       label: 'Stokvels admin',     path: '/admin/stokvels',      desc: 'Moderate stokvel groups and contribution flows.' },
      { icon: Briefcase,       label: 'Jobs admin',         path: '/admin/jobs',          desc: 'Post / edit / delete jobs. Manage applicants.' },
      { icon: FileText,        label: 'Job applications',   path: '/admin/job-applications', desc: 'Review every job application across the platform.' },
      { icon: MapPin,          label: 'Places admin',       path: '/admin/places',        desc: 'Moderate places, claims, and reviews.' },
      { icon: Activity,        label: 'Activities admin',   path: '/admin/activities',    desc: 'Moderate community-posted activities.' },
      { icon: Send,            label: 'Announcements',      path: '/admin/announce',      desc: 'Push pinned posts to every member.' },
      { icon: Mail,            label: 'Outreach emails',    path: '/admin/outreach',      desc: 'Invite non-users via curated Brevo templates.' },
      { icon: Megaphone,       label: 'Promotions admin',   path: '/admin/promotions',    desc: 'Create, schedule, and audit campaigns.' },
      { icon: Wallet,          label: 'Withdrawals',        path: '/admin/withdrawals',   desc: 'Approve + sign off member wallet withdrawals.' },
      { icon: BarChart3,       label: 'Ads',                path: '/admin/ads',           desc: 'Manage feed-ad inventory + analytics.' },
      { icon: AlertTriangle,   label: 'Locked accounts',    path: '/admin/locked-accounts', desc: 'Release accounts locked out of password reset.' },
      { icon: ScrollText,      label: 'Ambassador apps',    path: '/admin/ambassador-applications', desc: 'Approve / decline ambassador applications.' },
    ],
  },
  {
    key: 'owner',
    title: 'Owner / Super-Admin',
    accent: 'from-amber-500/25 to-amber-500/5 border-amber-500/40',
    items: [
      { icon: Crown, label: 'Owner Control Center', path: '/admin/owner',          desc: 'Highest-trust dashboard. Super-PIN gate.' },
      { icon: Lock,  label: 'Super-Admin PIN',      path: '/admin/owner/pin',      desc: 'Set or verify the one-time Super-PIN.' },
      { icon: Users, label: 'User cleanup',         path: '/admin/owner/cleanup',  desc: 'Irreversible hard-delete with 21-collection sweep.' },
    ],
  },
];

const AdminSitemapPage = ({ user }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const isAdmin = user && ['admin', 'super_admin', 'moderator'].includes(user.role);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter(
        (it) =>
          it.label.toLowerCase().includes(q) ||
          it.desc.toLowerCase().includes(q) ||
          it.path.toLowerCase().includes(q),
      ),
    })).filter((s) => s.items.length > 0);
  }, [query]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-muted p-10 text-center">
        <div>
          <Shield size={28} className="mx-auto text-primary mb-2" />
          Admin access only.
        </div>
      </div>
    );
  }

  const totalCount = SECTIONS.reduce((a, s) => a + s.items.length, 0);

  return (
    <div className="min-h-screen bg-[#04101e] text-white pb-24" data-testid="admin-sitemap-page">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-[#04101e]/85 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/admin/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-white/5" data-testid="sitemap-back">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-heading font-bold text-base sm:text-lg leading-tight">Network Capital · Site Map</h1>
            <p className="text-[11px] text-white/55">{totalCount} surfaces · tap any icon to open</p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E8A817]/15 border border-[#E8A817]/40 text-[10px] uppercase tracking-wider font-bold text-[#E8A817]">
            <Sparkles size={11} /> {user.role === 'super_admin' ? 'Super-Admin view' : 'Admin view'}
          </span>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 50+ features…"
              className="w-full pl-9 pr-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-full text-sm text-white placeholder-white/40 outline-none focus:border-[#E8A817]/60"
              data-testid="sitemap-search"
            />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-white/55" data-testid="sitemap-no-results">
            No features matched &quot;{query}&quot;.
          </div>
        ) : filtered.map((section) => (
          <section key={section.key} data-testid={`sitemap-section-${section.key}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading font-bold text-sm sm:text-base tracking-wide text-white/85">{section.title}</h2>
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{section.items.length} tools</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {section.items.map((it) => {
                const Icon = it.icon;
                return (
                  <button
                    key={it.path + it.label}
                    onClick={() => navigate(it.path)}
                    className={`group relative text-left rounded-2xl p-4 bg-gradient-to-br ${section.accent} border hover:border-[#E8A817]/60 hover:shadow-[0_8px_24px_-12px_rgba(232,168,23,0.55)] transition-all duration-200 active:scale-[0.98] overflow-hidden`}
                    data-testid={`sitemap-tile-${it.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  >
                    <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                         style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(232,168,23,0.4) 0%, transparent 70%)' }} />
                    <div className="relative flex items-start gap-3">
                      <span className="shrink-0 w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center group-hover:bg-[#E8A817]/15 group-hover:border-[#E8A817]/45 transition-all">
                        <Icon size={18} className="text-white group-hover:text-[#E8A817] transition-colors" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-heading font-bold text-sm leading-tight mb-0.5 truncate">{it.label}</p>
                        <p className="text-[11px] text-white/60 leading-snug line-clamp-2">{it.desc}</p>
                        <p className="text-[10px] mt-1.5 font-mono text-white/35 truncate">{it.path}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
};

export default AdminSitemapPage;
