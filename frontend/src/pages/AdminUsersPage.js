import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Search, Loader2, ArrowLeft, MoreVertical, Ban, Trash2, Flame, DollarSign, FileBarChart, Filter, X, AlertTriangle, Star } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import CreditGrantModal from '../components/CreditGrantModal';

const ROLE_OPTIONS = ['user', 'ambassador', 'moderator', 'admin', 'super_admin'];

// Pre-set Network-Score brackets (per-thousand).  Free min/max also supported.
const SCORE_BRACKETS = [
  { label: '0 – 1k', min: 0, max: 1000 },
  { label: '1k – 2k', min: 1000, max: 2000 },
  { label: '2k – 3k', min: 2000, max: 3000 },
  { label: '3k – 4k', min: 3000, max: 4000 },
  { label: '4k – 5k', min: 4000, max: 5000 },
  { label: '5k – 6k', min: 5000, max: 6000 },
  { label: '6k – 7k', min: 6000, max: 7000 },
  { label: '7k – 8k', min: 7000, max: 8000 },
  { label: '8k – 9k', min: 8000, max: 9000 },
  { label: '9k – 10k', min: 9000, max: 10000 },
  { label: '10k+ (Top Contributor)', min: 10000, max: 1000000 },
];

const AdminUsersPage = ({ user }) => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState(null);
  const [creditTarget, setCreditTarget] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [scoreFilter, setScoreFilter] = useState(null);   // { min, max } | null
  const [customRange, setCustomRange] = useState({ min: '', max: '' });

  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
  const isSuperAdmin = user && user.role === 'super_admin';

  const load = async () => {
    setLoading(true);
    try {
      // If a score bracket is selected, use /admin/users/by-score; otherwise the
      // legacy /admin/users-list endpoint (which doesn't know about brackets).
      if (scoreFilter) {
        const params = { min_score: scoreFilter.min, max_score: scoreFilter.max, limit: 500 };
        if (q.trim()) params.q = q.trim();
        if (roleFilter) params.role = roleFilter;
        const r = await axiosInstance.get('/admin/users/by-score', { params });
        setUsers(r.data?.users || []);
      } else {
        const params = {};
        if (q.trim()) params.q = q.trim();
        if (roleFilter) params.role = roleFilter;
        const r = await axiosInstance.get('/admin/users-list', { params });
        setUsers(r.data || []);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [roleFilter, scoreFilter]);

  const applyCustomRange = () => {
    const lo = Number(customRange.min);
    const hi = Number(customRange.max);
    if (Number.isNaN(lo) || Number.isNaN(hi) || hi <= lo) {
      toast.error('Enter a valid min < max');
      return;
    }
    setScoreFilter({ min: lo, max: hi });
  };

  const setRole = async (uid, role) => {
    if (!window.confirm(`Set this user's role to ${role.toUpperCase()}?`)) return;
    try {
      await axiosInstance.patch(`/admin/users/${uid}/role`, { role });
      toast.success(`Role → ${role}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not update role');
    }
  };

  const toggleAmbassador = async (uid, currentlyAmb, label) => {
    if (!window.confirm(currentlyAmb ? `Revoke ambassador status from ${label}?` : `Promote ${label} to Ambassador?`)) return;
    try {
      await axiosInstance.post(`/admin/users/${uid}/make-ambassador`, { ambassador: !currentlyAmb });
      toast.success(currentlyAmb ? 'Ambassador revoked' : 'Ambassador granted');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not update ambassador status');
    }
  };

  const suspendUser = async (uid, currentlySuspended) => {
    if (!window.confirm(currentlySuspended ? 'Unsuspend this user?' : 'Suspend this user? They will not be able to log in.')) return;
    try {
      const r = await axiosInstance.post(`/admin/users/${uid}/suspend`, { reason: 'admin_panel' });
      toast.success(r.data.suspended ? 'User suspended' : 'User unsuspended');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not suspend');
    }
  };

  const deleteUser = async (uid, label, mode) => {
    const reason = window.prompt(`${mode === 'hard' ? '🔥 HARD-DELETE' : '🗑 Soft-delete (30-day grace)'} user "${label}". Enter a reason (min 4 chars):`);
    if (!reason || reason.trim().length < 4) return;
    if (mode === 'hard' && !window.confirm(`⚠️ FINAL CONFIRM: This will WIPE ${label} and ALL their posts, messages, places, jobs, applications, reviews. There is no undo. Proceed?`)) return;
    try {
      const r = await axiosInstance.delete(`/admin/users/${uid}`, {
        params: { mode, reason: reason.trim(), purge_content: mode === 'soft' ? false : true },
      });
      toast.success(`${label} ${mode === 'hard' ? 'hard-deleted' : 'soft-deleted'}`);
      console.log('delete result', r.data);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not delete');
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
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="admin-users-page" onClick={() => setOpenMenu(null)}>
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate('/admin/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-heading font-bold text-primary flex-1">User management</h1>
        <button
          onClick={() => navigate('/admin/audit-log')}
          className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-text-secondary px-3 py-1.5 rounded-full inline-flex items-center gap-1"
          data-testid="admin-go-audit">
          <FileBarChart size={12} /> Audit log
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setBulkOpen(true); }}
          className="text-xs font-semibold bg-secondary text-primary px-3 py-1.5 rounded-full inline-flex items-center gap-1"
          data-testid="admin-bulk-button">
          <Filter size={12} /> Bulk
        </button>
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

        {/* Score-bracket filter strip — preset thousand-step chips + custom range */}
        <div className="bg-white rounded-2xl border border-gray-100 p-3" data-testid="admin-users-bracket-filter">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted">Filter by Network Score</p>
            {scoreFilter && (
              <button
                onClick={() => { setScoreFilter(null); setCustomRange({ min: '', max: '' }); }}
                className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                data-testid="admin-bracket-clear"
              >
                <X size={11} /> Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SCORE_BRACKETS.map((b) => {
              const active = scoreFilter && scoreFilter.min === b.min && scoreFilter.max === b.max;
              return (
                <button
                  key={b.label}
                  onClick={() => setScoreFilter({ min: b.min, max: b.max })}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                    active ? 'bg-primary text-white border-primary' : 'bg-gray-50 hover:bg-gray-100 text-text-secondary border-gray-200'
                  }`}
                  data-testid={`bracket-chip-${b.min}-${b.max}`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number" min="0" placeholder="Custom min"
              value={customRange.min} onChange={(e) => setCustomRange({ ...customRange, min: e.target.value })}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-full text-xs outline-none focus:border-primary"
              data-testid="bracket-custom-min"
            />
            <span className="text-text-muted text-xs">–</span>
            <input
              type="number" min="1" placeholder="Custom max"
              value={customRange.max} onChange={(e) => setCustomRange({ ...customRange, max: e.target.value })}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-full text-xs outline-none focus:border-primary"
              data-testid="bracket-custom-max"
            />
            <button
              onClick={applyCustomRange}
              className="bg-secondary text-primary text-xs font-bold px-3 py-1.5 rounded-full"
              data-testid="bracket-custom-apply"
            >Apply</button>
          </div>
          {scoreFilter && (
            <p className="text-[11px] text-text-muted mt-2" data-testid="bracket-active-label">
              Showing users with Network Score <strong className="text-primary">{scoreFilter.min.toLocaleString()} – {scoreFilter.max.toLocaleString()}</strong>
            </p>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-visible">
            {users.length === 0 ? (
              <p className="p-6 text-center text-text-muted text-sm">No users match these filters.</p>
            ) : users.map((u) => {
              const label = u.full_name || u.username || u.email;
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 relative" data-testid={`admin-user-row-${u.id}`}>
                  {u.photo ? (
                    <img src={u.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-xs font-bold flex items-center justify-center">
                      {(u.username || u.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/admin/profiles/${u.id}`)} data-testid={`admin-user-open-${u.id}`}>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate">{label}</p>
                      {u.is_ambassador && <span className="bg-secondary text-primary text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">★ Amb</span>}
                      {u.suspended && <span className="bg-red-100 text-red-700 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">Suspended</span>}
                      {u.flagged_for_review && <span className="bg-orange-100 text-orange-700 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">Flagged</span>}
                      {u.deactivated && <span className="bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">Pending purge</span>}
                    </div>
                    <p className="text-[11px] text-text-muted truncate">
                      {u.email} · ${(u.wallet_balance || 0).toFixed(2)} · {u.monthly_score || 0} pts
                    </p>
                  </div>
                  <select
                    value={u.is_ambassador ? 'ambassador' : (u.role || 'user')}
                    onChange={(e) => setRole(u.id, e.target.value)}
                    className="text-xs font-semibold px-2 py-1.5 border border-gray-200 rounded-full bg-white outline-none focus:border-primary"
                    data-testid={`admin-user-role-${u.id}`}>
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                  </select>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === u.id ? null : u.id); }}
                    className="p-1.5 rounded-full hover:bg-gray-100"
                    data-testid={`user-menu-toggle-${u.id}`}>
                    <MoreVertical size={16} />
                  </button>
                  {openMenu === u.id && (
                    <div onClick={(e) => e.stopPropagation()} className="absolute right-3 top-12 z-20 bg-white border border-gray-100 shadow-lg rounded-xl py-1 min-w-[180px]" data-testid={`admin-user-menu-${u.id}`}>
                      {isSuperAdmin ? (
                        <button onClick={() => { setOpenMenu(null); setCreditTarget({ id: u.id, label }); }} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 inline-flex items-center gap-2" data-testid={`menu-credit-${u.id}`}>
                          <DollarSign size={12} /> Adjust balance
                        </button>
                      ) : (
                        <div className="px-3 py-2 text-[10px] text-text-muted inline-flex items-center gap-1.5" data-testid={`menu-credit-disabled-${u.id}`}>
                          <DollarSign size={12} /> Balance — owner only
                        </div>
                      )}
                      <button onClick={() => { setOpenMenu(null); suspendUser(u.id, u.suspended); }} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 inline-flex items-center gap-2" data-testid={`menu-suspend-${u.id}`}>
                        <Ban size={12} /> {u.suspended ? 'Unsuspend' : 'Suspend'}
                      </button>
                      <button onClick={() => { setOpenMenu(null); toggleAmbassador(u.id, u.is_ambassador, label); }} className="w-full text-left px-3 py-2 text-xs hover:bg-yellow-50 text-yellow-700 inline-flex items-center gap-2" data-testid={`menu-ambassador-${u.id}`}>
                        <Star size={12} /> {u.is_ambassador ? 'Revoke ambassador' : 'Make ambassador'}
                      </button>
                      <div className="border-t border-gray-50 my-1" />
                      <button onClick={() => { setOpenMenu(null); deleteUser(u.id, label, 'soft'); }} className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 text-amber-700 inline-flex items-center gap-2" data-testid={`menu-soft-${u.id}`}>
                        <Trash2 size={12} /> Soft-delete (30d)
                      </button>
                      <button onClick={() => { setOpenMenu(null); deleteUser(u.id, label, 'hard'); }} className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-700 inline-flex items-center gap-2" data-testid={`menu-hard-${u.id}`}>
                        <Flame size={12} /> Hard-delete + content
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {creditTarget && (
        <CreditGrantModal
          targetType="user"
          targetId={creditTarget.id}
          targetLabel={creditTarget.label}
          onClose={() => setCreditTarget(null)}
          onApplied={load}
        />
      )}
      {bulkOpen && <BulkDeleteModal onClose={() => setBulkOpen(false)} onDone={load} />}
    </div>
  );
};

const BulkDeleteModal = ({ onClose, onDone }) => {
  const [filters, setFilters] = useState({
    score_min: '', score_max: '', inactive_days: '',
    profile_incomplete: false, email_unverified: false,
    country: '', city: '', search: '',
  });
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmToken, setConfirmToken] = useState('');
  const [mode, setMode] = useState('soft');

  const buildPayload = (m) => {
    const p = { mode: m, reason: 'admin_panel_bulk' };
    if (filters.score_min !== '') p.score_min = Number(filters.score_min);
    if (filters.score_max !== '') p.score_max = Number(filters.score_max);
    if (filters.inactive_days !== '') p.inactive_days = Number(filters.inactive_days);
    if (filters.profile_incomplete) p.profile_incomplete = true;
    if (filters.email_unverified) p.email_unverified = true;
    if (filters.country.trim()) p.country = filters.country.trim();
    if (filters.city.trim()) p.city = filters.city.trim();
    if (filters.search.trim()) p.search = filters.search.trim();
    return p;
  };

  const runPreview = async () => {
    setSubmitting(true);
    try {
      const r = await axiosInstance.post('/admin/users/bulk-delete', buildPayload('preview'));
      setPreview(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Preview failed');
    } finally {
      setSubmitting(false);
    }
  };

  const execute = async () => {
    if (!preview) return;
    if (confirmToken !== preview.confirm_token_required) {
      toast.error(`Type exactly: ${preview.confirm_token_required}`);
      return;
    }
    if (!window.confirm(`Final: ${mode.toUpperCase()}-delete ${preview.would_delete} users?`)) return;
    setSubmitting(true);
    try {
      const r = await axiosInstance.post('/admin/users/bulk-delete', { ...buildPayload(mode), confirm_token: confirmToken });
      toast.success(`Deleted ${r.data.deleted?.users || 0} users`);
      onClose(); onDone && onDone();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Bulk delete failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose} data-testid="bulk-delete-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-lg w-full p-5 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100"><X size={18} /></button>
        <div className="flex items-center gap-2 mb-3">
          <Filter size={18} className="text-primary" />
          <h3 className="font-heading font-bold text-lg text-primary">Bulk delete users</h3>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <input placeholder="Score min" type="number" value={filters.score_min} onChange={(e) => setFilters({ ...filters, score_min: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-xl text-xs" data-testid="bulk-score-min" />
          <input placeholder="Score max" type="number" value={filters.score_max} onChange={(e) => setFilters({ ...filters, score_max: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-xl text-xs" data-testid="bulk-score-max" />
          <input placeholder="Inactive for N days" type="number" value={filters.inactive_days} onChange={(e) => setFilters({ ...filters, inactive_days: e.target.value })} className="col-span-2 px-3 py-2 border border-gray-200 rounded-xl text-xs" data-testid="bulk-inactive-days" />
          <input placeholder="Country" value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-xl text-xs" data-testid="bulk-country" />
          <input placeholder="City" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-xl text-xs" data-testid="bulk-city" />
          <input placeholder="Username/email contains…" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="col-span-2 px-3 py-2 border border-gray-200 rounded-xl text-xs" data-testid="bulk-search" />
        </div>

        <label className="inline-flex items-center gap-1.5 text-xs text-text-secondary mr-3">
          <input type="checkbox" checked={filters.profile_incomplete} onChange={(e) => setFilters({ ...filters, profile_incomplete: e.target.checked })} data-testid="bulk-profile-incomplete" />
          Profile not complete
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
          <input type="checkbox" checked={filters.email_unverified} onChange={(e) => setFilters({ ...filters, email_unverified: e.target.checked })} data-testid="bulk-email-unverified" />
          Email unverified
        </label>

        <div className="flex items-center gap-2 mt-4 mb-2">
          <button onClick={runPreview} disabled={submitting} className="flex-1 bg-gray-100 hover:bg-gray-200 text-text-primary font-semibold py-2.5 rounded-full text-xs disabled:opacity-50" data-testid="bulk-preview-button">
            {submitting && !preview ? <Loader2 size={12} className="inline animate-spin mr-1" /> : null}
            Preview matches
          </button>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-full text-xs" data-testid="bulk-mode-select">
            <option value="soft">Soft (30d)</option>
            <option value="hard">Hard (irreversible)</option>
          </select>
        </div>

        {preview && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-800 mb-2 inline-flex items-center gap-1">
              <AlertTriangle size={12} /> <strong>{preview.would_delete}</strong> users match. Sample of up to 20:
            </p>
            <div className="max-h-32 overflow-y-auto text-[10px] text-amber-900 bg-white/50 rounded-lg p-2 mb-2">
              {(preview.sample || []).map((s) => (
                <div key={s.id} className="flex justify-between border-b border-amber-100 py-0.5">
                  <span className="truncate">{s.username || s.email}</span>
                  <span>{s.monthly_score || 0} pts</span>
                </div>
              ))}
            </div>
            <input
              value={confirmToken}
              onChange={(e) => setConfirmToken(e.target.value)}
              placeholder={`Type: ${preview.confirm_token_required}`}
              className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs font-mono mb-2"
              data-testid="bulk-confirm-token"
            />
            <button
              onClick={execute}
              disabled={submitting || confirmToken !== preview.confirm_token_required}
              className="w-full bg-red-600 text-white font-bold py-2.5 rounded-full text-xs disabled:opacity-30"
              data-testid="bulk-execute-button">
              {submitting && preview ? <Loader2 size={12} className="inline animate-spin mr-1" /> : null}
              {mode === 'hard' ? '🔥 ' : '🗑 '} {mode.toUpperCase()}-delete {preview.would_delete} users
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsersPage;
