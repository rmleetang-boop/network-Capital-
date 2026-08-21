import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Film, Heart, MessageCircle, MoreHorizontal, Play, Share2, Sparkles, Volume2, VolumeX, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { axiosInstance } from '../App';
import NetworkScore from '../components/NetworkScore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const formatCount = (value) => {
  const count = Number(value || 0);
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toLocaleString();
};

const ReelsPage = ({ user }) => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMode, setActiveMode] = useState('for-you');
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [watched, setWatched] = useState(new Set());
  const containerRef = useRef(null);
  const videoRefs = useRef(new Map());

  useEffect(() => {
    let mounted = true;
    axiosInstance.get('/posts', { params: { skip: 0, limit: 50 } })
      .then((response) => {
        if (!mounted) return;
        const reels = (response.data || []).filter((post) => post.media_type === 'reel' || post.video);
        setPosts(reels);
      })
      .catch(() => toast.error('Could not load reels right now.'))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const visiblePosts = useMemo(() => {
    const source = [...posts];
    if (activeMode === 'top-network') {
      return source.sort((a, b) => Number(b.user_score || 0) - Number(a.user_score || 0));
    }
    return source;
  }, [posts, activeMode]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const index = Number(entry.target.dataset.reelIndex || 0);
        const video = videoRefs.current.get(index);
        if (entry.isIntersecting && entry.intersectionRatio >= 0.72) {
          setActiveIndex(index);
          video?.play().catch(() => {});
        } else {
          video?.pause();
        }
      });
    }, { root, threshold: [0.2, 0.72] });
    root.querySelectorAll('[data-reel-index]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [visiblePosts.length]);

  const toggleLike = async (postId) => {
    try {
      const response = await axiosInstance.post(`/posts/${postId}/like`);
      setPosts((current) => current.map((post) => post.id === postId ? {
        ...post,
        likes: response.data?.liked
          ? [...(post.likes || []), user.id]
          : (post.likes || []).filter((id) => id !== user.id),
      } : post));
    } catch {
      toast.error('Could not update your like.');
    }
  };

  const shareReel = async (post) => {
    const shareData = { title: `${post.username || 'Member'} on Network Capital`, text: post.content || 'Watch this reel on Network Capital', url: `${window.location.origin}/reels#${post.id}` };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(shareData.url); toast.success('Reel link copied.'); }
    } catch { /* user dismissed native sharing */ }
  };

  const markWatched = async (post) => {
    if (watched.has(post.id)) return;
    setWatched((current) => new Set([...current, post.id]));
    try { await axiosInstance.post('/score/video-watched', { video_id: String(post.id) }); } catch { /* scoring is non-blocking */ }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#080b12] text-white"><div className="h-10 w-10 animate-spin rounded-full border-2 border-[#e8ad2f]/30 border-t-[#e8ad2f]" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#080b12] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b1220]/90 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <button type="button" onClick={() => navigate('/')} className="rounded-full p-2 text-white/65 transition hover:bg-white/10 hover:text-white" aria-label="Back to feed"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.28em] text-[#e8ad2f]"><Film size={13} /> Network Reels</p><p className="mt-1 truncate text-xs text-white/45">Short ideas. Stronger connections.</p></div>
          <button type="button" onClick={() => navigate('/')} className="rounded-full border border-white/10 bg-white/[.06] px-3 py-2 text-xs font-bold text-white/75 transition hover:border-[#e8ad2f]/40 hover:text-white">Create</button>
        </div>
        <div className="mx-auto mt-3 flex max-w-6xl gap-1 rounded-full bg-white/[.04] p-1 sm:max-w-sm">
          {[['for-you', 'For you'], ['top-network', 'Top network']].map(([mode, label]) => <button key={mode} type="button" onClick={() => setActiveMode(mode)} className={`flex-1 rounded-full px-3 py-2 text-xs font-bold transition ${activeMode === mode ? 'bg-[#2d82ff] text-white shadow-lg' : 'text-white/45 hover:text-white'}`}>{label}</button>)}
        </div>
      </header>

      <main ref={containerRef} className="mx-auto h-[calc(100vh-126px)] max-w-6xl snap-y snap-mandatory overflow-y-auto overscroll-contain scrollbar-hide">
        {visiblePosts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-[#e8ad2f]/25 bg-[#e8ad2f]/[.08] text-[#f1c768]"><Film size={28} /></div><h1 className="mt-5 text-2xl font-bold">Your reel network is waiting</h1><p className="mt-2 max-w-sm text-sm leading-6 text-white/45">Share a focused idea, skill, or moment and give your network something worth returning to.</p><button type="button" onClick={() => navigate('/')} className="mt-5 rounded-xl bg-[#e8ad2f] px-5 py-3 text-sm font-bold text-[#10131a]">Create the first reel</button></div>
        ) : visiblePosts.map((post, index) => {
          const liked = (post.likes || []).includes(user.id);
          return (
            <article key={post.id} data-reel-index={index} className="relative flex min-h-full snap-start items-center justify-center px-3 py-4 sm:px-6 sm:py-6">
              <div className="relative h-full max-h-[760px] w-full max-w-[440px] overflow-hidden rounded-[28px] border border-white/10 bg-[#101621] shadow-[0_24px_90px_rgba(0,0,0,.42)]">
                <video ref={(node) => { if (node) videoRefs.current.set(index, node); else videoRefs.current.delete(index); }} src={post.video} className="absolute inset-0 h-full w-full object-cover" muted={muted} loop playsInline preload="metadata" onTimeUpdate={(event) => { if (event.currentTarget.duration && event.currentTarget.currentTime / event.currentTarget.duration > 0.82) markWatched(post); }} onClick={(event) => { if (event.currentTarget.paused) event.currentTarget.play(); else event.currentTarget.pause(); }} />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/85" />
                <div className="absolute left-4 right-4 top-4 flex items-center justify-between"><span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur"><Sparkles size={12} className="text-[#f1c768]" /> Reel</span><button type="button" onClick={() => setMuted((value) => !value)} className="pointer-events-auto rounded-full border border-white/15 bg-black/30 p-2.5 text-white backdrop-blur" aria-label={muted ? 'Unmute reel' : 'Mute reel'}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button></div>
                <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6"><div className="flex items-end gap-3"><Avatar className="h-11 w-11 shrink-0 border-2 border-[#e8ad2f]/60 ring-2 ring-[#101621]"><AvatarImage src={post.user_photo} alt={post.username} /><AvatarFallback className="bg-[#1d3157] font-bold text-[#cce0ff]">{(post.username || 'M')[0].toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><button type="button" onClick={() => navigate(`/u/${post.username}`)} className="truncate text-left text-sm font-bold text-white hover:text-[#f1c768]">@{post.username}</button><div className="mt-1 flex items-center gap-2"><NetworkScore score={post.user_score} size="small" animate={false} /><span className="text-[10px] text-white/55">{post.member_role || 'member'}</span></div></div></div><p className="mt-4 line-clamp-3 text-base font-medium leading-6 text-white sm:text-lg">{post.content || 'A new idea from your network.'}</p><div className="mt-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[11px] text-white/55"><Zap size={13} className="text-[#f1c768]" /> {Number(post.user_score || 0) >= 1000 ? 'High-signal creator' : 'Growing creator'}</div><div className="flex items-center gap-2"><button type="button" onClick={() => toggleLike(post.id)} className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition ${liked ? 'border-[#ff8d9a]/40 bg-[#ff8d9a]/15 text-[#ffb0b9]' : 'border-white/15 bg-black/20 text-white/75 hover:border-[#ff8d9a]/40'}`}><Heart size={15} fill={liked ? 'currentColor' : 'none'} />{formatCount((post.likes || []).length)}</button><button type="button" onClick={() => toast.info('Comments are available from the feed post.')} className="rounded-full border border-white/15 bg-black/20 p-2.5 text-white/75 hover:text-white" aria-label="Open comments"><MessageCircle size={16} /></button><button type="button" onClick={() => shareReel(post)} className="rounded-full border border-white/15 bg-black/20 p-2.5 text-white/75 hover:text-white" aria-label="Share reel"><Share2 size={16} /></button><button type="button" onClick={() => toast.info('More creator actions coming soon.')} className="rounded-full border border-white/15 bg-black/20 p-2.5 text-white/75 hover:text-white" aria-label="More reel actions"><MoreHorizontal size={16} /></button></div></div></div>
                {!videoRefs.current.get(index)?.paused && activeIndex === index ? null : <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="rounded-full bg-black/30 p-4 text-white/80 backdrop-blur"><Play size={25} fill="currentColor" /></div></div>}
              </div>
            </article>
          );
        })}
      </main>
    </div>
  );
};

export default ReelsPage;

