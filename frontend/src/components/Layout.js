import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Trophy, Bell, User, BarChart3, Wallet } from 'lucide-react';

const Layout = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Feed', path: '/' },
    { icon: Wallet, label: 'Stokvels', path: '/stokvels' },
    { icon: Trophy, label: 'Leaderboard', path: '/leaderboard' },
    { icon: Bell, label: 'Notifications', path: '/notifications' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-20">
      <div className="max-w-2xl mx-auto">
        {children}
      </div>
      
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-200 z-50">
        <div className="max-w-2xl mx-auto flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
                  active ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon size={24} strokeWidth={active ? 2.5 : 1.5} />
                <span className={`text-xs mt-1 font-medium ${active ? 'font-semibold' : ''}`}>
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