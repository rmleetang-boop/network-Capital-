import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, User, Briefcase, Compass, MapPin } from 'lucide-react';

const Layout = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const primaryNav = [
    { icon: Home, label: 'Feed', path: '/' },
    { icon: Compass, label: 'Explore', path: '/explore' },
    { icon: MapPin, label: 'Hubs', path: '/hubs' },
    { icon: Briefcase, label: 'Stokvel+', path: '/stokvels' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const isActive = (path) => location.pathname === path;
  // Hide bottom nav on DM pages (Instagram-style full-screen chat)
  const hideBottomNav = location.pathname.startsWith('/messages');

  return (
    <div className={`min-h-screen bg-background-DEFAULT ${hideBottomNav ? '' : 'pb-20'}`}>
      <div className="max-w-2xl mx-auto">{children}</div>

      {!hideBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-200 z-50">
          <div className="max-w-2xl mx-auto flex justify-around items-center h-16 px-2">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
                    active ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
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
