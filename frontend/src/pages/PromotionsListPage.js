import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Megaphone, Loader2, Sparkles, Clock, DollarSign, Power, Trash2, Users, TrendingUp, Trophy } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const PromotionsListPage = ({ user }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const isAdmin = user && user.role === 'admin';

  const load = async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        axiosInstance.get('/admin/promotions'),
        axiosInstance.get('/admin/promotions-summary'),
      ]);
      setItems(list.data || []);
      setSummary(sum.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not load promotions');
    } finally { setLoading(false); }
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) {
    return <div className="p-10 text-center text-text-muted"><Megaphone size={28} className="mx-auto text-primary mb-2" />Admin only.</div>;
  }

  const togglePromotion = async (p) => {
    try {
      await axiosInstance.patch(`/admin/promotions/${p.id}`, { is_active: !p.is_active });
      toast.success(p.is_active ? 'Paused' : 'Activated');
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const deletePromotion = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This won't remove past tracking data.`)) return;
    try {
      await axiosInstance.delete(`/admin/promotions/${p.id}`);
      toast.success('Promotion deleted'); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="promotions-list-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate('/admin/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
        <h1 className="text-base font-heading font-bold text-primary flex-1 inline-flex items-center gap-2"><Megaphone size={16} className="text-secondary" /> Promotions</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-secondary text-primary font-bold px-3 py-1.5 rounded-full text-xs inline-flex items-center gap-1"
          data-testid="new-promotion-button">
          <Plus size={12} /> New
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Summary panel */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2" data-testid="promotions-summary">
            <Tile label="Active promotions" value={summary.active_promotions} sub={`${summary.total_promotions} total`} />
            <Tile label="Participants" value={summary.total_participants} sub={`${summary.total_engagement_actions} actions`} />
            <Tile label="Points generated" value={summary.total_points_generated.toLocaleString()} sub={`avg ${summary.avg_per_user}/user`} />
            <Tile label="ZAR allocated" value={`R${summary.total_zar_allocated.toLocaleString()}`} sub="Estimated rewards" tone="from-secondary to-yellow-600" />
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-text-muted text-sm">No promotions yet.</div>
        ) : (
          <div className="space-y-2">
            {items.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4" data-testid={`promo-row-${p.id}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${p.is_window_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    <Sparkles size={16} />
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/admin/promotions/${p.id}`)} data-testid={`promo-open-${p.id}`}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-text-primary">{p.name}</p>
                      {p.is_window_active && <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">Live now</span>}
                      {!p.is_active && <span className="bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">Paused</span>}
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">{p.description}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <ScheduleBadge schedule={p.schedule} />
                      <span className="text-[10px] bg-secondary/15 text-primary px-1.5 py-0.5 rounded-full font-bold">R{(p.zar_per_point || 0).toFixed(2)}/pt</span>
                      {p.min_network_score > 0 && <span className="text-[10px] bg-gray-100 text-text-secondary px-1.5 py-0.5 rounded-full">Min {p.min_network_score} pts</span>}
                      {(p.minutes_until_window != null) && !p.is_window_active && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"><Clock size={9} /> opens in {Math.floor(p.minutes_until_window / 60)}h {p.minutes_until_window % 60}m</span>}
                    </div>
                  </div>
                  <button onClick={() => togglePromotion(p)} className="p-2 rounded-full hover:bg-gray-100" data-testid={`promo-toggle-${p.id}`}>
                    <Power size={14} className={p.is_active ? 'text-emerald-600' : 'text-gray-400'} />
                  </button>
                  <button onClick={() => deletePromotion(p)} className="p-2 rounded-full hover:bg-red-50 text-red-600" data-testid={`promo-delete-${p.id}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <PromotionEditor onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
    </div>
  );
};

const Tile = ({ label, value, sub, tone = 'from-primary to-blue-600' }) => (
  <div className={`bg-gradient-to-br ${tone} text-white rounded-2xl p-4`}>
    <p className="text-2xl font-heading font-bold leading-none">{value}</p>
    <p className="text-[10px] uppercase tracking-wider font-bold opacity-90 mt-1">{label}</p>
    {sub && <p className="text-[10px] opacity-75 mt-0.5">{sub}</p>}
  </div>
);

const ScheduleBadge = ({ schedule }) => {
  if (!schedule) return null;
  const days = schedule.days_of_week || [];
  return (
    <span className="text-[10px] bg-gray-50 text-text-secondary px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
      {DAY_LABELS.map((d, i) => (
        <span key={i} className={days.includes(i) ? 'font-bold text-primary' : 'opacity-30'}>{d}</span>
      ))}
      <span className="ml-1">{schedule.start_time}–{schedule.end_time} SAST</span>
    </span>
  );
};

const PromotionEditor = ({ onClose, onSaved }) => {
  const [data, setData] = useState({
    name: '', description: '',
    days_of_week: [0, 2, 4], start_time: '08:00', end_time: '12:00',
    min_network_score: 0, zar_per_point: 0.10,
    eligible_actions: ['post_create', 'post_share', 'comment_quality', 'post_like', 'referral_qualified'],
  });
  const [submitting, setSubmitting] = useState(false);

  const toggleDay = (i) => {
    const has = data.days_of_week.includes(i);
    setData({ ...data, days_of_week: has ? data.days_of_week.filter(d => d !== i) : [...data.days_of_week, i].sort() });
  };

  const submit = async () => {
    if (data.name.trim().length < 2) return toast.error('Name required');
    setSubmitting(true);
    try {
      await axiosInstance.post('/admin/promotions', {
        name: data.name.trim(),
        description: data.description.trim(),
        schedule: {
          days_of_week: data.days_of_week,
          start_time: data.start_time,
          end_time: data.end_time,
        },
        min_network_score: Number(data.min_network_score),
        zar_per_point: Number(data.zar_per_point),
        eligible_actions: data.eligible_actions,
      });
      toast.success('Promotion created');
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose} data-testid="promotion-editor-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="font-heading font-bold text-lg mb-3">New promotion</h3>
        <input value={data.name} onChange={e => setData({ ...data, name: e.target.value })} placeholder="Name (e.g., Weekend Boost)" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm mb-2" data-testid="promo-name-input" />
        <textarea value={data.description} onChange={e => setData({ ...data, description: e.target.value })} placeholder="Description" rows={2} className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none mb-3" data-testid="promo-desc-input" />

        <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">Active days (SAST)</p>
        <div className="flex gap-1 mb-3">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <button key={i} type="button" onClick={() => toggleDay(i)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold ${data.days_of_week.includes(i) ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'}`}
              data-testid={`promo-day-${i}`}>
              {d}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">Start (SAST)</p>
            <input type="time" value={data.start_time} onChange={e => setData({ ...data, start_time: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" data-testid="promo-start-time" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">End (SAST)</p>
            <input type="time" value={data.end_time} onChange={e => setData({ ...data, end_time: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" data-testid="promo-end-time" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">Min Network Score</p>
            <input type="number" value={data.min_network_score} onChange={e => setData({ ...data, min_network_score: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" data-testid="promo-min-score" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">ZAR per point</p>
            <input type="number" step="0.01" value={data.zar_per_point} onChange={e => setData({ ...data, zar_per_point: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" data-testid="promo-zar-rate" />
          </div>
        </div>

        <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">Eligible actions ({data.eligible_actions.length})</p>
        <div className="flex flex-wrap gap-1 mb-3">
          {['post_create', 'post_share', 'comment_quality', 'post_like', 'video_watched', 'referral_qualified', 'place_review_create', 'connection_made', 'job_share', 'ad_watch_engage', 'daily_checkin'].map((a) => {
            const selected = data.eligible_actions.includes(a);
            return (
              <button key={a} type="button"
                onClick={() => setData({ ...data, eligible_actions: selected ? data.eligible_actions.filter(x => x !== a) : [...data.eligible_actions, a] })}
                className={`text-[10px] px-2 py-1 rounded-full ${selected ? 'bg-secondary text-primary font-bold' : 'bg-gray-100 text-text-secondary'}`}
                data-testid={`promo-action-${a}`}>
                {a.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>

        <button onClick={submit} disabled={submitting} className="w-full bg-primary text-white font-bold py-2.5 rounded-full text-sm disabled:opacity-50" data-testid="promo-submit-button">
          {submitting && <Loader2 size={12} className="inline animate-spin mr-1" />}
          Create promotion
        </button>
      </div>
    </div>
  );
};

export default PromotionsListPage;
