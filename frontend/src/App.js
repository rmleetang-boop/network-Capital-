import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from '@/components/ui/sonner';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import LandingPage from './pages/LandingPage';
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
import StokvelIntroPage, { hasSeenStokvelIntro } from './pages/StokvelIntroPage';

const StokvelEntryRoute = ({ user }) => (
  hasSeenStokvelIntro() ? <StokvelListPage user={user} /> : <StokvelIntroPage />
);
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
import ActivitiesPage from './pages/ActivitiesPage';
import AccountSettingsPage from './pages/AccountSettingsPage';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';
import CreateJobPage from './pages/CreateJobPage';
import PremiumLoadingScreen from './components/PremiumLoadingScreen';
import useHeartbeat from './hooks/useHeartbeat';
import Layout from './components/Layout';
import { CurrencyProvider } from './context/CurrencyContext';
import './App.css';

// Captures referral context from a personalised invite link.
// Supports two formats:
//   1) New path-style: /join/<share_code>            (e.g., /join/networkcapitalapp.maria.06.42)
//   2) Legacy query:   /join?ref=<code>&joined=…&bm=…
const JoinHandler = () => {
  const { pathname, search } = window.location;
  try {
    let ref = null;
    let joined = null;
    let bm = null;
    // Path style: /join/<code>
    const pathMatch = pathname.match(/^\/join\/(.+)$/);
    if (pathMatch && pathMatch[1]) {
      ref = decodeURIComponent(pathMatch[1]);
    }
    // Query style fallback / overlay
    const params = new URLSearchParams(search);
    if (!ref) ref = params.get('ref');
    joined = params.get('joined');
    bm = params.get('bm');
    if (ref) {
      localStorage.setItem('nc_referrer', JSON.stringify({
        ref, joined: joined || null, bm: bm || null,
        captured_at: new Date().toISOString(),
      }));
    }
  } catch {}
  const token = localStorage.getItem('token');
  return <Navigate to={token ? '/' : '/auth'} replace />;
};

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
  const [bootSplash, setBootSplash] = useState(() => {
    try { return sessionStorage.getItem('nc_splash_shown') !== '1'; } catch { return true; }
  });

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

  if (loading || bootSplash) {
    return (
      <PremiumLoadingScreen
        minDuration={bootSplash ? 2600 : 1600}
        onDone={() => {
          try { sessionStorage.setItem('nc_splash_shown', '1'); } catch {}
          setBootSplash(false);
        }}
      />
    );
  }

  if (!user) {
    // Show landing page for first-time visitors (but not on legal/admin/auth pages)
    if (showOnboarding && !window.location.pathname.startsWith('/legal') && !window.location.pathname.startsWith('/admin') && !window.location.pathname.startsWith('/auth')) {
      return (
        <>
          <Toaster position="top-center" />
          <BrowserRouter>
            <Routes>
              <Route path="/legal" element={<LegalDocumentsPage />} />
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/onboarding" element={<OnboardingPage onComplete={handleOnboardingComplete} onLogin={handleLogin} />} />
              <Route path="/join" element={<JoinHandler />} />
              <Route path="/join/:slug" element={<JoinHandler />} />
              <Route path="*" element={<LandingPage onContinue={handleOnboardingComplete} />} />
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
            <Route path="/join" element={<JoinHandler />} />
            <Route path="/join/:slug" element={<JoinHandler />} />
            <Route path="/" element={<LandingPage onContinue={handleOnboardingComplete} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
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
            <Route path="/stokvels" element={<StokvelEntryRoute user={user} />} />
            <Route path="/stokvels/intro" element={<StokvelIntroPage />} />
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
            <Route path="/activity" element={<Navigate to="/tracker" replace />} />
            <Route path="/tracker" element={<ActivityTrackerPage user={user} />} />
            <Route path="/activities" element={<ActivitiesPage user={user} />} />
            <Route path="/explore" element={<ExplorePage user={user} />} />
            <Route path="/hashtag/:tag" element={<HashtagPage user={user} />} />
            <Route path="/premium/success" element={<PremiumSuccessPage />} />
            <Route path="/messages" element={<MessagesPage user={user} />} />
            <Route path="/messages/:userId" element={<ChatThreadPage user={user} />} />
            <Route path="/leaderboards" element={<LeaderboardsPage user={user} />} />
            <Route path="/help" element={<HelpCenterPage />} />
            <Route path="/settings" element={<AccountSettingsPage user={user} onLogout={handleLogout} />} />
            <Route path="/jobs" element={<JobsPage user={user} />} />
            <Route path="/jobs/new" element={<CreateJobPage user={user} />} />
            <Route path="/jobs/:jobId" element={<JobDetailPage user={user} />} />
            <Route path="/legal" element={<LegalDocumentsPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/join" element={<Navigate to="/" replace />} />
            <Route path="/join/:slug" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        </CurrencyProvider>
      </BrowserRouter>
    </>
  );
}

export default App;

