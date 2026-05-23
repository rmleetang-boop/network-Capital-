import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Eye, X, Sparkles, ExternalLink } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

/**
 * Smart ad button — loads the currently-active admin-managed ad campaign from
 * /api/ads/current. If no live campaign, falls back to a mock placeholder.
 * Records impressions/clicks/engagements/shares to /api/ads/event for analytics.
 */
const MockAdButton = ({ onAwarded, duration = 10 }) => {
  const [open, setOpen] = useState(false);
  const [ad, setAd] = useState(null);
  const [remaining, setRemaining] = useState(duration);
  const [stage, setStage] = useState('watching');
  const [working, setWorking] = useState(false);
  const impressionFiredRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await axiosInstance.get('/ads/current');
        setAd(r.data);
      } catch { /* silent */ }
    })();
  }, []);

  useEffect(() => {
    if (!open || stage !== 'watching') return;
    const t = setInterval(() => {
      setRemaining((r) => { if (r <= 1) { clearInterval(t); setStage('done'); return 0; } return r - 1; });
    }, 1000);
    return () => clearInterval(t);
  }, [open, stage]);

  useEffect(() => {
    // Record an impression once when the modal opens with a real ad attached.
    if (open && ad?.is_real && !impressionFiredRef.current) {
      impressionFiredRef.current = true;
      axiosInstance.post('/ads/event', { ad_id: ad.id, type: 'impressions' }).catch(() => {});
    }
  }, [open, ad]);

  const reset = () => { setOpen(false); setRemaining(duration); setStage('watching'); impressionFiredRef.current = false; };

  const recordEvent = (type) => {
    if (ad?.is_real && ad?.id) {
      axiosInstance.post('/ads/event', { ad_id: ad.id, type }).catch(() => {});
    }
  };

  const claim = async (kind) => {
    setWorking(true);
    try {
      const res = await axiosInstance.post('/ads/watch', {
        with_share: kind === 'share',
        with_engagement: kind === 'engage',
        ad_id: ad?.id || 'mock-ad-001',
      });
      const pts = res.data.points || 0;
      toast.success(pts > 0 ? `Earned +${pts} points!` : 'No points awarded');
      recordEvent(kind === 'engage' ? 'engagements' : 'shares');
      setStage('claimed');
      if (onAwarded) onAwarded(pts);
      setTimeout(reset, 1200);
    } catch { toast.error('Failed to claim'); } finally { setWorking(false); }
  };

  const openLink = () => {
    if (ad?.link_url) {
      recordEvent('clicks');
      window.open(ad.link_url, '_blank', 'noopener,noreferrer');
    }
  };

  const isReal = ad?.is_real;
  const title = isReal ? ad.title : 'Sponsored Content';
  const body = isReal ? ad.body : 'Mock ad — admins can publish real campaigns from /admin/ads';
  const ctaLabel = isReal ? ad.cta_label : 'Learn more';
  const engagePts = isReal ? (ad.reward_engage_points || 500) : 500;
  const sharePts = isReal ? (ad.reward_share_points || 100) : 100;
  const buttonLabel = isReal ? `${ad.title} — earn up to ${engagePts} pts` : `Watch ad to earn up to ${engagePts} pts`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-secondary/20 to-yellow-500/20 border border-secondary/40 hover:border-secondary text-secondary font-semibold py-3 rounded-full transition-all"
        data-testid="open-ad-button">
        <Eye size={16} /> {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="ad-modal">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0a1628] border border-white/20 rounded-2xl max-w-md w-full overflow-hidden">
            <div className="aspect-video bg-gradient-to-br from-purple-600 via-pink-500 to-secondary flex flex-col items-center justify-center text-white relative overflow-hidden">
              {isReal && ad.video_data_url ? (
                <video src={ad.video_data_url} autoPlay muted loop className="absolute inset-0 w-full h-full object-cover" />
              ) : isReal && ad.image_data_url ? (
                <img src={ad.image_data_url} alt={ad.title} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <Sparkles size={48} className="mb-2 opacity-70" />
              )}
              <div className={`relative z-10 text-center px-4 ${isReal && (ad.image_data_url || ad.video_data_url) ? 'bg-black/40 backdrop-blur-sm rounded-xl py-3 px-4' : ''}`}>
                <p className="text-2xl font-heading font-bold">{title}</p>
                <p className="text-sm opacity-90 line-clamp-2">{body}</p>
              </div>
              <p className="absolute bottom-2 right-3 text-xs bg-black/40 px-2 py-1 rounded">{stage === 'watching' ? `${remaining}s` : 'Done'}</p>
              {stage === 'watching' && (
                <button onClick={reset} className="absolute top-2 right-2 bg-black/40 p-1 rounded" data-testid="ad-close"><X size={16} /></button>
              )}
            </div>

            <div className="p-5">
              {stage === 'watching' && (
                <div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-secondary transition-all" style={{ width: `${((duration - remaining) / duration) * 100}%` }} />
                  </div>
                  <p className="text-white/60 text-xs text-center">Keep watching to earn — {remaining}s remaining</p>
                  {isReal && ad.link_url && (
                    <button onClick={openLink} className="mt-3 w-full py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-full inline-flex items-center justify-center gap-1" data-testid="ad-link">
                      <ExternalLink size={12} /> {ctaLabel}
                    </button>
                  )}
                </div>
              )}

              {stage === 'done' && (
                <div className="space-y-2">
                  {isReal && ad.link_url && (
                    <button onClick={openLink} className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-full inline-flex items-center justify-center gap-1" data-testid="ad-link-after">
                      <ExternalLink size={12} /> {ctaLabel}
                    </button>
                  )}
                  <p className="text-white text-center font-medium mb-2">Earn your reward:</p>
                  <button onClick={() => claim('engage')} disabled={working}
                    className="w-full py-3 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-bold rounded-full disabled:opacity-50"
                    data-testid="ad-engage-button">
                    Engage with product · +{engagePts} pts
                  </button>
                  <button onClick={() => claim('share')} disabled={working}
                    className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-full disabled:opacity-50"
                    data-testid="ad-share-button">
                    Just share · +{sharePts} pts
                  </button>
                  <button onClick={reset} disabled={working} className="w-full py-2 text-white/40 hover:text-white text-sm">No thanks</button>
                </div>
              )}

              {stage === 'claimed' && (<p className="text-center text-secondary font-bold py-4">Points awarded!</p>)}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default MockAdButton;
