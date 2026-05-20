import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, Pin, Camera, Shield, Megaphone } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const AdminAnnouncePage = ({ user }) => {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [image, setImage] = useState('');
  const [pin, setPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flagBusy, setFlagBusy] = useState(false);
  const [stokvelEnabled, setStokvelEnabled] = useState(null);

  const isAdmin = user && user.role === 'admin';

  useEffect(() => {
    axiosInstance.get('/feature-flags').then((r) => setStokvelEnabled(!!r.data?.stokvel_plus_enabled)).catch(() => {});
  }, []);

  const toggleStokvelPlus = async () => {
    setFlagBusy(true);
    try {
      const next = !stokvelEnabled;
      await axiosInstance.put('/admin/feature-flags/stokvel_plus_enabled', { value: next });
      setStokvelEnabled(next);
      toast.success(`Stokvel+ ${next ? 'enabled' : 'set to Coming Soon'}`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setFlagBusy(false);
  };

  const uploadImage = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 3 * 1024 * 1024) return toast.error('Image must be under 3MB');
    const r = new FileReader();
    r.onloadend = () => setImage(r.result);
    r.readAsDataURL(f);
  };

  const publish = async () => {
    if (content.trim().length < 2) return toast.error('Write something');
    setSubmitting(true);
    try {
      await axiosInstance.post('/admin/announce', { content: content.trim(), image, pin });
      toast.success('Announcement published as Network Capital');
      setContent(''); setImage(''); setPin(false);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSubmitting(false);
  };

  if (!isAdmin) return <div className="p-10 text-center text-text-muted"><Shield size={28} className="mx-auto text-primary mb-2" />Admin only.</div>;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="admin-announce-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate('/admin/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
        <h1 className="text-base font-heading font-bold text-primary flex-1">Announce &amp; settings</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Feature flag toggles */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-3">Feature flags</p>
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3" data-testid="stokvel-plus-flag-row">
            <div>
              <p className="text-sm font-semibold">Stokvel+ creation &amp; joining</p>
              <p className="text-[11px] text-text-muted">
                {stokvelEnabled === null ? 'Loading…' : stokvelEnabled ? 'Live · users can create &amp; join.' : 'Coming Soon · users see a holding screen.'}
              </p>
            </div>
            <button
              onClick={toggleStokvelPlus}
              disabled={flagBusy || stokvelEnabled === null}
              className={`px-4 py-2 rounded-full text-xs font-bold disabled:opacity-50 ${stokvelEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}
              data-testid="stokvel-plus-toggle">
              {flagBusy ? <Loader2 size={12} className="animate-spin" /> : stokvelEnabled ? 'Turn OFF (Coming Soon)' : 'Turn ON (Live)'}
            </button>
          </div>
        </div>

        {/* Announce composer */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone size={18} className="text-secondary" />
            <h3 className="font-heading font-bold text-primary">Post as Network Capital</h3>
          </div>
          <textarea
            value={content} onChange={(e) => setContent(e.target.value)}
            rows={6} maxLength={4000}
            placeholder="Write the announcement that all members will see in their feed…"
            className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary resize-none mb-3"
            data-testid="announce-content-input"
          />
          {image && <img src={image} alt="" className="w-full max-h-64 object-cover rounded-xl mb-2" />}
          <div className="flex items-center justify-between mb-3">
            <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
              <Camera size={12} /> {image ? 'Replace image' : 'Add image'}
              <input type="file" accept="image/*" onChange={uploadImage} className="hidden" data-testid="announce-image-input" />
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} data-testid="announce-pin-checkbox" />
              <Pin size={12} /> Pin to top of feed
            </label>
          </div>
          <button onClick={publish} disabled={submitting}
            className="w-full bg-primary text-white font-bold py-2.5 rounded-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="announce-publish-button">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Publish to feed
          </button>
        </div>

        <p className="text-[10px] text-text-muted text-center">
          Posts appear authored by <strong>@networkcapital</strong> with the Official badge across all feeds, notifications, and search.
        </p>
      </div>
    </div>
  );
};

export default AdminAnnouncePage;
