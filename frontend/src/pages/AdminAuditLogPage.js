import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, Shield, RefreshCw } from 'lucide-react';
import { axiosInstance } from '../App';

const ACTION_TONE = {
  user: 'bg-blue-50 text-blue-700',
  post: 'bg-pink-50 text-pink-700',
  message: 'bg-indigo-50 text-indigo-700',
  stokvel: 'bg-emerald-50 text-emerald-700',
  credit: 'bg-amber-50 text-amber-800',
};

const tone = (action) => {
  if (!action) return 'bg-gray-50 text-gray-700';
  const key = action.split('.')[0];
  return ACTION_TONE[key] || 'bg-gray-50 text-gray-700';
};

const AdminAuditLogPage = ({ user }) => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');

  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (actionFilter.trim()) params.action = actionFilter.trim();
      const r = await axiosInstance.get('/admin/audit-log', { params });
      setLogs(r.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line */ }, [actionFilter]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen p-10 text-center text-text-muted">
        <Shield size={28} className="mx-auto text-primary mb-2" />
        Admin access only.
      </div>
    );
  }

  const filtered = search.trim()
    ? logs.filter((l) => JSON.stringify(l).toLowerCase().includes(search.trim().toLowerCase()))
    : logs;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="admin-audit-log-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate('/admin/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-heading font-bold text-primary flex-1">Audit log</h1>
        <button onClick={load} className="p-2 rounded-full hover:bg-gray-100" data-testid="audit-refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reason / target / actor"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm outline-none focus:border-primary"
              data-testid="audit-search"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-full text-sm outline-none focus:border-primary"
            data-testid="audit-action-filter">
            <option value="">All actions</option>
            <option value="user.soft_delete">user.soft_delete</option>
            <option value="user.hard_delete">user.hard_delete</option>
            <option value="user.suspend">user.suspend</option>
            <option value="user.bulk_soft_delete">user.bulk_soft_delete</option>
            <option value="user.bulk_hard_delete">user.bulk_hard_delete</option>
            <option value="post.delete">post.delete</option>
            <option value="message.delete">message.delete</option>
            <option value="credit.grant_created">credit.grant_created</option>
            <option value="credit.grant_applied">credit.grant_applied</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-text-muted text-sm">No log entries.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {filtered.map((l) => (
              <div key={l.id} className="p-3" data-testid={`audit-row-${l.id}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tone(l.action)}`}>{l.action}</span>
                  <span className="text-[11px] text-text-muted">by @{l.actor_username || l.actor_id?.slice(0, 8)}</span>
                  <span className="text-[10px] text-text-muted ml-auto">{new Date(l.created_at).toLocaleString()}</span>
                </div>
                <p className="text-xs text-text-secondary">
                  Target: <code className="text-[10px] bg-gray-50 px-1 py-0.5 rounded">{l.target_type}/{l.target_id?.slice(0, 16)}</code>
                </p>
                {l.reason && <p className="text-xs text-text-primary mt-1 italic">"{l.reason}"</p>}
                {l.metadata && Object.keys(l.metadata).length > 0 && (
                  <details className="mt-1">
                    <summary className="text-[10px] text-text-muted cursor-pointer">metadata</summary>
                    <pre className="text-[10px] text-text-secondary bg-gray-50 rounded-lg p-2 mt-1 overflow-x-auto">{JSON.stringify(l.metadata, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAuditLogPage;
