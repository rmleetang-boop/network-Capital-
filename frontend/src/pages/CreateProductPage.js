import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  Lightbulb, 
  DollarSign, 
  Clock, 
  Users, 
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Target,
  Calendar,
  Upload,
  FileText,
  Globe,
  Tag as TagIcon,
  X,
  Loader2,
} from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { uploadMedia, validateMediaFile, formatBytes } from '../lib/mediaUpload';

const CLASSIFICATIONS = [
  { v: 'entrepreneur', label: 'Entrepreneur' },
  { v: 'freelancer', label: 'Freelancer' },
  { v: 'consultant', label: 'Consultant' },
  { v: 'coach', label: 'Coach' },
  { v: 'artist', label: 'Artist' },
  { v: 'developer', label: 'Developer' },
  { v: 'designer', label: 'Designer' },
  { v: 'agency', label: 'Agency' },
  { v: 'small_business', label: 'Small Business' },
  { v: 'startup', label: 'Startup' },
  { v: 'professional_service', label: 'Professional Service' },
  { v: 'other', label: 'Other' },
];

const SUPPORT_CATEGORIES = [
  { v: 'funding', label: 'Funding / Investment' },
  { v: 'partnerships', label: 'Strategic Partnerships' },
  { v: 'mentorship', label: 'Mentorship' },
  { v: 'customers', label: 'Customers / Leads' },
  { v: 'marketing', label: 'Marketing Exposure' },
  { v: 'team', label: 'Team Members' },
  { v: 'technical', label: 'Technical Assistance' },
  { v: 'distribution', label: 'Distribution Channels' },
  { v: 'other', label: 'Other' },
];

const CreateProductPage = ({ user }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [formData, setFormData] = useState({
    // Iter 52 — Creator type + classification at the start
    creator_type: user?.creator_type || 'independent',
    classification: user?.creator_classification || '',
    name: '',
    problem_solved: '',
    description: '',
    estimated_cost: '',
    timeline: '',
    interest_level: '',
    category: 'general',
    release_date: '',
    min_support: '10',
    max_support: '1000',
    images: [],
    // type / currency / availability
    type: 'product',
    currency: 'USD',
    availability: 'available_now',
    availability_days: '7',
    // Iter 52 new fields
    tags: [],
    website: '',
    contact_email: '',
    contact_phone: '',
    location: '',
    price_min: '',
    price_max: '',
    support_needed: false,
    support_categories: [],
    support_message: '',
    file_url: '',
    file_name: '',
    file_size_bytes: 0,
    file_mime: '',
    file_access: 'free',     // free | email_gated | paid
    file_price: '',
  });

  // Auto-default currency to creator's country on mount
  useEffect(() => {
    if (!user?.country) return;
    const COUNTRY_CURRENCY = {
      south_africa: 'ZAR', nigeria: 'NGN', kenya: 'KES', ghana: 'GHS',
    };
    const defaultCurrency = COUNTRY_CURRENCY[user.country] || 'USD';
    setFormData((p) => p.currency === 'USD' ? { ...p, currency: defaultCurrency } : p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.country]);

  const steps = [
    { id: 1, title: 'Product Info', icon: Package },
    { id: 2, title: 'Problem & Solution', icon: Lightbulb },
    { id: 3, title: 'Costs & Timeline', icon: Clock },
    { id: 4, title: 'Support Settings', icon: Users },
    { id: 5, title: 'Review & Submit', icon: Check }
  ];

  const categories = [
    { value: 'technology', label: 'Technology' },
    { value: 'fashion', label: 'Fashion & Apparel' },
    { value: 'food', label: 'Food & Beverage' },
    { value: 'health', label: 'Health & Wellness' },
    { value: 'education', label: 'Education' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'home', label: 'Home & Living' },
    { value: 'general', label: 'Other' }
  ];

  const interestLevels = [
    { value: 'idea', label: 'Just an idea', desc: 'Concept stage, gathering interest' },
    { value: 'prototype', label: 'Prototype ready', desc: 'Working prototype or samples' },
    { value: 'ready_to_launch', label: 'Ready to launch', desc: 'Product ready, need community support' }
  ];

  const timelines = [
    { value: '1_month', label: '1 Month' },
    { value: '3_months', label: '3 Months' },
    { value: '6_months', label: '6 Months' },
    { value: '12_months', label: '12 Months' },
    { value: 'ongoing', label: 'Ongoing' }
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleSupportCategory = (v) => {
    setFormData((p) => {
      const set = new Set(p.support_categories || []);
      if (set.has(v)) set.delete(v); else set.add(v);
      return { ...p, support_categories: Array.from(set) };
    });
  };

  const handleTagInput = (e) => {
    if (e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    const v = e.target.value.trim().replace(/[#,]/g, '').toLowerCase();
    if (!v) return;
    setFormData((p) => ({ ...p, tags: Array.from(new Set([...(p.tags || []), v])).slice(0, 12) }));
    e.target.value = '';
  };

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Allowed: PDF/PPT/DOC/XLS/EPUB/ZIP/TXT/MD/CSV
    setUploadingFile(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await axiosInstance.post('/uploads/file', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFormData((p) => ({
        ...p,
        file_url: res.data.url,
        file_name: res.data.file_name,
        file_size_bytes: res.data.size_bytes,
        file_mime: res.data.mime,
      }));
      toast.success(`Attached ${res.data.file_name} · ${formatBytes(res.data.size_bytes)}`);
    } catch (ex) {
      toast.error(ex?.response?.data?.detail || 'Could not upload that file.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleHeroImagePicked = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    for (const file of files) {
      const err = validateMediaFile(file, 'image');
      if (err) { toast.error(err); continue; }
      try {
        const { url } = await uploadMedia(file, { scope: 'products' });
        setFormData((p) => ({ ...p, images: [...(p.images || []), url].slice(0, 5) }));
      } catch (ex) {
        toast.error(ex?.response?.data?.detail || 'Image upload failed.');
      }
    }
  };

  const removeImage = (i) => setFormData((p) => ({ ...p, images: p.images.filter((_, idx) => idx !== i) }));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        ...formData,
        estimated_cost: parseFloat(formData.estimated_cost) || 0,
        min_support: parseFloat(formData.min_support) || 10,
        max_support: parseFloat(formData.max_support) || 1000,
        price_min: formData.price_min !== '' ? parseFloat(formData.price_min) : null,
        price_max: formData.price_max !== '' ? parseFloat(formData.price_max) : null,
        file_price: formData.file_access === 'paid' ? parseFloat(formData.file_price) || null : null,
        availability_days: formData.availability === 'available_in_days'
          ? Math.max(1, parseInt(formData.availability_days, 10) || 7)
          : null,
      };

      const res = await axiosInstance.post('/products', payload);
      const isIndependent = formData.creator_type === 'independent';
      toast.success(isIndependent ? 'Published! It is live on your profile.' : 'Submitted for review!');
      const p = res.data.product;
      // Prefer slug-based URL when present
      if (p?.creator_username && p?.slug) {
        navigate(`/p/${p.creator_username}/${p.slug}`);
      } else {
        navigate(`/products/${p.id}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name && formData.category;
      case 2:
        return formData.problem_solved;
      case 3:
        return formData.estimated_cost && formData.timeline && formData.interest_level;
      case 4:
        return formData.min_support && formData.max_support;
      default:
        return true;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-5">
            {/* Iter 52 — Creator Type chooser */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10" data-testid="creator-type-section">
              <p className="text-sm font-semibold text-white mb-1">How would you like to join?</p>
              <p className="text-[11px] text-white/55 mb-3">You can switch later from your profile.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { v: 'independent', label: 'Independent Creator', desc: 'Just showcase — publish instantly, no support requested.' },
                  { v: 'growth', label: 'Growth Creator', desc: 'I want support from the community — funding, mentors, partners or customers.' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, creator_type: opt.v, support_needed: opt.v === 'growth' ? p.support_needed : false }))}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.creator_type === opt.v
                        ? 'bg-secondary/20 border-secondary text-white'
                        : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'
                    }`}
                    data-testid={`creator-type-${opt.v}`}
                  >
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-[11px] text-white/60 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Classification */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">I am a…</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="classification-grid">
                {CLASSIFICATIONS.map((c) => (
                  <button
                    key={c.v}
                    type="button"
                    onClick={() => setFormData({ ...formData, classification: c.v })}
                    className={`px-3 py-2 rounded-xl border text-xs transition-all ${
                      formData.classification === c.v
                        ? 'bg-secondary/20 border-secondary text-white'
                        : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'
                    }`}
                    data-testid={`classification-${c.v}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-white/45 mt-2">This applies to this listing — your profile default stays untouched.</p>
            </div>

            {/* Type: Product or Service */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Listing type *</label>
              <div className="grid grid-cols-2 gap-2" data-testid="product-type-toggle">
                {[
                  { v: 'product', label: 'Product', desc: 'A physical or digital good' },
                  { v: 'service', label: 'Service', desc: 'A skill or experience you offer' },
                ].map((t) => (
                  <button
                    key={t.v}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: t.v })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.type === t.v
                        ? 'bg-secondary/20 border-secondary text-white'
                        : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'
                    }`}
                    data-testid={`product-type-${t.v}`}
                  >
                    <p className="font-semibold">{t.label}</p>
                    <p className="text-[11px] text-white/55 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">{formData.type === 'service' ? 'Service' : 'Product'} Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder={formData.type === 'service' ? 'What service are you offering?' : "What's your product called?"}
                className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                data-testid="product-name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Category *</label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.value })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.category === cat.value
                        ? 'bg-secondary/20 border-secondary text-white'
                        : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Short Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Briefly describe your product..."
                className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none resize-none"
              />
            </div>

            {/* Hero images (up to 5) */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Cover images (up to 5)</label>
              <div className="grid grid-cols-3 gap-2" data-testid="product-image-previews">
                {(formData.images || []).map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 group">
                    <img src={src.startsWith('http') || src.startsWith('data:') ? src : `${process.env.REACT_APP_BACKEND_URL}${src}`} alt={`hero-${i}`} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-black/65 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {(formData.images?.length || 0) < 5 && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-secondary text-white/40 text-[11px] text-center p-2" data-testid="product-image-picker">
                    <span>+ Add image</span>
                    <input type="file" accept="image/*" multiple onChange={handleHeroImagePicked} className="hidden" data-testid="product-image-input" />
                  </label>
                )}
              </div>
              <p className="text-[10px] text-white/40 mt-1">First image becomes the share preview / OG image.</p>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Tags / keywords</label>
              <input
                type="text"
                onKeyDown={handleTagInput}
                placeholder="Press Enter to add (e.g. ai, coaching, ebook)"
                className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                data-testid="product-tags-input"
              />
              {formData.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {formData.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/20 text-secondary text-[11px]">
                      #{t}
                      <button type="button" onClick={() => setFormData((p) => ({ ...p, tags: p.tags.filter((x) => x !== t) }))}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Website (optional)</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://yourwebsite.com"
                className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                data-testid="product-website"
              />
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                What problem does your product solve? *
              </label>
              <textarea
                name="problem_solved"
                value={formData.problem_solved}
                onChange={handleChange}
                rows={4}
                placeholder="Explain the problem your product addresses and how it helps people..."
                className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none resize-none"
                data-testid="problem-solved"
              />
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-secondary text-sm font-medium mb-2">Tips for a great description:</p>
              <ul className="text-white/60 text-sm space-y-1">
                <li>• Be specific about who benefits</li>
                <li>• Explain the current pain point</li>
                <li>• Describe your unique solution</li>
              </ul>
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Estimated Production Cost ($) *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                <input
                  type="number"
                  name="estimated_cost"
                  value={formData.estimated_cost}
                  onChange={handleChange}
                  placeholder="5000"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                  data-testid="estimated-cost"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Timeline *</label>
              <div className="grid grid-cols-3 gap-2">
                {timelines.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, timeline: t.value })}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      formData.timeline === t.value
                        ? 'bg-secondary/20 border-secondary text-white'
                        : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Current Stage *</label>
              <div className="space-y-2">
                {interestLevels.map(level => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, interest_level: level.value })}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      formData.interest_level === level.value
                        ? 'bg-secondary/20 border-secondary'
                        : 'bg-white/5 border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <p className="text-white font-medium">{level.label}</p>
                    <p className="text-white/60 text-sm">{level.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Availability *</label>
              <div className="grid grid-cols-2 gap-2" data-testid="availability-toggle">
                {[
                  { v: 'available_now', label: 'Available now', desc: 'Ships / starts immediately' },
                  { v: 'available_in_days', label: 'Available in N days', desc: 'Ready within a short window' },
                  { v: 'preorder', label: 'Pre-order', desc: 'Reserve now, fulfilled later' },
                  { v: 'on_request', label: 'On request', desc: 'Tailored — contact creator' },
                ].map((a) => (
                  <button
                    key={a.v}
                    type="button"
                    onClick={() => setFormData({ ...formData, availability: a.v })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.availability === a.v
                        ? 'bg-secondary/20 border-secondary text-white'
                        : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'
                    }`}
                    data-testid={`availability-${a.v}`}
                  >
                    <p className="font-semibold text-sm">{a.label}</p>
                    <p className="text-[11px] text-white/55 mt-0.5">{a.desc}</p>
                  </button>
                ))}
              </div>
              {formData.availability === 'available_in_days' && (
                <input
                  type="number"
                  min="1"
                  name="availability_days"
                  value={formData.availability_days}
                  onChange={handleChange}
                  placeholder="7"
                  className="w-full mt-2 px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                  data-testid="availability-days-input"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Listing currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white focus:border-secondary outline-none appearance-none cursor-pointer"
                data-testid="product-currency"
              >
                {['USD','EUR','GBP','ZAR','NGN','KES','GHS','JPY','CAD','AUD'].map((c) => (
                  <option key={c} value={c} className="bg-[#0a1628] text-white">{c}</option>
                ))}
              </select>
              <p className="text-[11px] text-white/50 mt-1">Auto-set to your country's currency. Editable.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Expected Release Date</label>
              <input
                type="date"
                name="release_date"
                value={formData.release_date}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white focus:border-secondary outline-none"
              />
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-5">
            {/* ── Downloadable file as product ─────────────────────────── */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10" data-testid="product-file-section">
              <p className="text-secondary text-sm font-medium mb-1 flex items-center gap-1.5">
                <FileText size={14} /> Sell or share a file (optional)
              </p>
              <p className="text-white/55 text-[11px] mb-3">
                PDF, slide deck, ebook, ZIP, or any document — up to 100 MB. Buyers / leads access it via your shareable link.
              </p>
              {formData.file_url ? (
                <div className="bg-white/10 rounded-xl p-3 flex items-center gap-3" data-testid="product-file-preview">
                  <FileText size={20} className="text-secondary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate font-medium">{formData.file_name}</p>
                    <p className="text-white/50 text-[11px]">{formatBytes(formData.file_size_bytes || 0)} · {formData.file_mime || 'file'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, file_url: '', file_name: '', file_size_bytes: 0, file_mime: '', file_price: '' }))}
                    className="text-white/70 hover:text-white p-1"
                    data-testid="product-file-remove"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="block border-2 border-dashed border-white/20 rounded-xl p-4 text-center cursor-pointer hover:border-secondary transition-all" data-testid="product-file-picker">
                  {uploadingFile ? (
                    <span className="text-white/70 text-sm inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Uploading…</span>
                  ) : (
                    <>
                      <Upload className="mx-auto mb-1 text-white/50" size={20} />
                      <p className="text-white/80 text-sm">Pick a file</p>
                      <p className="text-white/40 text-[10px]">PDF · PPT/PPTX · DOC/DOCX · XLS · EPUB · ZIP · TXT · MD · CSV</p>
                    </>
                  )}
                  <input type="file" onChange={handleFilePicked} className="hidden"
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.epub,.zip,.txt,.md,.csv,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/epub+zip,application/zip,text/plain,text/markdown,text/csv"
                    data-testid="product-file-input"
                  />
                </label>
              )}

              {formData.file_url && (
                <div className="mt-3 space-y-2" data-testid="file-access-section">
                  <p className="text-white/80 text-xs font-medium">Who can download it?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { v: 'free', label: 'Free', desc: 'Anyone with the link' },
                      { v: 'email_gated', label: 'Email-gated', desc: 'Capture name/email/phone' },
                      { v: 'paid', label: 'Paid', desc: 'Stripe checkout first' },
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setFormData({ ...formData, file_access: opt.v })}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          formData.file_access === opt.v
                            ? 'bg-secondary/20 border-secondary text-white'
                            : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'
                        }`}
                        data-testid={`file-access-${opt.v}`}
                      >
                        <p className="font-semibold text-xs">{opt.label}</p>
                        <p className="text-[10px] text-white/55 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                  {formData.file_access === 'paid' && (
                    <div>
                      <label className="block text-xs font-medium text-white/70 mt-2 mb-1">Price (in {formData.currency})</label>
                      <input
                        type="number"
                        name="file_price"
                        value={formData.file_price}
                        onChange={handleChange}
                        min="1"
                        step="0.01"
                        placeholder="e.g. 9.99"
                        className="w-full px-4 py-2.5 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                        data-testid="file-price-input"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Community support (Growth creators only) ─────────────── */}
            {formData.creator_type === 'growth' && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10" data-testid="support-section">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-secondary text-sm font-medium">Need community support?</p>
                    <p className="text-white/55 text-[11px]">Tap the categories of help you’d like — investors, mentors, partners, customers.</p>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!formData.support_needed}
                      onChange={(e) => setFormData({ ...formData, support_needed: e.target.checked })}
                      className="sr-only peer"
                      data-testid="support-needed-toggle"
                    />
                    <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:bg-secondary relative transition-all">
                      <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform"></span>
                    </div>
                  </label>
                </div>
                {formData.support_needed && (
                  <>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {SUPPORT_CATEGORIES.map((c) => {
                        const active = formData.support_categories?.includes(c.v);
                        return (
                          <button
                            key={c.v}
                            type="button"
                            onClick={() => toggleSupportCategory(c.v)}
                            className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                              active
                                ? 'bg-secondary/20 border-secondary text-white'
                                : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'
                            }`}
                            data-testid={`support-cat-${c.v}`}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      name="support_message"
                      value={formData.support_message}
                      onChange={handleChange}
                      rows={2}
                      placeholder="What kind of help would unlock the next step? (one or two sentences)"
                      className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none resize-none text-sm"
                      data-testid="support-message-input"
                    />
                  </>
                )}
              </div>
            )}

            {/* ── Legacy support amount range (still tracked) ──────────── */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Min support ({formData.currency})</label>
                <input
                  type="number"
                  name="min_support"
                  value={formData.min_support}
                  onChange={handleChange}
                  placeholder="10"
                  className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Max support ({formData.currency})</label>
                <input
                  type="number"
                  name="max_support"
                  value={formData.max_support}
                  onChange={handleChange}
                  placeholder="1000"
                  className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                />
              </div>
            </div>

            <p className="text-[11px] text-white/40">
              Support contributions are tracked transparently. This is community backing — not an investment.
            </p>
          </div>
        );
      
      case 5:
        return (
          <div className="space-y-5">
            <div className="bg-white/5 rounded-xl p-5 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">{formData.name || 'Your Product'}</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/60">Category</span>
                  <span className="text-white capitalize">{formData.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Estimated Cost</span>
                  <span className="text-white">${formData.estimated_cost || '0'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Timeline</span>
                  <span className="text-white capitalize">{formData.timeline?.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Stage</span>
                  <span className="text-white capitalize">{formData.interest_level?.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Support Range</span>
                  <span className="text-white">${formData.min_support} - ${formData.max_support}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-white/60 text-sm mb-2">Problem Solved:</p>
              <p className="text-white bg-white/5 rounded-xl p-4">{formData.problem_solved || 'Not provided'}</p>
            </div>

            <div className={`rounded-xl p-4 border ${formData.creator_type === 'independent' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-primary/30 border-primary/50'}`}>
              <p className="text-white text-sm">
                {formData.creator_type === 'independent' ? (
                  <><strong className="text-emerald-300">Independent Creator:</strong> Your listing publishes instantly — you can edit or take it down anytime.</>
                ) : (
                  <><strong className="text-secondary">Growth Creator:</strong> Your listing will be reviewed within 24–72 hours before going live. We’ll notify you the moment it’s approved.</>
                )}
              </p>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a1628]/95 backdrop-blur-lg border-b border-white/10 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
              <Sparkles className="text-primary" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-white">Create Product</h1>
              <p className="text-xs text-white/60">Share your idea with the community</p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    currentStep >= step.id 
                      ? 'bg-secondary text-primary' 
                      : 'bg-white/10 text-white/40'
                  }`}
                >
                  {currentStep > step.id ? <Check size={16} /> : <step.icon size={16} />}
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-8 h-1 mx-1 rounded ${currentStep > step.id ? 'bg-secondary' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {/* Step Title */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="text-2xl font-bold text-white mb-1">
            {steps[currentStep - 1]?.title}
          </h2>
          <p className="text-white/60">Step {currentStep} of {steps.length}</p>
        </motion.div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="flex-shrink-0 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-all flex items-center gap-2"
            >
              <ChevronLeft size={20} />
              Back
            </button>
          )}
          
          {currentStep < steps.length ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
              className="flex-1 py-3 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight size={20} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="submit-product"
            >
              {loading ? 'Submitting...' : formData.creator_type === 'independent' ? 'Publish now' : 'Submit for review'}
              <Check size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateProductPage;
