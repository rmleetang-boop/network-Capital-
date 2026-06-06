import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Briefcase, Eye, CheckCircle2, XCircle, Filter, Search, MessageSquare } from 'lucide-react';
import { axiosInstance } from '../App';

const STATUS_OPTIONS = ['all', 'new', 'shortlisted', 'interview', 'hired', 'rejected'];

const AdminJobApplicationsPage = ({ user }) => {
  const navigate = useNavigate();
  const isAdmin = user && ['admin', 'super_admin'].includes(user.role);

  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 300 };
      if (status !== 'all') params.status_filter = status;
      const r = await axiosInstance.get('/admin/job-applications', { params });
      setRows(r.data?.rows || []);
      setCounts(r.data?.counts || {});
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line */ }, [isAdmin, status]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.job_title || '').toLowerCase().includes(q)
      || (r.applicant_username || r.applicant_name || '').toLowerCase().includes(q)
      || (r.employer_username || '').toLowerCase().includes(q)
      || (r.cover_letter || '').toLowerCase().includes(q));
  }, [rows, search]);

  const handleView = async (row) => {
    setBusy(`view-${row.id}`);
    try {
      await axiosInstance.post(`/admin/job-applications/${row.id}/view`);
      toast.success('Applicant notified that review has started');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not mark as viewed');
    } finally { setBusy(null); }
  };

  const handleStatus = async (row, newStatus) => {
    const note = window.prompt(`Optional note for ${row.applicant_username || 'applicant'} (max 1000 chars):`, '');
    if (note === null) return;
    setBusy(`status-${row.id}`);
    try {
      await axiosInstance.patch(`/admin/job-applications/${row.id}`, { status: newStatus, note });
      toast.success(`Status set to ${newStatus} · applicant emailed`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not update status');
    } finally { setBusy(null); }
  };

  if (!isAdmin) {
    return (
      <div className="p-10 text-center text-text-muted" data-testid="admin-apps-denied">
        <Briefcase size={28} className="mx-auto text-primary mb-2" />
        <p className="text-sm">Admin access required.</p>
        <button onClick={() => navigate(-1)} className="mt-4 bg-primary text-white text-sm font-bold px-5 py-2 rounded-full">Go back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="admin-job-applications-page">
      <header className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
        <Briefcase size={18} className="text-primary" />
        <h1 className="text-base font-heading font-bold text-primary flex-1">Job applications · all</h1>
        <span className="text-xs font-bold text-text-muted bg-gray-100 px-2.5 py-1 rounded-full">{counts.all ?? 0} total</span>
      </header>

      <div className="max-w-5xl mx-auto p-4 space-y-3">
        {/* Status pills */}
        <div className="flex flex-wrap gap-2" data-testid="status-filter">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border ${status === s ? 'bg-primary text-white border-primary' : 'bg-white text-text-secondary border-gray-200'}`}
              data-testid={`status-pill-${s}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)} {counts[s] !== undefined ? `(${counts[s]})` : ''}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search applicant, employer, job title…"
            className="w-full bg-white border border-gray-200 rounded-full pl-9 pr-4 py-2.5 text-sm outline-none focus:border-secondary"
            data-testid="apps-search"
          />
        </div>

        {loading ? (
          <div className="py-20 text-center"><Loader2 className="mx-auto animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-text-muted text-sm py-12">No applications match these filters.</p>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((row) => (
              <div key={row.id} className="bg-white rounded-2xl border border-gray-100 p-4" data-testid={`app-row-${row.id}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <Link to={`/jobs/${row.job_id}`} className="text-sm font-heading font-bold text-primary hover:underline">
                      {row.job_title || '(deleted job)'}
                    </Link>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Applicant <strong className="text-text-primary">@{row.applicant_username || row.applicant_name || row.applicant_id}</strong>
                      {' · '}Employer <strong className="text-text-primary">@{row.employer_username || row.employer_id}</strong>
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      Applied {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                    row.status === 'hired' ? 'bg-emerald-100 text-emerald-700' :
                    row.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    row.status === 'shortlisted' || row.status === 'interview' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {row.status}
                  </span>
                </div>
                {row.cover_letter && (
                  <div className="bg-gray-50 rounded-xl p-2.5 mb-2">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1 inline-flex items-center gap-1"><MessageSquare size={10} /> Cover letter</p>
                    <p className="text-xs text-text-secondary whitespace-pre-wrap">{row.cover_letter}</p>
                  </div>
                )}
                {row.employer_note && (
                  <p className="text-[11px] text-text-muted mb-2"><strong>Note:</strong> {row.employer_note}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    onClick={() => handleView(row)}
                    disabled={busy === `view-${row.id}`}
                    className="text-[11px] font-bold inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 disabled:opacity-50"
                    data-testid={`btn-view-${row.id}`}
                  >
                    <Eye size={11} /> Mark viewed + email applicant
                  </button>
                  {['new', 'shortlisted', 'interview'].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatus(row, s)}
                      disabled={busy === `status-${row.id}` || row.status === s}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 disabled:opacity-40"
                      data-testid={`btn-${s}-${row.id}`}
                    >
                      → {s}
                    </button>
                  ))}
                  <button
                    onClick={() => handleStatus(row, 'hired')}
                    disabled={busy === `status-${row.id}` || row.status === 'hired'}
                    className="text-[11px] font-bold inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 disabled:opacity-40"
                    data-testid={`btn-hired-${row.id}`}
                  >
                    <CheckCircle2 size={11} /> Hire
                  </button>
                  <button
                    onClick={() => handleStatus(row, 'rejected')}
                    disabled={busy === `status-${row.id}` || row.status === 'rejected'}
                    className="text-[11px] font-bold inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200 disabled:opacity-40"
                    data-testid={`btn-reject-${row.id}`}
                  >
                    <XCircle size={11} /> Reject
                  </button>
                </div>
                {Array.isArray(row.admin_viewed_by) && row.admin_viewed_by.length > 0 && (
                  <p className="text-[10px] text-text-muted mt-2">Viewed by {row.admin_viewed_by.length} admin{row.admin_viewed_by.length === 1 ? '' : 's'}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminJobApplicationsPage;
