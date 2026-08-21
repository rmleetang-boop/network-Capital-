import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, User, Briefcase, Compass, MapPin, Film } from 'lucide-react';

const Layout = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const primaryNav = [
    { icon: Home, label: 'Feed', path: '/' },
    { icon: Compass, label: 'Explore', path: '/explore' },
    { icon: Film, label: 'Reels', path: '/reels' },
    { icon: MapPin, label: 'Hubs', path: '/hubs' },
    { icon: Briefcase, label: 'Stokvel+', path: '/stokvels' },
    // The authenticated Profile tab must use the own-profile route directly.
    // Public profiles remain available through /u/:username elsewhere in the app.
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const isActive = (path) => {
    if (path === '/profile') {
      return location.pathname === '/profile' || location.pathname.startsWith('/profile/');
    }
    return location.pathname === path;
  };
  // Hide bottom nav on DM pages (Instagram-style full-screen chat) and on the
  // iter 56 product-creation flow (sticky publish footer needs the bottom edge).
  const hideBottomNav =
    location.pathname.startsWith('/messages') ||
    location.pathname === '/products/create';

  return (
    <div className={`platform-shell min-h-screen w-full overflow-x-hidden bg-[#080b12] text-white ${hideBottomNav ? '' : 'pb-20'}`}>
      <div className="w-full min-w-0">{children}</div>

      {!hideBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 w-full border-t border-white/10 bg-[#0c111b]/90 backdrop-blur-xl">
          <div className="w-full flex justify-around items-center h-16 px-2 sm:px-6 lg:px-12">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
                    active ? 'text-[#e8ad2f]' : 'text-white/50 hover:text-white'
                  }`}
                  data-testid={`bottom-nav-${item.label.toLowerCase().replace(/\s+/g, '-').replace(/\+/g, '')}`}
                >
                  <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
                  <span className={`text-[10px] mt-0.5 font-medium ${active ? 'font-semibold' : ''}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default Layout;
