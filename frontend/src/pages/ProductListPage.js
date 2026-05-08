import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  Users, 
  DollarSign,
  Clock,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../App';
import FeatureIntroModal from '../components/FeatureIntroModal';

const ProductListPage = ({ user }) => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { value: 'all', label: 'All' },
    { value: 'technology', label: 'Technology' },
    { value: 'fashion', label: 'Fashion' },
    { value: 'food', label: 'Food' },
    { value: 'health', label: 'Health' },
    { value: 'education', label: 'Education' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'home', label: 'Home' },
    { value: 'general', label: 'Other' }
  ];

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  const fetchProducts = async () => {
    try {
      const params = selectedCategory !== 'all' ? `?category=${selectedCategory}` : '';
      const res = await axiosInstance.get(`/products${params}`);
      setProducts(res.data.products);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.problem_solved?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] pb-24">
      <FeatureIntroModal
        featureKey="products"
        icon={<Sparkles size={20} />}
        title="Products & Creators"
        subtitle="Discover what members in your community are building, and back the work you believe in."
        bullets={[
          { icon: <Package size={14} />, label: 'Browse by category', body: 'Filter by tech, fashion, food, education, and more.' },
          { icon: <Users size={14} />, label: 'Follow creators', body: 'Following grows your social-capital network and unlocks creator tiers.' },
          { icon: <Plus size={14} />, label: 'Create your own', body: 'Members on the Creator track can list a product and grow an audience here.' },
        ]}
      />
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a1628]/95 backdrop-blur-lg border-b border-white/10 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
                <Sparkles className="text-primary" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-heading font-bold text-white">Products</h1>
                <p className="text-xs text-white/60">Discover & support creators</p>
              </div>
            </div>
            {user && (
              <button
                onClick={() => navigate('/products/create')}
                className="bg-secondary hover:bg-secondary-hover text-primary font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                data-testid="create-product"
              >
                <Plus size={18} />
                Create
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-12 pr-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
            />
          </div>

          {/* Category Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {categories.map(cat => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.value
                    ? 'bg-secondary text-primary'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <Package className="mx-auto mb-4 text-white/30" size={64} />
            <h3 className="text-xl font-bold text-white mb-2">No products yet</h3>
            <p className="text-white/60 mb-6">Be the first to create a product!</p>
            {user && (
              <button
                onClick={() => navigate('/products/create')}
                className="bg-gradient-to-r from-secondary to-yellow-500 text-primary font-semibold px-6 py-3 rounded-xl transition-all"
              >
                Create Product
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => navigate(`/products/${product.id}`)}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20 cursor-pointer hover:bg-white/15 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-secondary to-primary rounded-xl flex items-center justify-center flex-shrink-0">
                    <Package className="text-white" size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-secondary text-xs font-medium uppercase tracking-wide">
                        {product.category}
                      </span>
                      <span className="text-white/30">•</span>
                      <span className="text-white/50 text-xs capitalize">
                        {product.interest_level?.replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white group-hover:text-secondary transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-white/60 text-sm mt-1 line-clamp-2">
                      {product.problem_solved}
                    </p>
                    
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1 text-white/50 text-sm">
                        <Users size={14} />
                        <span>{product.total_supporters || 0} supporters</span>
                      </div>
                      <div className="flex items-center gap-1 text-green-400 text-sm">
                        <DollarSign size={14} />
                        <span>${product.total_support_amount?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-white/50 text-sm">
                        <Clock size={14} />
                        <span className="capitalize">{product.timeline?.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="text-white/30 group-hover:text-secondary transition-colors flex-shrink-0" size={20} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default ProductListPage;
