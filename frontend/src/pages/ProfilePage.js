import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Edit2, Save, X, LogOut, Users, HelpCircle, MapPin, Camera, Video, FileText, Trash2, Plus, Network, Package, MessageCircle, Sparkles, Briefcase, Trophy, Mail, Phone, Link2, Copy, ArrowUpRight, BarChart3, CheckCircle2, PencilLine, Activity } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis } from 'recharts';
import NetworkScore from '../components/NetworkScore';
import RankBadge from '../components/RankBadge';
import FeatureIntroModal from '../components/FeatureIntroModal';
import { Progress } from '@/components/ui/progress';
import OwnModuleGrid from '../components/profile/OwnModuleGrid';

const MONTHS = [
  { v: 1, l: 'January' }, { v: 2, l: 'February' }, { v: 3, l: 'March' },
  { v: 4, l: 'April' }, { v: 5, l: 'May' }, { v: 6, l: 'June' },
  { v: 7, l: 'July' }, { v: 8, l: 'August' }, { v: 9, l: 'September' },
  { v: 10, l: 'October' }, { v: 11, l: 'November' }, { v: 12, l: 'December' },
];

const ProfilePage = ({ user, setUser }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const isOwnProfile = !userId || userId === user.id;
  const [profileUser, setProfileUser] = useState(user);
  const [loading, setLoading] = useState(false);
  const [scoreSummary, setScoreSummary] = useState(null);
  const [scoreActivity, setScoreActivity] = useState([]);
  const [scorePeriodDays, setScorePeriodDays] = useState(14);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [profileTheme, setProfileTheme] = useState(() => localStorage.getItem('profile-theme') || 'obsidian');
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    full_name: user.full_name || '',
    username: user.username,
    email: user.email || '',
    phone: user.phone || '',
    bio: user.bio,
    photo: user.photo,
    city: user.city || '',
    profession: user.profession || '',
    birth_month: user.birth_month || '',
    user_kind: user.user_kind || 'social',
    skills: Array.isArray(user.skills) ? user.skills.join(', ') : '',
  });
  const [cities, setCities] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [videos, setVideos] = useState([]);
  const [articles, setArticles] = useState([]);
  const [mediaTab, setMediaTab] = useState('photos');
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [articleDraft, setArticleDraft] = useState({ title: '', content: '' });
  const [uploading, setUploading] = useState(false);
  const isTitaniumTheme = profileTheme === 'titanium';

  useEffect(() => {
    localStorage.setItem('profile-theme', profileTheme);
  }, [profileTheme]);

  useEffect(() => {
    if (!isOwnProfile && userId) {
      // For other users, prefer the Instagram-style /u/:username public profile.
      // Look up the target user to obtain a username, then redirect.
      axiosInstance.get(`/users/${userId}`).then((r) => {
        const target = r.data;
        if (target?.username) {
          navigate(`/u/${target.username}`, { replace: true });
        } else {
          setProfileUser(target);
        }
      }).catch(() => fetchUserProfile(userId));
    } else {
      setProfileUser(user);
    }
  }, [userId, user]);

  useEffect(() => {
    axiosInstance.get('/hubs/cities').then((r) => setCities(r.data.cities || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOwnProfile) return undefined;
    let mounted = true;
    const loadScoreData = async () => {
      setScoreLoading(true);
      try {
        const [summaryResponse, activityResponse] = await Promise.all([
          axiosInstance.get('/score/summary'),
          axiosInstance.get(`/score/activity?period=daily&days=${scorePeriodDays}`),
        ]);
        if (mounted) {
          setScoreSummary(summaryResponse.data);
          setScoreActivity(activityResponse.data.buckets || []);
        }
      } catch (error) {
        // Keep the previously loaded dashboard visible if a refresh is unavailable.
      } finally {
        if (mounted) setScoreLoading(false);
      }
    };
    loadScoreData();
    const refreshTimer = window.setInterval(loadScoreData, 60000);
    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
    };
  }, [isOwnProfile, scorePeriodDays]);

  useEffect(() => {
    const id = profileUser?.id;
    if (!id) return;
    axiosInstance.get(`/users/${id}/photos`).then((r) => setPhotos(r.data.photos || [])).catch(() => {});
    axiosInstance.get(`/users/${id}/videos`).then((r) => setVideos(r.data.videos || [])).catch(() => {});
    axiosInstance.get(`/users/${id}/articles`).then((r) => setArticles(r.data.articles || [])).catch(() => {});
  }, [profileUser?.id]);

  const readDataUrl = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const handleAddPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 11 * 1024 * 1024) { toast.error(`Photo is ${(file.size/1024/1024).toFixed(1)} MB — over the 11 MB limit. Please compress it or pick a smaller image.`); return; }
    setUploading(true);
    try {
      const data_url = await readDataUrl(file);
      const res = await axiosInstance.post('/users/me/photos', { data_url });
      setPhotos((p) => [res.data.photo, ...p]);
      toast.success('Photo added');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally { setUploading(false); e.target.value = ''; }
  };

  const handleAddVideo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 11 * 1024 * 1024) { toast.error(`Video is ${(file.size/1024/1024).toFixed(1)} MB — over the 11 MB limit. Try a shorter clip or compress it before uploading.`); return; }
    setUploading(true);
    try {
      const data_url = await readDataUrl(file);
      const res = await axiosInstance.post('/users/me/videos', { data_url });
      setVideos((v) => [res.data.video, ...v]);
      toast.success('Video added');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally { setUploading(false); e.target.value = ''; }
  };

  const handleDeletePhoto = async (id) => {
    await axiosInstance.delete(`/users/me/photos/${id}`);
    setPhotos((p) => p.filter((x) => x.id !== id));
  };
  const handleDeleteVideo = async (id) => {
    await axiosInstance.delete(`/users/me/videos/${id}`);
    setVideos((v) => v.filter((x) => x.id !== id));
  };
  const handleDeleteArticle = async (id) => {
    await axiosInstance.delete(`/users/me/articles/${id}`);
    setArticles((a) => a.filter((x) => x.id !== id));
  };

  const handlePublishArticle = async () => {
    if (!articleDraft.title.trim() || !articleDraft.content.trim()) {
      toast.error('Title and content required'); return;
    }
    try {
      const res = await axiosInstance.post('/users/me/articles', articleDraft);
      setArticles((a) => [res.data.article, ...a]);
      setShowArticleModal(false);
      setArticleDraft({ title: '', content: '' });
      toast.success('Article published');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const fetchUserProfile = async (id) => {
    setLoading(true);
    try {
      const response = await axiosInstance.get(`/users/${id}`);
      setProfileUser(response.data);
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        full_name: editData.full_name,
        username: editData.username,
        email: editData.email,
        phone: editData.phone,
        bio: editData.bio,
        photo: editData.photo,
        city: editData.city,
        profession: editData.profession,
      };
      if (editData.birth_month) {
        payload.birth_month = parseInt(editData.birth_month, 10);
      }
      if (editData.user_kind) {
        payload.user_kind = editData.user_kind;
      }
      if (typeof editData.skills === 'string') {
        payload.skills = editData.skills.split(',').map((s) => s.trim()).filter(Boolean);
      }
      const response = await axiosInstance.put('/users/me', payload);
      setUser(response.data);
      setProfileUser(response.data);
      setEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditData({ ...editData, photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/auth';
  };

  const getNextRankScore = (currentScore) => {
    if (currentScore < 500) return 500;
    if (currentScore < 2000) return 2000;
    return 5000;
  };

  const calculateProgress = (score) => {
    if (score < 500) return (score / 500) * 100;
    if (score < 2000) return ((score - 500) / 1500) * 100;
    return Math.min(((score - 2000) / 3000) * 100, 100);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080b12]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2d82ff] border-t-transparent" />
      </div>
    );
  }

  const referralLink = profileUser.share_code
    ? `${window.location.origin}/join/${profileUser.share_code}`
    : `${window.location.origin}/referral`;

  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success('Referral link copied');
    } catch (error) {
      toast.error('Could not copy link');
    }
  };

  const resetEditData = () => setEditData({
    full_name: user.full_name || '',
    username: user.username,
    email: user.email || '',
    phone: user.phone || '',
    bio: user.bio,
    photo: user.photo,
    city: user.city || '',
    profession: user.profession || '',
    birth_month: user.birth_month || '',
    user_kind: user.user_kind || 'social',
    skills: Array.isArray(user.skills) ? user.skills.join(', ') : '',
  });

  return (
    <div className={`profile-theme-shell min-h-screen pb-8 text-white ${isTitaniumTheme ? 'profile-theme-titanium bg-[#17150f]' : 'profile-theme-obsidian bg-[#080b12]'}`}>
      {isOwnProfile && (
        <FeatureIntroModal
          featureKey="profile"
          icon={<Users size={20} />}
          title="Your Profile"
          subtitle="Your home base for identity, network momentum, and professional presence."
          bullets={[
            { icon: <Edit2 size={14} />, label: 'Edit anytime', body: 'Update your identity, contact details, bio, location, and professional focus.' },
            { icon: <Sparkles size={14} />, label: 'Premium quick access', body: 'Jump into the tools that matter without scanning a wall of buttons.' },
            { icon: <Trophy size={14} />, label: 'Score & rank', body: 'Track your network momentum and progress toward the next milestone.' },
          ]}
        />
      )}

      <div className={`profile-theme-header relative overflow-hidden border-b border-white/10 ${isTitaniumTheme ? 'bg-[#211d13]' : 'bg-[#0b1220]'}`}>
        <div className="absolute inset-0 opacity-90" style={{ background: 'radial-gradient(circle at 16% 10%, rgba(42, 111, 255, .42), transparent 32%), radial-gradient(circle at 94% 4%, rgba(236, 171, 39, .26), transparent 30%), linear-gradient(120deg, #08111f 0%, #111827 45%, #251a17 100%)' }} />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#f2b840]/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-7 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#e8b13d]">Network Capital</p>
              <p className="mt-1 text-xs text-white/45">Executive profile</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/15 p-1" aria-label="Profile appearance">
              {[['obsidian', 'Obsidian'], ['titanium', 'Titanium']].map(([theme, label]) => <button key={theme} type="button" onClick={() => setProfileTheme(theme)} className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold transition ${profileTheme === theme ? 'bg-[#e8ad2f] text-[#10131a]' : 'text-white/45 hover:text-white'}`}>{label}</button>)}
            </div>
            {isOwnProfile && !editing && (
              <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-4 py-2 text-xs font-bold text-white transition hover:border-[#e8b13d]/60 hover:bg-white/[0.14] active:scale-[.97]" data-testid="edit-profile-button">
                <PencilLine size={14} /> Edit profile
              </button>
            )}
            {isOwnProfile && editing && (
              <div className="flex items-center gap-2">
                <button onClick={resetEditData} className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/65 hover:text-white" data-testid="cancel-edit-button"><X size={15} /></button>
                <button onClick={handleSave} className="inline-flex items-center gap-2 rounded-full bg-[#e8ad2f] px-4 py-2 text-xs font-bold text-[#10131a] shadow-[0_8px_28px_rgba(232,173,47,.25)]" data-testid="save-profile-button"><Save size={14} /> Save changes</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="relative mx-auto -mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }} className="executive-tile relative overflow-hidden rounded-[28px] border border-white/10 bg-[#121722]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,.35)] backdrop-blur-xl sm:p-7">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-[#2f70ff]/10 blur-3xl" />
          <div className="relative grid gap-7 lg:grid-cols-[1fr_330px] lg:items-center">
            <div className="flex min-w-0 items-start gap-4 sm:gap-5">
              <div className="relative shrink-0">
                {editing ? (
                  <label className="group block cursor-pointer">
                    <Avatar className="h-24 w-24 border-2 border-[#e8ad2f]/70 shadow-[0_0_0_6px_rgba(232,173,47,.08)] sm:h-28 sm:w-28">
                      <AvatarImage src={editData.photo} />
                      <AvatarFallback className="bg-[#1d3157] text-3xl font-bold text-[#cce0ff]">{(editData.username || '?')[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition group-hover:opacity-100"><Camera size={22} /></div>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" data-testid="profile-photo-input" />
                  </label>
                ) : (
                  <Avatar className="h-24 w-24 border-2 border-[#e8ad2f]/70 shadow-[0_0_0_6px_rgba(232,173,47,.08)] sm:h-28 sm:w-28">
                    <AvatarImage src={profileUser.photo} />
                    <AvatarFallback className="bg-[#1d3157] text-3xl font-bold text-[#cce0ff]">{(profileUser.username || '?')[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                )}
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-4 border-[#121722] bg-[#2d82ff] text-white"><CheckCircle2 size={14} /></span>
              </div>

              <div className="min-w-0 flex-1">
                {editing ? (
                  <div className="space-y-2">
                    <input value={editData.full_name} onChange={(e) => setEditData({ ...editData, full_name: e.target.value })} placeholder="Full name" className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xl font-bold text-white outline-none focus:border-[#e8ad2f]" data-testid="full-name-edit-input" />
                    <input value={editData.username} onChange={(e) => setEditData({ ...editData, username: e.target.value })} placeholder="Username" className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white/75 outline-none focus:border-[#e8ad2f]" data-testid="username-edit-input" />
                  </div>
                ) : (
                  <>
                    <h1 className="truncate text-2xl font-bold tracking-[-.03em] text-white sm:text-3xl">{profileUser.full_name || profileUser.username}</h1>
                    <p className="mt-1 text-sm text-white/50">@{profileUser.username}</p>
                  </>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <RankBadge rank={profileUser.rank} />
                  <span className="rounded-full border border-[#e8ad2f]/25 bg-[#e8ad2f]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#f1c768]">{profileUser.user_kind === 'professional' ? 'Professional' : 'Member'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Network score</p><p className="mt-2 text-3xl font-extrabold tracking-tight text-[#c7e4ff]">{(profileUser.network_score || 0).toLocaleString()}</p><p className="mt-1 text-[11px] text-white/40">Momentum points</p></div>
              <div className="rounded-2xl border border-[#e8ad2f]/20 bg-[#e8ad2f]/[0.07] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#e8ad2f]/65">Wallet</p><p className="mt-2 text-3xl font-extrabold tracking-tight text-[#e8ad2f]">${Number(profileUser.wallet_balance || 0).toFixed(2)}</p><p className="mt-1 text-[11px] text-white/40">Available balance</p></div>
            </div>
            <div className="grid grid-cols-3 gap-2 lg:col-span-1">
              <div className="rounded-xl border border-white/10 bg-white/[0.035] px-2.5 py-3"><p className="text-[9px] font-bold uppercase tracking-wider text-white/35">Weekly</p><p className="mt-1 text-sm font-extrabold text-[#cce4ff]">{(scoreSummary?.weekly_score || 0).toLocaleString()}</p><p className="text-[9px] text-white/35">pts earned</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.035] px-2.5 py-3"><p className="text-[9px] font-bold uppercase tracking-wider text-white/35">Engagement</p><p className="mt-1 text-sm font-extrabold text-[#f1c768]">{((profileUser.likes_received_count || 0) + (profileUser.comments_given_count || 0)).toLocaleString()}</p><p className="text-[9px] text-white/35">signals</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.035] px-2.5 py-3"><p className="text-[9px] font-bold uppercase tracking-wider text-white/35">Today</p><p className="mt-1 text-sm font-extrabold text-[#cce4ff]">{scoreSummary?.session_minutes_today || 0}</p><p className="text-[9px] text-white/35">active min</p></div>
            </div>
          </div>

          <div className="relative mt-7 border-t border-white/10 pt-6">
            {editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <textarea value={editData.bio} onChange={(e) => setEditData({ ...editData, bio: e.target.value })} placeholder="Write a concise executive bio" rows={3} className="sm:col-span-2 w-full resize-none rounded-2xl border border-white/15 bg-white/[0.05] p-3 text-sm text-white outline-none focus:border-[#e8ad2f]" data-testid="bio-edit-input" />
                <input value={editData.profession} onChange={(e) => setEditData({ ...editData, profession: e.target.value })} placeholder="Role / profession" className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-3 text-sm text-white outline-none focus:border-[#e8ad2f]" data-testid="profession-edit-input" />
                <select value={editData.city} onChange={(e) => setEditData({ ...editData, city: e.target.value })} className="rounded-xl border border-white/15 bg-[#171d2a] px-3 py-3 text-sm text-white outline-none focus:border-[#e8ad2f]" data-testid="city-edit-input"><option value="">Select city</option>{cities.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
                <input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} placeholder="Email address" className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-3 text-sm text-white outline-none focus:border-[#e8ad2f]" data-testid="email-edit-input" />
                <input value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} placeholder="Phone number" className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-3 text-sm text-white outline-none focus:border-[#e8ad2f]" data-testid="phone-edit-input" />
                <div className="sm:col-span-2"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Profile mode</p><div className="grid grid-cols-2 gap-2">{[{ v: 'social', label: 'Social' }, { v: 'professional', label: 'Professional' }].map((k) => <button key={k.v} type="button" onClick={() => setEditData({ ...editData, user_kind: k.v })} className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${editData.user_kind === k.v ? 'border-[#e8ad2f] bg-[#e8ad2f] text-[#10131a]' : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white'}`}>{k.label}</button>)}</div></div>
                {editData.user_kind === 'professional' && <input value={editData.skills} onChange={(e) => setEditData({ ...editData, skills: e.target.value })} placeholder="Skills, separated by commas" className="sm:col-span-2 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-3 text-sm text-white outline-none focus:border-[#e8ad2f]" data-testid="skills-edit-input" />}
              </div>
            ) : (
              <>
                <p className="max-w-2xl text-base leading-7 text-white/72">{profileUser.bio || 'Add a concise bio to make your profile more memorable.'}</p>
                <div className="mt-4 flex flex-wrap gap-2.5 text-xs text-white/55">
                  {profileUser.profession && <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2"><Briefcase size={13} className="text-[#e8ad2f]" />{profileUser.profession}</span>}
                  {profileUser.city && <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2"><MapPin size={13} className="text-[#77aaff]" />{cities.find((c) => c.value === profileUser.city)?.label || profileUser.city}</span>}
                  {profileUser.email && <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2"><Mail size={13} className="text-[#77aaff]" />{profileUser.email}</span>}
                  {profileUser.phone && <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2"><Phone size={13} className="text-[#77aaff]" />{profileUser.phone}</span>}
                </div>
              </>
            )}
          </div>
        </motion.section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
          <section className="executive-tile relative overflow-hidden rounded-[26px] border border-white/10 bg-[#111827] p-5 sm:p-6">
            <div className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-[#2d82ff]/15 blur-2xl" />
            <div className="relative flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#7eaeff]">Network momentum</p><h2 className="mt-2 text-xl font-bold">Your score dashboard</h2></div><BarChart3 className="text-[#7eaeff]" size={21} /></div>
            <div className="relative mt-6 flex items-end justify-between"><div><p className="text-5xl font-black tracking-[-.05em] text-[#cce4ff]">{(profileUser.network_score || 0).toLocaleString()}</p><p className="mt-1 text-xs text-white/45">lifetime network points</p></div><div className="text-right"><p className="text-sm font-bold text-white/80">Next milestone</p><p className="mt-1 text-xs text-white/45">{getNextRankScore(profileUser.network_score || 0).toLocaleString()} pts</p></div></div>
            <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#2d82ff] via-[#79b2ff] to-[#e8ad2f]" style={{ width: `${Math.min(100, calculateProgress(profileUser.network_score || 0))}%` }} /></div>
            <div className="relative mt-3 flex items-center justify-between text-[11px] text-white/40"><span>Keep building meaningful connections</span><span className="text-[#e8ad2f]">{Math.round(calculateProgress(profileUser.network_score || 0))}%</span></div>
            <div className="relative mt-5 rounded-2xl border border-white/10 bg-black/15 p-3 sm:mt-6 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-white/40">Live activity trend</p><p className="mt-1 text-xs text-white/55">Score points earned per day</p></div>
                <div className="flex items-center gap-1 rounded-full bg-white/[.05] p-1" aria-label="Chart time range">
                  {[7, 14, 30].map((days) => <button key={days} type="button" onClick={() => setScorePeriodDays(days)} className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold transition ${scorePeriodDays === days ? 'bg-[#2d82ff] text-white' : 'text-white/45 hover:text-white'}`}>{days}D</button>)}
                </div>
              </div>
              <div className="mt-3 h-32 w-full sm:h-36">
                {scoreLoading && scoreActivity.length === 0 ? <div className="flex h-full items-center justify-center text-xs text-white/40">Refreshing score activity…</div> : scoreActivity.length > 0 ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={scoreActivity} margin={{ top: 8, right: 4, left: -26, bottom: 0 }}>
                  <defs><linearGradient id="scoreActivityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6fa8ff" stopOpacity={0.42} /><stop offset="100%" stopColor="#6fa8ff" stopOpacity={0.02} /></linearGradient></defs>
                  <XAxis dataKey="key" tickFormatter={(value) => String(value).slice(-5)} tick={{ fill: 'rgba(255,255,255,.35)', fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={22} />
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(126,174,255,.24)', borderRadius: 12, color: '#fff', fontSize: 11 }} labelStyle={{ color: 'rgba(255,255,255,.55)' }} formatter={(value, name) => [value, name === 'points' ? 'Points' : 'Events']} labelFormatter={(label) => `Day ${label}`} />
                  <Area type="monotone" dataKey="points" stroke="#79b2ff" strokeWidth={2} fill="url(#scoreActivityFill)" dot={false} activeDot={{ r: 4, fill: '#e8ad2f', stroke: '#111827', strokeWidth: 2 }} />
                </AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-white/35">No score activity in this range yet.</div>}
              </div>
            </div>
            <div className="relative mt-5 grid min-w-0 grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-2">
              <div className="min-w-0 rounded-2xl border border-[#2d82ff]/20 bg-[#2d82ff]/[0.08] p-3.5 sm:p-4">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1"><span className="inline-flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#8db7ff] sm:text-xs sm:tracking-wider"><Activity size={14} className="shrink-0" /> Activity</span><span className="text-[10px] text-white/35">This week</span></div>
                <p className="mt-2.5 truncate text-[1.7rem] font-black leading-none text-[#cce4ff] sm:mt-3 sm:text-2xl">{(scoreSummary?.weekly_score || 0).toLocaleString()} <span className="text-xs font-semibold text-white/40">pts</span></p>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[11px] text-white/45 sm:mt-3"><div className="min-w-0"><span className="block truncate">Today</span><span className="mt-1 block truncate font-bold text-white/75">{(scoreSummary?.daily_score || 0).toLocaleString()} pts</span></div><div className="min-w-0"><span className="block truncate">Time active</span><span className="mt-1 block truncate font-bold text-white/75">{scoreSummary?.session_minutes_today || 0} min</span></div></div>
              </div>
              <div className="min-w-0 rounded-2xl border border-[#e8ad2f]/20 bg-[#e8ad2f]/[0.07] p-3.5 sm:p-4">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1"><span className="inline-flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#f1c768] sm:text-xs sm:tracking-wider"><MessageCircle size={14} className="shrink-0" /> Engagement</span><span className="text-[10px] text-white/35">All time</span></div>
                <p className="mt-2.5 truncate text-[1.7rem] font-black leading-none text-[#f4cf76] sm:mt-3 sm:text-2xl">{((profileUser.likes_received_count || 0) + (profileUser.comments_given_count || 0)).toLocaleString()} <span className="text-xs font-semibold text-white/40">signals</span></p>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[11px] text-white/45 sm:mt-3"><div className="min-w-0"><span className="block truncate">Likes received</span><span className="mt-1 block truncate font-bold text-white/75">{(profileUser.likes_received_count || 0).toLocaleString()}</span></div><div className="min-w-0"><span className="block truncate">Comments given</span><span className="mt-1 block truncate font-bold text-white/75">{(profileUser.comments_given_count || 0).toLocaleString()}</span></div></div>
              </div>
            </div>
          </section>

          <section className="executive-tile rounded-[26px] border border-[#e8ad2f]/25 bg-gradient-to-br from-[#1e1b16] to-[#121722] p-5 sm:p-6">
            <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#e8ad2f]">Referral access</p><h2 className="mt-2 text-xl font-bold">Grow your circle</h2></div><Link2 className="text-[#e8ad2f]" size={20} /></div>
            <p className="mt-3 text-sm leading-6 text-white/55">Share your personal link and earn points when your network joins.</p>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-3"><span className="min-w-0 flex-1 truncate font-mono text-xs text-[#f1c768]">{referralLink.replace(window.location.origin, '')}</span><button onClick={copyReferralLink} className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white" aria-label="Copy referral link"><Copy size={15} /></button></div>
            <div className="mt-4 flex gap-2"><button onClick={copyReferralLink} className="flex-1 rounded-xl bg-[#e8ad2f] px-3 py-2.5 text-xs font-bold text-[#10131a] transition hover:bg-[#f2c45a] active:scale-[.97]">Copy link</button><button onClick={() => navigate('/referral')} className="inline-flex items-center justify-center rounded-xl border border-white/15 px-3 py-2.5 text-white/70 transition hover:border-white/30 hover:text-white" aria-label="Open referrals"><ArrowUpRight size={16} /></button></div>
          </section>
        </div>

        <section className="executive-tile mt-4 rounded-[26px] border border-white/10 bg-[#101621] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#e8ad2f]">Workspace</p><h2 className="mt-1 text-xl font-bold">Your toolkit</h2></div><span className="text-xs text-white/35">Curated access</span></div>
          {isOwnProfile && <OwnModuleGrid profile={profileUser} variant="quick-access" />}
        </section>

        {profileUser.user_kind === 'professional' && (
          <section className="executive-tile mt-4 rounded-[26px] border border-white/10 bg-[#101621] p-5 sm:p-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2d82ff]/15 text-[#8db7ff]"><Briefcase size={20} /></div><div><p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#7eaeff]">Professional showcase</p><h2 className="mt-1 text-xl font-bold">Your edge, clearly presented</h2></div></div><div className="mt-5 flex flex-wrap gap-2">{(profileUser.skills || []).length ? profileUser.skills.map((skill) => <span key={skill} className="rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-white/65">{skill}</span>) : <p className="text-sm italic text-white/40">No skills yet — tap Edit profile to add some.</p>}</div><button onClick={() => navigate('/jobs')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#2d82ff] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#438fff] active:scale-[.97]">Browse opportunities <ArrowUpRight size={16} /></button></section>
        )}

        <section className="executive-tile mt-4 rounded-[26px] border border-white/10 bg-[#101621] p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.25em] text-white/35">Profile media</p><h2 className="mt-1 text-xl font-bold">Proof of work</h2></div><div className="flex gap-1 rounded-full bg-white/[.05] p-1">{[['photos', Camera, photos.length], ['videos', Video, videos.length], ['articles', FileText, articles.length]].map(([tab, Icon, count]) => <button key={tab} onClick={() => setMediaTab(tab)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition ${mediaTab === tab ? 'bg-[#2d82ff] text-white' : 'text-white/45 hover:text-white'}`}><Icon size={13} />{tab[0].toUpperCase() + tab.slice(1)} <span className="opacity-60">{count}</span></button>)}</div></div>
          {mediaTab === 'photos' && <div className="mt-5 grid grid-cols-3 gap-3">{isOwnProfile && <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[.03] text-white/45 transition hover:border-[#2d82ff] hover:text-white" data-testid="add-photo-tile"><Plus size={25} /><span className="mt-2 text-xs">Add photo</span><input type="file" accept="image/*" onChange={handleAddPhoto} className="hidden" disabled={uploading} /></label>}{photos.map((p) => <div key={p.id} className="group relative aspect-square overflow-hidden rounded-2xl"><img src={p.data_url} alt={p.caption || 'Profile media'} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />{isOwnProfile && <button onClick={() => handleDeletePhoto(p.id)} className="absolute right-2 top-2 rounded-full bg-black/70 p-2 text-white opacity-0 transition group-hover:opacity-100" data-testid={`delete-photo-${p.id}`}><Trash2 size={13} /></button>}</div>)}</div>}
          {mediaTab === 'videos' && <div className="mt-5 space-y-3">{isOwnProfile && <label className="block w-full cursor-pointer rounded-2xl border border-dashed border-white/15 bg-white/[.03] py-6 text-center text-white/45" data-testid="add-video-tile"><Video className="mx-auto mb-2" size={24} /><span className="text-xs">{uploading ? 'Uploading…' : 'Upload video'}</span><input type="file" accept="video/*" onChange={handleAddVideo} className="hidden" disabled={uploading} /></label>}{videos.map((v) => <div key={v.id} className="relative overflow-hidden rounded-2xl bg-black"><video src={v.data_url} controls className="max-h-80 w-full" />{isOwnProfile && <button onClick={() => handleDeleteVideo(v.id)} className="absolute right-2 top-2 rounded-full bg-black/70 p-2 text-white" data-testid={`delete-video-${v.id}`}><Trash2 size={13} /></button>}</div>)}</div>}
          {mediaTab === 'articles' && <div className="mt-5 space-y-3">{isOwnProfile && <button onClick={() => setShowArticleModal(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[.03] py-6 text-sm text-white/55 transition hover:border-[#2d82ff] hover:text-white"><Plus size={18} /> Publish an article</button>}{articles.map((a) => <div key={a.id} className="relative rounded-2xl border border-white/10 bg-white/[.03] p-4"><h4 className="font-bold text-white">{a.title}</h4><p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-white/55">{a.content}</p>{isOwnProfile && <button onClick={() => handleDeleteArticle(a.id)} className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white/60 hover:text-white" data-testid={`delete-article-${a.id}`}><Trash2 size={13} /></button>}</div>)}</div>}
        </section>

        {isOwnProfile && <div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={() => navigate('/help')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[.04] py-3.5 text-sm font-semibold text-white/70 transition hover:bg-white/[.08] hover:text-white" data-testid="help-center-button"><HelpCircle size={17} /> Help Center & FAQ</button><button onClick={handleLogout} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#ff7b7b]/20 bg-[#ff7b7b]/[.06] py-3.5 text-sm font-semibold text-[#ff9b9b] transition hover:bg-[#ff7b7b]/[.12]" data-testid="logout-button"><LogOut size={17} /> Log out</button></div>}
      </main>

      {showArticleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowArticleModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
            data-testid="article-modal"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold">Write an Article</h2>
              <button onClick={() => setShowArticleModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <input
              type="text"
              value={articleDraft.title}
              onChange={(e) => setArticleDraft({ ...articleDraft, title: e.target.value })}
              placeholder="Title"
              className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-primary mb-3"
              data-testid="article-title-input"
            />
            <textarea
              value={articleDraft.content}
              onChange={(e) => setArticleDraft({ ...articleDraft, content: e.target.value })}
              placeholder="Share your notes, thoughts, or a short article…"
              rows={8}
              className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-primary resize-none"
              data-testid="article-content-input"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowArticleModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-text-primary font-medium py-3 rounded-full"
              >
                Cancel
              </button>
              <button
                onClick={handlePublishArticle}
                className="flex-1 bg-primary hover:bg-primary-hover text-white font-medium py-3 rounded-full"
                data-testid="publish-article-btn"
              >
                Publish
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;