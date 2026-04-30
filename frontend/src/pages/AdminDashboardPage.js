import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Search, 
  Download, 
  TrendingUp, 
  Wallet, 
  Phone, 
  Mail, 
  Calendar,
  ChevronDown,
  ChevronUp,
  Network,
  Award,
  UserPlus,
  DollarSign,
  Eye,
  X,
  Briefcase,
  Lock,
  Shield
} from 'lucide-react';
import { axiosInstance } from '../App';

// Admin password - change this to your secure password
const ADMIN_PASSWORD = 'NetworkCapital2025!';

const AdminDashboardPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userStokvels, setUserStokvels] = useState([]);

  useEffect(() => {
    // Check if already authenticated
    const adminAuth = sessionStorage.getItem('adminAuthenticated');
    if (adminAuth === 'true') {
      setIsAuthenticated(true);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      sessionStorage.setItem('adminAuthenticated', 'true');
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Invalid password');
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuthenticated');
    setIsAuthenticated(false);
    setUsers([]);
    setStats(null);
  };

  const adminHeaders = { headers: { 'X-Admin-Password': ADMIN_PASSWORD } };

  const fetchData = async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        axiosInstance.get('/admin/users', adminHeaders),
        axiosInstance.get('/admin/stats', adminHeaders)
      ]);
      setUsers(usersRes.data.users);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId) => {
    try {
      const res = await axiosInstance.get(`/admin/users/${userId}/details`, adminHeaders);
      setSelectedUser(res.data.user);
      setUserStokvels(res.data.stokvels || []);
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  const exportToCSV = () => {
    const headers = ['Username', 'Full Name', 'Email', 'Phone', 'Score', 'Wallet Balance', 'Referral Code', 'Referred By', 'Terms Accepted', 'Created At'];
    const csvData = users.map(u => [
      u.username,
      u.full_name || '',
      u.email,
      u.phone || '',
      u.network_score,
      u.wallet_balance,
      u.referral_code,
      u.referred_by_code || '',
      u.terms_accepted_at || '',
      u.created_at
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-capital-users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredUsers = users
    .filter(u => 
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone?.includes(searchQuery)
    )
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (typeof aVal === 'string') aVal = aVal?.toLowerCase() || '';
      if (typeof bVal === 'string') bVal = bVal?.toLowerCase() || '';
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="opacity-30" size={14} />;
    return sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // Admin Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-secondary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="text-secondary" size={32} />
              </div>
              <h1 className="text-2xl font-heading font-bold text-white mb-2">Admin Access</h1>
              <p className="text-white/60 text-sm">Enter the admin password to continue</p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Admin Password"
                  className="w-full pl-12 pr-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                  data-testid="admin-password-input"
                  autoFocus
                />
              </div>

              {passwordError && (
                <p className="text-red-400 text-sm text-center">{passwordError}</p>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-secondary to-yellow-500 text-primary hover:shadow-lg transition-all"
                data-testid="admin-login-button"
              >
                Access Dashboard
              </button>
            </form>

            <p className="text-white/40 text-xs text-center mt-6">
              Protected admin area • Network Capital
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a1628]/95 backdrop-blur-lg border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
              <Users className="text-primary" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-white">Admin Dashboard</h1>
              <p className="text-xs text-white/60">Network Capital User Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-secondary hover:bg-secondary-hover text-primary font-medium px-4 py-2 rounded-lg transition-all"
              data-testid="export-csv"
            >
              <Download size={18} />
              Export CSV
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2 rounded-lg transition-all border border-white/20"
              data-testid="admin-logout"
            >
              <Lock size={18} />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20"
            >
              <div className="flex items-center gap-3 mb-2">
                <Users className="text-blue-400" size={24} />
                <span className="text-white/70 text-sm">Total Users</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.total_users}</p>
              <p className="text-xs text-green-400 mt-1">+{stats.new_users_today} today</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20"
            >
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="text-green-400" size={24} />
                <span className="text-white/70 text-sm">Total Wallet</span>
              </div>
              <p className="text-3xl font-bold text-white">${stats.total_wallet_balance?.toFixed(2)}</p>
              <p className="text-xs text-white/50 mt-1">Across all users</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20"
            >
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="text-secondary" size={24} />
                <span className="text-white/70 text-sm">Avg Score</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.avg_network_score?.toFixed(1)}</p>
              <p className="text-xs text-white/50 mt-1">Network Score</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20"
            >
              <div className="flex items-center gap-3 mb-2">
                <UserPlus className="text-purple-400" size={24} />
                <span className="text-white/70 text-sm">Referrals</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.total_referrals}</p>
              <p className="text-xs text-white/50 mt-1">Successful referrals</p>
            </motion.div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone..."
            className="w-full pl-12 pr-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
            data-testid="search-users"
          />
        </div>

        {/* Users Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left p-4 text-white/70 font-medium text-sm">
                    <button onClick={() => toggleSort('username')} className="flex items-center gap-1 hover:text-white">
                      User <SortIcon field="username" />
                    </button>
                  </th>
                  <th className="text-left p-4 text-white/70 font-medium text-sm">Contact</th>
                  <th className="text-left p-4 text-white/70 font-medium text-sm">
                    <button onClick={() => toggleSort('network_score')} className="flex items-center gap-1 hover:text-white">
                      Score <SortIcon field="network_score" />
                    </button>
                  </th>
                  <th className="text-left p-4 text-white/70 font-medium text-sm">
                    <button onClick={() => toggleSort('wallet_balance')} className="flex items-center gap-1 hover:text-white">
                      Wallet <SortIcon field="wallet_balance" />
                    </button>
                  </th>
                  <th className="text-left p-4 text-white/70 font-medium text-sm">Referral</th>
                  <th className="text-left p-4 text-white/70 font-medium text-sm">
                    <button onClick={() => toggleSort('created_at')} className="flex items-center gap-1 hover:text-white">
                      Joined <SortIcon field="created_at" />
                    </button>
                  </th>
                  <th className="text-left p-4 text-white/70 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredUsers.map((user, idx) => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-secondary to-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {user.username?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{user.full_name || user.username}</p>
                          <p className="text-white/50 text-xs">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-white/80 text-sm">
                          <Mail size={14} className="text-white/40" />
                          {user.email}
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-2 text-white/60 text-xs">
                            <Phone size={12} className="text-white/40" />
                            {user.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-white/20 rounded-full h-2">
                          <div 
                            className="h-full bg-secondary rounded-full" 
                            style={{ width: `${user.network_score}%` }} 
                          />
                        </div>
                        <span className="text-white font-medium text-sm">{user.network_score}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-green-400 font-medium">${user.wallet_balance?.toFixed(2)}</span>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-secondary font-mono text-xs">{user.referral_code}</p>
                        {user.referred_by_code && (
                          <p className="text-white/40 text-xs mt-1">via: {user.referred_by_code}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-white/60 text-xs">
                        <Calendar size={12} />
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => fetchUserDetails(user.id)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        data-testid={`view-user-${user.id}`}
                      >
                        <Eye className="text-secondary" size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="mx-auto mb-4 text-white/30" size={48} />
              <p className="text-white/50">No users found</p>
            </div>
          )}
        </motion.div>

        <p className="text-white/40 text-sm mt-4 text-center">
          Showing {filteredUsers.length} of {users.length} users
        </p>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0a1628] rounded-2xl border border-white/20 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-[#0a1628] border-b border-white/10 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">User Details</h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X className="text-white/60" size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-secondary to-primary rounded-2xl flex items-center justify-center text-white font-bold text-2xl">
                  {selectedUser.username?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedUser.full_name || selectedUser.username}</h3>
                  <p className="text-white/60">@{selectedUser.username}</p>
                </div>
              </div>

              {/* Contact Details */}
              <div className="bg-white/5 rounded-xl p-4 space-y-3">
                <h4 className="text-white/70 font-medium text-sm mb-3">Contact Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-white/40 text-xs">Email</p>
                    <p className="text-white">{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">Phone</p>
                    <p className="text-white">{selectedUser.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">Joined</p>
                    <p className="text-white">{new Date(selectedUser.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">Terms Accepted</p>
                    <p className="text-white">{selectedUser.terms_accepted_at ? new Date(selectedUser.terms_accepted_at).toLocaleString() : 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <TrendingUp className="text-secondary mx-auto mb-2" size={24} />
                  <p className="text-2xl font-bold text-white">{selectedUser.network_score}</p>
                  <p className="text-white/50 text-xs">Network Score</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <Wallet className="text-green-400 mx-auto mb-2" size={24} />
                  <p className="text-2xl font-bold text-white">${selectedUser.wallet_balance?.toFixed(2)}</p>
                  <p className="text-white/50 text-xs">Wallet Balance</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <Award className="text-purple-400 mx-auto mb-2" size={24} />
                  <p className="text-2xl font-bold text-white">{selectedUser.rank || 'Rising Star'}</p>
                  <p className="text-white/50 text-xs">Rank</p>
                </div>
              </div>

              {/* Referral Info */}
              <div className="bg-white/5 rounded-xl p-4">
                <h4 className="text-white/70 font-medium text-sm mb-3">Referral Network</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-white/40 text-xs">Referral Code</p>
                    <p className="text-secondary font-mono">{selectedUser.referral_code}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">Referred By</p>
                    <p className="text-white">{selectedUser.referred_by_code || 'Direct signup'}</p>
                  </div>
                </div>
              </div>

              {/* Stokvels */}
              {userStokvels.length > 0 && (
                <div className="bg-white/5 rounded-xl p-4">
                  <h4 className="text-white/70 font-medium text-sm mb-3 flex items-center gap-2">
                    <Briefcase size={16} />
                    Stokvel+ Memberships ({userStokvels.length})
                  </h4>
                  <div className="space-y-2">
                    {userStokvels.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                        <div>
                          <p className="text-white font-medium">{s.name}</p>
                          <p className="text-white/50 text-xs">{s.members?.length || 0} members</p>
                        </div>
                        <div className="text-right">
                          <p className="text-secondary font-medium">${s.pool?.toFixed(2) || '0.00'}</p>
                          <p className="text-white/50 text-xs">Pool</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
