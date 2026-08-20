import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Edit2, Save, X, LogOut, Users, HelpCircle, MapPin, Camera, Video, FileText, Trash2, Plus, Network, Package, MessageCircle, Sparkles, Briefcase, Trophy } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    username: user.username,
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
        username: editData.username,
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-6">
      {isOwnProfile && (
        <FeatureIntroModal
          featureKey="profile"
          icon={<Users size={20} />}
          title="Your Profile"
          subtitle="Your home base for media, banking, Quick Access, and your Network Score."
          bullets={[
            { icon: <Edit2 size={14} />, label: 'Edit anytime', body: 'Tap Edit to update photo, bio, city, profession, and birth month.' },
            { icon: <Sparkles size={14} />, label: 'Quick Access menu', body: 'Wallet, Score Tracker, Stokvels, Messages, Products and Notifications all start here.' },
            { icon: <Trophy size={14} />, label: 'Score & rank', body: 'See your live Network Score, current rank, and progress to the next tier.' },
          ]}
        />
      )}
      <div className="bg-gradient-to-br from-primary to-secondary h-32"></div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 -mt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
        >
          <div className="flex items-start gap-4 mb-6">
            <div className="relative">
              {editing ? (
                <label className="cursor-pointer group">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={editData.photo} />
                    <AvatarFallback>{editData.username[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Edit2 className="text-white" size={20} />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    data-testid="profile-photo-input"
                  />
                </label>
              ) : (
                <Avatar className="w-24 h-24">
                  <AvatarImage src={profileUser.photo} />
                  <AvatarFallback>{profileUser.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
              )}
            </div>

            <div className="flex-1">
              {editing ? (
                <input
                  type="text"
                  value={editData.username}
                  onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                  className="text-2xl font-heading font-bold mb-2 w-full border border-gray-300 rounded-lg px-3 py-1 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  data-testid="username-edit-input"
                />
              ) : (
                <h1 className="text-2xl font-heading font-bold text-text-primary mb-2">
                  {profileUser.username}
                </h1>
              )}
              <RankBadge rank={profileUser.rank} />
            </div>

            {isOwnProfile && (
              <div className="flex gap-2 items-center">
                {/* Iter 56e — visible "My Store" entry from the profile header */}
                {!editing && (
                  <button
                    onClick={() => navigate('/my-store')}
                    className="inline-flex items-center gap-1.5 bg-gradient-to-r from-secondary to-yellow-500 hover:from-yellow-500 hover:to-secondary text-primary px-3 py-2 rounded-full text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
                    data-testid="profile-my-store-button"
                    aria-label="Open my store"
                  >
                    <Package size={14} /> My Store
                  </button>
                )}
                {editing ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="bg-secondary hover:bg-secondary-hover text-white p-2 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
                      data-testid="save-profile-button"
                    >
                      <Save size={20} />
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setEditData({
                          username: user.username,
                          bio: user.bio,
                          photo: user.photo,
                          city: user.city || '',
                          profession: user.profession || '',
                        });
                      }}
                      className="bg-gray-200 hover:bg-gray-300 text-text-primary p-2 rounded-full transition-all"
                      data-testid="cancel-edit-button"
                    >
                      <X size={20} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="bg-primary hover:bg-primary-hover text-white p-2 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95"
                    data-testid="edit-profile-button"
                  >
                    <Edit2 size={20} />
                  </button>
                )}
              </div>
            )}
            {!isOwnProfile && profileUser.id && (
              <button
                onClick={() => navigate(`/messages/${profileUser.id}`)}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-full text-sm font-semibold shadow-md hover:shadow-lg active:scale-95 transition-all"
                data-testid="profile-message-button"
              >
                <MessageCircle size={16} /> Message
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3 mb-4">
              <textarea
                value={editData.bio}
                onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                placeholder="Write something about yourself..."
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                data-testid="bio-edit-input"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={editData.city}
                  onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                  className="p-3 border border-gray-300 rounded-xl outline-none"
                  data-testid="city-edit-input"
                >
                  <option value="">Select city…</option>
                  {cities.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={editData.profession}
                  onChange={(e) => setEditData({ ...editData, profession: e.target.value })}
                  placeholder="Profession (e.g., Designer)"
                  className="p-3 border border-gray-300 rounded-xl outline-none"
                  data-testid="profession-edit-input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Birth Month — used for personalised referrals &amp; birthday recognition</label>
                <select
                  value={editData.birth_month}
                  onChange={(e) => setEditData({ ...editData, birth_month: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  data-testid="birth-month-edit-input"
                >
                  <option value="">Select your birth month…</option>
                  {MONTHS.map((m) => (
                    <option key={m.v} value={m.v}>{m.l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Profile type</label>
                <div className="grid grid-cols-2 gap-2" data-testid="user-kind-edit">
                  {[{ v: 'social', label: 'Social' }, { v: 'professional', label: 'Professional' }].map((k) => (
                    <button
                      key={k.v}
                      type="button"
                      onClick={() => setEditData({ ...editData, user_kind: k.v })}
                      className={`p-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        editData.user_kind === k.v
                          ? 'bg-primary text-white border-primary'
                          : 'bg-background-subtle border-gray-200 text-text-primary hover:bg-gray-50'
                      }`}
                      data-testid={`user-kind-edit-${k.v}`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>
              {editData.user_kind === 'professional' && (
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Skills (comma-separated)</label>
                  <input
                    type="text"
                    value={editData.skills}
                    onChange={(e) => setEditData({ ...editData, skills: e.target.value })}
                    placeholder="React, Sales, Onboarding, …"
                    className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    data-testid="skills-edit-input"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="mb-6">
              <p className="text-text-secondary mb-2">{profileUser.bio || 'No bio yet'}</p>
              <div className="flex flex-wrap gap-2 text-sm">
                {profileUser.city && (
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full">
                    <MapPin size={12} />
                    {cities.find((c) => c.value === profileUser.city)?.label || profileUser.city}
                  </span>
                )}
                {profileUser.profession && (
                  <span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary px-3 py-1 rounded-full">
                    <Network size={12} />
                    {profileUser.profession}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl p-6 mb-6">
            {/* Always-visible Profile-type toggle (Social ↔ Professional) */}
            <div className="mb-4" data-testid="user-kind-toggle">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-text-muted mb-1.5">Profile type</p>
              <div className="inline-flex p-1 bg-white rounded-full border border-gray-200">
                {[{ v: 'social', label: 'Social' }, { v: 'professional', label: 'Professional' }].map((k) => (
                  <button
                    key={k.v}
                    type="button"
                    disabled={profileUser.user_kind === k.v}
                    onClick={async () => {
                      try {
                        const res = await axiosInstance.put('/users/me', { user_kind: k.v });
                        setUser(res.data);
                        setProfileUser(res.data);
                        setEditData((prev) => ({ ...prev, user_kind: k.v }));
                        toast.success(`Switched to ${k.label}`);
                      } catch (err) {
                        toast.error(err.response?.data?.detail || 'Could not switch profile type');
                      }
                    }}
                    className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
                      profileUser.user_kind === k.v
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-text-secondary hover:text-primary'
                    }`}
                    data-testid={`user-kind-toggle-${k.v}`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
            {profileUser.user_kind === 'professional' && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-3 bg-primary text-white text-[10px] font-bold uppercase tracking-wider rounded-full" data-testid="professional-badge">
                <Briefcase size={11} /> Professional
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-secondary">Network Score</span>
              <span className="text-xs text-text-muted">
                {profileUser.network_score?.toLocaleString?.() || profileUser.network_score} pts
                {(profileUser.network_score || 0) >= 10000 && (
                  <span className="ml-1.5 inline-flex items-center text-[10px] font-bold text-secondary bg-secondary/10 border border-secondary/30 px-1.5 py-0.5 rounded-full">★ Top Contributor</span>
                )}
              </span>
            </div>
            <NetworkScore score={profileUser.network_score} size="large" />
            <Progress value={Math.min(100, ((profileUser.network_score || 0) / 10000) * 100)} className="mt-3 h-2" />
            <p className="text-[11px] text-text-muted mt-1">Score grows uncapped. Hit <strong>10,000 this month</strong> to unlock the Top Contributor badge.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-background-subtle rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{profileUser.network_score}</p>
              <p className="text-sm text-text-secondary">Network Score</p>
            </div>
            <div className="bg-background-subtle rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-secondary">${profileUser.wallet_balance?.toFixed(2) || '0.00'}</p>
              <p className="text-sm text-text-secondary">Wallet Balance</p>
            </div>
          </div>

          {/* Professional showcase — visible only when user_kind = 'professional' */}
          {profileUser.user_kind === 'professional' && (
            <div className="bg-white rounded-2xl border border-primary/20 p-5 mb-6" data-testid="professional-showcase">
              <h3 className="font-heading font-bold text-primary mb-3 flex items-center gap-2">
                <Briefcase size={16} /> Professional showcase
              </h3>
              {Array.isArray(profileUser.skills) && profileUser.skills.length > 0 ? (
                <div className="mb-4">
                  <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profileUser.skills.map((s, i) => (
                      <span key={i} className="px-2.5 py-1 bg-primary/8 text-primary text-xs font-semibold rounded-full border border-primary/15">{s}</span>
                    ))}
                  </div>
                </div>
              ) : isOwnProfile ? (
                <p className="text-xs text-text-muted italic mb-3">No skills yet — tap Edit to add some.</p>
              ) : null}
              {Array.isArray(profileUser.experience) && profileUser.experience.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-2">Experience</p>
                  <div className="space-y-2">
                    {profileUser.experience.map((x, i) => (
                      <div key={i} className="text-sm">
                        <p className="font-semibold text-text-primary">{x.role || x.title}</p>
                        <p className="text-xs text-text-secondary">{x.company} {x.period ? `· ${x.period}` : ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {isOwnProfile && (
                <button onClick={() => navigate('/jobs')}
                  className="mt-4 w-full bg-primary text-white py-2 rounded-full text-xs font-semibold hover:bg-primary-hover">
                  Browse jobs →
                </button>
              )}
            </div>
          )}

          {isOwnProfile && profileUser.share_code && (
            <div className="bg-secondary/8 rounded-xl p-4 border border-secondary/30 mb-6" data-testid="profile-share-code-card">
              <p className="text-xs text-text-muted mb-1.5">Your code — for referrals &amp; Stokvel+ invites</p>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-mono font-bold text-secondary break-all">{profileUser.share_code}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(profileUser.share_code);
                      toast.success('Code copied!');
                    }}
                    className="text-primary hover:text-primary-hover text-xs font-medium"
                    data-testid="profile-share-code-copy"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => navigate('/referral')}
                    className="text-xs font-semibold text-primary border border-primary/40 px-3 py-1 rounded-full hover:bg-primary/5"
                    data-testid="profile-share-code-share"
                  >
                    Share
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============== MEDIA GALLERY ============== */}
          <div className="border-t border-gray-100 pt-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-bold text-text-primary">Profile Media</h3>
              {isOwnProfile && mediaTab === 'articles' && (
                <button
                  onClick={() => setShowArticleModal(true)}
                  className="text-secondary hover:text-secondary-hover font-medium text-sm flex items-center gap-1"
                  data-testid="new-article-btn"
                >
                  <Plus size={16} /> New
                </button>
              )}
            </div>
            <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-full text-sm">
              {[
                { k: 'photos', label: 'Photos', icon: Camera, count: photos.length },
                { k: 'videos', label: 'Videos', icon: Video, count: videos.length },
                { k: 'articles', label: 'Articles', icon: FileText, count: articles.length },
              ].map((t) => {
                const Icon = t.icon;
                const active = mediaTab === t.k;
                return (
                  <button
                    key={t.k}
                    onClick={() => setMediaTab(t.k)}
                    className={`flex-1 py-1.5 rounded-full font-medium flex items-center justify-center gap-1 transition-all ${
                      active ? 'bg-primary text-white shadow-sm' : 'text-text-secondary'
                    }`}
                    data-testid={`media-tab-${t.k}`}
                  >
                    <Icon size={13} /> {t.label} ({t.count})
                  </button>
                );
              })}
            </div>

            {mediaTab === 'photos' && (
              <div className="grid grid-cols-3 gap-2">
                {isOwnProfile && (
                  <label className="aspect-square bg-gray-100 hover:bg-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer text-text-muted transition-all" data-testid="add-photo-tile">
                    <Plus size={24} />
                    <span className="text-xs mt-1">{uploading ? 'Uploading…' : 'Add'}</span>
                    <input type="file" accept="image/*" onChange={handleAddPhoto} className="hidden" disabled={uploading} />
                  </label>
                )}
                {photos.map((p) => (
                  <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden group">
                    <img src={p.data_url} alt={p.caption} className="w-full h-full object-cover" />
                    {isOwnProfile && (
                      <button
                        onClick={() => handleDeletePhoto(p.id)}
                        className="absolute top-1 right-1 bg-red-500/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`delete-photo-${p.id}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {photos.length === 0 && !isOwnProfile && (
                  <p className="col-span-3 text-center text-text-muted text-sm py-6">No photos yet</p>
                )}
              </div>
            )}

            {mediaTab === 'videos' && (
              <div className="space-y-3">
                {isOwnProfile && (
                  <label className="block w-full bg-gray-100 hover:bg-gray-200 border-2 border-dashed border-gray-300 rounded-xl py-6 text-center cursor-pointer text-text-muted" data-testid="add-video-tile">
                    <Video className="mx-auto mb-1" size={24} />
                    <p className="text-sm font-medium">{uploading ? 'Uploading…' : 'Upload video (max 3MB)'}</p>
                    <input type="file" accept="video/*" onChange={handleAddVideo} className="hidden" disabled={uploading} />
                  </label>
                )}
                {videos.map((v) => (
                  <div key={v.id} className="relative bg-black rounded-xl overflow-hidden">
                    <video src={v.data_url} controls className="w-full max-h-72" />
                    {isOwnProfile && (
                      <button
                        onClick={() => handleDeleteVideo(v.id)}
                        className="absolute top-2 right-2 bg-red-500/80 text-white p-1.5 rounded-full"
                        data-testid={`delete-video-${v.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {videos.length === 0 && !isOwnProfile && (
                  <p className="text-center text-text-muted text-sm py-6">No videos yet</p>
                )}
              </div>
            )}

            {mediaTab === 'articles' && (
              <div className="space-y-3">
                {articles.map((a) => (
                  <div key={a.id} className="bg-background-subtle rounded-xl p-4 relative group">
                    <h4 className="font-bold text-text-primary mb-1">{a.title}</h4>
                    <p className="text-text-secondary text-sm whitespace-pre-wrap line-clamp-3">{a.content}</p>
                    <p className="text-xs text-text-muted mt-2">{new Date(a.created_at).toLocaleDateString()}</p>
                    {isOwnProfile && (
                      <button
                        onClick={() => handleDeleteArticle(a.id)}
                        className="absolute top-2 right-2 bg-red-100 text-red-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`delete-article-${a.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {articles.length === 0 && (
                  <p className="text-center text-text-muted text-sm py-6">
                    {isOwnProfile ? 'Write your first article — share notes, thoughts, ideas' : 'No articles yet'}
                  </p>
                )}
              </div>
            )}
          </div>

          {isOwnProfile && (
            <>
              {/* Quick Access grid — shared OwnModuleGrid component */}
              <OwnModuleGrid profile={profileUser} variant="quick-access" />

              <button
                onClick={() => window.location.href = '/referral'}
                className="w-full flex items-center justify-center gap-2 bg-secondary hover:bg-secondary-hover text-white font-medium py-3 rounded-full transition-all shadow-md hover:shadow-lg active:scale-95 mb-3"
                data-testid="referral-button"
              >
                <Users size={20} />
                Invite Friends (+200 pts)
              </button>
              <button
                onClick={() => navigate('/help')}
                className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary font-medium py-3 rounded-full transition-all border border-primary/20 mb-3"
                data-testid="help-center-button"
              >
                <HelpCircle size={20} />
                Help Center & FAQ
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-medium py-3 rounded-full transition-all border border-red-200"
                data-testid="logout-button"
              >
                <LogOut size={20} />
                Logout
              </button>
            </>
          )}
        </motion.div>
      </div>

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