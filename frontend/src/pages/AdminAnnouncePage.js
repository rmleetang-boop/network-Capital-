import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Loader2, Pin, Shield, Megaphone,
  Plus, X, Layers, Film, Sparkles, Image as ImageIcon,
} from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import {
  uploadMedia, validateMediaFile, probeVideoDuration,
  MAX_VIDEO_SECONDS, formatBytes,
} from '../lib/mediaUpload';

const AdminAnnouncePage = ({ user }) => {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [pin, setPin] = useState(false);
  // Iter 51 — admin announcements now ship the same carousel + reel power.
  const [mode, setMode] = useState('photos');           // 'photos' | 'reel'
  const [slides, setSlides] = useState([]);             // up to 10 image URLs
  const [reel, setReel] = useState(null);               // { url, duration_seconds, size_bytes }
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [flagBusy, setFlagBusy] = useState(false);
  const [stokvelEnabled, setStokvelEnabled] = useState(null);

  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');

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

  const resolveUrl = (u) => (u?.startsWith('http') ? u : `${process.env.REACT_APP_BACKEND_URL}${u}`);

  const handlePhotosPicked = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (slides.length + files.length > 10) {
      toast.error(`A carousel can hold up to 10 photos. You're trying to add ${files.length} on top of ${slides.length}.`);
      return;
    }
    for (const file of files) {
      const err = validateMediaFile(file, 'image');
      if (err) { toast.error(err); continue; }
      setUploading(true);
      setUploadProgress(0);
      try {
        const { url, size_bytes } = await uploadMedia(file, {
          scope: 'announcements',
          onProgress: setUploadProgress,
        });
        setMode('photos');
        setReel(null);
        setSlides((prev) => prev.concat([{ image: url, size_bytes, name: file.name }]));
      } catch (ex) {
        toast.error(ex?.response?.data?.detail || 'Image upload failed.');
      }
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const handleReelPicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateMediaFile(file, 'video');
    if (err) { toast.error(err); return; }
    const duration = await probeVideoDuration(file);
    if (duration && duration > MAX_VIDEO_SECONDS + 0.5) {
      toast.error(`Reels are capped at ${MAX_VIDEO_SECONDS}s — your clip is ${Math.round(duration)}s.`);
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const { url, size_bytes } = await uploadMedia(file, {
        scope: 'announcements',
        onProgress: setUploadProgress,
      });
      setMode('reel');
      setSlides([]);
      setReel({ url, duration_seconds: Math.round(duration || 0), size_bytes, name: file.name });
      toast.success(`Reel attached · ${formatBytes(size_bytes)} · ${Math.round(duration || 0)}s`);
    } catch (ex) {
      toast.error(ex?.response?.data?.detail || 'Video upload failed.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const publish = async () => {
    if (content.trim().length < 2) return toast.error('Write something');
    const payload = { content: content.trim(), pin };
    if (mode === 'reel' && reel) {
      payload.video = reel.url;
      payload.media_type = 'reel';
      payload.duration_seconds = reel.duration_seconds || null;
    } else if (slides.length === 1) {
      payload.image = slides[0].image;
      payload.media_type = 'single';
    } else if (slides.length >= 2) {
      payload.slides = slides.map((s) => ({ type: 'image', image: s.image, caption: '' }));
      payload.media_type = 'carousel';
    }

    setSubmitting(true);
    try {
      await axiosInstance.post('/admin/announce', payload);
      toast.success('Announcement published as Network Capital');
      setContent('');
      setPin(false);
      setMode('photos');
      setSlides([]);
      setReel(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    }
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

          {/* Composer mode hint */}
          <div className="flex items-center gap-2 text-[11px] text-text-muted mb-3">
            {mode === 'reel' ? (
              <><Film size={12} className="text-secondary" /><span>Reel · vertical video ≤ 30s</span></>
            ) : slides.length >= 2 ? (
              <><Layers size={12} className="text-secondary" /><span>Carousel · {slides.length}/10 photos</span></>
            ) : slides.length === 1 ? (
              <><ImageIcon size={12} className="text-secondary" /><span>Single photo · add more to make a carousel</span></>
            ) : (
              <><Sparkles size={12} className="text-secondary" /><span>Add up to 10 photos for a carousel, or one ≤30s video for a Reel.</span></>
            )}
          </div>

          {/* Photo previews */}
          {mode === 'photos' && slides.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3" data-testid="announce-photo-previews">
              {slides.map((s, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group">
                  <img src={resolveUrl(s.image)} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setSlides((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-black/65 hover:bg-black text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Remove slide ${i + 1}`}
                    data-testid={`announce-remove-slide-${i}`}
                  >
                    <X size={12} />
                  </button>
                  <span className="absolute bottom-1 left-1 bg-black/55 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{i + 1}</span>
                </div>
              ))}
              {slides.length < 10 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all" data-testid="announce-add-more-photos">
                  <Plus size={20} className="text-text-muted" />
                  <input type="file" accept="image/*" multiple onChange={handlePhotosPicked} className="hidden" />
                </label>
              )}
            </div>
          )}

          {/* Reel preview */}
          {mode === 'reel' && reel && (
            <div className="relative mb-3 mx-auto" style={{ maxWidth: 220 }} data-testid="announce-reel-preview">
              <video
                src={resolveUrl(reel.url)}
                controls
                className="w-full rounded-xl bg-black"
                style={{ aspectRatio: '9 / 16' }}
              />
              <button
                type="button"
                onClick={() => { setReel(null); setMode('photos'); }}
                className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-100"
                aria-label="Remove video"
                data-testid="announce-remove-reel"
              >
                <X size={14} />
              </button>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1.5 text-center">
                Reel · {formatBytes(reel.size_bytes)} · {reel.duration_seconds}s
              </p>
            </div>
          )}

          {/* Upload progress */}
          {uploading && (
            <div className="mb-3">
              <div className="flex items-center gap-2 text-[11px] text-text-muted mb-1">
                <Loader2 size={12} className="animate-spin" /> Uploading… {uploadProgress}%
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-secondary transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {/* Pickers */}
          {mode !== 'reel' && slides.length === 0 && (
            <div className="flex gap-3 mb-3">
              <label className="flex-1 border-2 border-dashed border-gray-300 rounded-xl p-3 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all" data-testid="announce-photos-picker">
                <Layers className="mx-auto mb-1 text-text-muted" size={22} />
                <span className="text-xs text-text-secondary block">Add photos</span>
                <span className="text-[10px] text-text-muted block mt-0.5">1–10 · JPG/PNG/WebP · 11 MB each</span>
                <input type="file" accept="image/*" multiple onChange={handlePhotosPicked} className="hidden" data-testid="announce-photos-input" />
              </label>
              <label className="flex-1 border-2 border-dashed border-gray-300 rounded-xl p-3 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all" data-testid="announce-reel-picker">
                <Film className="mx-auto mb-1 text-text-muted" size={22} />
                <span className="text-xs text-text-secondary block">Add reel</span>
                <span className="text-[10px] text-text-muted block mt-0.5">MP4/MOV · ≤ 30s · 50 MB</span>
                <input type="file" accept="video/*" onChange={handleReelPicked} className="hidden" data-testid="announce-reel-input" />
              </label>
            </div>
          )}

          <div className="flex items-center justify-end mb-3">
            <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} data-testid="announce-pin-checkbox" />
              <Pin size={12} /> Pin to top of feed
            </label>
          </div>

          <button onClick={publish} disabled={submitting || uploading}
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
