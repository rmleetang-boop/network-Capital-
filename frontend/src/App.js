import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from '@/components/ui/sonner';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import HelpCenterPage from './pages/HelpCenterPage';
import LegalDocumentsPage from './pages/LegalDocumentsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import FeedPage from './pages/FeedPage';
import ProfilePage from './pages/ProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';
import LeaderboardsPage from './pages/LeaderboardsPage';
import NotificationsPage from './pages/NotificationsPage';
import DashboardPage from './pages/DashboardPage';
import ReferralPage from './pages/ReferralPage';
import WalletPage from './pages/WalletPage';
import StokvelListPage from './pages/StokvelListPage';
import CreateStokvelPage from './pages/CreateStokvelPage';
import StokvelDetailPage from './pages/StokvelDetailPage';
import ScoreDashboardPage from './pages/ScoreDashboardPage';
import RewardsPage from './pages/RewardsPage';
import ProductListPage from './pages/ProductListPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CreateProductPage from './pages/CreateProductPage';
import NetWorthPage from './pages/NetWorthPage';
import AudienceInsightsPage from './pages/AudienceInsightsPage';
import RegionalHubsPage from './pages/RegionalHubsPage';
import ConnectionsPage from './pages/ConnectionsPage';
import ActivityTrackerPage from './pages/ActivityTrackerPage';
import ExplorePage from './pages/ExplorePage';
import HashtagPage from './pages/HashtagPage';
import PremiumSuccessPage from './pages/PremiumSuccessPage';
import MessagesPage from './pages/MessagesPage';
import ChatThreadPage from './pages/ChatThreadPage';
import useHeartbeat from './hooks/useHeartbeat';
import Layout from './components/Layout';
import { CurrencyProvider } from './context/CurrencyContext';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const axiosInstance = axios.create({
  baseURL: API,
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Heartbeat: ping every 60s while authenticated for time-on-app score
  useHeartbeat(!!user);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    
    if (token) {
      fetchCurrentUser();
    } else {
      // Show onboarding for new visitors
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
      }
      setLoading(false);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await axiosInstance.get('/users/me');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-DEFAULT">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Show onboarding for first-time visitors (but not on legal/admin page)
    if (showOnboarding && !window.location.pathname.startsWith('/legal') && !window.location.pathname.startsWith('/admin')) {
      return (
        <>
          <Toaster position="top-center" />
          <BrowserRouter>
            <Routes>
              <Route path="/legal" element={<LegalDocumentsPage />} />
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="*" element={<OnboardingPage onComplete={handleOnboardingComplete} onLogin={handleLogin} />} />
            </Routes>
          </BrowserRouter>
        </>
      );
    }

    return (
      <>
        <Toaster position="top-center" />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage onLogin={handleLogin} />} />
            <Route path="/onboarding" element={<OnboardingPage onComplete={handleOnboardingComplete} onLogin={handleLogin} />} />
            <Route path="/legal" element={<LegalDocumentsPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        </BrowserRouter>
      </>
    );
  }

  return (
    <>
      <Toaster position="top-center" />
      <BrowserRouter>
        <CurrencyProvider user={user} setUser={setUser}>
          <Layout user={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/" element={<FeedPage user={user} />} />
            <Route path="/profile" element={<ProfilePage user={user} setUser={setUser} />} />
            <Route path="/profile/:userId" element={<ProfilePage user={user} setUser={setUser} />} />
            <Route path="/leaderboard" element={<LeaderboardPage currentUser={user} />} />
            <Route path="/notifications" element={<NotificationsPage user={user} />} />
            <Route path="/dashboard" element={<DashboardPage user={user} />} />
            <Route path="/referral" element={<ReferralPage user={user} />} />
            <Route path="/wallet" element={<WalletPage user={user} />} />
            <Route path="/stokvels" element={<StokvelListPage user={user} />} />
            <Route path="/stokvels/create" element={<CreateStokvelPage />} />
            <Route path="/stokvels/:stokvelId" element={<StokvelDetailPage user={user} />} />
            <Route path="/stokvels/:stokvelId/score" element={<ScoreDashboardPage user={user} />} />
            <Route path="/stokvels/:stokvelId/rewards" element={<RewardsPage />} />
            <Route path="/products" element={<ProductListPage user={user} />} />
            <Route path="/products/create" element={<CreateProductPage user={user} />} />
            <Route path="/products/:productId" element={<ProductDetailPage user={user} />} />
            <Route path="/products/:productId/insights" element={<AudienceInsightsPage user={user} />} />
            <Route path="/net-worth" element={<NetWorthPage user={user} />} />
            <Route path="/hubs" element={<RegionalHubsPage user={user} />} />
            <Route path="/connections" element={<ConnectionsPage user={user} />} />
            <Route path="/activity" element={<ActivityTrackerPage user={user} />} />
            <Route path="/explore" element={<ExplorePage user={user} />} />
            <Route path="/hashtag/:tag" element={<HashtagPage user={user} />} />
            <Route path="/premium/success" element={<PremiumSuccessPage />} />
            <Route path="/messages" element={<MessagesPage user={user} />} />
            <Route path="/messages/:userId" element={<ChatThreadPage user={user} />} />
            <Route path="/leaderboards" element={<LeaderboardsPage user={user} />} />
            <Route path="/help" element={<HelpCenterPage />} />
            <Route path="/legal" element={<LegalDocumentsPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        </CurrencyProvider>
      </BrowserRouter>
    </>
  );
}

export default App;
