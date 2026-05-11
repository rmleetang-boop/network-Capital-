import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Search, Loader2, ArrowLeft } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const ROLE_OPTIONS = ['user', 'moderator', 'admin'];

const AdminUsersPage = ({ user }) => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user && user.role === 'admin';

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q.trim()) params.q = q.trim();
      if (roleFilter) params.role = roleFilter;
      const r = await axiosInstance.get('/admin/users-list', { params });
      setUsers(r.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [roleFilter]);

  const setRole = async (uid, role) => {
    if (!window.confirm(`Set this user's role to ${role.toUpperCase()}?`)) return;
    try {
      await axiosInstance.patch(`/admin/users/${uid}/role`, { role });
      toast.success(`Role updated to ${role}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not update role');
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen p-10 text-center text-text-muted">
        <Shield size={28} className="mx-auto text-primary mb-2" />
        Only admins can manage user roles.
        <div className="mt-3">
          <button onClick={() => navigate('/admin/dashboard')} className="text-primary text-sm font-semibold">← Back to dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="admin-users-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate('/admin/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-heading font-bold text-primary flex-1">User management</h1>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="Search by email, username or name"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm outline-none focus:border-primary"
              data-testid="admin-users-search"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-full text-sm outline-none focus:border-primary"
            data-testid="admin-users-role-filter">
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={load} className="bg-primary text-white text-xs font-semibold px-3 py-2 rounded-full" data-testid="admin-users-go">Go</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {users.length === 0 ? (
              <p className="p-6 text-center text-text-muted text-sm">No users match these filters.</p>
            ) : users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0" data-testid={`admin-user-row-${u.id}`}>
                {u.photo ? (
                  <img src={u.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-xs font-bold flex items-center justify-center">
                    {(u.username || u.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{u.full_name || u.username || u.email}</p>
                  <p className="text-[11px] text-text-muted truncate">{u.email}</p>
                </div>
                <select
                  value={u.role || 'user'}
                  onChange={(e) => setRole(u.id, e.target.value)}
                  className="text-xs font-semibold px-2 py-1.5 border border-gray-200 rounded-full bg-white outline-none focus:border-primary"
                  data-testid={`admin-user-role-${u.id}`}>
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsersPage;
