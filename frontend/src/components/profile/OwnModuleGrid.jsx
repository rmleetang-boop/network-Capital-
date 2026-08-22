import React from 'react';
import {
  Users, MapPin, MessageCircle, Sparkles, Wallet, Package,
  TrendingUp, Activity, Briefcase, Trophy, Bell, HelpCircle,
  Settings, Star, Shield, Crown, Gem,
} from 'lucide-react';

/**
 * OwnModuleGrid — single source of truth for the own-profile module tile grid.
 *
 * Used by:
 *   - /profile          (ProfilePage.js)              variant="quick-access"
 *   - /u/:me            (UserPublicProfilePage.js)    variant="own-module"
 *
 * Variants preserve existing data-testids so testing flows don't regress:
 *   - variant="quick-access" → wrap testid `quick-access-grid-wrap`, inner grid `quick-access-grid`,
 *     per-tile `quick-<slug>`, header right text "Tap to open", extra blue halo.
 *   - variant="own-module"   → wrap testid `own-module-grid`, per-tile `module-<slug>`,
 *     header right text "<N> tools".
 */
const buildTiles = (profile) => [
  { icon: Users, label: 'My Network', path: '/network' },
  { icon: MapPin, label: 'My Places', path: '/places' },
  { icon: MessageCircle, label: 'Messages', path: '/messages' },
  { icon: Sparkles, label: 'Activities', path: '/activities' },
  { icon: Wallet, label: 'Wallet', path: '/wallet' },
  { icon: Package, label: 'My Store', path: '/my-store', highlight: true },
  { icon: Package, label: 'Products', path: '/products' },
  { icon: TrendingUp, label: 'Net Worth', path: '/net-worth' },
  { icon: Gem, image: '/network-capital-symbol.png', label: 'Network Capital', path: '/', highlight: true },
  { icon: Activity, label: 'Score Tracker', path: '/tracker' },
  { icon: Briefcase, label: 'Jobs', path: '/jobs' },
  { icon: Sparkles, label: 'Promotions', path: '/promotions/me' },
  { icon: Star, label: 'Become Ambassador', path: '/ambassadors/apply' },
  { icon: Trophy, label: 'Leaderboards', path: '/leaderboards' },
  { icon: Bell, label: 'Notifications', path: '/notifications' },
  { icon: HelpCircle, label: 'Help', path: '/help' },
  { icon: Settings, label: 'Settings', path: '/settings' },
  ...(profile?.is_ambassador
    ? [{ icon: Trophy, label: 'Ambassador', path: '/ambassadors/me', highlight: true }]
    : []),
  ...(['admin', 'moderator', 'super_admin'].includes(profile?.role)
    ? [{ icon: Shield, label: 'Admin', path: '/admin/dashboard', highlight: true }]
    : []),
  ...(profile?.role === 'super_admin'
    ? [{ icon: Crown, label: 'Owner Center', path: '/admin/owner/pin', highlight: true }]
    : []),
];

const slugify = (s) => s.toLowerCase().replace(/\s+/g, '-');

const OwnModuleGrid = ({ profile, onNavigate, variant = 'own-module' }) => {
  const tiles = buildTiles(profile);
  const isQuickAccess = variant === 'quick-access';

  const wrapperTestId = isQuickAccess ? 'quick-access-grid-wrap' : 'own-module-grid';
  const innerGridTestId = isQuickAccess ? 'quick-access-grid' : undefined;
  const tileTestPrefix = isQuickAccess ? 'quick' : 'module';
  const headerRight = isQuickAccess ? 'Tap to open' : `${tiles.length} tools`;

  const wrapperClass = isQuickAccess
    ? 'relative mb-1 overflow-hidden rounded-2xl border border-white/10 bg-transparent p-0'
    : 'relative mb-5 overflow-hidden rounded-2xl border border-white/10 bg-transparent p-0';

  const handleNavigate = (tile) => {
    if (tile.external) {
      window.location.assign(tile.path);
      return;
    }
    if (typeof onNavigate === 'function') {
      onNavigate(tile.path);
    } else {
      window.location.href = tile.path;
    }
  };

  return (
    <div className={wrapperClass} data-testid={wrapperTestId}>
      {/* Shared gold atmosphere, kept inside the parent surface instead of creating a second panel. */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(232,168,23,0.28) 0%, transparent 65%)' }}
      />
      {/* Blue halo — quick-access only */}
      {isQuickAccess && (
        <div
          className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full pointer-events-none opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(30,79,165,0.5) 0%, transparent 65%)' }}
        />
      )}

      <div className="relative mb-3 flex items-center justify-between px-1">
        <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#E8A817]">Your modules</p>
        <span className="text-[10px] uppercase tracking-wider text-white/40">{headerRight}</span>
      </div>

      <div className="relative grid grid-cols-3 gap-2.5" data-testid={innerGridTestId}>
        {tiles.map((t) => {
          const TIcon = t.icon;
          return (
            <button
              key={t.path + t.label}
              onClick={() => handleNavigate(t)}
              className={`group relative flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 transition-all duration-200 active:scale-95 ${
                t.highlight
                  ? 'bg-[#e8ad2f]/[0.08] border-[#e8ad2f]/35 hover:border-[#e8ad2f]/70 hover:bg-[#e8ad2f]/[0.13]'
                  : 'bg-white/[0.025] border-white/10 hover:bg-white/[0.07] hover:border-[#e8ad2f]/35'
              }`}
              data-testid={`${tileTestPrefix}-${slugify(t.label)}`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center border overflow-hidden ${
                  t.highlight
                    ? 'bg-[#E8A817]/15 border-[#E8A817]/40'
                    : 'bg-white/5 border-white/10 group-hover:border-[#E8A817]/40 group-hover:bg-[#E8A817]/10'
                } transition-colors`}
              >
                {t.image ? (
                  <img src={t.image} alt="Network Capital symbol" className="h-full w-full object-contain p-1.5" />
                ) : (
                  <TIcon size={18} className={t.highlight ? 'text-[#E8A817]' : 'text-white/85 group-hover:text-[#E8A817]'} />
                )}
              </div>
              <span className="text-[11px] font-semibold leading-tight text-center text-white/85 group-hover:text-white">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default OwnModuleGrid;
