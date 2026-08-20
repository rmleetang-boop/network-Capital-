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
  { icon: Gem, image: '/brand/aridja-logo.png', label: 'Aridja', path: 'https://aridja.online', external: true, highlight: true },
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
    ? 'relative rounded-3xl overflow-hidden mb-5 bg-gradient-to-br from-[#04101e] via-[#0a1f3a] to-[#04101e] border border-white/10 p-4 sm:p-5'
    : 'relative rounded-3xl overflow-hidden mb-5 bg-gradient-to-br from-[#0a1f3a] to-[#04101e] border border-white/10 p-4';

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
      {/* Gold halo (both variants) */}
      <div
        className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(232,168,23,0.25) 0%, transparent 65%)' }}
      />
      {/* Blue halo — quick-access only */}
      {isQuickAccess && (
        <div
          className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full pointer-events-none opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(30,79,165,0.5) 0%, transparent 65%)' }}
        />
      )}

      <div className="relative flex items-center justify-between mb-3">
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
              className={`group relative flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all duration-200 active:scale-95 ${
                t.highlight
                  ? 'bg-gradient-to-br from-[#E8A817]/20 to-[#E8A817]/5 border-[#E8A817]/40 hover:border-[#E8A817]/70'
                  : 'bg-white/[0.06] border-white/10 hover:bg-white/[0.10] hover:border-[#E8A817]/30'
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
                  <img src={t.image} alt="Aridja" className="w-full h-full object-contain p-1" />
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
