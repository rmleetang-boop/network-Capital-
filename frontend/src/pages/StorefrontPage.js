// Iter 56 — Public buyer-facing storefront at /store/:username.
// Browse, search, filter by category, view seller info, follow, contact,
// share store. Hides drafts/pending products. Mobile-first.
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Store as StoreIcon, Search, Share2, Copy, Check, MessageCircle, UserPlus, UserCheck,
  Eye, Loader2, Package, ChevronRight, ExternalLink, MapPin, BadgeCheck, ArrowLeft,
} from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const SHARE_BASE_URL = 'https://networkcapitalapp.co.za';

const CATEGORY_LABELS = {
  general: 'General', tech: 'Tech', fashion: 'Fashion', food: 'Food', services: 'Services',
  beauty: 'Beauty', health: 'Health', education: 'Education', home: 'Home', art: 'Art',
};

const StorefrontPage = ({ user }) => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const storeUrl = `${SHARE_BASE_URL}/store/${username}`;
  const isOwner = !!(user && user.username && user.username.toLowerCase() === (username || '').toLowerCase());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/storefront/${username}`);
        setStore(res.data.store);
        setProducts(res.data.products || []);
        setFollowerCount(res.data.store?.follower_count || 0);
        // Only auth'd, non-owner viewers can know their own follow state
        if (user && !isOwner) {
          try {
            const fs = await axiosInstance.get(`/storefront/${username}/follow-status`);
            setFollowing(!!fs.data.following);
            setFollowerCount(fs.data.follower_count || 0);
          } catch { /* non-fatal */ }
        }
      } catch (e) {
        if (e.response?.status === 404) toast.error('Store not found');
        else toast.error('Could not load store');
      } finally {
        setLoading(false);
      }
    };
    if (username) load();
  }, [username, user, isOwner]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || 'general'));
    return ['all', ...Array.from(set)];
  }, [products]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== 'all' && (p.category || 'general') !== category) return false;
      if (!term) return true;
      return (
        (p.name || '').toLowerCase().includes(term) ||
        (p.description || '').toLowerCase().includes(term) ||
        (p.problem_solved || '').toLowerCase().includes(term) ||
        (p.tags || []).join(' ').toLowerCase().includes(term)
      );
    });
  }, [products, category, search]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      toast.success('Store link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy');
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: store?.name || 'Store',
          text: `Check out ${store?.name || 'this store'} on Network Capital`,
          url: storeUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  const toggleFollow = async () => {
    if (!user) {
      toast.error('Sign in to follow this seller');
      return;
    }
    if (isOwner || followBusy) return;
    setFollowBusy(true);
    try {
      const res = await axiosInstance.post(`/storefront/${username}/follow`);
      setFollowing(!!res.data.following);
      setFollowerCount(res.data.follower_count || 0);
      toast.success(res.data.following ? `Following ${store?.name || 'this store'}` : 'Unfollowed');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not update follow');
    } finally {
      setFollowBusy(false);
    }
  };

  const contactSeller = () => {
    if (!user) {
      toast.error('Sign in to contact this seller');
      return;
    }
    if (isOwner) return;
    // Open the DM thread with the seller
    navigate(`/messages/${store?.owner_username}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <StoreIcon size={32} className="mx-auto text-gray-400 mb-2" />
          <p className="font-semibold text-text-primary mb-1">Store not found</p>
          <button onClick={() => navigate('/products')} className="text-xs text-primary font-semibold">Browse all products</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20" data-testid="storefront-page">
      {/* Cover header */}
      <div className="relative bg-gradient-to-br from-primary to-primary/70 text-white">
        {store.cover && (
          <img src={store.cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        )}
        <div className="relative max-w-4xl mx-auto px-4 pt-4 pb-8">
          <button onClick={() => navigate(-1)} className="text-[11px] inline-flex items-center gap-1 text-white/80 hover:text-white mb-3" data-testid="storefront-back">
            <ArrowLeft size={12} /> Back
          </button>
          <div className="flex items-end gap-4">
            <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur border-2 border-white/30 overflow-hidden flex items-center justify-center flex-shrink-0">
              {store.owner_photo ? (
                <img src={store.owner_photo} alt={store.name} className="w-full h-full object-cover" />
              ) : (
                <StoreIcon size={28} className="text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <h1 className="font-heading font-bold text-xl sm:text-2xl truncate" data-testid="storefront-name">{store.name}</h1>
                {store.owner_premium && <BadgeCheck size={16} className="text-yellow-300 flex-shrink-0" aria-label="Premium" />}
              </div>
              <p className="text-[11px] opacity-80 truncate" data-testid="storefront-owner">
                @{store.owner_username}
                {store.city && <span> · <MapPin size={10} className="inline mb-px" /> {store.city}{store.country ? `, ${store.country}` : ''}</span>}
              </p>
              {store.bio && <p className="text-xs opacity-90 mt-1 line-clamp-2">{store.bio}</p>}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!isOwner ? (
              <>
                <button onClick={toggleFollow} disabled={followBusy} className={`px-3 py-2 rounded-full text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60 ${following ? 'bg-white text-primary' : 'bg-white/15 border border-white/20 text-white'}`} data-testid="storefront-follow">
                  {followBusy ? <Loader2 size={12} className="animate-spin" /> : (following ? <UserCheck size={12} /> : <UserPlus size={12} />)}
                  {following ? 'Following' : 'Follow'}
                </button>
                <button onClick={contactSeller} className="px-3 py-2 rounded-full bg-white/15 border border-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5" data-testid="storefront-contact">
                  <MessageCircle size={12} /> Contact seller
                </button>
              </>
            ) : (
              <button onClick={() => navigate('/my-store')} className="px-3 py-2 rounded-full bg-white text-primary text-xs font-bold inline-flex items-center gap-1.5" data-testid="storefront-own-edit">
                <StoreIcon size={12} /> My store dashboard
              </button>
            )}
            <button onClick={nativeShare} className="px-3 py-2 rounded-full bg-white/15 border border-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5" data-testid="storefront-share">
              <Share2 size={12} /> Share
            </button>
            <button onClick={copyLink} className="px-3 py-2 rounded-full bg-white/15 border border-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5" data-testid="storefront-copy">
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>

          <div className="mt-4 flex items-center gap-4 text-[11px] opacity-90">
            <span>{store.product_count} products</span>
            <span data-testid="storefront-follower-count">{followerCount} followers</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
        {/* Search + categories */}
        <div className="flex flex-col gap-3 sticky top-0 z-10 bg-gray-50 pt-2 pb-2 -mx-4 px-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search this store…"
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-full text-sm outline-none focus:border-primary"
              data-testid="storefront-search"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto -mx-4 px-4 scrollbar-hide" data-testid="storefront-categories">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold ${category === c ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-text-secondary hover:border-primary/30'}`}
                data-testid={`storefront-category-${c}`}
              >
                {CATEGORY_LABELS[c] || c}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        {visibleProducts.length === 0 ? (
          <div className="text-center py-12 px-4" data-testid="storefront-empty">
            <Package size={28} className="mx-auto text-gray-400 mb-2" />
            <p className="font-semibold text-text-primary mb-1">No products yet</p>
            <p className="text-xs text-text-muted">{isOwner ? 'Publish your first product to fill this store.' : 'Check back soon.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="storefront-products">
            {visibleProducts.map((p) => {
              const img = (p.images || [])[0];
              const price = p.price_min || p.estimated_cost || 0;
              const currency = p.currency || 'USD';
              return (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => navigate(`/p/${p.creator_username || username}/${p.slug}`)}
                  className="bg-white rounded-2xl overflow-hidden border border-gray-100 text-left hover:border-primary/30 transition-all shadow-sm"
                  data-testid={`storefront-product-${p.id}`}
                >
                  <div className="aspect-square bg-gray-100 overflow-hidden">
                    {img ? <img src={img} alt={p.name} className="w-full h-full object-cover" /> : (
                      <div className="w-full h-full flex items-center justify-center"><Package size={22} className="text-gray-400" /></div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-[9px] uppercase tracking-wider text-text-muted mb-0.5">{p.type === 'service' ? 'Service' : 'Product'}</p>
                    <p className="font-semibold text-sm text-text-primary line-clamp-1">{p.name}</p>
                    {price > 0 && (
                      <p className="text-primary font-bold text-xs mt-0.5">
                        {currency} {Number(price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    )}
                    {p.view_count > 0 && (
                      <p className="text-[10px] text-text-muted mt-0.5"><Eye size={9} className="inline mr-0.5" />{p.view_count}</p>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StorefrontPage;
