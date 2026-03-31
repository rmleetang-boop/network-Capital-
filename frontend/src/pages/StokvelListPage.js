import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, TrendingUp, Target, Calendar } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const StokvelListPage = ({ user }) => {
  const [stokvels, setStokvels] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStokvels();
  }, []);

  const fetchStokvels = async () => {
    try {
      const response = await axiosInstance.get('/stokvels');
      setStokvels(response.data);
    } catch (error) {
      toast.error('Failed to load stokvels');
    } finally {
      setLoading(false);
    }
  };

  const getStrengthLevel = (score) => {
    if (score <= 25) return { label: 'Low', color: 'text-red-600', bgColor: 'bg-red-50' };
    if (score <= 50) return { label: 'Medium', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    if (score <= 75) return { label: 'High', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    return { label: 'Strong', color: 'text-secondary', bgColor: 'bg-secondary/10' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-DEFAULT">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-primary">Stokvel+</h1>
            <p className="text-sm text-text-secondary">Group savings & contributions</p>
          </div>
          <button
            onClick={() => navigate('/stokvels/create')}
            className="bg-primary hover:bg-primary-hover text-white p-3 rounded-full shadow-md hover:shadow-lg active:scale-95 transition-all"
            data-testid="create-stokvel-button"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {stokvels.map((stokvel, index) => {
          const strength = getStrengthLevel(stokvel.group_strength);
          const progress = stokvel.target_amount > 0 
            ? (stokvel.total_pool / stokvel.target_amount) * 100 
            : 0;

          return (
            <motion.div
              key={stokvel.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(`/stokvels/${stokvel.id}`)}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all cursor-pointer"
              data-testid={`stokvel-card-${index}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-heading font-bold text-text-primary mb-1">
                    {stokvel.name}
                  </h3>
                  <p className="text-sm text-text-secondary line-clamp-2">
                    {stokvel.description}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full ${strength.bgColor}`}>
                  <span className={`text-xs font-semibold ${strength.color}`}>
                    {strength.label}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-text-secondary mb-1">
                    <Users size={14} />
                  </div>
                  <p className="text-lg font-bold text-text-primary">{stokvel.members.length}</p>
                  <p className="text-xs text-text-muted">Members</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-text-secondary mb-1">
                    <TrendingUp size={14} />
                  </div>
                  <p className="text-lg font-bold text-secondary">R{stokvel.total_pool.toFixed(2)}</p>
                  <p className="text-xs text-text-muted">Pool</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-text-secondary mb-1">
                    <Target size={14} />
                  </div>
                  <p className="text-lg font-bold text-primary">R{stokvel.target_amount.toFixed(2)}</p>
                  <p className="text-xs text-text-muted">Target</p>
                </div>
              </div>

              <div className="mb-2">
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span>Progress</span>
                  <span>{Math.min(progress, 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-secondary to-primary transition-all duration-500"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Calendar size={12} />
                <span>Payout: {stokvel.payout_cycle}</span>
              </div>
            </motion.div>
          );
        })}

        {stokvels.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-primary/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
              <Users className="text-primary" size={40} />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">No Stokvels Yet</h3>
            <p className="text-sm text-text-secondary mb-4">
              Create your first group savings stokvel
            </p>
            <button
              onClick={() => navigate('/stokvels/create')}
              className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-full font-medium transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              Create Stokvel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StokvelListPage;