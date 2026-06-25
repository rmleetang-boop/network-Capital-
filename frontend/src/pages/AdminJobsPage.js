// Iter 58 — Admin Jobs CRUD console.
// Admin/Super-Admin can: post new jobs, edit existing, delete, view applications.
// Wraps the existing /api/admin/jobs list + per-job /api/jobs/{id} PATCH/DELETE.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Plus, Pencil, Trash2, Briefcase, Shield, FileText, X, Save,
  ExternalLink, Search,
} from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { v: 'open',   label: 'Open' },
  { v: 'closed', label: 'Closed' },
];

const EditJobModal = ({ job, onClose, onSaved }) => {
  const [form, setForm] = useState({
    title: job.title || '',
    company: job.company || '',
    location: job.location || '',
    description: job.description || '',
    status: job.status || 'open',
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setBusy(true);
    try {
      const r = await axiosInstance.patch(`/jobs/${job.id}`, form);
      toast.success('Job updated');
      onSaved(r.data);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Update failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="admin-job-edit-modal">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-bold">Edit job</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <Field label="Title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" data-testid="admin-job-edit-title" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company">
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="input" data-testid="admin-job-edit-company" />
            </Field>
            <Field label="Location">
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input" data-testid="admin-job-edit-location" />
            </Field>
          </div>
          <Field label="Description">
            <textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input resize-none" data-testid="admin-job-edit-desc" />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input" data-testid="admin-job-edit-status">
              {STATUS_OPTIONS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 font-semibold text-sm">Cancel</button>
          <button onClick={save} disabled={busy} className="flex-1 py-2.5 rounded-full bg-primary text-white font-semibold text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60" data-testid="admin-job-edit-save">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>
      <style>{`.input { width: 100%; padding: 0.6rem 0.8rem; border: 1px solid #e5e7eb; border-radius: 0.75rem; font-size: 0.875rem; outline: none; }
                .input:focus { border-color: #1e4fa5; }`}</style>
    </div>
  );
};

const Field = ({ label, children }) => (
  <label className="block">
    <span className="block text-[11px] uppercase tracking-wider font-semibold text-text-muted mb-1">{label}</span>
    {children}
  </label>
);

const AdminJobsPage = ({ user }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);

  const isAdmin = user && ['admin', 'moderator', 'super_admin'].includes(user.role);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axiosInstance.get('/admin/jobs', { params: q.trim() ? { q: q.trim() } : {} });
      setItems(r.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not load jobs');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (isAdmin) load(); }, []);

  const doDelete = async (job) => {
    const reason = window.prompt(`Delete "${job.title}"? Enter reason (min 4 chars):`);
    if (!reason || reason.trim().length < 4) return;
    try {
      await axiosInstance.delete(`/admin/jobs/${job.id}`, { params: { reason: reason.trim() } });
      setItems((prev) => prev.filter((j) => j.id !== job.id));
      toast.success('Job deleted');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Delete failed');
    }
  };

  const onJobSaved = (updated) => {
    setItems((prev) => prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)));
  };

  if (!isAdmin) {
    return (
      <div className="p-10 text-center text-text-muted">
        <Shield size={28} className="mx-auto text-primary mb-2" />
        Admin access only.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="admin-jobs-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate('/admin/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-heading font-bold text-primary flex-1 inline-flex items-center gap-2">
          <Briefcase size={16} /> Jobs admin
        </h1>
        <button
          onClick={() => navigate('/admin/job-applications')}
          className="text-xs font-semibold text-primary inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-primary/30 hover:bg-primary/5"
          data-testid="admin-jobs-applications-link"
        >
          <FileText size={12} /> Applications
        </button>
        <button
          onClick={() => navigate('/jobs/new')}
          className="text-xs font-bold text-white bg-primary inline-flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-primary-hover"
          data-testid="admin-jobs-post-new"
        >
          <Plus size={12} /> Post job
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="Search jobs"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm outline-none focus:border-primary"
              data-testid="admin-jobs-search"
            />
          </div>
          <button onClick={load} className="bg-primary text-white text-xs font-semibold px-3 py-2 rounded-full">Go</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Briefcase size={28} className="mx-auto text-gray-400 mb-2" />
            <p className="font-semibold text-text-primary mb-1">No jobs yet</p>
            <p className="text-xs text-text-muted mb-4">Post the first one to seed the marketplace.</p>
            <button onClick={() => navigate('/jobs/new')} className="px-4 py-2.5 bg-primary text-white rounded-full text-sm font-bold inline-flex items-center gap-1.5" data-testid="admin-jobs-empty-cta">
              <Plus size={14} /> Post job
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {items.map((j) => (
              <div key={j.id} className="px-4 py-3 flex items-center gap-3" data-testid={`admin-jobs-row-${j.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate">{j.title || 'Untitled job'}</p>
                    <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full border ${
                      j.status === 'open'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}>{j.status || 'open'}</span>
                  </div>
                  <p className="text-[11px] text-text-muted truncate">
                    {j.company || '—'} · {j.location || '—'} · {j.applications_count || 0} applicants
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/jobs/${j.id}`)}
                  className="p-2 rounded-full text-text-secondary hover:bg-gray-100"
                  title="View"
                  data-testid={`admin-jobs-view-${j.id}`}
                >
                  <ExternalLink size={14} />
                </button>
                <button
                  onClick={() => setEditing(j)}
                  className="p-2 rounded-full text-primary hover:bg-primary/10"
                  title="Edit"
                  data-testid={`admin-jobs-edit-${j.id}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => doDelete(j)}
                  className="p-2 rounded-full text-red-600 hover:bg-red-50"
                  title="Delete"
                  data-testid={`admin-jobs-delete-${j.id}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <EditJobModal job={editing} onClose={() => setEditing(null)} onSaved={onJobSaved} />
      )}
    </div>
  );
};

export default AdminJobsPage;
