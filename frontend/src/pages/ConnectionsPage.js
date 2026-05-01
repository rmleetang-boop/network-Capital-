import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Briefcase, PiggyBank, Inbox, Check, X, ArrowRight, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const TABS = [
  { key: 'social', label: 'Social', icon: Heart, color: 'pink' },
  { key: 'financial', label: 'Financial', icon: PiggyBank, color: 'green' },
  { key: 'professional', label: 'Professional', icon: Briefcase, color: 'blue' },
];

const ConnectionsPage = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('social');
  const [view, setView] = useState('inbox'); // inbox | accepted | sent
  const [inbox, setInbox] = useState([]);
  const [accepted, setAccepted] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [i, a, s] = await Promise.all([
        axiosInstance.get('/connections/inbox', { params: { type: activeTab } }),
        axiosInstance.get('/connections', { params: { type: activeTab } }),
        axiosInstance.get('/connections/outbox', { params: { type: activeTab } }),
      ]);
      setInbox(i.data.inbox || []);
      setAccepted(a.data.connections || []);
      setSent(s.data.outbox || []);
    } catch {
      toast.error('Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeTab]);

  const handleAccept = async (id) => {
    setActingId(id);
    try {
      await axiosInstance.post(`/connections/${id}/accept`);
      toast.success('Connection accepted');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id) => {
    setActingId(id);
    try {
      await axiosInstance.post(`/connections/${id}/reject`);
      toast.success('Request declined');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    } finally {
      setActingId(null);
    }
  };

  const tabMeta = TABS.find((t) => t.key === activeTab);
  const TabIcon = tabMeta.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] pb-24" data-testid="connections-page">
      <div className="sticky top-0 z-10 bg-[#0a1628]/95 backdrop-blur-lg border-b border-white/10 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
              <Users className="text-primary" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-white">My Connections</h1>
              <p className="text-xs text-white/60">Manage social, financial & professional ties</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 bg-white/5 p-1 rounded-full">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex-1 py-2 rounded-full font-medium text-sm transition-all flex items-center justify-center gap-1.5 ${
                    active ? 'bg-secondary text-primary' : 'text-white/60 hover:text-white'
                  }`}
                  data-testid={`tab-${t.key}`}
                >
                  <Icon size={14} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sub-views */}
          <div className="flex gap-3 mt-3 text-sm">
            {[
              { k: 'inbox', label: `Inbox (${inbox.length})` },
              { k: 'accepted', label: `Connections (${accepted.length})` },
              { k: 'sent', label: `Sent (${sent.length})` },
            ].map((v) => (
              <button
                key={v.k}
                onClick={() => setView(v.k)}
                className={`pb-1 border-b-2 transition-colors ${
                  view === v.k ? 'text-secondary border-secondary' : 'text-white/60 border-transparent hover:text-white'
                }`}
                data-testid={`view-${v.k}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : view === 'inbox' ? (
          inbox.length === 0 ? (
            <EmptyState icon={Inbox} title={`No pending ${tabMeta.label.toLowerCase()} requests`} subtitle="You'll see incoming requests here" />
          ) : (
            <div className="space-y-3">
              {inbox.map((c) => (
                <RequestRow
                  key={c.id}
                  conn={c}
                  TabIcon={TabIcon}
                  acting={actingId === c.id}
                  onAccept={() => handleAccept(c.id)}
                  onReject={() => handleReject(c.id)}
                  onClickProfile={() => navigate(`/profile/${c.from_user_id}`)}
                  showActions
                />
              ))}
            </div>
          )
        ) : view === 'accepted' ? (
          accepted.length === 0 ? (
            <EmptyState icon={tabMeta.icon} title={`No ${tabMeta.label.toLowerCase()} connections yet`} subtitle="Find people in your hub to start connecting" actionLabel="Open Regional Hubs" onAction={() => navigate('/hubs')} />
          ) : (
            <div className="space-y-3">
              {accepted.map((c) => (
                <ConnectionRow
                  key={c.id}
                  conn={c}
                  TabIcon={TabIcon}
                  onClick={() => navigate(`/profile/${c.other_user_id}`)}
                />
              ))}
            </div>
          )
        ) : (
          sent.length === 0 ? (
            <EmptyState icon={tabMeta.icon} title="You haven't sent any requests" subtitle="Discover people in your city" actionLabel="Open Regional Hubs" onAction={() => navigate('/hubs')} />
          ) : (
            <div className="space-y-3">
              {sent.map((c) => (
                <SentRow key={c.id} conn={c} TabIcon={TabIcon} onClickProfile={() => navigate(`/profile/${c.to_user_id}`)} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, subtitle, actionLabel, onAction }) => (
  <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10" data-testid="empty-state">
    <Icon className="mx-auto mb-3 text-white/30" size={48} />
    <p className="text-white text-lg font-semibold">{title}</p>
    <p className="text-white/60 text-sm mt-1">{subtitle}</p>
    {actionLabel && (
      <button
        onClick={onAction}
        className="mt-4 px-5 py-2.5 bg-secondary hover:bg-secondary-hover text-primary rounded-full font-semibold inline-flex items-center gap-2"
      >
        {actionLabel} <ArrowRight size={16} />
      </button>
    )}
  </div>
);

const RequestRow = ({ conn, TabIcon, acting, onAccept, onReject, onClickProfile }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/10 rounded-2xl p-4 border border-white/20" data-testid={`request-${conn.id}`}>
    <div className="flex items-start gap-3">
      <button onClick={onClickProfile} className="flex-shrink-0">
        {conn.from_photo ? (
          <img src={conn.from_photo} alt={conn.from_username} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white font-bold">
            {conn.from_username?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <button onClick={onClickProfile} className="text-white font-semibold truncate hover:underline">@{conn.from_username}</button>
          <span className="text-secondary text-xs flex items-center gap-1"><TabIcon size={12} /> {conn.type}</span>
        </div>
        {conn.message && <p className="text-white/70 text-sm mt-1">"{conn.message}"</p>}
        {conn.stokvel_id && (
          <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
            <PiggyBank size={12} /> Wants to invite you to a Stokvel
          </p>
        )}
      </div>
    </div>
    <div className="flex gap-2 mt-3">
      <button
        onClick={onReject}
        disabled={acting}
        className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
        data-testid="decline-btn"
      >
        <X size={14} /> Decline
      </button>
      <button
        onClick={onAccept}
        disabled={acting}
        className="flex-1 py-2 bg-gradient-to-r from-secondary to-yellow-500 text-primary rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
        data-testid="accept-btn"
      >
        <Check size={14} /> Accept
      </button>
    </div>
  </motion.div>
);

const ConnectionRow = ({ conn, TabIcon, onClick }) => (
  <motion.button
    onClick={onClick}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="w-full bg-white/10 rounded-2xl p-4 border border-white/20 hover:bg-white/15 transition-all text-left"
    data-testid={`connection-${conn.id}`}
  >
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white font-bold">
        {conn.other_username?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold truncate">@{conn.other_username}</p>
        <p className="text-white/60 text-xs flex items-center gap-1 mt-0.5">
          <TabIcon size={12} /> {conn.type} · since {new Date(conn.responded_at).toLocaleDateString()}
        </p>
      </div>
      <ArrowRight className="text-white/30" size={18} />
    </div>
  </motion.button>
);

const SentRow = ({ conn, TabIcon, onClickProfile }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/5 rounded-2xl p-4 border border-white/10">
    <div className="flex items-center gap-3">
      <button onClick={onClickProfile} className="text-white font-semibold hover:underline">@{conn.to_username}</button>
      <span className={`text-xs px-2 py-0.5 rounded-full ${
        conn.status === 'accepted' ? 'bg-green-500/20 text-green-300'
        : conn.status === 'rejected' ? 'bg-red-500/20 text-red-300'
        : 'bg-yellow-500/20 text-yellow-300'
      }`}>
        {conn.status}
      </span>
      <TabIcon className="text-white/40 ml-auto" size={14} />
    </div>
    {conn.message && <p className="text-white/60 text-xs mt-1">"{conn.message}"</p>}
  </motion.div>
);

export default ConnectionsPage;
