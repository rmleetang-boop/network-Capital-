import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MapPin, Calendar, Clock, Coins, Users, Sparkles, X, Tag, Image as ImageIcon, ChevronLeft, Utensils, Music, Plane, Palmtree } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const CATEGORY_META = {
  dinner: { label: 'Dinner', icon: Utensils, gradient: 'from-amber-500 to-orange-600' },
  concert: { label: 'Concert', icon: Music, gradient: 'from-pink-500 to-purple-600' },
  travel: { label: 'Travel', icon: Plane, gradient: 'from-sky-500 to-blue-600' },
  holiday: { label: 'Holiday', icon: Palmtree, gradient: 'from-emerald-500 to-teal-600' },
  experience: { label: 'Experience', icon: Sparkles, gradient: 'from-secondary to-yellow-600' },
};

const CURRENCIES = ['USD','EUR','GBP','ZAR','NGN','KES','GHS','CAD','AUD','JPY'];

const ActivitiesPage = ({ user }) => {
  const navigate = useNavigate();
  const [regions, setRegions] = useState([]);
  const [country, setCountry] = useState(user?.country || '');
  const [city, setCity] = useState(user?.city || '');
  const [category, setCategory] = useState('all');
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    axiosInstance.get('/hubs/regions').then((r) => setRegions(r.data.countries || [])).catch(() => {});
  }, []);

  useEffect(() => { fetchActivities(); /* eslint-disable-next-line */ }, [country, city, category]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const params = {};
      if (country) params.country = country;
      if (city) params.city = city;
      if (category && category !== 'all') params.category = category;
      const res = await axiosInstance.get('/activities', { params });
      setActivities(res.data.activities || []);
    } catch { toast.error('Failed to load activities'); }
    setLoading(false);
  };

  const cities = useMemo(() => {
    if (!country) return [];
    const c = regions.find((r) => r.value === country);
    if (!c) return [];
    const out = [];
    c.provinces.forEach((p) => p.cities.forEach((ct) => out.push(ct)));
    return out;
  }, [country, regions]);

  const handleCountry = (v) => { setCountry(v); setCity(''); };

  return (
    <div className="min-h-screen bg-[#0a1628] text-white pb-24" data-testid="activities-page">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-[#0a1628] via-primary to-[#0a1628] border-b border-white/10 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 text-white/70 hover:text-white" data-testid="activities-back">
            <ChevronLeft size={20} />
          </button>
          <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
            <Sparkles className="text-primary" size={20} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-heading font-bold">Activities</h1>
            <p className="text-[11px] text-white/55">Curated experiences across Africa</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="bg-secondary text-primary text-sm font-bold px-3 py-2 rounded-full inline-flex items-center gap-1 active:scale-95"
            data-testid="create-activity-cta"
          >
            <Plus size={14} /> Create
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Intro card */}
        <AnimatePresence>
          {intro && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border border-secondary/30 bg-gradient-to-br from-secondary/15 to-transparent p-5"
              data-testid="activities-intro"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-secondary" />
                  <p className="font-heading font-bold text-base">Curated experiences for the community</p>
                </div>
                <button onClick={() => setIntro(false)} className="text-white/60 hover:text-white" data-testid="dismiss-intro">
                  <X size={16} />
                </button>
              </div>
              <p className="text-sm text-white/75 leading-relaxed">
                Activities are member-organised gatherings — dinners, concerts, travel and holidays — designed to bring people together in real life.
                Pick a country and city to see what's nearby. Don't see anything? Be the first to host.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select value={country} onValueChange={handleCountry}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="activity-country">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent className="bg-[#0a1628] border-white/15 text-white">
              {regions.map((c) => (
                <SelectItem key={c.value} value={c.value} className="text-white focus:bg-white/10" data-testid={`activity-country-${c.value}`}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={city} onValueChange={setCity} disabled={!country}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="activity-city">
              <SelectValue placeholder={country ? 'City' : 'Pick country first'} />
            </SelectTrigger>
            <SelectContent className="bg-[#0a1628] border-white/15 text-white">
              {cities.map((c) => (
                <SelectItem key={c.value} value={c.value} className="text-white focus:bg-white/10" data-testid={`activity-city-${c.value}`}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="activity-category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent className="bg-[#0a1628] border-white/15 text-white">
              <SelectItem value="all" className="text-white focus:bg-white/10">All categories</SelectItem>
              {Object.entries(CATEGORY_META).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-white focus:bg-white/10">{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Activities list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : activities.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center"
            data-testid="activities-empty"
          >
            <Sparkles size={36} className="mx-auto text-secondary mb-3" />
            <h3 className="font-heading font-bold text-lg mb-1">No activities yet{country || city ? ' here' : ''}</h3>
            <p className="text-sm text-white/65 mb-5">Be the first to host. Curate a dinner, a concert outing, a weekend trip — invite the community.</p>
            <button
              onClick={() => setCreating(true)}
              className="bg-secondary text-primary px-5 py-3 rounded-full font-bold inline-flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-secondary/20"
              data-testid="create-from-empty"
            >
              <Plus size={16} /> Create an activity
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="activities-grid">
            {activities.map((a, i) => <ActivityCard key={a.id} a={a} idx={i} currentUser={user} onUpdate={fetchActivities} />)}
          </div>
        )}
      </div>

      {creating && <CreateActivityModal regions={regions} initialCountry={country} initialCity={city} onClose={() => setCreating(false)} onCreated={(a) => { setActivities((p) => [a, ...p]); setCreating(false); }} />}
    </div>
  );
};

const ActivityCard = ({ a, idx, currentUser, onUpdate }) => {
  const meta = CATEGORY_META[a.category] || CATEGORY_META.experience;
  const Icon = meta.icon;
  const isJoined = (a.participants || []).some((p) => p.user_id === currentUser?.id);
  const isCreator = a.creator_id === currentUser?.id;

  const join = async () => {
    try {
      await axiosInstance.post(`/activities/${a.id}/${isJoined ? 'leave' : 'join'}`);
      toast.success(isJoined ? 'Left activity' : 'Joined! +25 pts');
      onUpdate?.();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx, 8) * 0.04 }}
      whileHover={{ y: -3 }}
      className="rounded-3xl overflow-hidden bg-white/5 border border-white/10 hover:border-secondary/40 transition-colors"
      data-testid={`activity-card-${idx}`}
    >
      <div className={`h-32 bg-gradient-to-br ${meta.gradient} relative flex items-end p-4`}>
        {a.cover_image ? (
          <img src={a.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90" />
        ) : (
          <Icon size={64} className="absolute right-3 top-3 opacity-25" />
        )}
        <span className="relative text-[10px] uppercase tracking-widest bg-black/40 backdrop-blur px-2 py-1 rounded-full font-bold">
          {meta.label}
        </span>
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-heading font-bold text-base leading-tight">{a.title}</h3>
        <p className="text-xs text-white/65 line-clamp-2">{a.description}</p>
        <div className="flex flex-wrap gap-2 text-[11px] text-white/70 pt-1">
          <span className="inline-flex items-center gap-1"><MapPin size={11} className="text-secondary" />{a.city_label}, {a.country_label}</span>
          <span className="inline-flex items-center gap-1"><Calendar size={11} className="text-secondary" />{a.date}</span>
          <span className="inline-flex items-center gap-1"><Clock size={11} className="text-secondary" />{a.time}</span>
          {a.cost_amount > 0 && <span className="inline-flex items-center gap-1"><Coins size={11} className="text-secondary" />{a.cost_currency} {a.cost_amount}</span>}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-3">
          <div className="flex items-center gap-2">
            <Avatar className="w-7 h-7"><AvatarImage src={a.creator_photo} /><AvatarFallback>{a.creator_username?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
            <div>
              <p className="text-xs font-semibold leading-tight">@{a.creator_username}</p>
              <p className="text-[10px] text-white/55"><Users size={9} className="inline mr-0.5" />{(a.participants || []).length} joined{a.max_participants ? ` / ${a.max_participants}` : ''}</p>
            </div>
          </div>
          {!isCreator && (
            <button
              onClick={join}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95 ${isJoined ? 'bg-white/10 text-white' : 'bg-secondary text-primary'}`}
              data-testid={`activity-join-${idx}`}
            >
              {isJoined ? 'Joined ✓' : 'Join'}
            </button>
          )}
          {isCreator && <span className="text-[10px] text-secondary font-bold">YOUR EVENT</span>}
        </div>
      </div>
    </motion.div>
  );
};

const CreateActivityModal = ({ regions, initialCountry = '', initialCity = '', onClose, onCreated }) => {
  const [form, setForm] = useState({
    title: '', description: '', country: initialCountry, city: initialCity,
    venue: '', date: '', time: '', cost_amount: '', cost_currency: 'USD',
    cost_note: '', max_participants: '', category: 'experience', cover_image: '',
  });
  const [saving, setSaving] = useState(false);

  const cities = useMemo(() => {
    if (!form.country) return [];
    const c = regions.find((r) => r.value === form.country);
    if (!c) return [];
    const out = []; c.provinces.forEach((p) => p.cities.forEach((ct) => out.push(ct)));
    return out;
  }, [form.country, regions]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e?.preventDefault();
    if (!form.title || !form.description || !form.country || !form.city || !form.date || !form.time) {
      toast.error('Please fill all required fields'); return;
    }
    setSaving(true);
    try {
      const res = await axiosInstance.post('/activities', {
        ...form,
        cost_amount: parseFloat(form.cost_amount || 0) || 0,
        max_participants: form.max_participants ? parseInt(form.max_participants, 10) : null,
        cover_image: form.cover_image || null,
      });
      toast.success('Activity created! +50 pts');
      onCreated?.(res.data);
    } catch (e) { toast.error(e.response?.data?.detail || 'Create failed'); }
    setSaving(false);
  };

  const onCover = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 3 * 1024 * 1024) { toast.error('Image too large (max 3MB)'); return; }
    const r = new FileReader(); r.onload = () => set('cover_image', r.result); r.readAsDataURL(f);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose} data-testid="create-activity-modal">
      <motion.form
        onSubmit={submit}
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0a1628] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-xl max-h-[92vh] overflow-y-auto text-white"
      >
        <div className="sticky top-0 bg-[#0a1628] border-b border-white/10 px-5 py-4 flex items-center justify-between">
          <h2 className="font-heading font-bold text-lg">Create Activity</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-white/60 hover:text-white" data-testid="close-create-activity"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Title *" testid="ca-title">
            <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Sunset rooftop dinner in Cape Town" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-secondary text-sm" data-testid="ca-title-input" />
          </Field>
          <Field label="Description *" testid="ca-desc">
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="What's the vibe? Who is it for? What should people bring?" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-secondary text-sm resize-none" data-testid="ca-desc-input" />
          </Field>
          <Field label="Category" testid="ca-category">
            <Select value={form.category} onValueChange={(v) => set('category', v)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="ca-category-select"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#0a1628] border-white/15 text-white">
                {Object.entries(CATEGORY_META).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-white focus:bg-white/10">{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Country *" testid="ca-country">
              <Select value={form.country} onValueChange={(v) => { set('country', v); set('city', ''); }}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="ca-country-select"><SelectValue placeholder="Country" /></SelectTrigger>
                <SelectContent className="bg-[#0a1628] border-white/15 text-white">
                  {regions.map((c) => <SelectItem key={c.value} value={c.value} className="text-white focus:bg-white/10">{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="City *" testid="ca-city">
              <Select value={form.city} onValueChange={(v) => set('city', v)} disabled={!form.country}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="ca-city-select"><SelectValue placeholder={form.country ? 'City' : 'Pick country'} /></SelectTrigger>
                <SelectContent className="bg-[#0a1628] border-white/15 text-white">
                  {cities.map((c) => <SelectItem key={c.value} value={c.value} className="text-white focus:bg-white/10">{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Venue (optional)" testid="ca-venue">
            <input value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. The Silo Hotel, V&A Waterfront" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-secondary text-sm" data-testid="ca-venue-input" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date *" testid="ca-date">
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-secondary text-sm" data-testid="ca-date-input" />
            </Field>
            <Field label="Time *" testid="ca-time">
              <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-secondary text-sm" data-testid="ca-time-input" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Cost" testid="ca-cost">
              <input type="number" min="0" step="0.01" value={form.cost_amount} onChange={(e) => set('cost_amount', e.target.value)} placeholder="0" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-secondary text-sm" data-testid="ca-cost-input" />
            </Field>
            <Field label="Currency" testid="ca-currency">
              <Select value={form.cost_currency} onValueChange={(v) => set('cost_currency', v)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0a1628] border-white/15 text-white">
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c} className="text-white focus:bg-white/10">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Max ppl" testid="ca-max">
              <input type="number" min="1" value={form.max_participants} onChange={(e) => set('max_participants', e.target.value)} placeholder="∞" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-secondary text-sm" data-testid="ca-max-input" />
            </Field>
          </div>
          <Field label="Cost note (optional)" testid="ca-costnote">
            <input value={form.cost_note} onChange={(e) => set('cost_note', e.target.value)} placeholder="e.g. Includes 3-course meal & wine" className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-secondary text-sm" />
          </Field>
          <Field label="Cover image (optional)" testid="ca-cover">
            {form.cover_image ? (
              <div className="relative">
                <img src={form.cover_image} alt="" className="w-full h-32 object-cover rounded-xl" />
                <button type="button" onClick={() => set('cover_image', '')} className="absolute top-2 right-2 bg-black/50 rounded-full p-1.5"><X size={14} /></button>
              </div>
            ) : (
              <label className="flex items-center gap-2 px-3 py-3 rounded-xl border-2 border-dashed border-white/10 hover:border-secondary/40 cursor-pointer text-sm text-white/65">
                <ImageIcon size={16} /> Upload an image
                <input type="file" accept="image/*" onChange={onCover} className="hidden" data-testid="ca-cover-input" />
              </label>
            )}
          </Field>
        </div>
        <div className="sticky bottom-0 bg-[#0a1628] border-t border-white/10 p-4">
          <button type="submit" disabled={saving} className="w-full bg-secondary text-primary font-bold py-3 rounded-full disabled:opacity-60 active:scale-95 inline-flex items-center justify-center gap-2" data-testid="ca-submit">
            {saving ? 'Creating…' : (<><Sparkles size={16} /> Create Activity</>)}
          </button>
        </div>
      </motion.form>
    </div>
  );
};

const Field = ({ label, children, testid }) => (
  <div data-testid={testid}>
    <label className="text-[11px] uppercase tracking-wider text-white/55 mb-1 block">{label}</label>
    {children}
  </div>
);

export default ActivitiesPage;
