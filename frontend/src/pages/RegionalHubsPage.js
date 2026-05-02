import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Users, Search, Heart, Briefcase, PiggyBank, Check, Send, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import HubPulse from '../components/HubPulse';

const TYPE_META = {
  social: { label: 'Social', icon: Heart, color: 'bg-pink-500/20 text-pink-300 border-pink-500/40' },
  financial: { label: 'Financial', icon: PiggyBank, color: 'bg-green-500/20 text-green-300 border-green-500/40' },
  professional: { label: 'Professional', icon: Briefcase, color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
};

const RegionalHubsPage = ({ user }) => {
  const navigate = useNavigate();
  const [cities, setCities] = useState([]);
  const [city, setCity] = useState(user?.city || '');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [savingCity, setSavingCity] = useState(false);
  const [requestModal, setRequestModal] = useState(null); // {user, type}
  const [stokvels, setStokvels] = useState([]);
  const [reqMessage, setReqMessage] = useState('');
  const [reqStokvel, setReqStokvel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axiosInstance.get('/hubs/cities').then((r) => setCities(r.data.cities)).catch(() => {});
    axiosInstance.get('/stokvels').then((r) => setStokvels(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (city) loadHub(city);
  }, [city]);

  const loadHub = async (c) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/hubs/users', { params: { city: c } });
      setUsers(res.data.users || []);
    } catch {
      toast.error('Failed to load hub');
    } finally {
      setLoading(false);
    }
  };

  const handleSetMyCity = async (newCity) => {
    setSavingCity(true);
    try {
      await axiosInstance.put('/users/me', { city: newCity, country: 'ZA' });
      setCity(newCity);
      toast.success(`Set your hub to ${cities.find((c) => c.value === newCity)?.label}`);
    } catch {
      toast.error('Failed to update');
    } finally {
      setSavingCity(false);
    }
  };

  const openRequest = (target, type) => {
    setRequestModal({ user: target, type });
    setReqMessage('');
    setReqStokvel(stokvels[0]?.id || '');
  };

  const sendRequest = async () => {
    if (!requestModal) return;
    setSubmitting(true);
    try {
      const payload = {
        to_user_id: requestModal.user.id,
        type: requestModal.type,
        message: reqMessage,
      };
      if (requestModal.type === 'financial' && reqStokvel) payload.stokvel_id = reqStokvel;
      await axiosInstance.post('/connections/request', payload);
      toast.success(`Request sent to ${requestModal.user.username}`);
      setRequestModal(null);
      // Refresh user statuses
      loadHub(city);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send request');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.profession?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const cityLabel = cities.find((c) => c.value === city)?.label || 'Your hub';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] pb-24" data-testid="regional-hubs-page">
      <div className="sticky top-0 z-10 bg-[#0a1628]/95 backdrop-blur-lg border-b border-white/10 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
              <MapPin className="text-primary" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-white">Regional Hubs</h1>
              <p className="text-xs text-white/60">Discover people in your city</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Select value={city} onValueChange={handleSetMyCity} disabled={savingCity}>
              <SelectTrigger
                className="flex-1 bg-white/10 border-white/20 text-white rounded-xl px-3 h-11 focus:border-secondary"
                data-testid="city-selector"
              >
                <SelectValue placeholder="Pick a city…" />
              </SelectTrigger>
              <SelectContent className="bg-[#0a1628] border-white/20 text-white">
                {cities.map((c) => (
                  <SelectItem
                    key={c.value}
                    value={c.value}
                    className="text-white focus:bg-secondary/20 focus:text-white cursor-pointer"
                    data-testid={`city-option-${c.value}`}
                  >
                    {c.label} ({c.user_count || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => navigate('/connections')}
              className="px-4 py-2.5 bg-secondary text-primary font-semibold rounded-xl hover:bg-secondary-hover transition-all flex items-center gap-1.5"
              data-testid="open-connections"
            >
              <Users size={16} />
              <span className="hidden sm:inline">Inbox</span>
            </button>
          </div>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username, profession…"
              className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 outline-none focus:border-secondary"
            />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        {city && <div className="mb-4"><HubPulse city={city} /></div>}
        {!city ? (
          <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
            <MapPin className="mx-auto mb-3 text-white/30" size={48} />
            <p className="text-white text-lg font-semibold">Set your city to see your hub</p>
            <p className="text-white/60 text-sm mt-1">Pick a city above to discover nearby members</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
            <Users className="mx-auto mb-3 text-white/30" size={48} />
            <p className="text-white text-lg font-semibold">No one in {cityLabel} yet</p>
            <p className="text-white/60 text-sm mt-1">Be the first to grow this hub. Invite friends!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-white/60 text-sm">{filtered.length} member{filtered.length !== 1 ? 's' : ''} in {cityLabel}</p>
            {filtered.map((u, idx) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 hover:bg-white/15 transition-all"
                data-testid={`hub-user-${u.id}`}
              >
                <div className="flex items-center gap-3">
                  <button onClick={() => navigate(`/profile/${u.id}`)} className="flex-shrink-0">
                    {u.photo ? (
                      <img src={u.photo} alt={u.username} className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white font-bold text-lg">
                        {u.username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => navigate(`/profile/${u.id}`)} className="block text-left">
                      <p className="text-white font-semibold truncate">{u.full_name || u.username}</p>
                      <p className="text-white/60 text-xs truncate">@{u.username}</p>
                    </button>
                    {u.profession && (
                      <p className="text-secondary text-xs mt-0.5 truncate">{u.profession}</p>
                    )}
                    {u.bio && <p className="text-white/50 text-xs mt-1 line-clamp-1">{u.bio}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {['social', 'financial', 'professional'].map((t) => {
                      const Icon = TYPE_META[t].icon;
                      const status = u.connection_status?.[t];
                      const disabled = status === 'pending' || status === 'accepted';
                      return (
                        <button
                          key={t}
                          onClick={() => !disabled && openRequest(u, t)}
                          disabled={disabled}
                          className={`text-[10px] uppercase font-bold tracking-wide px-2 py-1 rounded-full border flex items-center gap-1 transition-all ${
                            status === 'accepted'
                              ? 'bg-green-500/20 text-green-300 border-green-500/40'
                              : status === 'pending'
                              ? 'bg-white/5 text-white/40 border-white/10'
                              : `${TYPE_META[t].color} hover:opacity-80`
                          }`}
                          data-testid={`connect-${t}-${u.id}`}
                          title={status || 'Send request'}
                        >
                          <Icon size={11} />
                          {status === 'accepted' ? <Check size={11} /> : status === 'pending' ? '…' : TYPE_META[t].label[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {requestModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setRequestModal(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0a1628] rounded-2xl border border-white/20 max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
            data-testid="request-modal"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl border ${TYPE_META[requestModal.type].color} flex items-center justify-center`}>
                  {React.createElement(TYPE_META[requestModal.type].icon, { size: 18 })}
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">{TYPE_META[requestModal.type].label} Request</h2>
                  <p className="text-white/60 text-sm">to @{requestModal.user.username}</p>
                </div>
              </div>
              <button onClick={() => setRequestModal(null)} className="text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-white/80 mb-1">Message (optional)</label>
                <textarea
                  rows={3}
                  value={reqMessage}
                  onChange={(e) => setReqMessage(e.target.value)}
                  placeholder={
                    requestModal.type === 'financial'
                      ? "Hi, I'd like to invite you to my Stokvel…"
                      : requestModal.type === 'professional'
                      ? "I'd love to connect professionally…"
                      : 'Hey, let\'s connect!'
                  }
                  className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 outline-none focus:border-secondary resize-none"
                  data-testid="request-message"
                />
              </div>

              {requestModal.type === 'financial' && stokvels.length > 0 && (
                <div>
                  <label className="block text-sm text-white/80 mb-1">Invite to Stokvel</label>
                  <select
                    value={reqStokvel}
                    onChange={(e) => setReqStokvel(e.target.value)}
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white outline-none focus:border-secondary"
                    data-testid="request-stokvel-select"
                  >
                    {stokvels.map((s) => (
                      <option key={s.id} value={s.id} className="bg-[#0a1628]">{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {requestModal.type === 'financial' && stokvels.length === 0 && (
                <p className="text-yellow-400 text-xs">You don't have a Stokvel yet — they'll just receive a financial connection request.</p>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setRequestModal(null)}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium"
              >
                Cancel
              </button>
              <button
                onClick={sendRequest}
                disabled={submitting}
                className="flex-1 py-3 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                data-testid="send-request-btn"
              >
                <Send size={16} />
                {submitting ? 'Sending…' : 'Send'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default RegionalHubsPage;
