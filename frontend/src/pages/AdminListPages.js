import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, Trash2, Shield } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

/**
 * Generic admin list page. Used for Jobs, Places, Activities.
 * Configured via the URL params via wrapper components below.
 */
const AdminGenericListPage = ({ user, title, fetchUrl, deleteUrl, rowRender, dataTestId, searchKey = 'q' }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator');

  const load = async () => {
    setLoading(true);
    try {
      const params = q.trim() ? { [searchKey]: q.trim() } : {};
      const r = await axiosInstance.get(fetchUrl, { params });
      setItems(r.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not load');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line */ }, []);

  const doDelete = async (id, label) => {
    const reason = window.prompt(`Delete "${label}"? Enter reason (min 4 chars):`);
    if (!reason || reason.trim().length < 4) return;
    try {
      await axiosInstance.delete(`${deleteUrl}/${id}`, { params: { reason: reason.trim() } });
      toast.success('Deleted');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Delete failed');
    }
  };

  if (!isAdmin) {
    return <div className="p-10 text-center text-text-muted"><Shield size={28} className="mx-auto text-primary mb-2" />Admin access only.</div>;
  }

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid={dataTestId}>
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate('/admin/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-heading font-bold text-primary flex-1">{title}</h1>
      </div>
      <div className="max-w-5xl mx-auto p-4 space-y-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder={`Search ${title.toLowerCase()}`}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm outline-none focus:border-primary"
              data-testid={`${dataTestId}-search`}
            />
          </div>
          <button onClick={load} className="bg-primary text-white text-xs font-semibold px-3 py-2 rounded-full">Go</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-text-muted text-sm">No items.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {items.map((it) => (
              <div key={it.id} className="px-4 py-3 flex items-center gap-3" data-testid={`${dataTestId}-row-${it.id}`}>
                {rowRender(it)}
                <button
                  onClick={() => doDelete(it.id, rowRender(it).props.children?.[0]?.props?.children || it.id)}
                  className="p-2 rounded-full text-red-600 hover:bg-red-50"
                  data-testid={`${dataTestId}-delete-${it.id}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const AdminJobsPage = ({ user }) => (
  <AdminGenericListPage
    user={user}
    title="Jobs"
    fetchUrl="/admin/jobs"
    deleteUrl="/admin/jobs"
    dataTestId="admin-jobs-page"
    rowRender={(j) => (
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{j.title || 'Untitled job'}</p>
        <p className="text-[11px] text-text-muted truncate">{j.company} · {j.location || '—'} · {j.applications_count || 0} applicants</p>
      </div>
    )}
  />
);

export const AdminPlacesPage = ({ user }) => (
  <AdminGenericListPage
    user={user}
    title="Places"
    fetchUrl="/admin/places"
    deleteUrl="/admin/places"
    dataTestId="admin-places-page"
    rowRender={(p) => (
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{p.name}</p>
        <p className="text-[11px] text-text-muted truncate">{p.category} · {p.city || '—'} · ★ {Number(p.average_rating || 0).toFixed(1)} ({p.review_count || 0})</p>
      </div>
    )}
  />
);

export const AdminActivitiesPage = ({ user }) => (
  <AdminGenericListPage
    user={user}
    title="Activities"
    fetchUrl="/admin/activities"
    deleteUrl="/admin/activities"
    dataTestId="admin-activities-page"
    rowRender={(a) => (
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{a.title}</p>
        <p className="text-[11px] text-text-muted truncate">{a.location || a.city || '—'} · {a.attendees_count || a.participants?.length || 0} attendees</p>
      </div>
    )}
  />
);

export default AdminGenericListPage;
