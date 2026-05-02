import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, X, Sparkles } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

/**
 * Mock ad watcher.
 * - Counts down from `duration` seconds (default 15)
 * - On completion, prompts user to share OR engage to earn points
 * - Calls POST /api/ads/watch with chosen reward type
 *
 * Use as a small button anywhere; opens a modal.
 */
const MockAdButton = ({ onAwarded, label = 'Watch ad to earn 100-500 pts', duration = 15 }) => {
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(duration);
  const [stage, setStage] = useState('watching'); // watching | done | claimed
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!open || stage !== 'watching') return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          setStage('done');
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [open, stage]);

  const reset = () => {
    setOpen(false);
    setRemaining(duration);
    setStage('watching');
  };

  const claim = async (kind) => {
    setWorking(true);
    try {
      const res = await axiosInstance.post('/ads/watch', {
        with_share: kind === 'share',
        with_engagement: kind === 'engage',
        ad_id: 'mock-ad-001',
      });
      const pts = res.data.points || 0;
      toast.success(pts > 0 ? `Earned +${pts} points!` : 'No points awarded');
      setStage('claimed');
      if (onAwarded) onAwarded(pts);
      setTimeout(reset, 1200);
    } catch (e) {
      toast.error('Failed to claim');
    } finally { setWorking(false); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-secondary/20 to-yellow-500/20 border border-secondary/40 hover:border-secondary text-secondary font-semibold py-3 rounded-full transition-all"
        data-testid="open-ad-button"
      >
        <Eye size={16} /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="ad-modal">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0a1628] border border-white/20 rounded-2xl max-w-md w-full overflow-hidden"
          >
            <div className="aspect-video bg-gradient-to-br from-purple-600 via-pink-500 to-secondary flex flex-col items-center justify-center text-white relative">
              <Sparkles size={48} className="mb-2 opacity-70" />
              <p className="text-2xl font-heading font-bold">Sponsored Content</p>
              <p className="text-sm opacity-80">Mock ad — replace with real SDK</p>
              <p className="absolute bottom-2 right-3 text-xs bg-black/40 px-2 py-1 rounded">
                {stage === 'watching' ? `${remaining}s` : 'Done'}
              </p>
              {stage === 'watching' && (
                <button
                  onClick={reset}
                  className="absolute top-2 right-2 bg-black/40 p-1 rounded"
                  data-testid="ad-close"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="p-5">
              {stage === 'watching' && (
                <div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-secondary transition-all"
                      style={{ width: `${((duration - remaining) / duration) * 100}%` }}
                    />
                  </div>
                  <p className="text-white/60 text-xs text-center">
                    Keep watching to earn — {remaining}s remaining
                  </p>
                </div>
              )}

              {stage === 'done' && (
                <div className="space-y-2">
                  <p className="text-white text-center font-medium mb-2">Earn your reward:</p>
                  <button
                    onClick={() => claim('engage')}
                    disabled={working}
                    className="w-full py-3 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-bold rounded-full disabled:opacity-50"
                    data-testid="ad-engage-button"
                  >
                    Engage with product · +500 pts
                  </button>
                  <button
                    onClick={() => claim('share')}
                    disabled={working}
                    className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-full disabled:opacity-50"
                    data-testid="ad-share-button"
                  >
                    Just share · +100 pts
                  </button>
                  <button
                    onClick={reset}
                    disabled={working}
                    className="w-full py-2 text-white/40 hover:text-white text-sm"
                  >
                    No thanks
                  </button>
                </div>
              )}

              {stage === 'claimed' && (
                <p className="text-center text-secondary font-bold py-4">Points awarded!</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default MockAdButton;
