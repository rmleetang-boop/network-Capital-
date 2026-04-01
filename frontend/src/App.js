import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from '@/components/ui/sonner';
import AuthPage from './pages/AuthPage';
import FeedPage from './pages/FeedPage';
import ProfilePage from './pages/ProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';
import NotificationsPage from './pages/NotificationsPage';
import DashboardPage from './pages/DashboardPage';
import ReferralPage from './pages/ReferralPage';
import WalletPage from './pages/WalletPage';
import StokvelListPage from './pages/StokvelListPage';
import CreateStokvelPage from './pages/CreateStokvelPage';
import StokvelDetailPage from './pages/StokvelDetailPage';
import Layout from './components/Layout';
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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

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
    return (
      <>
        <Toaster position="top-center" />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage onLogin={handleLogin} />} />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </>
  );
}

export default App;