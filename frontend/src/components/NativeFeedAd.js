import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, MoreHorizontal, Heart, MessageCircle, Send, Sparkles } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

/**
 * NativeFeedAd — Instagram/Facebook-style sponsored card that lives INSIDE the
 * feed as a regular post. Loads the currently-live campaign from /api/ads/current,
 * tracks impressions/clicks/engagements/shares to /api/ads/event for analytics,
 * and awards +N points on engagement via /api/ads/watch.
 *
 * Renders nothing while no live campaign exists, so the feed stays clean.
 */
const NativeFeedAd = ({ onAwarded }) => {
  const [ad, setAd] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [working, setWorking] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const cardRef = useRef(null);
  const impressionFiredRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await axiosInstance.get('/ads/current');
        if (mounted) setAd(r.data?.is_real ? r.data : null);
      } catch { /* silent */ }
      if (mounted) setLoaded(true);
    })();
    return () => { mounted = false; };
  }, []);

  // Fire impression once when the card scrolls into view.
  useEffect(() => {
    if (!ad?.id || impressionFiredRef.current || !cardRef.current) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !impressionFiredRef.current) {
          impressionFiredRef.current = true;
          axiosInstance.post('/ads/event', { ad_id: ad.id, type: 'impressions' }).catch(() => {});
        }
      });
    }, { threshold: 0.5 });
    io.observe(cardRef.current);
    return () => io.disconnect();
  }, [ad]);

  if (!loaded || !ad) return null;

  const recordEvent = (type) => {
    if (ad?.id) axiosInstance.post('/ads/event', { ad_id: ad.id, type }).catch(() => {});
  };

  const handleLearnMore = () => {
    if (!ad.link_url) return;
    recordEvent('clicks');
    window.open(ad.link_url, '_blank', 'noopener,noreferrer');
  };

  const handleEngage = async () => {
    if (engaged || working) return;
    setWorking(true);
    try {
      const res = await axiosInstance.post('/ads/watch', {
        with_engagement: true,
        ad_id: ad.id,
      });
      const pts = res.data?.points || 0;
      toast.success(pts > 0 ? `+${pts} Network Score points` : 'Thanks for engaging');
      recordEvent('engagements');
      setEngaged(true);
      if (onAwarded) onAwarded(pts);
    } catch {
      toast.error('Could not award points right now');
    } finally {
      setWorking(false);
    }
  };

  const handleShare = async () => {
    recordEvent('shares');
    try {
      await axiosInstance.post('/ads/watch', { with_share: true, ad_id: ad.id });
      toast.success('Shared');
    } catch { /* silent */ }
    if (navigator.share && ad.link_url) {
      try { await navigator.share({ title: ad.title, text: ad.body, url: ad.link_url }); } catch { /* noop */ }
    }
  };

  const mediaUrl = ad.video_data_url || ad.image_data_url;

  return (
    <motion.article
      ref={cardRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-[#0f1d35] border border-white/10 rounded-2xl overflow-hidden"
      data-testid="native-feed-ad"
    >
      {/* Header — looks like a normal post header */}
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-yellow-500 flex items-center justify-center text-primary font-bold shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-sm truncate">{ad.advertiser_name || 'Network Capital'}</span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-secondary bg-secondary/10 border border-secondary/30 px-1.5 py-0.5 rounded">Sponsored</span>
            </div>
            <p className="text-[11px] text-white/50 truncate">Paid partnership</p>
          </div>
        </div>
        <button className="text-white/40 hover:text-white p-1" aria-label="More options" data-testid="ad-more-button">
          <MoreHorizontal size={20} />
        </button>
      </header>

      {/* Media (image or video) — clickable straight to link */}
      {mediaUrl && (
        <button
          type="button"
          onClick={handleLearnMore}
          className="block w-full bg-black/40 relative"
          data-testid="ad-media"
        >
          {ad.video_data_url ? (
            <video src={ad.video_data_url} autoPlay muted loop playsInline className="w-full max-h-[520px] object-cover" />
          ) : (
            <img src={ad.image_data_url} alt={ad.title} className="w-full max-h-[520px] object-cover" />
          )}
        </button>
      )}

      {/* Action row — mimics IG (like / comment / send) but maps to engage / learn more / share */}
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-4">
          <button
            onClick={handleEngage}
            disabled={working}
            className={`p-1.5 transition-transform active:scale-90 ${engaged ? 'text-secondary' : 'text-white/85 hover:text-secondary'}`}
            aria-label="Engage"
            data-testid="ad-engage-button"
          >
            <Heart size={24} className={engaged ? 'fill-secondary' : ''} />
          </button>
          <button
            onClick={handleLearnMore}
            className="text-white/85 hover:text-white p-1.5 transition-transform active:scale-90"
            aria-label="Comment / Learn more"
            data-testid="ad-comment-button"
          >
            <MessageCircle size={24} />
          </button>
          <button
            onClick={handleShare}
            className="text-white/85 hover:text-white p-1.5 transition-transform active:scale-90"
            aria-label="Share"
            data-testid="ad-share-button"
          >
            <Send size={22} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-2 pb-4">
        <h3 className="text-white font-bold text-base leading-snug mb-1">{ad.title}</h3>
        {ad.body && <p className="text-white/75 text-sm leading-relaxed line-clamp-3 mb-3 whitespace-pre-wrap">{ad.body}</p>}

        {ad.link_url && (
          <button
            onClick={handleLearnMore}
            className="w-full inline-flex items-center justify-center gap-2 bg-secondary hover:brightness-110 text-primary font-bold py-2.5 rounded-full text-sm active:scale-95 transition-all"
            data-testid="ad-cta-button"
          >
            {ad.cta_label || 'Learn more'} <ExternalLink size={14} />
          </button>
        )}

        {engaged && (
          <p className="text-[11px] text-secondary mt-2 text-center" data-testid="ad-engaged-confirm">
            ✓ Engagement recorded — points added to your Network Score
          </p>
        )}
      </div>
    </motion.article>
  );
};

export default NativeFeedAd;
