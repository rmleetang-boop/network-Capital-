// Iter 56 — Lean Independent-creator product flow.
// Two modes:
//   1. Step-by-step (default) — 4 screens: Name+Image → Price+Currency → Description → Publish
//   2. Quick Sell — single screen with Photo, Name, Description, Price → Publish Instantly
// Auto-generates: storefront, product page, seller profile, shareable link, QR code,
// product card, product preview (via PublishSuccessModal).
// All financial-support / fundraising / AI assistant flows are intentionally OUT of scope.
import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Package, Briefcase, Image as ImageIcon, ChevronRight, ChevronLeft, Check, Sparkles,
  X, Loader2, Upload, Zap, ListChecks, Settings2, Plus, Save, Send, AlertCircle,
} from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { uploadMedia, validateMediaFile, formatBytes } from '../lib/mediaUpload';
import PublishSuccessModal from '../components/PublishSuccessModal';

const CURRENCIES = [
  { v: 'USD', label: 'USD · US Dollar' },
  { v: 'ZAR', label: 'ZAR · S. African Rand' },
  { v: 'NGN', label: 'NGN · Nigerian Naira' },
  { v: 'KES', label: 'KES · Kenyan Shilling' },
  { v: 'GHS', label: 'GHS · Ghanaian Cedi' },
  { v: 'EUR', label: 'EUR · Euro' },
  { v: 'GBP', label: 'GBP · British Pound' },
];

const CATEGORIES = [
  { v: 'general', label: 'General' },
  { v: 'tech', label: 'Tech' },
  { v: 'fashion', label: 'Fashion' },
  { v: 'food', label: 'Food' },
  { v: 'services', label: 'Services' },
  { v: 'beauty', label: 'Beauty' },
  { v: 'health', label: 'Health' },
  { v: 'education', label: 'Education' },
  { v: 'home', label: 'Home' },
  { v: 'art', label: 'Art' },
];

const AVAILABILITY_OPTIONS = [
  { v: 'available_now',    label: 'Available now' },
  { v: 'available_in_days', label: 'Available in X days' },
  { v: 'preorder',         label: 'Pre-order' },
  { v: 'on_request',       label: 'On request' },
];

const COUNTRY_DEFAULT_CURRENCY = {
  south_africa: 'ZAR', nigeria: 'NGN', kenya: 'KES', ghana: 'GHS',
};

const CreateProductPage = ({ user }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const defaultCurrency = COUNTRY_DEFAULT_CURRENCY[user?.country?.toLowerCase()] || 'USD';

  // Mode: 'quick' (single screen) or 'wizard' (4 steps)
  const [mode, setMode] = useState('wizard');
  const [step, setStep] = useState(0);   // 0 = kind chooser; 1-4 wizard steps; 1 = quick sell
  const [kind, setKind] = useState(null); // 'product' | 'service'
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [createdProduct, setCreatedProduct] = useState(null);
  const [createdIsDraft, setCreatedIsDraft] = useState(false);

  const [form, setForm] = useState({
    name: '',
    images: [],
    price: '',
    currency: defaultCurrency,
    description: '',
    problem_solved: '',
    category: 'general',
    // More Options (all optional)
    inventory_qty: '',
    shipping_options: '',     // newline separated → array
    refund_policy: '',
    availability: 'available_now',
    availability_days: '',
    variants: '',             // newline separated → [{name}]
    delivery_options: '',     // newline separated → array
    contact_email: '',
    contact_phone: '',
  });

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // ── Image upload ──────────────────────────────────────────────────────
  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateMediaFile(file, 'image');
    if (err) {
      toast.error(err);
      return;
    }
    setUploadingImage(true);
    try {
      const result = await uploadMedia(file);
      setField('images', [result.url]);
      toast.success(`Image added (${formatBytes(file.size)})`);
    } catch (e2) {
      toast.error('Could not upload image');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Validation per step ───────────────────────────────────────────────
  const canAdvance = useMemo(() => {
    if (step === 0) return !!kind;
    if (mode === 'quick') {
      return form.name.trim().length >= 2 && form.images.length > 0 &&
             form.description.trim().length >= 5 && Number(form.price) > 0;
    }
    if (step === 1) return form.name.trim().length >= 2 && form.images.length > 0;
    if (step === 2) return Number(form.price) > 0 && !!form.currency;
    if (step === 3) return form.description.trim().length >= 5;
    if (step === 4) return true;
    return false;
  }, [step, kind, mode, form]);

  // ── Submit ────────────────────────────────────────────────────────────
  const submit = async (publish = true) => {
    if (publishing) return;
    if (!canAdvance && mode === 'wizard') return;

    const price = Number(form.price) || 0;
    const variantsArr = form.variants
      ? form.variants.split('\n').map((s) => s.trim()).filter(Boolean).map((label) => ({ name: label }))
      : null;
    const shippingArr = form.shipping_options
      ? form.shipping_options.split('\n').map((s) => s.trim()).filter(Boolean).map((label) => ({ label }))
      : null;
    const deliveryArr = form.delivery_options
      ? form.delivery_options.split('\n').map((s) => s.trim()).filter(Boolean)
      : null;

    const payload = {
      name: form.name.trim(),
      type: kind || 'product',
      currency: form.currency,
      price_min: price,
      price_max: price,
      estimated_cost: price,
      description: form.description.trim(),
      problem_solved: form.problem_solved.trim() || form.description.trim(),
      category: form.category || 'general',
      images: form.images,
      publish,
      // More Options
      inventory_qty: form.inventory_qty ? Number(form.inventory_qty) : null,
      shipping_options: shippingArr,
      refund_policy: form.refund_policy.trim() || null,
      availability: form.availability,
      availability_days: form.availability === 'available_in_days' && form.availability_days
        ? Number(form.availability_days) : null,
      variants: variantsArr,
      delivery_options: deliveryArr,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
    };

    setPublishing(true);
    try {
      const res = await axiosInstance.post('/products', payload);
      setCreatedProduct(res.data.product);
      setCreatedIsDraft(!publish);
      toast.success(res.data.message || (publish ? 'Published' : 'Saved as draft'));
    } catch (e) {
      const msg = e.response?.data?.detail || 'Could not save product. Please try again.';
      toast.error(typeof msg === 'string' ? msg : 'Could not save product');
    } finally {
      setPublishing(false);
    }
  };

  // ── Reset for "Sell another" ──────────────────────────────────────────
  const resetForNext = () => {
    setCreatedProduct(null);
    setCreatedIsDraft(false);
    setKind(null);
    setStep(0);
    setForm({
      ...form, name: '', images: [], price: '', description: '', problem_solved: '',
      inventory_qty: '', shipping_options: '', refund_policy: '', variants: '',
      delivery_options: '', contact_email: '', contact_phone: '',
    });
    setShowMoreOptions(false);
  };

  // ── Layouts ───────────────────────────────────────────────────────────
  const Header = () => (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100" aria-label="Back" data-testid="create-back-btn">
          <X size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">{mode === 'quick' ? 'Quick sell' : 'Step-by-step'}</p>
          <p className="font-heading font-bold text-sm truncate">
            {kind === 'service' ? 'List a service' : kind === 'product' ? 'List a product' : 'New listing'}
          </p>
        </div>
        {mode === 'wizard' && step > 0 && (
          <button
            onClick={() => { setMode('quick'); setStep(1); }}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1"
            data-testid="create-switch-quick"
          >
            <Zap size={12} /> Quick sell
          </button>
        )}
        {mode === 'quick' && (
          <button
            onClick={() => { setMode('wizard'); setStep(kind ? 1 : 0); }}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-gray-100 text-text-secondary inline-flex items-center gap-1"
            data-testid="create-switch-wizard"
          >
            <ListChecks size={12} /> Step-by-step
          </button>
        )}
      </div>
      {/* Wizard progress */}
      {mode === 'wizard' && step > 0 && (
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className={`h-1 flex-1 rounded-full transition-colors ${n <= step ? 'bg-primary' : 'bg-gray-200'}`}
                data-testid={`create-progress-${n}`}
              />
            ))}
          </div>
          <p className="text-[11px] text-text-muted mt-1.5">Step {step} of 4</p>
        </div>
      )}
    </div>
  );

  // ── Kind chooser (step 0) ─────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-8" data-testid="create-step-kind">
          <h1 className="font-heading font-bold text-2xl sm:text-3xl mb-2">What are you listing?</h1>
          <p className="text-sm text-text-secondary mb-6">Choose one — you can change later in More Options.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { v: 'product', label: 'Product',  desc: 'Physical or digital goods', Icon: Package,  testid: 'create-kind-product' },
              { v: 'service', label: 'Service',  desc: 'Booked or delivered time',  Icon: Briefcase, testid: 'create-kind-service' },
            ].map((k) => (
              <button
                key={k.v}
                onClick={() => { setKind(k.v); setStep(1); }}
                className="text-left p-5 rounded-2xl bg-white border-2 border-gray-200 hover:border-primary transition-all shadow-sm"
                data-testid={k.testid}
              >
                <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <k.Icon size={22} />
                </div>
                <p className="font-heading font-bold text-base mb-0.5">{k.label}</p>
                <p className="text-xs text-text-muted">{k.desc}</p>
              </button>
            ))}
          </div>
          <div className="mt-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
            <Sparkles size={14} className="flex-shrink-0 mt-0.5" />
            <span>In a hurry? Tap <strong>Quick Sell</strong> after picking and publish in one screen.</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Quick Sell single-screen ──────────────────────────────────────────
  if (mode === 'quick') {
    return (
      <div className="min-h-screen bg-gray-50 pb-32">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-5" data-testid="create-quick-screen">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-amber-700 font-bold mb-1">Quick sell</p>
            <h1 className="font-heading font-bold text-xl mb-1">Publish in one screen</h1>
            <p className="text-xs text-text-muted">Photo, name, short description, price. That's it.</p>
          </div>

          {/* Photo */}
          <PhotoField form={form} setField={setField} fileInputRef={fileInputRef} onPick={handleImagePick} uploading={uploadingImage} />

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">{kind === 'service' ? 'Service' : 'Product'} name</label>
            <input
              value={form.name} onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Handmade leather wallet" maxLength={80}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
              data-testid="create-quick-name"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
            <textarea
              rows={3} value={form.description} onChange={(e) => setField('description', e.target.value)}
              placeholder="What is it and what makes it great?" maxLength={500}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary resize-none"
              data-testid="create-quick-description"
            />
          </div>

          {/* Price + currency */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-text-secondary mb-1">Price</label>
              <input
                type="number" inputMode="decimal" min="0" step="0.01"
                value={form.price} onChange={(e) => setField('price', e.target.value)}
                placeholder="0.00"
                className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
                data-testid="create-quick-price"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Currency</label>
              <select
                value={form.currency} onChange={(e) => setField('currency', e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary bg-white"
                data-testid="create-quick-currency"
              >
                {CURRENCIES.map((c) => <option key={c.v} value={c.v}>{c.v}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Sticky publish bar */}
        <StickyFooter>
          <button
            onClick={() => submit(true)}
            disabled={!canAdvance || publishing}
            className="w-full px-4 py-3.5 rounded-full bg-gradient-to-r from-primary to-primary/80 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
            data-testid="create-quick-publish"
          >
            {publishing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            Publish instantly
          </button>
        </StickyFooter>

        {createdProduct && (
          <PublishSuccessModal
            product={createdProduct}
            isDraft={createdIsDraft}
            onClose={() => navigate('/my-store')}
            onSellAnother={resetForNext}
          />
        )}
      </div>
    );
  }

  // ── Wizard steps 1-4 ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-5">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-5" data-testid="create-step-1">
              <div>
                <h1 className="font-heading font-bold text-2xl mb-1">What would you like to sell?</h1>
                <p className="text-sm text-text-muted">Give it a name and a photo.</p>
              </div>
              <PhotoField form={form} setField={setField} fileInputRef={fileInputRef} onPick={handleImagePick} uploading={uploadingImage} />
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">{kind === 'service' ? 'Service' : 'Product'} name</label>
                <input
                  value={form.name} onChange={(e) => setField('name', e.target.value)}
                  placeholder="e.g. Handmade leather wallet" maxLength={80}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
                  data-testid="create-step1-name"
                />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-5" data-testid="create-step-2">
              <div>
                <h1 className="font-heading font-bold text-2xl mb-1">How much are you selling it for?</h1>
                <p className="text-sm text-text-muted">Buyers will see this price on every share preview.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Price</label>
                  <input
                    type="number" inputMode="decimal" min="0" step="0.01"
                    value={form.price} onChange={(e) => setField('price', e.target.value)}
                    placeholder="0.00"
                    className="w-full p-3 border border-gray-200 rounded-xl text-base font-bold outline-none focus:border-primary"
                    data-testid="create-step2-price"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Currency</label>
                  <select
                    value={form.currency} onChange={(e) => setField('currency', e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary bg-white"
                    data-testid="create-step2-currency"
                  >
                    {CURRENCIES.map((c) => <option key={c.v} value={c.v}>{c.v}</option>)}
                  </select>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-5" data-testid="create-step-3">
              <div>
                <h1 className="font-heading font-bold text-2xl mb-1">Tell buyers about it</h1>
                <p className="text-sm text-text-muted">Short and honest works best.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Short description</label>
                <textarea
                  rows={3} value={form.description} onChange={(e) => setField('description', e.target.value)}
                  placeholder="What is it? What makes it special?" maxLength={500}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary resize-none"
                  data-testid="create-step3-description"
                />
                <p className="text-[10px] text-text-muted text-right mt-1">{form.description.length}/500</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">What problem does it solve?</label>
                <textarea
                  rows={2} value={form.problem_solved} onChange={(e) => setField('problem_solved', e.target.value)}
                  placeholder="The customer benefit in one or two sentences." maxLength={280}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary resize-none"
                  data-testid="create-step3-solution"
                />
                <p className="text-[10px] text-text-muted text-right mt-1">Optional · {form.problem_solved.length}/280</p>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-5" data-testid="create-step-4">
              <div>
                <h1 className="font-heading font-bold text-2xl mb-1">Ready to publish?</h1>
                <p className="text-sm text-text-muted">Quick review then go live. You can edit anytime.</p>
              </div>
              {/* Preview card */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm" data-testid="create-step4-preview">
                {form.images[0] && <div className="aspect-[16/10] bg-gray-100"><img src={form.images[0]} alt="" className="w-full h-full object-cover" /></div>}
                <div className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">{kind === 'service' ? 'Service' : 'Product'}</p>
                  <h3 className="font-heading font-bold text-base">{form.name || 'Untitled'}</h3>
                  {form.price && <p className="text-primary font-bold mt-1">{form.currency} {Number(form.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>}
                  {form.description && <p className="text-xs text-text-muted mt-2 line-clamp-3">{form.description}</p>}
                </div>
              </div>

              {/* Category quick pick */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.v}
                      onClick={() => setField('category', c.v)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border ${form.category === c.v ? 'bg-primary text-white border-primary' : 'bg-white text-text-secondary border-gray-200 hover:border-primary/30'}`}
                      data-testid={`create-step4-category-${c.v}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* More Options accordion */}
              <button
                onClick={() => setShowMoreOptions((s) => !s)}
                className="w-full px-3 py-3 rounded-xl border border-dashed border-gray-300 text-sm font-semibold inline-flex items-center justify-between bg-white"
                data-testid="create-more-options-toggle"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Settings2 size={14} /> More options {showMoreOptions ? '(collapse)' : '(optional)'}
                </span>
                <ChevronRight size={16} className={`transition-transform ${showMoreOptions ? 'rotate-90' : ''}`} />
              </button>

              {showMoreOptions && (
                <MoreOptionsPanel form={form} setField={setField} kind={kind} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky footer */}
      <StickyFooter>
        {step < 4 ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="px-4 py-3 rounded-full bg-gray-100 text-text-secondary font-semibold inline-flex items-center justify-center gap-1.5"
              data-testid="create-back"
            >
              <ChevronLeft size={14} /> Back
            </button>
            <button
              onClick={() => setStep((s) => Math.min(4, s + 1))}
              disabled={!canAdvance}
              className="flex-1 px-4 py-3 rounded-full bg-primary text-white font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              data-testid="create-next"
            >
              Continue <ChevronRight size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => submit(false)}
              disabled={publishing}
              className="flex-1 px-4 py-3 rounded-full bg-white border-2 border-primary text-primary font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              data-testid="create-save-draft"
            >
              <Save size={14} /> Save draft
            </button>
            <button
              onClick={() => submit(true)}
              disabled={publishing}
              className="flex-1 px-4 py-3 rounded-full bg-gradient-to-r from-primary to-primary/80 text-white font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-lg"
              data-testid="create-publish-now"
            >
              {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Publish now
            </button>
          </div>
        )}
      </StickyFooter>

      {createdProduct && (
        <PublishSuccessModal
          product={createdProduct}
          isDraft={createdIsDraft}
          onClose={() => navigate('/my-store')}
          onSellAnother={resetForNext}
        />
      )}
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────────────────────
const StickyFooter = ({ children }) => (
  <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-gray-100 px-4 py-3 safe-area-bottom">
    <div className="max-w-2xl mx-auto">{children}</div>
  </div>
);

const PhotoField = ({ form, setField, fileInputRef, onPick, uploading }) => {
  const img = form.images?.[0];
  return (
    <div>
      <label className="block text-xs font-semibold text-text-secondary mb-1">Photo</label>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={`relative w-full aspect-[16/10] rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-all ${img ? 'border-primary/30 bg-black' : 'border-gray-300 bg-gray-50 hover:border-primary/40'}`}
        data-testid="create-photo-input"
      >
        {img ? (
          <>
            <img src={img} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
              <Upload size={14} /> Replace photo
            </div>
          </>
        ) : uploading ? (
          <div className="flex flex-col items-center gap-2 text-text-muted">
            <Loader2 size={22} className="animate-spin text-primary" />
            <span className="text-xs">Uploading…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-text-muted">
            <ImageIcon size={22} />
            <span className="text-xs">Tap to add a photo</span>
            <span className="text-[10px] text-text-muted/70">JPG / PNG · up to 8MB</span>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      </button>
      {img && (
        <button
          onClick={() => setField('images', [])}
          className="text-[11px] text-red-600 font-semibold mt-2 inline-flex items-center gap-1"
          data-testid="create-photo-remove"
        >
          <X size={11} /> Remove photo
        </button>
      )}
    </div>
  );
};

const MoreOptionsPanel = ({ form, setField, kind }) => {
  const isProduct = kind !== 'service';
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4" data-testid="create-more-options-panel">
      {isProduct && (
        <>
          <Field label="Inventory (units available)">
            <input
              type="number" inputMode="numeric" min="0"
              value={form.inventory_qty} onChange={(e) => setField('inventory_qty', e.target.value)}
              placeholder="Leave blank for unlimited"
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
              data-testid="more-inventory"
            />
          </Field>
          <Field label="Shipping options (one per line)">
            <textarea
              rows={2} value={form.shipping_options} onChange={(e) => setField('shipping_options', e.target.value)}
              placeholder="Standard - R65&#10;Express - R150"
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary resize-none"
              data-testid="more-shipping"
            />
          </Field>
          <Field label="Product variants (one per line)">
            <textarea
              rows={2} value={form.variants} onChange={(e) => setField('variants', e.target.value)}
              placeholder="Small&#10;Medium&#10;Large"
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary resize-none"
              data-testid="more-variants"
            />
          </Field>
        </>
      )}
      {!isProduct && (
        <Field label="Delivery options (one per line)">
          <textarea
            rows={2} value={form.delivery_options} onChange={(e) => setField('delivery_options', e.target.value)}
            placeholder="In-person&#10;Online video call&#10;On-site"
            className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary resize-none"
            data-testid="more-delivery"
          />
        </Field>
      )}
      <Field label="Refund policy">
        <textarea
          rows={2} value={form.refund_policy} onChange={(e) => setField('refund_policy', e.target.value)}
          placeholder="e.g. 14-day returns on unopened items"
          className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary resize-none"
          data-testid="more-refund"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Availability">
          <select
            value={form.availability} onChange={(e) => setField('availability', e.target.value)}
            className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary bg-white"
            data-testid="more-availability"
          >
            {AVAILABILITY_OPTIONS.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
          </select>
        </Field>
        {form.availability === 'available_in_days' && (
          <Field label="In how many days?">
            <input
              type="number" inputMode="numeric" min="1"
              value={form.availability_days} onChange={(e) => setField('availability_days', e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
              data-testid="more-availability-days"
            />
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Contact email">
          <input
            type="email" inputMode="email"
            value={form.contact_email} onChange={(e) => setField('contact_email', e.target.value)}
            placeholder="hello@example.com"
            className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            data-testid="more-email"
          />
        </Field>
        <Field label="Contact phone">
          <input
            type="tel" inputMode="tel"
            value={form.contact_phone} onChange={(e) => setField('contact_phone', e.target.value)}
            placeholder="+27 ..."
            className="w-full p-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            data-testid="more-phone"
          />
        </Field>
      </div>
      <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
        <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
        Need help with branding, marketing, or sales? Email{' '}
        <a href="mailto:creative@networkcapitalapp.co.za?subject=Creative%20Services" className="text-primary font-bold underline">creative@networkcapitalapp.co.za</a>
        {' '}— optional, paid Creative Services.
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-semibold text-text-secondary mb-1">{label}</label>
    {children}
  </div>
);

export default CreateProductPage;
