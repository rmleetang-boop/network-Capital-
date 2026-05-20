import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, Shield, DollarSign, PiggyBank } from 'lucide-react';
import { axiosInstance } from '../App';
import CreditGrantModal from '../components/CreditGrantModal';

const AdminStokvelsPage = ({ user }) => {
  const navigate = useNavigate();
  const [stokvels, setStokvels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [creditTarget, setCreditTarget] = useState(null);

  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator');

  const load = async () => {
    setLoading(true);
    try {
      const params = q.trim() ? { q: q.trim() } : {};
      const r = await axiosInstance.get('/admin/stokvels', { params });
      setStokvels(r.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line */ }, []);

  if (!isAdmin) {
    return (
      <div className="min-h-screen p-10 text-center text-text-muted">
        <Shield size={28} className="mx-auto text-primary mb-2" />
        Admin access only.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="admin-stokvels-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate('/admin/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-heading font-bold text-primary flex-1">Stokvel oversight</h1>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="Search stokvels"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm outline-none focus:border-primary"
              data-testid="admin-stokvels-search"
            />
          </div>
          <button onClick={load} className="bg-primary text-white text-xs font-semibold px-3 py-2 rounded-full" data-testid="admin-stokvels-go">Go</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>
        ) : stokvels.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-text-muted text-sm">No stokvels.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {stokvels.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3" data-testid={`admin-stokvel-row-${s.id}`}>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center">
                  <PiggyBank size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.name}</p>
                  <p className="text-[11px] text-text-muted truncate">
                    {s.member_count || 0} member{s.member_count === 1 ? '' : 's'} · Pool ${(s.total_pool || 0).toFixed(2)} / target ${(s.target_amount || 0).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => setCreditTarget({ id: s.id, label: s.name })}
                  className="bg-secondary text-primary text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1"
                  data-testid={`admin-stokvel-credit-${s.id}`}>
                  <DollarSign size={11} /> Adjust pool
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {creditTarget && (
        <CreditGrantModal
          targetType="stokvel"
          targetId={creditTarget.id}
          targetLabel={creditTarget.label}
          onClose={() => setCreditTarget(null)}
          onApplied={load}
        />
      )}
    </div>
  );
};

export default AdminStokvelsPage;
