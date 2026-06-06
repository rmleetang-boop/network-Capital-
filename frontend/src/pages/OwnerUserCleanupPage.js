import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Trash2, Search, AlertTriangle, Lock, ShieldAlert, Users } from 'lucide-react';
import { axiosInstance } from '../App';

const OwnerUserCleanupPage = ({ user }) => {
  const navigate = useNavigate();
  const isOwner = user && user.role === 'super_admin';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [daysInactive, setDaysInactive] = useState(30);
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  const [q, setQ] = useState('');
  const [confirming, setConfirming] = useState(null); // user row pending delete
  const [reason, setReason] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axiosInstance.get('/admin/users/cleanup-candidates', {
        params: { days_inactive: daysInactive, only_unverified: onlyUnverified, q: q || undefined, limit: 200 },
      });
      setRows(r.data?.rows || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load candidates');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (isOwner) load(); /* eslint-disable-next-line */ }, [isOwner, daysInactive, onlyUnverified]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      // Push stale/unverified ahead
      const score = (u) => (u.is_stale ? 2 : 0) + (u.email_verified ? 0 : 1);
      return score(b) - score(a);
    });
    return arr;
  }, [rows]);

  const openConfirm = (row) => {
    setConfirming(row);
    setReason('');
    setConfirmEmail('');
  };

  const doDelete = async () => {
    if (!confirming) return;
    if (reason.trim().length < 10) { toast.error('Reason must be at least 10 characters'); return; }
    if ((confirmEmail || '').trim().toLowerCase() !== (confirming.email || '').trim().toLowerCase()) {
      toast.error('Confirmation email does not match'); return;
    }
    setDeleting(true);
    try {
      const r = await axiosInstance.post('/admin/users/cleanup-delete', {
        user_id: confirming.id,
        reason: reason.trim(),
        confirm_email: confirmEmail.trim(),
      });
      const deleted = Object.entries(r.data?.deletions || {})
        .filter(([k, v]) => v > 0)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      toast.success(`User permanently deleted. ${deleted}`, { duration: 6000 });
      setConfirming(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Delete failed');
    } finally { setDeleting(false); }
  };

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
          <Lock size={32} className="mx-auto text-text-muted mb-3" />
          <h1 className="font-heading font-bold text-xl mb-2">Platform Owner only</h1>
          <p className="text-sm text-text-secondary">The cleanup tool is reserved for the Platform Owner account.</p>
          <button onClick={() => navigate(-1)} className="mt-5 bg-primary text-white text-sm font-bold px-5 py-2 rounded-full">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04101e] text-white pb-24" data-testid="owner-user-cleanup-page">
      <header className="sticky top-0 z-10 bg-[#04101e]/85 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/5"><ArrowLeft size={16} /></button>
        <ShieldAlert size={18} className="text-red-300" />
        <h1 className="text-sm font-heading font-bold flex-1">User cleanup · hard delete</h1>
        <span className="text-[10px] uppercase tracking-wider font-bold text-red-200 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded">irreversible</span>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-3">
        {/* Warning banner */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 flex gap-2.5">
          <AlertTriangle size={16} className="text-red-300 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-red-100/90">
            <strong className="text-red-200">Hard delete</strong> permanently removes the user and ALL their content
            (posts, comments, messages, applications, score events). Wallet balances must be zero. Admins, super admin,
            and the platform owner can never be deleted from this page.
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search size={14} className="text-white/55" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="Search email / username / name…"
              className="bg-transparent flex-1 text-sm placeholder-white/40 outline-none"
              data-testid="cleanup-search"
            />
            <button onClick={load} className="text-xs font-bold bg-secondary text-primary px-3 py-1.5 rounded-full">Search</button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/55">Inactive ≥</span>
            <select
              value={daysInactive}
              onChange={(e) => setDaysInactive(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-full px-2 py-1 text-white"
              data-testid="cleanup-days"
            >
              {[7, 30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d}d</option>)}
            </select>
            <label className="inline-flex items-center gap-1.5 cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={onlyUnverified}
                onChange={(e) => setOnlyUnverified(e.target.checked)}
                className="accent-secondary"
                data-testid="cleanup-only-unverified"
              />
              Unverified only
            </label>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="py-20 text-center text-white/55"><Loader2 className="mx-auto animate-spin" /></div>
        ) : sorted.length === 0 ? (
          <div className="py-20 text-center text-white/55">
            <Users size={28} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No candidates match. Try widening the filter.</p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="cleanup-rows">
            <p className="text-[10px] uppercase tracking-wider text-white/55">{sorted.length} candidate{sorted.length === 1 ? '' : 's'}</p>
            {sorted.map((u) => (
              <div key={u.id} className="bg-white/5 border border-white/10 rounded-2xl p-3" data-testid={`cleanup-row-${u.id}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {(u.username || u.email || '?')[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-0.5">
                      <p className="text-sm font-bold text-white truncate">{u.full_name || u.username || '(no name)'}</p>
                      {u.is_ambassador && <span className="text-[9px] uppercase tracking-wider font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded">Ambassador</span>}
                      {!u.email_verified && <span className="text-[9px] uppercase tracking-wider font-bold text-amber-200 bg-amber-500/15 px-1.5 py-0.5 rounded">Unverified</span>}
                      {u.is_stale && <span className="text-[9px] uppercase tracking-wider font-bold text-red-200 bg-red-500/15 px-1.5 py-0.5 rounded">Stale</span>}
                    </div>
                    <p className="text-[11px] text-white/70 truncate">{u.email} · @{u.username || '—'}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">
                      Joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      {' · '}{u.posts_count || 0} posts · {u.jobs_count || 0} jobs · {u.stokvels_count || 0} stokvels
                      {' · '}wallet ${(u.wallet_balance_usd || 0).toFixed(2)}
                      {' · '}score {u.network_score || 0}
                    </p>
                  </div>
                  <button
                    onClick={() => openConfirm(u)}
                    className="text-[11px] font-bold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 shrink-0"
                    data-testid={`cleanup-delete-${u.id}`}
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Confirmation modal */}
      {confirming && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !deleting && setConfirming(null)} data-testid="cleanup-confirm-modal">
          <div onClick={(e) => e.stopPropagation()} className="bg-white text-text-primary w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl">
            <div className="border-b border-gray-100 px-5 py-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-600" />
              <h3 className="font-heading font-bold text-base flex-1">Confirm hard delete</h3>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm">You are about to <strong className="text-red-700">permanently delete</strong>:</p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm font-bold text-text-primary">{confirming.full_name || '(no name)'}</p>
                <p className="text-[12px] text-text-secondary">{confirming.email}</p>
                <p className="text-[11px] text-text-muted mt-1">
                  {confirming.posts_count || 0} posts · {confirming.jobs_count || 0} jobs · {confirming.stokvels_count || 0} stokvels · score {confirming.network_score || 0}
                </p>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-text-muted">Reason (min 10 chars)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. test account from pre-launch QA"
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-secondary"
                  data-testid="cleanup-reason"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-text-muted">Type the user's email to confirm</label>
                <input
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={confirming.email}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-secondary font-mono"
                  data-testid="cleanup-confirm-email"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setConfirming(null)}
                  disabled={deleting}
                  className="flex-1 border border-gray-200 text-text-primary font-bold py-2.5 rounded-full disabled:opacity-50"
                  data-testid="cleanup-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={doDelete}
                  disabled={deleting || reason.trim().length < 10 || (confirmEmail.trim().toLowerCase() !== (confirming.email || '').trim().toLowerCase())}
                  className="flex-1 bg-red-600 text-white font-bold py-2.5 rounded-full disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  data-testid="cleanup-confirm"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Delete permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerUserCleanupPage;
