import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Users, Search, Heart, Briefcase, PiggyBank, Check, Send, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import HubPulse from '../components/HubPulse';
import FeatureIntroModal from '../components/FeatureIntroModal';

const TYPE_META = {
  social: { label: 'Social', icon: Heart, color: 'bg-pink-500/20 text-pink-300 border-pink-500/40' },
  financial: { label: 'Financial', icon: PiggyBank, color: 'bg-green-500/20 text-green-300 border-green-500/40' },
  professional: { label: 'Professional', icon: Briefcase, color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
};

const RegionalHubsPage = ({ user }) => {
  const navigate = useNavigate();
  const [cities, setCities] = useState([]);
  const [country, setCountry] = useState(user?.country || '');
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
  const [categoryFilter, setCategoryFilter] = useState('all'); // all|social|financial|professional

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
      const cityMeta = cities.find((c) => c.value === newCity);
      const payloadCountry = country || cityMeta?.country || 'ZA';
      await axiosInstance.put('/users/me', { city: newCity, country: payloadCountry });
      setCity(newCity);
      const niceLabel = cityMeta?.label || newCity.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      toast.success(`Set your hub to ${niceLabel}`);
    } catch {
      toast.error('Failed to update');
    } finally {
      setSavingCity(false);
    }
  };

  const handleSetCountry = (newCountry) => {
    setCountry(newCountry);
    setCity('');
    setUsers([]);
  };

  // Cities filtered by selected country
  const visibleCities = useMemo(
    () => (country ? cities.filter((c) => c.country === country) : cities),
    [cities, country]
  );
  // Country list derived from cities response (de-duped)
  const countryOptions = useMemo(() => {
    const seen = new Map();
    cities.forEach((c) => {
      if (c.country && !seen.has(c.country)) {
        seen.set(c.country, { value: c.country, label: c.country_label || c.country });
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [cities]);

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
    let list = users;
    // Category filter — show users where the selected connection type is open (not already accepted),
    // emphasising members you can still connect with via that lane.
    if (categoryFilter !== 'all') {
      list = list.filter((u) => {
        const status = u.connection_status?.[categoryFilter];
        return status !== 'accepted';
      });
    }
    if (!q) return list;
    return list.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.profession?.toLowerCase().includes(q)
    );
  }, [users, search, categoryFilter]);

  const cityLabel = cities.find((c) => c.value === city)?.label || 'Your hub';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] pb-24" data-testid="regional-hubs-page">
      <FeatureIntroModal
        featureKey="hubs"
        icon={<MapPin size={20} />}
        title="Regional Hubs"
        subtitle="Find members in your city — across all 54 African countries."
        bullets={[
          { icon: <Users size={14} />, label: 'People near you', body: 'Pick a country, then a city to browse members in that hub.' },
          { icon: <Heart size={14} />, label: 'Three connection lanes', body: 'Send Social, Financial (Stokvel) or Professional connection requests — clearly labelled on every card.' },
          { icon: <Search size={14} />, label: 'Search & filter', body: 'Use the chip filter (Social / Financial / Professional) or search by name, profession or interests.' },
        ]}
      />
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

          <div className="grid grid-cols-2 gap-2">
            <Select value={country} onValueChange={handleSetCountry}>
              <SelectTrigger
                className="bg-white/10 border-white/20 text-white rounded-xl px-3 h-11 focus:border-secondary"
                data-testid="country-selector"
              >
                <SelectValue placeholder="Pick country" />
              </SelectTrigger>
              <SelectContent className="bg-[#0a1628] border-white/20 text-white max-h-[60vh]">
                {countryOptions.map((c) => (
                  <SelectItem
                    key={c.value}
                    value={c.value}
                    className="text-white focus:bg-secondary/20 focus:text-white cursor-pointer"
                    data-testid={`country-option-${c.value}`}
                  >
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={city} onValueChange={handleSetMyCity} disabled={savingCity || !country}>
              <SelectTrigger
                className="bg-white/10 border-white/20 text-white rounded-xl px-3 h-11 focus:border-secondary"
                data-testid="city-selector"
              >
                <SelectValue placeholder={country ? 'Pick a city…' : 'Pick country first'} />
              </SelectTrigger>
              <SelectContent className="bg-[#0a1628] border-white/20 text-white max-h-[60vh]">
                {visibleCities.map((c) => (
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
          </div>
          <CustomCityInput
            country={country}
            currentCity={city}
            onSet={(typed) => handleSetMyCity(typed)}
            saving={savingCity}
          />
          <button
            onClick={() => navigate('/connections')}
            className="mt-2 w-full px-4 py-2.5 bg-secondary text-primary font-semibold rounded-xl hover:bg-secondary-hover transition-all flex items-center justify-center gap-1.5"
            data-testid="open-connections"
          >
            <Users size={16} />
              <span className="hidden sm:inline">Inbox</span>
            </button>

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

          {/* Connection-type filter chips */}
          <div className="flex flex-wrap gap-2 mt-3" data-testid="hub-category-filters">
            {[
              { key: 'all', label: 'All', icon: Users, color: 'bg-white/10 text-white border-white/20' },
              { key: 'social', label: 'Social', icon: Heart, color: TYPE_META.social.color },
              { key: 'financial', label: 'Financial', icon: PiggyBank, color: TYPE_META.financial.color },
              { key: 'professional', label: 'Professional', icon: Briefcase, color: TYPE_META.professional.color },
            ].map(({ key, label, icon: Icon, color }) => {
              const active = categoryFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setCategoryFilter(key)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${active ? `${color} ring-2 ring-secondary/60 brightness-110` : `${color} opacity-60 hover:opacity-100`}`}
                  data-testid={`hub-filter-${key}`}
                >
                  <Icon size={12} /> {label}
                </button>
              );
            })}
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
                  <button onClick={() => navigate(u.username ? `/u/${u.username}` : `/profile/${u.id}`)} className="flex-shrink-0">
                    {u.photo ? (
                      <img src={u.photo} alt={u.username} className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white font-bold text-lg">
                        {u.username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => navigate(u.username ? `/u/${u.username}` : `/profile/${u.id}`)} className="block text-left">
                      <p className="text-white font-semibold truncate">{u.full_name || u.username}</p>
                      <p className="text-white/60 text-xs truncate">@{u.username}</p>
                    </button>
                    {u.profession && (
                      <p className="text-secondary text-xs mt-0.5 truncate">{u.profession}</p>
                    )}
                    {u.bio && <p className="text-white/50 text-xs mt-1 line-clamp-1">{u.bio}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0" data-testid={`connect-bar-${u.id}`}>
                    {['social', 'financial', 'professional'].map((t) => {
                      const Icon = TYPE_META[t].icon;
                      const status = u.connection_status?.[t];
                      const disabled = status === 'pending' || status === 'accepted';
                      return (
                        <button
                          key={t}
                          onClick={() => !disabled && openRequest(u, t)}
                          disabled={disabled}
                          className={`text-[10px] uppercase font-bold tracking-wide px-2.5 py-1.5 rounded-full border flex items-center gap-1.5 transition-all min-w-[110px] justify-start ${
                            status === 'accepted'
                              ? 'bg-green-500/20 text-green-300 border-green-500/40'
                              : status === 'pending'
                              ? 'bg-white/5 text-white/40 border-white/10'
                              : `${TYPE_META[t].color} hover:opacity-80`
                          }`}
                          data-testid={`connect-${t}-${u.id}`}
                          title={status || `Send ${TYPE_META[t].label} request`}
                        >
                          <Icon size={12} />
                          <span>{TYPE_META[t].label}</span>
                          {status === 'accepted' && <Check size={11} className="ml-auto" />}
                          {status === 'pending' && <span className="ml-auto opacity-60">…</span>}
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

/* ────────────────────── Custom city input ──────────────────────── */
const CustomCityInput = ({ country, currentCity, onSet, saving }) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  if (!country) return null;
  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setValue(currentCity || ''); }}
        className="mt-2 text-[11px] font-semibold text-secondary/90 hover:text-secondary inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
        data-testid="hub-add-custom-city"
      >
        + My city is not listed
      </button>
    );
  }
  const submit = () => {
    const trimmed = (value || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (trimmed.length < 2) return;
    onSet(trimmed);
    setOpen(false);
  };
  return (
    <div className="mt-2 flex gap-2 items-center">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Type your city (e.g. Libreville)"
        className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 h-10 text-white placeholder-white/40 outline-none focus:border-secondary text-sm"
        data-testid="hub-custom-city-input"
      />
      <button
        onClick={submit}
        disabled={saving || (value || '').trim().length < 2}
        className="text-xs font-bold bg-secondary text-primary px-3 h-10 rounded-xl disabled:opacity-50"
        data-testid="hub-custom-city-save"
      >
        Set
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-xs font-semibold text-white/60 px-2"
        data-testid="hub-custom-city-cancel"
      >
        Cancel
      </button>
    </div>
  );
};
