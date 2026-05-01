import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, User, Wallet as WalletIcon, Briefcase, Package, MapPin, Users as UsersIcon, Menu, X, TrendingUp, Trophy, HelpCircle } from 'lucide-react';

const Layout = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const primaryNav = [
    { icon: Home, label: 'Feed', path: '/' },
    { icon: MapPin, label: 'Hubs', path: '/hubs' },
    { icon: Briefcase, label: 'Stokvel+', path: '/stokvels' },
    { icon: Package, label: 'Products', path: '/products' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const overflowNav = [
    { icon: UsersIcon, label: 'Connections', path: '/connections' },
    { icon: WalletIcon, label: 'Wallet', path: '/wallet' },
    { icon: TrendingUp, label: 'Net Worth', path: '/net-worth' },
    { icon: Trophy, label: 'Leaderboards', path: '/leaderboards' },
    { icon: HelpCircle, label: 'Help', path: '/help' },
  ];

  const isActive = (path) => location.pathname === path;
  const go = (path) => { setMenuOpen(false); navigate(path); };

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-20">
      <div className="max-w-2xl mx-auto">
        {children}
      </div>

      {/* Floating menu button (overflow) */}
      <button
        onClick={() => setMenuOpen(true)}
        className="fixed top-4 right-4 z-40 bg-primary text-white p-2.5 rounded-full shadow-lg hover:scale-105 transition-transform"
        data-testid="open-overflow-menu"
        aria-label="More navigation"
      >
        <Menu size={20} />
      </button>

      {menuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end" onClick={() => setMenuOpen(false)}>
          <div className="bg-[#0a1628] w-72 h-full p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="overflow-menu">
            <div className="flex items-center justify-between mb-6">
              <p className="text-white font-bold text-lg">Menu</p>
              <button onClick={() => setMenuOpen(false)} className="text-white/70 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-1">
              {overflowNav.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => go(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      active ? 'bg-secondary/20 text-secondary' : 'text-white/80 hover:bg-white/5'
                    }`}
                    data-testid={`menu-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
            {user && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-white/60 text-xs">Signed in as</p>
                <p className="text-white font-medium">@{user.username}</p>
              </div>
            )}
          </div>
        </div>
      )}

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
    </div>
  );
};

export default Layout;
