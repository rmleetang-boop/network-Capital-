import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Briefcase, PiggyBank, Check, X, UserPlus, ArrowLeft, Loader2 } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const KINDS = [
  { v: 'social',       l: 'Social',       icon: Users,      tone: 'from-indigo-500 to-blue-500',  desc: 'Friends & people you follow' },
  { v: 'professional', l: 'Professional', icon: Briefcase,  tone: 'from-amber-500 to-orange-500', desc: 'Colleagues, mentors, partners' },
  { v: 'financial',    l: 'Financial',    icon: PiggyBank,  tone: 'from-emerald-500 to-teal-500', desc: 'Stokvel & co-savings partners' },
];

const NetworkPage = ({ user }) => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState({ counts: { social: 0, professional: 0, financial: 0 }, total: 0, pending_incoming: 0 });
  const [tab, setTab] = useState('social'); // social | professional | financial | requests
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSummary = async () => {
    try {
      const r = await axiosInstance.get('/connections/me/summary');
      setSummary(r.data);
    } catch { /* ignore */ }
  };

  const loadList = async () => {
    setLoading(true);
    try {
      if (tab === 'requests') {
        const r = await axiosInstance.get('/connections/me', { params: { status_filter: 'incoming' } });
        setItems(r.data || []);
      } else {
        const r = await axiosInstance.get('/connections/me', { params: { kind: tab, status_filter: 'accepted' } });
        setItems(r.data || []);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not load connections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSummary(); }, []);
  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, [tab]);

  const accept = async (id) => {
    try {
      await axiosInstance.post(`/connections/${id}/accept`);
      toast.success('Connected! +25 each');
      loadSummary(); loadList();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not accept');
    }
  };
  const reject = async (id) => {
    try {
      await axiosInstance.post(`/connections/${id}/reject`);
      loadSummary(); loadList();
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="network-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-heading font-bold text-primary flex-1">My Network</h1>
        {summary.pending_incoming > 0 && (
          <button
            onClick={() => setTab('requests')}
            className="bg-secondary text-primary font-bold px-3 py-1 rounded-full text-xs"
            data-testid="incoming-requests-badge">
            {summary.pending_incoming} new
          </button>
        )}
      </div>

      <div className="max-w-3xl mx-auto p-4">
        <div className="grid grid-cols-3 gap-3 mb-4" data-testid="network-summary-cards">
          {KINDS.map((k) => {
            const Icon = k.icon;
            const count = summary.counts?.[k.v] || 0;
            return (
              <button
                key={k.v}
                onClick={() => setTab(k.v)}
                className={`relative rounded-2xl p-4 text-white text-left bg-gradient-to-br ${k.tone} ${tab === k.v ? 'ring-2 ring-secondary' : ''} active:scale-95 transition-transform`}
                data-testid={`network-card-${k.v}`}>
                <Icon size={18} className="mb-1.5 opacity-80" />
                <p className="text-2xl font-heading font-bold leading-none">{count}</p>
                <p className="text-[11px] uppercase tracking-wider font-bold opacity-90 mt-1">{k.l}</p>
                <p className="text-[10px] opacity-75 mt-0.5 line-clamp-1">{k.desc}</p>
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4" data-testid="network-list">
          <div className="flex items-center gap-2 mb-3 overflow-x-auto">
            {KINDS.map((k) => (
              <button
                key={k.v}
                onClick={() => setTab(k.v)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === k.v ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'}`}
                data-testid={`network-tab-${k.v}`}>
                {k.l}
              </button>
            ))}
            <button
              onClick={() => setTab('requests')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1 ${tab === 'requests' ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'}`}
              data-testid="network-tab-requests">
              <UserPlus size={11} /> Requests {summary.pending_incoming > 0 ? `(${summary.pending_incoming})` : ''}
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>
          ) : items.length === 0 ? (
            <p className="text-center text-text-muted text-sm py-8">
              {tab === 'requests' ? 'No pending requests.' : 'No connections yet. Start by following users from the Feed.'}
            </p>
          ) : items.map((c) => {
            const other = c.other_user || {};
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0"
                data-testid={`connection-row-${c.id}`}>
                <div
                  onClick={() => other.id && navigate(`/network/${other.id}`)}
                  className="flex items-center gap-3 flex-1 cursor-pointer">
                  {other.photo ? (
                    <img src={other.photo} alt={other.username} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-xs font-bold flex items-center justify-center">
                      {(other.username || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{other.full_name || other.username || 'Member'}</p>
                    <p className="text-[11px] text-text-muted truncate">
                      {c.kind} · {other.city || (other.user_kind || 'member')}
                    </p>
                  </div>
                </div>
                {tab === 'requests' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => accept(c.id)}
                      className="p-2 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      data-testid={`accept-${c.id}`}>
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => reject(c.id)}
                      className="p-2 rounded-full bg-gray-100 text-text-secondary hover:bg-gray-200"
                      data-testid={`reject-${c.id}`}>
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NetworkPage;
