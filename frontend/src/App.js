import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from '@/components/ui/sonner';

// Eager — chrome / boot / auth (always needed before any feature page mounts)
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import LandingPage from './pages/LandingPage';
import Layout from './components/Layout';
import PremiumLoadingScreen from './components/PremiumLoadingScreen';
import PromotionsWelcomeModal from './components/PromotionsWelcomeModal';
import { hasSeenStokvelIntro } from './lib/stokvelIntro';
import useHeartbeat from './hooks/useHeartbeat';
import { CurrencyProvider } from './context/CurrencyContext';
import './App.css';

// Lazy — every feature page is split into its own chunk
const HelpCenterPage = lazy(() => import('./pages/HelpCenterPage'));
const LegalDocumentsPage = lazy(() => import('./pages/LegalDocumentsPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const LeaderboardsPage = lazy(() => import('./pages/LeaderboardsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReferralPage = lazy(() => import('./pages/ReferralPage'));
const WalletPage = lazy(() => import('./pages/WalletPage'));
const StokvelListPage = lazy(() => import('./pages/StokvelListPage'));
const StokvelIntroPage = lazy(() => import('./pages/StokvelIntroPage'));
const CreateStokvelPage = lazy(() => import('./pages/CreateStokvelPage'));
const StokvelDetailPage = lazy(() => import('./pages/StokvelDetailPage'));
const ScoreDashboardPage = lazy(() => import('./pages/ScoreDashboardPage'));
const RewardsPage = lazy(() => import('./pages/RewardsPage'));
const ProductListPage = lazy(() => import('./pages/ProductListPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const SharedProductPage = lazy(() => import('./pages/SharedProductPage'));
const CreateProductPage = lazy(() => import('./pages/CreateProductPage'));
const MyStorePage = lazy(() => import('./pages/MyStorePage'));
const StorefrontPage = lazy(() => import('./pages/StorefrontPage'));
const NetWorthPage = lazy(() => import('./pages/NetWorthPage'));
const AudienceInsightsPage = lazy(() => import('./pages/AudienceInsightsPage'));
const RegionalHubsPage = lazy(() => import('./pages/RegionalHubsPage'));
const ConnectionsPage = lazy(() => import('./pages/ConnectionsPage'));
const ActivityTrackerPage = lazy(() => import('./pages/ActivityTrackerPage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const HashtagPage = lazy(() => import('./pages/HashtagPage'));
const PremiumSuccessPage = lazy(() => import('./pages/PremiumSuccessPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const ChatThreadPage = lazy(() => import('./pages/ChatThreadPage'));
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage'));
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'));
const JobsPage = lazy(() => import('./pages/JobsPage'));
const JobDetailPage = lazy(() => import('./pages/JobDetailPage'));
const CreateJobPage = lazy(() => import('./pages/CreateJobPage'));
const PlacesPage = lazy(() => import('./pages/PlacesPage'));
const PlaceDetailPage = lazy(() => import('./pages/PlaceDetailPage'));
const CreatePlacePage = lazy(() => import('./pages/CreatePlacePage'));
const NetworkPage = lazy(() => import('./pages/NetworkPage'));
const NetworkUserPage = lazy(() => import('./pages/NetworkUserPage'));
const AdminMetricsDashboardPage = lazy(() => import('./pages/AdminMetricsDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminSitemapPage = lazy(() => import('./pages/AdminSitemapPage'));
const AdminAuditLogPage = lazy(() => import('./pages/AdminAuditLogPage'));
const AdminStokvelsPage = lazy(() => import('./pages/AdminStokvelsPage'));
const AdminProfileDetailPage = lazy(() => import('./pages/AdminProfileDetailPage'));
const AdminAnnouncePage = lazy(() => import('./pages/AdminAnnouncePage'));
const AdminOutreachPage = lazy(() => import('./pages/AdminOutreachPage'));
const AdminJobsPage = lazy(() => import('./pages/AdminJobsPage'));
const AdminPlacesPage = lazy(() => import('./pages/AdminListPages').then((m) => ({ default: m.AdminPlacesPage })));
const AdminActivitiesPage = lazy(() => import('./pages/AdminListPages').then((m) => ({ default: m.AdminActivitiesPage })));
const AmbassadorDashboardPage = lazy(() => import('./pages/AmbassadorDashboardPage'));
const AmbassadorCommandCenterPage = lazy(() => import('./pages/AmbassadorCommandCenterPage'));
const AmbassadorLeaderboardPage = lazy(() => import('./pages/AmbassadorLeaderboardPage'));
const PromotionsListPage = lazy(() => import('./pages/PromotionsListPage'));
const PromotionDetailPage = lazy(() => import('./pages/PromotionDetailPage'));
const MyPromotionsPage = lazy(() => import('./pages/MyPromotionsPage'));
const AdminWithdrawalsPage = lazy(() => import('./pages/AdminWithdrawalsPage'));
const AdminAdsPage = lazy(() => import('./pages/AdminAdsPage'));
const BecomeAmbassadorPage = lazy(() => import('./pages/BecomeAmbassadorPage'));
const OwnerControlCenterPage = lazy(() => import('./pages/OwnerControlCenterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const AdminLockedAccountsPage = lazy(() => import('./pages/AdminLockedAccountsPage'));
const AdminAmbassadorApplicationsPage = lazy(() => import('./pages/AdminAmbassadorApplicationsPage'));
const AdminJobApplicationsPage = lazy(() => import('./pages/AdminJobApplicationsPage'));
const OwnerUserCleanupPage = lazy(() => import('./pages/OwnerUserCleanupPage'));
const ReferralLandingPage = lazy(() => import('./pages/ReferralLandingPage'));
const SuperPinPage = lazy(() => import('./pages/SuperPinPage'));
const UserPublicProfilePage = lazy(() => import('./pages/UserPublicProfilePage'));

const StokvelEntryRoute = ({ user }) => (
  hasSeenStokvelIntro() ? <StokvelListPage user={user} /> : <StokvelIntroPage />
);

// Lightweight in-flight fallback shown while a lazy chunk is loading
const RouteFallback = () => (
  <div
    data-testid="route-loading"
    className="min-h-[60vh] flex items-center justify-center bg-[#04101e]"
  >
    <div className="w-10 h-10 border-2 border-[#E8A817]/30 border-t-[#E8A817] rounded-full animate-spin" />
  </div>
);

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
    const pathMatch = pathname.match(/^\/join\/(.+)$/);
    if (pathMatch && pathMatch[1]) {
      ref = decodeURIComponent(pathMatch[1]);
    }
    const params = new URLSearchParams(search);
    if (!ref) ref = params.get('ref');
    joined = params.get('joined');
    bm = params.get('bm');
    if (ref) {
      localStorage.setItem('nc_referrer', JSON.stringify({
        ref, joined: joined || null, bm: bm || null,
        captured_at: new Date().toISOString(),
      }));
      try {
        fetch(`${BACKEND_URL}/api/referrals/track-click`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref, user_agent: navigator.userAgent }),
          keepalive: true,
        }).catch(() => {});
      } catch { /* ignored */ }
    }
  } catch { /* ignored */ }
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
  try {
    const pinToken = sessionStorage.getItem('nc_super_pin_token');
    const exp = parseInt(sessionStorage.getItem('nc_super_pin_exp') || '0', 10);
    if (pinToken && exp > Date.now()) {
      config.headers['X-Super-Pin-Token'] = pinToken;
    } else if (pinToken && exp && exp <= Date.now()) {
      sessionStorage.removeItem('nc_super_pin_token');
      sessionStorage.removeItem('nc_super_pin_exp');
    }
  } catch { /* sessionStorage disabled */ }
  return config;
});

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useHeartbeat(!!user);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');

    if (token) {
      fetchCurrentUser();
    } else {
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

  // Initial boot only — disappears the moment user fetch resolves (no artificial timer)
  if (loading) {
    return <PremiumLoadingScreen visible={true} />;
  }

  if (!user) {
    // Show landing page for first-time visitors (but not on legal/admin/auth pages)
    if (showOnboarding
        && !window.location.pathname.startsWith('/legal')
        && !window.location.pathname.startsWith('/admin')
        && !window.location.pathname.startsWith('/auth')
        && !window.location.pathname.startsWith('/forgot-password')
        && !window.location.pathname.startsWith('/reset-password')
        && !window.location.pathname.startsWith('/p/')
        && !window.location.pathname.startsWith('/store/')) {
      return (
        <>
          <Toaster position="top-center" />
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/legal" element={<LegalDocumentsPage />} />
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/onboarding" element={<OnboardingPage onComplete={handleOnboardingComplete} onLogin={handleLogin} />} />
                <Route path="/join" element={<JoinHandler />} />
                <Route path="/join/:slug" element={<JoinHandler />} />
                <Route path="/r/:username" element={<ReferralLandingPage />} />
                <Route path="/p/:username/:slug" element={<SharedProductPage />} />
                <Route path="/store/:username" element={<StorefrontPage user={null} />} />
                <Route path="*" element={<LandingPage onContinue={handleOnboardingComplete} />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </>
      );
    }

    return (
      <>
        <Toaster position="top-center" />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/auth" element={<AuthPage onLogin={handleLogin} />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/onboarding" element={<OnboardingPage onComplete={handleOnboardingComplete} onLogin={handleLogin} />} />
              <Route path="/legal" element={<LegalDocumentsPage />} />
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/join" element={<JoinHandler />} />
              <Route path="/join/:slug" element={<JoinHandler />} />
              <Route path="/r/:username" element={<ReferralLandingPage />} />
              <Route path="/p/:username/:slug" element={<SharedProductPage />} />
              <Route path="/store/:username" element={<StorefrontPage user={null} />} />
              <Route path="/" element={<LandingPage onContinue={handleOnboardingComplete} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
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
            <PromotionsWelcomeModal user={user} />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<FeedPage user={user} />} />
                <Route path="/profile" element={<ProfilePage user={user} setUser={setUser} />} />
                <Route path="/profile/:userId" element={<ProfilePage user={user} setUser={setUser} />} />
                <Route path="/u/:username" element={<UserPublicProfilePage user={user} />} />
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
                <Route path="/p/:username/:slug" element={<SharedProductPage />} />
                <Route path="/products/:productId/insights" element={<AudienceInsightsPage user={user} />} />
                <Route path="/my-store" element={<MyStorePage user={user} />} />
                <Route path="/store/:username" element={<StorefrontPage user={user} />} />
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
                <Route path="/places" element={<PlacesPage user={user} />} />
                <Route path="/places/new" element={<CreatePlacePage user={user} />} />
                <Route path="/places/:placeId" element={<PlaceDetailPage user={user} />} />
                <Route path="/network" element={<NetworkPage user={user} />} />
                <Route path="/network/:userId" element={<NetworkUserPage user={user} />} />
                <Route path="/admin/dashboard" element={<AdminMetricsDashboardPage user={user} setUser={setUser} />} />
                <Route path="/admin/users" element={<AdminUsersPage user={user} />} />
                <Route path="/admin/sitemap" element={<AdminSitemapPage user={user} />} />
                <Route path="/admin/profiles/:userId" element={<AdminProfileDetailPage user={user} />} />
                <Route path="/admin/audit-log" element={<AdminAuditLogPage user={user} />} />
                <Route path="/admin/stokvels" element={<AdminStokvelsPage user={user} />} />
                <Route path="/admin/jobs" element={<AdminJobsPage user={user} />} />
                <Route path="/admin/places" element={<AdminPlacesPage user={user} />} />
                <Route path="/admin/activities" element={<AdminActivitiesPage user={user} />} />
                <Route path="/admin/announce" element={<AdminAnnouncePage user={user} />} />
                <Route path="/admin/outreach" element={<AdminOutreachPage user={user} />} />
                <Route path="/admin/promotions" element={<PromotionsListPage user={user} />} />
                <Route path="/admin/promotions/:promotionId" element={<PromotionDetailPage user={user} />} />
                <Route path="/admin/withdrawals" element={<AdminWithdrawalsPage user={user} />} />
                <Route path="/admin/ads" element={<AdminAdsPage user={user} />} />
                <Route path="/admin/ambassador-applications" element={<AdminAmbassadorApplicationsPage user={user} />} />
                <Route path="/ambassadors/apply" element={<BecomeAmbassadorPage user={user} />} />
                <Route path="/promotions/me" element={<MyPromotionsPage user={user} />} />
                <Route path="/ambassadors/me" element={<AmbassadorDashboardPage user={user} />} />
                <Route path="/ambassadors/command-center" element={<AmbassadorCommandCenterPage user={user} />} />
                <Route path="/ambassador-dashboard" element={<AmbassadorDashboardPage user={user} />} />
                <Route path="/ambassadors/leaderboard" element={<AmbassadorLeaderboardPage />} />
                <Route path="/legal" element={<LegalDocumentsPage />} />
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/owner" element={<OwnerControlCenterPage user={user} />} />
                <Route path="/admin/owner/pin" element={<SuperPinPage user={user} />} />
                <Route path="/admin/locked-accounts" element={<AdminLockedAccountsPage user={user} />} />
                <Route path="/admin/job-applications" element={<AdminJobApplicationsPage user={user} />} />
                <Route path="/admin/owner/cleanup" element={<OwnerUserCleanupPage user={user} />} />

                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                <Route path="/join" element={<Navigate to="/" replace />} />
                <Route path="/join/:slug" element={<Navigate to="/" replace />} />
                <Route path="/r/:username" element={<ReferralLandingPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Layout>
        </CurrencyProvider>
      </BrowserRouter>
    </>
  );
}

export default App;
