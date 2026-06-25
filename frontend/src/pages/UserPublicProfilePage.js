import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, UserPlus, UserCheck, Crown, MoreVertical, MapPin, Briefcase, Grid3x3, Bookmark, Share2, Loader2, Sparkles, Image as ImageIcon, Camera, HelpCircle, Settings, LogOut, Flag, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { axiosInstance } from '../App';
import OwnModuleGrid from '../components/profile/OwnModuleGrid';

/* /u/:username — Original Instagram-feel public profile.
 *  Composition (top to bottom):
 *    1. Sticky translucent header with back + @handle + actions menu
 *    2. Hero band: gradient ring avatar (gold if posts > 0) · stats triplet
 *       (posts · connections · network score)
 *    3. Identity block: full name + ambassador crown + city/profession + bio
 *    4. Action row: Connect / Message / Share — sticky-feel
 *    5. Highlights row (last 4 posts as round thumbs if any) — original twist
 *    6. Tabs: GRID · TAGGED. Posts grid (3-col, square, with hover overlay)
 *    7. Empty state encouraging the user to post — only shown on own profile
 */
const UserPublicProfilePage = ({ user: currentUser }) => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('grid');
  const [busyConnect, setBusyConnect] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isOwnProfile = currentUser && profile && currentUser.id === profile.id;

  useEffect(() => {
    const onClickAway = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [menuOpen]);

  const handleLogout = () => {
    if (!window.confirm('Sign out of Network Capital?')) return;
    try {
      localStorage.removeItem('token');
      sessionStorage.removeItem('nc_super_pin_token');
      sessionStorage.removeItem('nc_super_pin_exp');
    } catch { /* ignored */ }
    toast.success('Signed out');
    window.location.href = '/';
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const r = await axiosInstance.get(`/users/by-username/${encodeURIComponent(username)}`);
        setProfile(r.data);
        try {
          const ph = await axiosInstance.get(`/users/${r.data.id}/posts`);
          setPosts(ph.data?.posts || []);
        } catch { /* posts optional — render profile anyway */ }
      } catch (e) {
        toast.error(e.response?.data?.detail || 'Profile not found');
      } finally { setLoading(false); }
    };
    if (username) load();
  }, [username]);

  const handleConnect = async () => {
    if (!profile || isOwnProfile) return;
    setBusyConnect(true);
    try {
      await axiosInstance.post('/connections/request', { target_id: profile.id });
      toast.success(`Connection request sent to @${profile.username}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not send request');
    } finally { setBusyConnect(false); }
  };

  const handleMessage = () => {
    if (!profile || isOwnProfile) return;
    navigate(`/messages?to=${profile.id}`);
  };

  const handleShare = async () => {
    const url = `https://networkcapitalapp.co.za/u/${profile?.username}`;
    if (navigator.share) {
      try { await navigator.share({ title: `@${profile?.username} on Network Capital`, url }); } catch { /* ignored */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Profile link copied');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#04101e] flex items-center justify-center">
        <Loader2 className="text-white/40 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#04101e] text-white flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-white/55 mb-4">Profile not found.</p>
          <button onClick={() => navigate(-1)} className="bg-[#E8A817] text-[#04101e] text-sm font-bold px-5 py-2 rounded-full">Go back</button>
        </div>
      </div>
    );
  }

  const hasPosts = posts.length > 0;
  const score = profile.network_score || 0;
  const ambassador = profile.is_ambassador;

  return (
    <div className="min-h-screen bg-[#04101e] text-white pb-24" data-testid="user-public-profile">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#04101e]/85 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/5" data-testid="back-btn">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-heading font-bold text-base flex-1 truncate">@{profile.username}</h1>
          <button onClick={handleShare} className="p-2 rounded-full hover:bg-white/5" data-testid="share-btn">
            <Share2 size={18} />
          </button>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen((v) => !v)} className="p-2 rounded-full hover:bg-white/5" data-testid="profile-menu-btn">
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 mt-2 w-56 bg-[#0a1f3a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-30"
                data-testid="profile-menu"
              >
                {isOwnProfile ? (
                  <>
                    <MenuItem icon={UserCheck} label="Edit profile" onClick={() => { setMenuOpen(false); navigate('/profile'); }} testid="menu-edit" />
                    <MenuItem icon={Settings} label="Settings" onClick={() => { setMenuOpen(false); navigate('/settings'); }} testid="menu-settings" />
                    <MenuItem icon={HelpCircle} label="Help" onClick={() => { setMenuOpen(false); navigate('/help'); }} testid="menu-help" />
                    <div className="border-t border-white/10" />
                    <MenuItem icon={LogOut} label="Sign out" onClick={() => { setMenuOpen(false); handleLogout(); }} testid="menu-logout" danger />
                  </>
                ) : (
                  <>
                    <MenuItem icon={Share2} label="Share profile" onClick={() => { setMenuOpen(false); handleShare(); }} testid="menu-share" />
                    <MenuItem icon={Flag} label="Report" onClick={() => { setMenuOpen(false); toast.info('Report received — our team will review.'); }} testid="menu-report" />
                    <MenuItem icon={UserX} label="Block" onClick={() => { setMenuOpen(false); toast.info('Blocking feature coming soon.'); }} testid="menu-block" />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4">
        {/* Hero band */}
        <div className="flex items-center gap-5 sm:gap-8 py-5">
          <div className={`relative shrink-0 ${hasPosts ? 'p-[3px] rounded-full bg-gradient-to-tr from-[#E8A817] via-fuchsia-500 to-[#1e4fa5]' : ''}`} data-testid="avatar">
            <div className="rounded-full bg-[#04101e] p-[2px]">
              {profile.photo ? (
                <img src={profile.photo} alt="" className="w-20 h-20 sm:w-28 sm:h-28 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-[#1e4fa5] to-[#0a1f3a] flex items-center justify-center text-3xl font-bold">
                  {(profile.full_name || profile.username || '?')[0].toUpperCase()}
                </div>
              )}
            </div>
            {ambassador && (
              <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#04101e] border-2 border-[#E8A817] flex items-center justify-center" title="Ambassador">
                <Crown size={12} className="text-[#E8A817] fill-[#E8A817]" />
              </span>
            )}
          </div>
          <div className="flex-1 grid grid-cols-3 gap-2 text-center">
            <Stat label="posts" value={profile.posts_count || 0} testid="stat-posts" />
            <Stat label="connections" value={profile.connections_count || 0} testid="stat-connections" />
            <Stat label="score" value={(score >= 1000 ? `${(score / 1000).toFixed(1)}K` : score)} testid="stat-score" />
          </div>
        </div>

        {/* Identity block */}
        <div className="pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-heading font-bold text-base sm:text-lg" data-testid="full-name">{profile.full_name || profile.username}</h2>
            {ambassador && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#E8A817] bg-[#E8A817]/10 border border-[#E8A817]/30 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
                <Crown size={9} /> AMBASSADOR
              </span>
            )}
            {profile.role === 'super_admin' && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-white bg-white/15 border border-white/30 px-1.5 py-0.5 rounded-full">OWNER</span>
            )}
            {profile.role === 'admin' && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-200 bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.5 rounded-full">ADMIN</span>
            )}
            {profile.is_founder && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-fuchsia-200 bg-fuchsia-500/15 border border-fuchsia-500/30 px-1.5 py-0.5 rounded-full">FOUNDER</span>
            )}
          </div>
          {(profile.city || profile.country || profile.profession) && (
            <p className="text-[12px] text-white/55 mt-1 inline-flex items-center gap-2 flex-wrap">
              {(profile.city || profile.country) && (
                <span className="inline-flex items-center gap-1"><MapPin size={10} /> {[profile.city, profile.country].filter(Boolean).join(', ').replace(/_/g, ' ')}</span>
              )}
              {profile.profession && <span className="inline-flex items-center gap-1"><Briefcase size={10} /> {profile.profession}</span>}
            </p>
          )}
          {profile.bio && <p className="text-sm text-white/85 mt-2 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>}
        </div>

        {/* Action row */}
        {!isOwnProfile && (
          <div className="grid grid-cols-3 gap-2 pb-5" data-testid="action-row">
            <button onClick={handleConnect} disabled={busyConnect}
                    className="bg-[#E8A817] text-[#04101e] font-bold text-xs sm:text-sm py-2.5 rounded-xl inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                    data-testid="btn-connect">
              {busyConnect ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={13} />}
              Connect
            </button>
            <button onClick={handleMessage}
                    className="bg-white/[0.08] hover:bg-white/[0.12] text-white font-bold text-xs sm:text-sm py-2.5 rounded-xl border border-white/10 inline-flex items-center justify-center gap-1.5"
                    data-testid="btn-message">
              <MessageCircle size={13} /> Message
            </button>
            <button onClick={handleShare}
                    className="bg-white/[0.08] hover:bg-white/[0.12] text-white font-bold text-xs sm:text-sm py-2.5 rounded-xl border border-white/10 inline-flex items-center justify-center gap-1.5"
                    data-testid="btn-share">
              <Share2 size={13} /> Share
            </button>
          </div>
        )}

        {/* Own-profile action row */}
        {isOwnProfile && (
          <>
            <div className="grid grid-cols-2 gap-2 pb-4" data-testid="own-action-row">
              <button onClick={() => navigate('/profile')}
                      className="bg-white/[0.08] hover:bg-white/[0.12] text-white font-bold text-xs sm:text-sm py-2.5 rounded-xl border border-white/10 inline-flex items-center justify-center gap-1.5"
                      data-testid="btn-edit-profile">
                <UserCheck size={13} /> Edit profile
              </button>
              <button onClick={handleShare}
                      className="bg-[#E8A817] text-[#04101e] font-bold text-xs sm:text-sm py-2.5 rounded-xl inline-flex items-center justify-center gap-1.5"
                      data-testid="btn-share">
                <Share2 size={13} /> Share my profile
              </button>
            </div>

            {/* Dark navy module grid — only for own profile */}
            <OwnModuleGrid profile={profile} onNavigate={navigate} variant="own-module" />
          </>
        )}

        {/* Highlights row — last 4 posts as round thumbnails */}
        {hasPosts && (
          <div className="flex gap-3 overflow-x-auto pb-4 mb-2 no-scrollbar" data-testid="highlights-row">
            {posts.slice(0, 4).map((p, idx) => (
              <button key={p.id || idx} onClick={() => navigate(`/posts/${p.id}`)} className="shrink-0 group" data-testid={`highlight-${idx}`}>
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-[2px] bg-gradient-to-tr from-[#E8A817] via-fuchsia-500 to-[#1e4fa5]">
                  <div className="rounded-full bg-[#04101e] p-[2px] w-full h-full">
                    {p.image
                      ? <img src={p.image} alt="" className="w-full h-full rounded-full object-cover" />
                      : <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center text-white/30"><Sparkles size={16} /></div>
                    }
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="border-t border-white/10 flex items-center justify-center gap-12 text-white/55" data-testid="tabs">
          <button
            onClick={() => setTab('grid')}
            className={`py-3 inline-flex items-center gap-1.5 text-xs uppercase tracking-widest border-t-2 -mt-px ${tab === 'grid' ? 'border-[#E8A817] text-white' : 'border-transparent'}`}
            data-testid="tab-grid">
            <Grid3x3 size={14} /> Posts
          </button>
          <button
            onClick={() => setTab('saved')}
            className={`py-3 inline-flex items-center gap-1.5 text-xs uppercase tracking-widest border-t-2 -mt-px ${tab === 'saved' ? 'border-[#E8A817] text-white' : 'border-transparent'}`}
            data-testid="tab-saved">
            <Bookmark size={14} /> Tagged
          </button>
        </div>

        {/* Grid */}
        {tab === 'grid' && (
          hasPosts ? (
            <div className="grid grid-cols-3 gap-0.5 mt-0.5" data-testid="posts-grid">
              {posts.map((p, idx) => (
                <button
                  key={p.id || idx}
                  onClick={() => navigate(`/posts/${p.id}`)}
                  className="aspect-square bg-white/[0.04] border border-white/[0.04] relative group overflow-hidden"
                  data-testid={`post-thumb-${idx}`}
                >
                  {p.image ? (
                    <img src={p.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : p.video ? (
                    <div className="w-full h-full bg-black flex items-center justify-center">
                      <Camera size={20} className="text-white/40" />
                    </div>
                  ) : (
                    <div className="w-full h-full p-2 flex items-center justify-center text-[10px] text-white/55 line-clamp-4 leading-tight">
                      {(p.content || '').slice(0, 80)}
                    </div>
                  )}
                  {p.is_official && (
                    <div className="absolute top-1 right-1 bg-[#E8A817] text-[#04101e] text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">Official</div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <PostEmptyState isOwn={isOwnProfile} navigate={navigate} />
          )
        )}

        {tab === 'saved' && (
          <div className="py-16 text-center text-white/40 text-sm" data-testid="tagged-empty">
            <Bookmark size={28} className="mx-auto mb-2 opacity-40" />
            No tagged posts yet.
          </div>
        )}
      </main>
    </div>
  );
};

const Stat = ({ label, value, testid }) => (
  <div data-testid={testid}>
    <p className="font-heading font-bold text-lg sm:text-xl">{value}</p>
    <p className="text-[11px] uppercase tracking-wider text-white/55">{label}</p>
  </div>
);

const MenuItem = ({ icon: Icon, label, onClick, testid, danger }) => (
  <button
    onClick={onClick}
    className={`w-full px-4 py-3 flex items-center gap-3 text-sm text-left hover:bg-white/5 transition-colors ${
      danger ? 'text-red-300 hover:text-red-200' : 'text-white/90'
    }`}
    data-testid={testid}
  >
    <Icon size={15} className={danger ? 'text-red-400' : 'text-white/55'} />
    <span className="font-semibold">{label}</span>
  </button>
);

const PostEmptyState = ({ isOwn, navigate }) => (
  <div className="py-14 text-center" data-testid="posts-empty">
    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#E8A817]/25 to-[#E8A817]/5 border border-[#E8A817]/30 mb-4">
      <ImageIcon size={22} className="text-[#E8A817]" />
    </div>
    <p className="font-heading font-bold text-base mb-1.5">
      {isOwn ? 'Capture your first moment' : 'No posts yet'}
    </p>
    <p className="text-sm text-white/55 max-w-xs mx-auto mb-5">
      {isOwn
        ? 'Posts here build your Network Score and tell the world what you stand for. Even one is enough to start.'
        : 'When @' + (window.location.pathname.split('/').pop() || 'they') + ' shares their first moment, you’ll see it here.'}
    </p>
    {isOwn && (
      <button onClick={() => navigate('/?compose=1')}
              className="bg-[#E8A817] text-[#04101e] font-bold text-sm px-5 py-2.5 rounded-full inline-flex items-center gap-2"
              data-testid="cta-create-first-post">
        <Sparkles size={14} /> Create my first post (+50 pts)
      </button>
    )}
  </div>
);

export default UserPublicProfilePage;
