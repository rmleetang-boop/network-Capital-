import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Unlock, Loader2, ShieldAlert, Search } from 'lucide-react';
import { toast } from 'sonner';
import { axiosInstance } from '../App';

/**
 * AdminLockedAccountsPage — lists every user currently locked due to password-reset
 * abuse (5 reset requests in 7 days).  Admins and super_admins can release the
 * lock with a reason; everything is captured in the AuditLog.
 */
const AdminLockedAccountsPage = ({ user }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unlockingId, setUnlockingId] = useState(null);
  const [search, setSearch] = useState('');

  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');

  const load = async () => {
    setLoading(true);
    try {
      const r = await axiosInstance.get('/admin/locked-accounts');
      setRows(r.data?.users || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load locked accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]); // eslint-disable-line

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md bg-white border border-gray-100 rounded-3xl p-8">
          <Lock size={28} className="mx-auto text-text-muted mb-2" />
          <h1 className="font-heading font-bold text-lg mb-1">Admins only</h1>
          <button onClick={() => navigate(-1)} className="mt-4 bg-primary text-white text-sm font-bold px-4 py-2 rounded-full">Go back</button>
        </div>
      </div>
    );
  }

  const handleUnlock = async (row) => {
    const reason = window.prompt(`Release lock on ${row.email}? Enter a reason (will be audit-logged):`);
    if (reason === null) return;
    setUnlockingId(row.id);
    try {
      await axiosInstance.post(`/admin/users/${row.id}/unlock-password-reset`, {
        reason: (reason || '').trim() || 'Released by admin',
      });
      toast.success('Account unlocked');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Unlock failed');
    } finally {
      setUnlockingId(null);
    }
  };

  const filtered = rows.filter((r) =>
    !search.trim()
      || (r.email || '').toLowerCase().includes(search.toLowerCase())
      || (r.username || '').toLowerCase().includes(search.toLowerCase())
      || (r.full_name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#04101e] via-[#04101e] to-[#0a1e3a] text-white" data-testid="admin-locked-accounts-page">
      <header className="sticky top-0 z-20 bg-[#04101e]/85 backdrop-blur-md border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/5"><ArrowLeft size={16} /></button>
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-secondary" />
            <h1 className="font-heading font-bold text-base">Locked accounts</h1>
            <span className="text-[10px] uppercase tracking-wider font-bold text-secondary bg-secondary/10 border border-secondary/30 px-1.5 py-0.5 rounded ml-1">{rows.length}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <p className="text-xs text-white/55 leading-relaxed">
          Users below requested a password reset 5+ times in 7 days and have been auto-locked.
          They've been instructed to email <strong>support@networkcapitalapp.co.za</strong>.
          Release the lock once you've verified the request is legitimate. Every action is audit-logged.
        </p>

        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder="Search by email / username / full name…"
                 className="w-full bg-white/5 border border-white/10 rounded-full px-8 py-2 text-xs text-white placeholder-white/40 outline-none focus:border-secondary"
                 data-testid="locked-accounts-search" />
        </div>

        {loading ? (
          <div className="py-12 text-center text-white/55"><Loader2 className="mx-auto animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl py-10 text-center">
            <Unlock size={28} className="mx-auto text-white/55 mb-2" />
            <p className="text-white/70 text-sm">No locked accounts. 🎉</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((row) => (
              <div key={row.id} className="bg-white/[0.04] border border-amber-500/30 rounded-xl p-4" data-testid={`locked-row-${row.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Lock size={12} className="text-amber-300" />
                      <span className="text-sm font-bold text-white truncate">{row.full_name || row.username || row.email}</span>
                    </div>
                    <p className="text-xs text-white/65 truncate">{row.email}</p>
                    <p className="text-[11px] text-white/45 mt-1">
                      Reason: {row.account_locked_reason || 'Unknown'}
                      {row.account_locked_at && (
                        <> · Locked: {new Date(row.account_locked_at).toLocaleString()}</>
                      )}
                    </p>
                    {row.network_score !== undefined && (
                      <p className="text-[10px] text-white/40 mt-0.5">Network Score: {row.network_score?.toLocaleString?.() || row.network_score} · Role: {row.role || 'user'}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleUnlock(row)}
                    disabled={unlockingId === row.id}
                    className="text-[11px] font-bold text-green-300 hover:text-green-200 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 disabled:opacity-50 shrink-0"
                    data-testid={`unlock-${row.id}`}
                  >
                    {unlockingId === row.id ? <Loader2 size={11} className="animate-spin" /> : <Unlock size={11} />}
                    Unlock
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminLockedAccountsPage;
