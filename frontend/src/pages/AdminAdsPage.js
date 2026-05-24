import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Megaphone, BarChart3, TrendingUp, Eye, MousePointer, Trash2, Edit2, X, Sparkles, Globe, ChevronRight, Power } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const empty = () => ({
  title: '', body: '', cta_label: 'Learn more', link_url: 'https://',
  image_data_url: '', video_data_url: '',
  starts_at: '', ends_at: '',
  is_active: true, reward_engage_points: 500, reward_share_points: 100,
});

const fileToDataUrl = (file) => new Promise((r, rej) => { const x = new FileReader(); x.onload = () => r(x.result); x.onerror = rej; x.readAsDataURL(file); });

const AdminAdsPage = ({ user }) => {
  const navigate = useNavigate();
  const isAdmin = user && user.role === 'admin';
  const [list, setList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);     // ad id under analytics view
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorAd, setEditorAd] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axiosInstance.get('/admin/ads');
      setList(r.data.ads || []);
      setSummary(r.data.summary || null);
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not load'); }
    setLoading(false);
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const toggleActive = async (ad) => {
    try {
      await axiosInstance.patch(`/admin/ads/${ad.id}`, { ...ad, is_active: !ad.is_active });
      toast.success(`Ad ${ad.is_active ? 'paused' : 'activated'}`);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const remove = async (ad) => {
    if (!window.confirm(`Delete "${ad.title}"? Analytics events will also be removed.`)) return;
    try { await axiosInstance.delete(`/admin/ads/${ad.id}`); toast.success('Deleted'); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const openEditor = (ad) => { setEditorAd(ad || null); setEditorOpen(true); };

  if (!isAdmin) return <div className="p-10 text-center text-text-muted" data-testid="ads-admin-gated">Admin only.</div>;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="admin-ads-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate('/admin/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
        <h1 className="text-base font-heading font-bold text-primary flex-1 inline-flex items-center gap-2"><Megaphone size={16} className="text-secondary" /> Ad Campaigns</h1>
        <button onClick={() => openEditor(null)} className="text-xs font-bold bg-primary text-white px-3 py-1.5 rounded-full inline-flex items-center gap-1" data-testid="ad-new"><Plus size={12} /> New</button>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2" data-testid="ads-summary">
            <Tile label="Campaigns" value={summary.total_campaigns} tone="from-primary to-[#0a1628]" />
            <Tile label="Live now" value={summary.active_campaigns} tone="from-emerald-500 to-emerald-600" />
            <Tile label="Impressions" value={(summary.total_impressions || 0).toLocaleString()} tone="from-blue-500 to-blue-600" />
            <Tile label="Avg CTR" value={`${summary.ctr_pct}%`} sub={`${(summary.total_clicks || 0).toLocaleString()} clicks`} tone="from-purple-500 to-pink-500" />
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center"><Loader2 className="mx-auto animate-spin text-text-muted" /></div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center" data-testid="ads-empty">
            <Megaphone size={28} className="mx-auto text-text-muted mb-2" />
            <p className="font-bold text-text-primary">No ad campaigns yet</p>
            <p className="text-xs text-text-muted mb-4">Create your first campaign to start tracking impressions, clicks, and engagements.</p>
            <button onClick={() => openEditor(null)} className="bg-primary text-white font-bold px-4 py-2 rounded-full text-sm">Create campaign</button>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((ad) => (
              <div key={ad.id} className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3" data-testid={`ad-row-${ad.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-text-primary truncate">{ad.title}</p>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${ad.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{ad.is_active ? 'Live' : 'Paused'}</span>
                  </div>
                  <p className="text-[11px] text-text-muted truncate">{ad.body}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-blue-700"><Eye size={11} /> {(ad.impressions || 0).toLocaleString()}</span>
                    <span className="inline-flex items-center gap-1 text-purple-700"><MousePointer size={11} /> {(ad.clicks || 0).toLocaleString()}</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700"><TrendingUp size={11} /> {(ad.engagements || 0).toLocaleString()}</span>
                    <span className="text-text-muted">CTR {(ad.impressions ? ((ad.clicks || 0) / ad.impressions * 100).toFixed(2) : '0.00')}%</span>
                  </div>
                </div>
                <button onClick={() => setEditing(ad.id)} className="p-1.5 rounded-full hover:bg-gray-100" title="Analytics" data-testid={`ad-analytics-${ad.id}`}><BarChart3 size={14} className="text-blue-600" /></button>
                <button onClick={() => openEditor(ad)} className="p-1.5 rounded-full hover:bg-gray-100" title="Edit"><Edit2 size={14} className="text-text-muted" /></button>
                <button onClick={() => toggleActive(ad)} className="p-1.5 rounded-full hover:bg-gray-100" title="Toggle active" data-testid={`ad-toggle-${ad.id}`}><Power size={14} className={ad.is_active ? 'text-emerald-600' : 'text-text-muted'} /></button>
                <button onClick={() => remove(ad)} className="p-1.5 rounded-full hover:bg-red-50" title="Delete" data-testid={`ad-delete-${ad.id}`}><Trash2 size={14} className="text-red-600" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && <AdAnalyticsModal adId={editing} onClose={() => setEditing(null)} />}
      {editorOpen && <AdEditorModal initial={editorAd} onClose={() => { setEditorOpen(false); setEditorAd(null); }} onSaved={() => { setEditorOpen(false); setEditorAd(null); load(); }} />}
    </div>
  );
};

const Tile = ({ label, value, sub, tone }) => (
  <div className={`bg-gradient-to-br ${tone} text-white rounded-2xl p-3`}>
    <p className="text-xl font-heading font-bold leading-none">{value}</p>
    <p className="text-[9px] uppercase tracking-wider opacity-90 mt-1 font-bold">{label}</p>
    {sub && <p className="text-[10px] opacity-80 mt-0.5">{sub}</p>}
  </div>
);

const AdEditorModal = ({ initial, onClose, onSaved }) => {
  const [form, setForm] = useState(() => ({ ...empty(), ...(initial || {}) }));
  const [saving, setSaving] = useState(false);

  const setVal = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleFile = async (file, kind) => {
    if (!file) return;
    if (file.size > 11 * 1024 * 1024) return toast.error(`${kind === 'video' ? 'Video' : 'Image'} is too large — max 11 MB.`);
    const url = await fileToDataUrl(file);
    setVal(kind === 'video' ? 'video_data_url' : 'image_data_url', url);
    if (kind === 'video') setVal('image_data_url', '');
    else setVal('video_data_url', '');
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim() || !form.link_url.trim()) {
      toast.error('Title, body, and link URL are all required.');
      return;
    }
    setSaving(true);
    try {
      if (initial?.id) await axiosInstance.patch(`/admin/ads/${initial.id}`, form);
      else await axiosInstance.post('/admin/ads', form);
      toast.success(initial ? 'Updated' : 'Campaign created');
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose} data-testid="ad-editor-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-2">
          <h3 className="font-heading font-bold flex-1">{initial ? 'Edit campaign' : 'New campaign'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100"><X size={14} /></button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <Field label="Title" testId="ad-title" value={form.title} onChange={(v) => setVal('title', v)} placeholder="Sponsor name or headline" />
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">Body</p>
            <textarea value={form.body} onChange={(e) => setVal('body', e.target.value)} rows={3} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm resize-none outline-none focus:border-primary" placeholder="What's this campaign about?" data-testid="ad-body" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="CTA label" testId="ad-cta" value={form.cta_label} onChange={(v) => setVal('cta_label', v)} placeholder="Shop now" />
            <Field label="Link URL" testId="ad-link" value={form.link_url} onChange={(v) => setVal('link_url', v)} placeholder="https://..." />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">Media (image OR video, max 11 MB)</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center cursor-pointer hover:border-primary text-xs" data-testid="ad-image-upload">
                <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0], 'image')} className="hidden" />
                {form.image_data_url ? <img src={form.image_data_url} alt="" className="h-16 mx-auto object-contain" /> : 'Upload image'}
              </label>
              <label className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center cursor-pointer hover:border-primary text-xs" data-testid="ad-video-upload">
                <input type="file" accept="video/*" onChange={(e) => handleFile(e.target.files?.[0], 'video')} className="hidden" />
                {form.video_data_url ? <span className="text-emerald-600 font-bold">Video attached</span> : 'Upload video'}
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">Starts (optional)</p>
              <input type="datetime-local" value={form.starts_at} onChange={(e) => setVal('starts_at', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" data-testid="ad-starts" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">Ends (optional)</p>
              <input type="datetime-local" value={form.ends_at} onChange={(e) => setVal('ends_at', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" data-testid="ad-ends" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">Reward — Engage (pts)</p>
              <input type="number" value={form.reward_engage_points} onChange={(e) => setVal('reward_engage_points', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" data-testid="ad-engage-pts" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">Reward — Share (pts)</p>
              <input type="number" value={form.reward_share_points} onChange={(e) => setVal('reward_share_points', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" data-testid="ad-share-pts" />
            </div>
          </div>
          <label className="flex items-center gap-2 p-2 border border-gray-200 rounded-xl text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setVal('is_active', e.target.checked)} className="w-4 h-4 accent-primary" data-testid="ad-is-active" />
            <span>Live (start showing to users immediately)</span>
          </label>
          <button onClick={save} disabled={saving} className="w-full bg-primary text-white font-bold py-2.5 rounded-full text-sm disabled:opacity-50 inline-flex items-center justify-center gap-1" data-testid="ad-save">
            {saving && <Loader2 size={12} className="animate-spin" />}
            {initial ? 'Save changes' : 'Create campaign'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, placeholder, testId }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">{label}</p>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary" data-testid={testId} />
  </div>
);

const AdAnalyticsModal = ({ adId, onClose }) => {
  const [data, setData] = useState(null);
  useEffect(() => { (async () => {
    try { const r = await axiosInstance.get(`/admin/ads/${adId}/analytics?days=30`); setData(r.data); }
    catch (e) { toast.error('Could not load analytics'); }
  })(); }, [adId]);

  if (!data) return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <Loader2 className="text-white animate-spin" />
    </div>
  );
  const t = data.totals;
  const maxDayImp = Math.max(1, ...(data.daily || []).map((d) => d.impressions || 0));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose} data-testid="ad-analytics-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-2">
          <h3 className="font-heading font-bold flex-1 inline-flex items-center gap-2"><BarChart3 size={16} className="text-secondary" /> {data.ad.title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100"><X size={14} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Tile label="Impressions" value={t.impressions.toLocaleString()} tone="from-blue-500 to-blue-600" />
            <Tile label="Clicks" value={t.clicks.toLocaleString()} sub={`CTR ${t.ctr_pct}%`} tone="from-purple-500 to-purple-600" />
            <Tile label="Engagements" value={t.engagements.toLocaleString()} tone="from-emerald-500 to-emerald-600" />
            <Tile label="Shares" value={t.shares.toLocaleString()} tone="from-amber-500 to-amber-600" />
            <Tile label="Unique viewers" value={t.unique_viewers.toLocaleString()} tone="from-cyan-500 to-cyan-600" />
            <Tile label="Unique clickers" value={t.unique_clickers.toLocaleString()} tone="from-rose-500 to-rose-600" />
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-text-muted mb-2">Last 30 days · impressions</p>
            {(data.daily || []).length === 0 ? (
              <p className="text-xs text-text-muted">No events yet.</p>
            ) : (
              <div className="flex items-end gap-1 h-32" data-testid="ad-daily-chart">
                {data.daily.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="bg-primary/80 hover:bg-primary rounded-t w-full transition-all" style={{ height: `${((d.impressions || 0) / maxDayImp) * 100}%`, minHeight: 2 }} title={`${d.day}: ${d.impressions} impressions, ${d.clicks} clicks`} />
                    <span className="text-[8px] text-text-muted hidden group-hover:block whitespace-nowrap">{d.day.slice(-5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-text-muted mb-2 inline-flex items-center gap-1"><Globe size={11} /> Top 20 geos by impressions</p>
            {(data.geo || []).length === 0 ? <p className="text-xs text-text-muted">No data.</p> : (
              <div className="space-y-1 max-h-48 overflow-y-auto" data-testid="ad-geo-list">
                {data.geo.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="flex-1">{g.country} · {g.city}</span>
                    <span className="font-bold text-primary">{g.impressions}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-text-muted mb-2">Age cohort (by birth-month)</p>
            {(data.age || []).length === 0 ? <p className="text-xs text-text-muted">No data.</p> : (
              <div className="grid grid-cols-6 gap-1" data-testid="ad-age-grid">
                {data.age.map((a, i) => (
                  <div key={i} className="bg-background-subtle rounded-lg p-2 text-center text-xs">
                    <p className="font-bold text-primary">{a.impressions}</p>
                    <p className="text-[9px] text-text-muted">Mo {a.birth_month ?? '?'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAdsPage;
