import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Star, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const TABS = ['pending', 'approved', 'rejected', 'all'];

const AdminAmbassadorApplicationsPage = ({ user }) => {
  const navigate = useNavigate();
  const isAdmin = user && user.role === 'admin';
  const [status, setStatus] = useState('pending');
  const [list, setList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axiosInstance.get(`/admin/ambassador-applications?status_filter=${status}`);
      setList(r.data.applications || []);
      setSummary(r.data.summary || null);
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not load'); }
    setLoading(false);
  };
  useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line */ }, [status, isAdmin]);

  const decide = async (id, kind) => {
    const note = window.prompt(kind === 'approve' ? 'Optional note for the applicant:' : 'Reason / feedback for the applicant:') || '';
    try {
      await axiosInstance.post(`/admin/ambassador-applications/${id}/${kind}`, { note });
      toast.success(kind === 'approve' ? 'Approved — ★ badge granted' : 'Rejected');
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Action failed'); }
  };

  if (!isAdmin) return <div className="p-10 text-center text-text-muted" data-testid="apps-admin-gated">Admin only.</div>;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="admin-ambassador-apps-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate('/admin/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
        <h1 className="text-base font-heading font-bold text-primary flex-1 inline-flex items-center gap-2"><Star size={16} className="text-secondary" /> Ambassador Applications</h1>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {summary && (
          <div className="grid grid-cols-3 gap-2">
            <Pill k="Pending" v={summary.pending} tone="bg-amber-100 text-amber-800" />
            <Pill k="Approved" v={summary.approved} tone="bg-emerald-100 text-emerald-800" />
            <Pill k="Rejected" v={summary.rejected} tone="bg-red-100 text-red-800" />
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => (
            <button key={t} onClick={() => setStatus(t)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${status === t ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-text-secondary'}`} data-testid={`apps-tab-${t}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-10 text-center"><Loader2 className="mx-auto animate-spin text-text-muted" /></div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center" data-testid="apps-empty">
            <Star size={28} className="mx-auto text-text-muted mb-2" />
            <p className="text-text-muted text-sm">No applications in this view.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((a) => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4" data-testid={`app-row-${a.id}`}>
                <div className="flex items-start gap-3">
                  {a.photo ? <img src={a.photo} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-sm font-bold flex items-center justify-center">{(a.username || '?')[0].toUpperCase()}</div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-text-primary">{a.full_name || a.username}</p>
                      <span className="text-[10px] text-text-muted">@{a.username}</span>
                      <span className="text-[10px] font-bold text-primary">NS {a.network_score}</span>
                    </div>
                    <p className="text-xs text-text-muted">{a.user_email} · {new Date(a.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${a.status === 'pending' ? 'bg-amber-100 text-amber-700' : a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {a.status === 'pending' ? <Clock size={10} /> : a.status === 'approved' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                    {a.status}
                  </span>
                </div>
                <p className="text-sm text-text-secondary mt-3">{a.why}</p>
                {(a.links || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {a.links.map((l, i) => (
                      <a key={i} href={l} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1 hover:underline"><ExternalLink size={9} /> {l}</a>
                    ))}
                  </div>
                )}
                {a.admin_note && (
                  <div className="mt-2 bg-background-subtle rounded-xl p-2 text-xs">
                    <p className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Reviewer note ({a.decided_by})</p>
                    <p className="text-text-secondary">{a.admin_note}</p>
                  </div>
                )}
                {a.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => decide(a.id, 'approve')} className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-full text-sm" data-testid={`app-approve-${a.id}`}>Approve</button>
                    <button onClick={() => decide(a.id, 'reject')} className="flex-1 bg-red-600 text-white font-bold py-2 rounded-full text-sm" data-testid={`app-reject-${a.id}`}>Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Pill = ({ k, v, tone }) => (
  <div className={`${tone} rounded-2xl p-3 text-center`}>
    <p className="text-2xl font-heading font-bold">{v}</p>
    <p className="text-[10px] uppercase tracking-wider font-bold">{k}</p>
  </div>
);

export default AdminAmbassadorApplicationsPage;
