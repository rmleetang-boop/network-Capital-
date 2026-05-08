import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';

/**
 * FeatureIntroModal
 * Shows a single, dismissible primer the very first time a user opens a feature.
 * Gated by localStorage.nc_intro_<featureKey>.
 *
 * Props:
 *   featureKey    string  — unique key for this feature (e.g., "feed", "stokvels")
 *   title         string  — modal headline
 *   subtitle      string  — single-line summary
 *   bullets       Array<{ icon?: ReactNode, label: string, body?: string }>
 *   icon          ReactNode — optional Lucide icon component instance for the header
 *   ctaLabel      string  — defaults to "Got it"
 *   onDismissed   ()=>void — optional callback once user dismisses
 */
const FeatureIntroModal = ({
  featureKey,
  title,
  subtitle,
  bullets = [],
  icon = null,
  ctaLabel = 'Got it',
  onDismissed,
}) => {
  const storageKey = `nc_intro_${featureKey}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        // Defer one frame to avoid flash on route mount
        const t = setTimeout(() => setOpen(true), 250);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [storageKey]);

  const dismiss = () => {
    try { localStorage.setItem(storageKey, '1'); } catch {}
    setOpen(false);
    onDismissed?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismiss}
          data-testid={`feature-intro-${featureKey}`}
        >
          <motion.div
            className="w-full sm:max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden border border-secondary/20"
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            data-testid={`feature-intro-card-${featureKey}`}
          >
            {/* Brand header */}
            <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-primary via-[#0a1628] to-primary text-white">
              <button
                onClick={dismiss}
                className="absolute top-3 right-3 p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Close"
                data-testid={`feature-intro-close-${featureKey}`}
              >
                <X size={18} />
              </button>
              <div className="flex items-start gap-3">
                {icon && (
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary border border-secondary/30">
                    {icon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-secondary/90 font-semibold mb-1">First look</p>
                  <h3 className="font-heading font-bold text-xl leading-tight">{title}</h3>
                  {subtitle && <p className="text-sm text-white/75 mt-1 leading-relaxed">{subtitle}</p>}
                </div>
              </div>
            </div>

            {/* Bullets */}
            <div className="px-6 py-5 space-y-3.5 bg-white">
              {bullets.map((b, i) => (
                <div key={i} className="flex gap-3" data-testid={`feature-intro-bullet-${featureKey}-${i}`}>
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-secondary/15 text-secondary flex items-center justify-center mt-0.5">
                    {b.icon || <Check size={14} strokeWidth={2.5} />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-text-primary leading-tight">{b.label}</p>
                    {b.body && <p className="text-[13px] text-text-secondary mt-0.5 leading-relaxed">{b.body}</p>}
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="px-6 pb-6 pt-1 bg-white">
              <button
                onClick={dismiss}
                className="w-full bg-gradient-to-r from-secondary to-yellow-500 text-primary font-bold py-3 rounded-full hover:brightness-110 active:scale-95 transition-all shadow-md"
                data-testid={`feature-intro-cta-${featureKey}`}
              >
                {ctaLabel}
              </button>
              <p className="text-[11px] text-center text-text-secondary mt-2">
                You can revisit this from <span className="text-primary font-medium">Help &amp; FAQ</span>.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FeatureIntroModal;
