// Iter 56 — Post-publish success modal.
// Shows the seller their freshly-created product card, shareable link,
// QR code, and one-tap next-actions (view store, sell another, native share).
// A small, dismissible "Need help growing your sales?" Creative Services CTA
// is appended — it never interrupts the selling flow.
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  X, Copy, Check, Share2, Store, Plus, Sparkles, ExternalLink, QrCode,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const SHARE_BASE_URL = 'https://networkcapitalapp.co.za';

const PublishSuccessModal = ({ product, isDraft = false, onClose, onSellAnother }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(true);
  const [showCreative, setShowCreative] = useState(true);

  const shareUrl = useMemo(() => {
    if (!product?.slug || !product?.creator_username) return SHARE_BASE_URL;
    return `${SHARE_BASE_URL}/p/${product.creator_username}/${product.slug}`;
  }, [product]);

  const storeUrl = useMemo(() => {
    if (!product?.creator_username) return SHARE_BASE_URL;
    return `${SHARE_BASE_URL}/store/${product.creator_username}`;
  }, [product]);

  const heroImg = (product?.images || [])[0];
  const price = product?.price_min || product?.estimated_cost || product?.min_support || 0;
  const currency = product?.currency || 'USD';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — long-press to copy manually');
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.name,
          text: `Check out ${product?.name} on Network Capital`,
          url: shareUrl,
        });
      } catch {
        // user cancelled — no-op
      }
    } else {
      copyLink();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      data-testid="publish-success-modal"
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur z-10 px-5 pt-5 pb-3 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center ${isDraft ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {isDraft ? <Sparkles size={18} /> : <Check size={18} />}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-text-muted">{isDraft ? 'Draft saved' : 'Live on your store'}</p>
              <h3 className="font-heading font-bold text-base leading-none">{isDraft ? 'Saved as draft' : "You're live! 🎉"}</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100" data-testid="publish-success-close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Product Preview Card */}
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-gradient-to-br from-gray-50 to-white" data-testid="publish-product-preview">
            {heroImg && (
              <div className="aspect-[16/10] bg-gray-100 overflow-hidden">
                <img src={heroImg} alt={product.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">{product?.type === 'service' ? 'Service' : 'Product'}</p>
              <h4 className="font-heading font-bold text-lg leading-snug">{product?.name}</h4>
              {price > 0 && (
                <p className="mt-1 text-primary font-bold">
                  {currency} {Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
            </div>
          </div>

          {isDraft ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <p className="font-semibold mb-1">Draft only — not yet visible to buyers.</p>
              <p className="text-xs">You can find it under <strong>My Store → Drafts</strong> and publish anytime.</p>
            </div>
          ) : (
            <>
              {/* Shareable Link */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Shareable link</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-text-secondary outline-none"
                    data-testid="publish-share-link"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={copyLink}
                    className="px-3 py-2.5 bg-primary text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 hover:opacity-90"
                    data-testid="publish-copy-link"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* QR Code */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-text-secondary inline-flex items-center gap-1">
                    <QrCode size={12} /> QR code
                  </label>
                  <button
                    onClick={() => setShowQR((s) => !s)}
                    className="text-[11px] text-primary font-semibold"
                    data-testid="publish-qr-toggle"
                  >
                    {showQR ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showQR && (
                  <div className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-2xl" data-testid="publish-qr-block">
                    <QRCodeSVG
                      value={shareUrl}
                      size={180}
                      level="M"
                      includeMargin
                      fgColor="#0a0e1f"
                      bgColor="#ffffff"
                    />
                    <p className="text-[10px] text-text-muted text-center">
                      Scan to view · long-press image to save
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={nativeShare}
                  className="px-3 py-3 bg-primary text-white rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5"
                  data-testid="publish-share-btn"
                >
                  <Share2 size={14} /> Share
                </button>
                <button
                  onClick={() => { onClose?.(); navigate(`/store/${product.creator_username}`); }}
                  className="px-3 py-3 bg-white border border-primary text-primary rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5"
                  data-testid="publish-view-store"
                >
                  <Store size={14} /> My store
                </button>
              </div>
            </>
          )}

          {/* Sell Another */}
          <button
            onClick={() => { onClose?.(); onSellAnother?.(); }}
            className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-full text-sm font-bold inline-flex items-center justify-center gap-1.5 shadow-lg"
            data-testid="publish-sell-another"
          >
            <Plus size={16} /> Sell another product
          </button>

          {/* Creative Services CTA — small, dismissible */}
          {showCreative && !isDraft && (
            <div className="rounded-xl border border-dashed border-gray-300 p-3 text-xs bg-gradient-to-br from-rose-50/40 to-amber-50/40" data-testid="creative-services-cta">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-text-primary mb-0.5">Need help growing your sales?</p>
                  <p className="text-text-muted leading-snug mb-1.5">
                    Network Capital Creative Services — branding, marketing, advertising, customer support, sales growth.
                  </p>
                  <a
                    href="mailto:creative@networkcapitalapp.co.za?subject=Creative%20Services%20enquiry"
                    className="inline-flex items-center gap-1 text-primary font-bold"
                    data-testid="creative-services-mailto"
                  >
                    creative@networkcapitalapp.co.za <ExternalLink size={10} />
                  </a>
                </div>
                <button
                  onClick={() => setShowCreative(false)}
                  className="p-1 text-text-muted hover:text-text-primary"
                  aria-label="Dismiss"
                  data-testid="creative-services-dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PublishSuccessModal;
