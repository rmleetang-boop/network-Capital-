// Iter 56 — Lean seller dashboard.
// 5 stat cards (Wallet, Total Sales, Active Orders, Product Views, Followers) +
// prominent "Sell Another Product" CTA + product list with status chips.
// Auto store name = "<First Name>'s Store" (customise from /store/customize).
import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Store as StoreIcon, Wallet, ShoppingBag, Eye, Users, Settings as SettingsIcon,
  ExternalLink, Copy, Check, QrCode, Loader2, Package, Sparkles, ChevronRight, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { axiosInstance } from '../App';
import { QRCodeSVG } from 'qrcode.react';

const SHARE_BASE_URL = 'https://networkcapitalapp.co.za';

const StatCard = ({ icon: Icon, label, value, suffix, accent, testid }) => (
  <div
    className={`flex-shrink-0 sm:flex-shrink rounded-2xl p-4 border bg-white shadow-sm min-w-[140px] ${accent}`}
    data-testid={testid}
  >
    <div className="flex items-center justify-between mb-1.5">
      <Icon size={16} className="text-text-secondary" />
    </div>
    <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">{label}</p>
    <p className="text-lg sm:text-xl font-heading font-bold text-text-primary leading-tight">
      {value}{suffix && <span className="text-xs text-text-muted ml-0.5 font-normal">{suffix}</span>}
    </p>
  </div>
);

const ProductRow = ({ product, currency, onClick, onDelete }) => {
  const img = (product.images || [])[0];
  const price = product.price_min || product.estimated_cost || 0;
  const statusChip =
    product.status === 'draft'      ? { label: 'Draft',         cls: 'bg-amber-100 text-amber-700 border-amber-200' } :
    product.status === 'approved'   ? { label: 'Live',          cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' } :
    product.status === 'pending_review' ? { label: 'In review', cls: 'bg-blue-100 text-blue-700 border-blue-200' } :
    { label: product.status, cls: 'bg-gray-100 text-gray-700 border-gray-200' };
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete?.(product);
  };
  return (
    <div className="flex items-stretch gap-1 group" data-testid={`mystore-product-row-${product.id}`}>
      <button
        onClick={onClick}
        className="flex-1 flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-2xl hover:border-primary/30 transition-all text-left"
        data-testid={`mystore-product-${product.id}`}
      >
        <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {img ? <img src={img} alt={product.name} className="w-full h-full object-cover" /> : <Package size={18} className="text-gray-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full border ${statusChip.cls}`}>
              {statusChip.label}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">{product.type === 'service' ? 'Service' : 'Product'}</span>
          </div>
          <p className="font-semibold text-sm text-text-primary truncate">{product.name}</p>
          <p className="text-[11px] text-text-muted">
            {currency} {Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {product.view_count > 0 && (
              <span className="ml-2"><Eye size={10} className="inline mr-0.5" />{product.view_count}</span>
            )}
          </p>
        </div>
        <ChevronRight size={16} className="text-text-muted flex-shrink-0" />
      </button>
      <button
        onClick={handleDeleteClick}
        className="px-3 rounded-2xl bg-white border border-gray-100 text-red-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all flex items-center justify-center flex-shrink-0"
        data-testid={`mystore-product-delete-${product.id}`}
        aria-label={`Delete ${product.name}`}
        title="Delete product"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
};

const MyStorePage = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [filter, setFilter] = useState('all');     // all | live | drafts
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const username = user?.username;
  const storeUrl = `${SHARE_BASE_URL}/store/${username || ''}`;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [dashRes, allRes] = await Promise.all([
          axiosInstance.get('/products/me/dashboard'),
          axiosInstance.get('/products/my'),
        ]);
        setData(dashRes.data);
        setAllProducts(allRes.data.products || []);
      } catch (e) {
        toast.error('Could not load your store');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredProducts = useMemo(() => {
    if (filter === 'live')   return allProducts.filter((p) => p.status === 'approved');
    if (filter === 'drafts') return allProducts.filter((p) => p.status === 'draft');
    return allProducts;
  }, [filter, allProducts]);

  const copyStoreLink = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      toast.success('Store link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy');
    }
  };

  const handleDelete = async (product) => {
    const ok = window.confirm(`Delete "${product.name}"? It will be removed from your store immediately. You can ask an admin to restore it later.`);
    if (!ok) return;
    try {
      await axiosInstance.delete(`/products/${product.id}`);
      setAllProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast.success('Product deleted');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not delete product');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  const currency = (allProducts[0]?.currency) || 'USD';

  return (
    <div className="min-h-screen bg-gray-50 pb-24" data-testid="my-store-page">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-white px-4 pt-6 pb-8 sm:rounded-b-3xl">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 rounded-full bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
                <StoreIcon size={22} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider opacity-70">My store</p>
                <h1 className="font-heading font-bold text-xl sm:text-2xl truncate" data-testid="mystore-name">{data?.store_name || `${user?.full_name?.split(' ')[0] || 'My'}'s Store`}</h1>
                <p className="text-[11px] opacity-80 truncate">{storeUrl}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/store/customize')}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 flex-shrink-0"
              data-testid="mystore-customize-btn"
              aria-label="Customise store"
            >
              <SettingsIcon size={16} />
            </button>
          </div>

          {/* Quick action row */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate('/products/create')}
              className="px-4 py-2.5 bg-white text-primary rounded-full text-sm font-bold inline-flex items-center gap-1.5 shadow"
              data-testid="mystore-sell-another"
            >
              <Plus size={14} /> Sell another product
            </button>
            <button
              onClick={copyStoreLink}
              className="px-3 py-2.5 bg-white/10 border border-white/20 text-white rounded-full text-xs font-semibold inline-flex items-center gap-1.5"
              data-testid="mystore-copy-link"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy link'}
            </button>
            <button
              onClick={() => setShowQR((s) => !s)}
              className="px-3 py-2.5 bg-white/10 border border-white/20 text-white rounded-full text-xs font-semibold inline-flex items-center gap-1.5"
              data-testid="mystore-qr-toggle"
            >
              <QrCode size={12} /> {showQR ? 'Hide QR' : 'Store QR'}
            </button>
            <a
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2.5 bg-white/10 border border-white/20 text-white rounded-full text-xs font-semibold inline-flex items-center gap-1.5"
              data-testid="mystore-open-public"
            >
              <ExternalLink size={12} /> Open public
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-4 space-y-4">
        {showQR && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center gap-2" data-testid="mystore-qr-block">
            <QRCodeSVG value={storeUrl} size={180} level="M" includeMargin fgColor="#0a0e1f" bgColor="#ffffff" />
            <p className="text-[10px] text-text-muted text-center">Scan to open your store · long-press image to save</p>
          </div>
        )}

        {/* Stat cards — scroll horizontally on mobile */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:grid sm:grid-cols-5 sm:overflow-visible scrollbar-hide" data-testid="mystore-stats">
          <StatCard icon={Wallet}       label="Wallet"        value={`${currency} ${Number(data?.wallet_balance || 0).toFixed(2)}`} accent="border-emerald-100" testid="stat-wallet" />
          <StatCard icon={ShoppingBag}  label="Total sales"   value={`${currency} ${Number(data?.total_sales || 0).toFixed(2)}`} suffix={data?.sales_count ? ` · ${data.sales_count}` : ''} accent="border-primary/20" testid="stat-sales" />
          <StatCard icon={Sparkles}     label="Active orders" value={data?.active_orders || 0} accent="border-amber-100" testid="stat-orders" />
          <StatCard icon={Eye}          label="Views"         value={data?.product_views || 0} accent="border-blue-100" testid="stat-views" />
          <StatCard icon={Users}        label="Followers"     value={data?.followers_count || 0} accent="border-violet-100" testid="stat-followers" />
        </div>

        {/* Products */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-bold text-base">Your products</h2>
            <div className="flex items-center gap-1 text-[11px]">
              {[
                { v: 'all',    label: 'All' },
                { v: 'live',   label: `Live (${data?.product_count || 0})` },
                { v: 'drafts', label: `Drafts (${data?.draft_count || 0})` },
              ].map((tab) => (
                <button
                  key={tab.v}
                  onClick={() => setFilter(tab.v)}
                  className={`px-2.5 py-1 rounded-full font-semibold ${filter === tab.v ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'}`}
                  data-testid={`mystore-filter-${tab.v}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 px-4" data-testid="mystore-empty">
              <div className="h-14 w-14 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                <Package size={22} className="text-gray-400" />
              </div>
              <p className="font-semibold text-text-primary mb-1">No products yet</p>
              <p className="text-xs text-text-muted mb-4">Sell your first product or service in under 2 minutes.</p>
              <button
                onClick={() => navigate('/products/create')}
                className="px-4 py-2.5 bg-primary text-white rounded-full text-sm font-bold inline-flex items-center gap-1.5"
                data-testid="mystore-empty-cta"
              >
                <Plus size={14} /> Start selling
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProducts.map((p) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  currency={p.currency || currency}
                  onClick={() => navigate(`/p/${p.creator_username || username}/${p.slug}`)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Customise / Creative Services secondary card */}
        <div className="rounded-2xl p-4 border border-dashed border-gray-300 bg-white text-xs flex items-start justify-between gap-3" data-testid="mystore-creative-cta">
          <div>
            <p className="font-semibold text-text-primary mb-0.5">Need help growing your sales?</p>
            <p className="text-text-muted leading-snug">Branding · Marketing · Advertising · Customer Support · Sales Growth.</p>
            <a href="mailto:creative@networkcapitalapp.co.za?subject=Creative%20Services%20enquiry" className="inline-flex items-center gap-1 text-primary font-bold mt-1">
              creative@networkcapitalapp.co.za <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyStorePage;
