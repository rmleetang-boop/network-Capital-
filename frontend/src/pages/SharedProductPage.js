// Iter 52 — Shareable product page.
// URL: /p/:username/:slug
//
// Fetches via GET /api/products/by-slug/:username/:slug. Renders:
//   • Hero image + name + creator
//   • Problem solved + description + tags
//   • Download button (free | email-gated lead form | paid via Stripe)
//   • Share button that copies /api/share/p/:u/:s (OG-aware link)
//   • Support categories chips (Growth Creators only)
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Download, Share2, FileText, Loader2, Check, Globe,
  MapPin, Tag as TagIcon, Megaphone, Lock, Mail,
} from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { resolveMediaUrl, formatBytes } from '../lib/mediaUpload';

const SharedProductPage = () => {
  const { username, slug } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [product, setProduct] = useState(null);
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [lead, setLead] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosInstance.get(`/products/by-slug/${username}/${slug}`);
        setProduct(res.data.product);
        setCreator(res.data.creator);
      } catch (e) {
        toast.error('Product not found.');
      } finally {
        setLoading(false);
      }
    })();
  }, [username, slug]);

  // Poll for paid-checkout completion if Stripe redirected here
  useEffect(() => {
    const sid = params.get('paid');
    if (!sid || !product) return;
    (async () => {
      try {
        const res = await axiosInstance.get(`/products/file-checkout/${sid}`);
        if (res.data.status === 'paid') {
          toast.success('Payment received — download unlocked!');
          // Force download
          const d = await axiosInstance.get(`/products/${product.id}/download`);
          if (d.data?.url) window.open(resolveMediaUrl(d.data.url), '_blank');
        }
      } catch (e) { /* swallow */ }
    })();
  }, [params, product]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1628]">
        <Loader2 className="text-secondary animate-spin" size={32} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a1628] text-white px-6">
        <p className="text-xl font-bold">This listing isn’t available.</p>
        <button onClick={() => navigate('/products')} className="mt-4 px-4 py-2 rounded-full bg-secondary text-primary font-semibold">
          Browse other listings
        </button>
      </div>
    );
  }

  const heroImg = (product.images || [])[0];
  // Iter 56b — share URL always points at the production brand domain.
  // We use the /api/share/* OG-aware backend route so WhatsApp/Twitter/iMessage
  // render preview cards, but anchor it to networkcapitalapp.co.za so the visible
  // URL is the canonical brand domain (NOT the preview/cluster pod URL).
  const shareUrl = `https://networkcapitalapp.co.za/api/share/p/${product.creator_username || username}/${product.slug || slug}`;
  const isGrowth = product.creator_type === 'growth';
  const fileAccess = product.file_access || 'free';

  const doShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, text: product.problem_solved, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Share link copied!');
      }
    } catch (e) { /* user cancelled */ }
  };

  const startDownload = async () => {
    if (!product.file_url) return;
    if (fileAccess === 'free') {
      window.open(resolveMediaUrl(product.file_url), '_blank');
      return;
    }
    if (fileAccess === 'email_gated') {
      setShowLeadForm(true);
      return;
    }
    if (fileAccess === 'paid') {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please sign in to purchase this file.');
        navigate('/auth');
        return;
      }
      setSubmitting(true);
      try {
        const res = await axiosInstance.post(`/products/${product.id}/file-checkout`);
        if (res.data?.url) window.location.href = res.data.url;
      } catch (e) {
        toast.error(e.response?.data?.detail || 'Could not start checkout.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const submitLead = async () => {
    if (!lead.name.trim() || !lead.email.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await axiosInstance.post(`/products/${product.id}/file-lead`, {
        name: lead.name.trim(), email: lead.email.trim(), phone: lead.phone.trim(),
      });
      if (res.data?.url) {
        toast.success('Thanks — your download is starting.');
        window.open(resolveMediaUrl(res.data.url), '_blank');
        setShowLeadForm(false);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not capture details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] text-white pb-24" data-testid="shared-product-page">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a1628]/85 backdrop-blur-lg border-b border-white/10 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10" data-testid="shared-back">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-sm font-bold flex-1 truncate">{product.name}</h1>
        <button
          onClick={doShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-primary text-xs font-bold"
          data-testid="shared-share-button"
        >
          <Share2 size={14} /> Share
        </button>
      </div>

      {/* Hero */}
      <div className="max-w-3xl mx-auto p-4 space-y-5">
        {heroImg && (
          <img
            src={resolveMediaUrl(heroImg)}
            alt={product.name}
            className="w-full max-h-[420px] object-cover rounded-2xl border border-white/10"
            data-testid="shared-hero-image"
          />
        )}

        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] uppercase tracking-wider">
              {product.type === 'service' ? 'Service' : 'Product'}
            </span>
            {product.classification && (
              <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-[10px] uppercase tracking-wider">
                {String(product.classification).replace('_', ' ')}
              </span>
            )}
            {isGrowth && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] uppercase tracking-wider">
                Growth Creator
              </span>
            )}
            {product.status !== 'approved' && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 text-[10px] uppercase tracking-wider">
                {product.status?.replace('_', ' ')}
              </span>
            )}
          </div>
          <h2 className="text-3xl font-heading font-bold" data-testid="shared-product-name">{product.name}</h2>
          {creator && (
            <p className="text-white/60 text-sm mt-1">
              by <span className="text-secondary font-semibold">@{creator.username}</span>
              {product.location && <> · <MapPin size={11} className="inline" /> {product.location}</>}
            </p>
          )}
        </div>

        {/* Download CTA */}
        {product.file_url && (
          <div className="rounded-2xl bg-white/5 border border-white/15 p-4" data-testid="shared-download-section">
            <div className="flex items-center gap-3">
              <FileText size={28} className="text-secondary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{product.file_name || 'Downloadable file'}</p>
                <p className="text-[11px] text-white/55">
                  {product.file_size_bytes ? formatBytes(product.file_size_bytes) : ''} · {product.file_mime || 'file'}
                </p>
              </div>
              {fileAccess === 'paid' && product.file_price ? (
                <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-200">
                  {product.currency || 'USD'} {Number(product.file_price).toFixed(2)}
                </span>
              ) : fileAccess === 'email_gated' ? (
                <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-200 inline-flex items-center gap-1"><Mail size={11} /> Email required</span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-200">Free</span>
              )}
            </div>
            <button
              onClick={startDownload}
              disabled={submitting}
              className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-secondary text-primary font-bold text-sm disabled:opacity-50"
              data-testid="shared-download-button"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> :
                fileAccess === 'paid' ? <Lock size={14} /> :
                fileAccess === 'email_gated' ? <Mail size={14} /> :
                <Download size={14} />
              }
              {fileAccess === 'paid' ? 'Buy & download' :
                fileAccess === 'email_gated' ? 'Get download link' :
                'Download now'}
            </button>
          </div>
        )}

        {/* Problem + Description */}
        {product.problem_solved && (
          <div>
            <p className="text-xs uppercase tracking-wider text-white/45 mb-1">What it does</p>
            <p className="text-white/85 whitespace-pre-wrap">{product.problem_solved}</p>
          </div>
        )}
        {product.description && (
          <div>
            <p className="text-xs uppercase tracking-wider text-white/45 mb-1">More details</p>
            <p className="text-white/75 whitespace-pre-wrap">{product.description}</p>
          </div>
        )}

        {/* Tags */}
        {product.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {product.tags.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-white/8 text-[11px] text-white/70 inline-flex items-center gap-1">
                <TagIcon size={10} /> {t}
              </span>
            ))}
          </div>
        )}

        {product.website && (
          <a
            href={product.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-secondary text-sm hover:underline"
            data-testid="shared-website-link"
          >
            <Globe size={14} /> {product.website}
          </a>
        )}

        {/* Support categories (Growth only) */}
        {isGrowth && product.support_needed && product.support_categories?.length > 0 && (
          <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-4">
            <p className="text-amber-300 text-sm font-semibold inline-flex items-center gap-1.5 mb-2">
              <Megaphone size={14} /> This creator is asking the community for…
            </p>
            <div className="flex flex-wrap gap-1.5">
              {product.support_categories.map((c) => (
                <span key={c} className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-100 text-[11px] capitalize">
                  {String(c).replace('_', ' ')}
                </span>
              ))}
            </div>
            {product.support_message && (
              <p className="text-white/80 text-sm mt-3">{product.support_message}</p>
            )}
          </div>
        )}

        {/* Counters */}
        <div className="flex items-center gap-4 text-[11px] text-white/45">
          <span>{product.view_count || 0} views</span>
          <span>·</span>
          <span>{product.download_count || 0} downloads</span>
        </div>
      </div>

      {/* Lead-form modal */}
      {showLeadForm && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowLeadForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-text-primary" onClick={(e) => e.stopPropagation()} data-testid="shared-lead-modal">
            <h3 className="text-lg font-heading font-bold mb-1">A few quick details</h3>
            <p className="text-xs text-text-muted mb-4">The creator will receive your contact so they can follow up. We will not spam you.</p>
            <div className="space-y-3">
              <input type="text" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} placeholder="Full name *" className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-primary outline-none" data-testid="lead-name" />
              <input type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} placeholder="Email *" className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-primary outline-none" data-testid="lead-email" />
              <input type="tel" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} placeholder="Phone (optional)" className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-primary outline-none" data-testid="lead-phone" />
            </div>
            <button onClick={submitLead} disabled={submitting} className="w-full mt-4 bg-primary text-white font-bold py-3 rounded-full disabled:opacity-50 inline-flex items-center justify-center gap-2" data-testid="lead-submit">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Get download link
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedProductPage;
