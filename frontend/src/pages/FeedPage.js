import React, { useState, useEffect, useRef, useCallback } from 'react';
// Iter 58 — framer-motion is dynamically loaded after first paint to keep the
// initial JS bundle small. While it's loading we render plain <div>/<span>
// placeholders so the feed never flickers/blocks.
import { Heart, MessageCircle, Share2, Image as ImageIcon, Video as VideoIcon, X, Sparkles, Compass, MoreHorizontal, Edit2, Trash2, Check, Plus, Film, Layers, Loader2, Eye, EyeOff } from 'lucide-react';
import ShareMenu from '../components/ShareMenu';
import NativeFeedAd from '../components/NativeFeedAd';
import StoriesRibbon from '../components/StoriesRibbon';
import StoryViewer from '../components/StoryViewer';
import HashtagText from '../components/HashtagText';
import FeatureIntroModal from '../components/FeatureIntroModal';
import MediaRenderer from '../components/MediaRenderer';
import { uploadMedia, validateMediaFile, probeVideoDuration, MAX_VIDEO_SECONDS, formatBytes } from '../lib/mediaUpload';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import NetworkScore from '../components/NetworkScore';
import { useNavigate } from 'react-router-dom';
import { MotionDiv, MotionSpan, AnimatePresenceLazy } from '../lib/motionLazy';

const motion = { div: MotionDiv, span: MotionSpan };
const AnimatePresence = AnimatePresenceLazy;

const PAGE_SIZE = 10;

const buildInitialComposer = () => ({ content: '', mode: 'photos', slides: [], reel: null });

const FeedPage = ({ user }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  // Iter 51 — composer rewrite for carousel + reels.
  // `mode`: 'photos' = single image OR 2-10 image carousel; 'reel' = one ≤30s video.
  const [composer, setComposer] = useState(buildInitialComposer);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [sharingPost, setSharingPost] = useState(null);
  const [posting, setPosting] = useState(false);
  const [storyGroup, setStoryGroup] = useState(null);
  const sentinelRef = useRef(null);
  const firstLoadRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Guard against React 18 StrictMode double-invoke firing two skip=0 calls back-to-back.
    if (firstLoadRef.current) return;
    firstLoadRef.current = true;
    fetchPosts(0, true);
  }, []);

  const fetchPosts = async (skip = 0, replace = false) => {
    if (skip === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const response = await axiosInstance.get('/posts', { params: { skip, limit: PAGE_SIZE } });
      const next = response.data || [];
      setHasMore(next.length === PAGE_SIZE);
      setPosts((prev) => (replace ? next : [...prev, ...next]));
    } catch (error) {
      if (skip === 0) toast.error('Failed to load posts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    fetchPosts(posts.length, false);
  }, [loadingMore, loading, hasMore, posts.length]);

  // IntersectionObserver-based infinite scroll on a sentinel below the feed.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: '400px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  const resetComposer = () => { setUploadProgress(0); setUploading(false); };

  const handleCreatePost = async () => {
    const hasMedia = (composer.mode === 'photos' && composer.slides.length > 0) || (composer.mode === 'reel' && composer.reel);
    if (!composer.content.trim()) {
      toast.error(
        hasMedia
          ? 'Add a caption to share your post — even one line helps your community connect.'
          : 'Please write something to share with your community.'
      );
      return;
    }

    const payload = { content: composer.content.trim() };
    if (composer.mode === 'reel' && composer.reel) {
      payload.video = composer.reel.url;
      payload.media_type = 'reel';
      payload.duration_seconds = composer.reel.duration_seconds || null;
    } else if (composer.mode === 'photos') {
      if (composer.slides.length === 1) {
        payload.image = composer.slides[0].image;
        // Iter 55 — store base64 fallback alongside the URL so feed images
        // survive ephemeral-disk redeploys on production.
        if (composer.slides[0].image_data_url) payload.image_data_url = composer.slides[0].image_data_url;
        payload.media_type = 'single';
      } else if (composer.slides.length >= 2) {
        payload.slides = composer.slides.map((s) => ({
          type: 'image',
          image: s.image,
          image_data_url: s.image_data_url || null,
          caption: s.caption || '',
        }));
        payload.media_type = 'carousel';
      }
    }

    setPosting(true);
    try {
      const response = await axiosInstance.post('/posts', payload);
      setPosts([response.data, ...posts]);
      resetComposer();
      setShowCreatePost(false);
      toast.success('Post created! +20 points');
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      if (status === 413) {
        toast.error(detail || 'Your post exceeds the upload limit. Please compress your media and try again.');
      } else if (status === 400) {
        toast.error(detail || 'Could not create your post. Please try again.');
      } else if (status === 401 || status === 403) {
        toast.error('Your session expired. Please log in again to continue posting.');
      } else if (status >= 500) {
        toast.error('Our servers had a hiccup. Please try again in a moment.');
      } else if (error?.message === 'Network Error') {
        toast.error('No internet connection. Please check your network and try again.');
      } else {
        toast.error(detail || 'Could not create your post. Please try again.');
      }
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await axiosInstance.post(`/posts/${postId}/like`);
      setPosts(posts.map(p =>
        p.id === postId
          ? { ...p, likes: response.data.liked
              ? [...p.likes, user.id]
              : p.likes.filter(id => id !== user.id) }
          : p
      ));
    } catch (error) {
      toast.error('Failed to like post');
    }
  };

  const handleComment = async (postId, content) => {
    if (!content.trim()) return;

    try {
      const response = await axiosInstance.post(`/posts/${postId}/comment`, { content });
      setPosts(posts.map(p =>
        p.id === postId
          ? { ...p, comments: [...p.comments, response.data] }
          : p
      ));
      toast.success('Comment added!');
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const handleShare = (postId) => {
    const post = posts.find((p) => p.id === postId);
    if (post) setSharingPost(post);
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Delete this post?\n\nYou will lose any score earned for this post, and points earned by people who liked or commented on it will also be reversed.')) return;
    try {
      await axiosInstance.delete(`/posts/${postId}`);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success('Post deleted');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not delete post');
    }
  };

  // Iter 56e — Admin/super-admin can delete or hide ANY post on the feed.
  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin' || user.role === 'moderator');

  const handleAdminDeletePost = async (postId) => {
    const reason = window.prompt('Delete this post as admin? Optional reason for the audit log:');
    if (reason === null) return;   // user cancelled
    try {
      await axiosInstance.delete(`/admin/posts/${postId}`, { params: { reason: reason || '' } });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success('Post deleted (admin)');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not delete post');
    }
  };

  const handleAdminHidePost = async (postId, hidden) => {
    if (hidden) {
      const reason = window.prompt('Hide this post (reversible). Optional reason:');
      if (reason === null) return;
      try {
        await axiosInstance.post(`/admin/posts/${postId}/hide`, null, { params: { reason: reason || '' } });
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, hidden: true } : p));
        toast.success('Post hidden from public feed');
      } catch (e) {
        toast.error(e.response?.data?.detail || 'Could not hide post');
      }
    } else {
      try {
        await axiosInstance.post(`/admin/posts/${postId}/unhide`);
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, hidden: false } : p));
        toast.success('Post restored');
      } catch (e) {
        toast.error(e.response?.data?.detail || 'Could not restore post');
      }
    }
  };

  const handleEditPost = async (postId, newContent) => {
    try {
      const res = await axiosInstance.patch(`/posts/${postId}`, { content: newContent });
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...res.data } : p)));
      toast.success('Post updated');
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not update post');
      return false;
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    if (!window.confirm('Delete this comment?\n\nIf score points were earned, they will be reversed.')) return;
    try {
      await axiosInstance.delete(`/posts/${postId}/comments/${commentId}`);
      setPosts((prev) => prev.map((p) =>
        p.id === postId ? { ...p, comments: (p.comments || []).filter((c) => c.id !== commentId) } : p
      ));
      toast.success('Comment deleted');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not delete comment');
    }
  };

  const confirmShare = async () => {
    if (!sharingPost) return;
    try {
      const response = await axiosInstance.post(`/posts/${sharingPost.id}/share`);
      setPosts((prev) => prev.map(p => p.id === sharingPost.id ? { ...p, shares: response.data.shares } : p));
      toast.success('Post shared! +10 points');
    } catch (e) { /* share endpoint best-effort */ }
    setSharingPost(null);
  };

  const handlePhotosPicked = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (composer.slides.length + files.length > 10) {
      toast.error(`A carousel can hold up to 10 photos. You're trying to add ${files.length} on top of ${composer.slides.length}.`);
      return;
    }
    for (const file of files) {
      const err = validateMediaFile(file, 'image');
      if (err) { toast.error(err); continue; }
      setUploading(true);
      setUploadProgress(0);
      try {
        const { url, size_bytes, data_url } = await uploadMedia(file, {
          scope: 'posts',
          onProgress: setUploadProgress,
        });
        setComposer((c) => ({
          ...c,
          mode: 'photos',
          reel: null,
          slides: c.slides.concat([{ image: url, image_data_url: data_url, size_bytes, name: file.name }]),
        }));
      } catch (ex) {
        const detail = ex?.response?.data?.detail || 'Image upload failed. Try a smaller file.';
        toast.error(detail);
      }
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const handleReelPicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateMediaFile(file, 'video');
    if (err) { toast.error(err); return; }
    const duration = await probeVideoDuration(file);
    if (duration && duration > MAX_VIDEO_SECONDS + 0.5) {
      toast.error(`Reels are capped at ${MAX_VIDEO_SECONDS}s — your clip is ${Math.round(duration)}s. Please trim it before uploading.`);
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const { url, size_bytes } = await uploadMedia(file, {
        scope: 'posts',
        onProgress: setUploadProgress,
      });
      setComposer((c) => ({
          ...c,
          mode: 'reel',
          slides: [],
          reel: {
          url,
          duration_seconds: Math.round(duration || 0),
          size_bytes,
          name: file.name,
        },
      }));
      toast.success(`Reel attached · ${formatBytes(size_bytes)} · ${Math.round(duration || 0)}s`);
    } catch (ex) {
      const detail = ex?.response?.data?.detail || 'Video upload failed. Try a shorter clip.';
      toast.error(detail);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeSlide = (idx) => {
    setComposer((c) => ({ ...c, slides: c.slides.filter((_, i) => i !== idx) }));
  };

  const removeReel = () => setComposer((c) => ({ ...c, reel: null, mode: 'photos' }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-DEFAULT">
      <FeatureIntroModal
        featureKey="feed"
        icon={<Sparkles size={20} />}
        title="Welcome to your Feed"
        subtitle="A live stream of your community — posts, stories, milestones and shared wins."
        bullets={[
          { icon: <Heart size={14} />, label: 'Double-tap to like', body: 'Tap-tap on any post for a quick heart, just like you\'d expect.' },
          { icon: <Share2 size={14} />, label: 'Share anywhere', body: 'Repost into the feed, send via DM, or share to your favourite app.' },
          { icon: <ImageIcon size={14} />, label: 'Stories at the top', body: 'Tap any avatar in the ribbon to view 24-hour Stories from members you follow.' },
        ]}
      />
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-[#0a1628] via-primary to-[#0a1628] border-b border-white/10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/brand/logo-mark.png"
              alt="Network Capital"
              className="h-9 w-9 rounded-lg object-cover"
            />
            <div>
              <p className="text-[10px] text-white/60 uppercase tracking-wider">Score</p>
              <p className="text-base font-bold text-secondary leading-none">{user.network_score}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/explore')}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              data-testid="feed-explore-shortcut"
              aria-label="Explore"
            >
              <Compass size={18} />
            </button>
            <button
              onClick={() => setShowCreatePost(true)}
              className="bg-secondary hover:brightness-110 text-primary px-4 py-2 rounded-full font-bold text-sm shadow-md active:scale-95 transition-all"
              data-testid="create-post-button"
            >
              Post
            </button>
          </div>
        </div>

        {/* Stories ribbon sits inside the dark header */}
        <StoriesRibbon currentUser={user} onOpenViewer={(g) => setStoryGroup(g)} />
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 space-y-4">
        <NativeFeedAd />
        {posts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={user.id}
            onLike={handleLike}
            onComment={handleComment}
            onShare={handleShare}
            onUserClick={async (userId, username) => {
              if (username) {
                navigate(`/u/${username}`);
                return;
              }
              // Username missing on post — look it up so we always land on /u/:username
              try {
                const r = await axiosInstance.get(`/users/${userId}`);
                if (r.data?.username) navigate(`/u/${r.data.username}`);
                else navigate(`/profile/${userId}`);
              } catch {
                navigate(`/profile/${userId}`);
              }
            }}
            onDeletePost={handleDeletePost}
            isAdmin={isAdmin}
            onAdminDelete={handleAdminDeletePost}
            onAdminHide={handleAdminHidePost}
            onEditPost={handleEditPost}
            onDeleteComment={handleDeleteComment}
            index={index}
          />
        ))}

        {posts.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-text-secondary">No posts yet. Be the first to post!</p>
          </div>
        )}

        {/* Iter 58 — infinite scroll sentinel + load-more fallback button */}
        {posts.length > 0 && (
          <div ref={sentinelRef} className="py-6 text-center" data-testid="feed-sentinel">
            {hasMore ? (
              loadingMore ? (
                <div className="inline-flex items-center gap-2 text-text-muted text-sm" data-testid="feed-loading-more">
                  <Loader2 size={14} className="animate-spin" /> Loading more posts…
                </div>
              ) : (
                <button
                  onClick={loadMore}
                  className="text-xs font-semibold text-primary border border-primary/40 px-4 py-2 rounded-full hover:bg-primary/5"
                  data-testid="feed-load-more"
                >
                  Load more
                </button>
              )
            ) : (
              <p className="text-[11px] text-text-muted" data-testid="feed-end">You&apos;re all caught up.</p>
            )}
          </div>
        )}
      </div>

      {showCreatePost && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowCreatePost(false); resetComposer(); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            data-testid="create-post-modal"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold">Create Post</h2>
              <button
                onClick={() => { setShowCreatePost(false); resetComposer(); }}
                className="text-text-muted hover:text-text-primary transition-colors"
                data-testid="close-create-post"
              >
                <X size={24} />
              </button>
            </div>

            <textarea
              value={composer.content}
              onChange={(e) => setComposer((c) => ({ ...c, content: e.target.value }))}
              placeholder="What's on your mind? Use #hashtags to join the conversation"
              rows={4}
              className="w-full p-3 border border-gray-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none mb-4"
              data-testid="post-content-input"
            />

            {/* Composer mode hint */}
            <div className="flex items-center gap-2 text-[11px] text-text-muted mb-3">
              {composer.mode === 'reel' ? (
                <><Film size={12} className="text-secondary" /><span>Reel · vertical video ≤ 30s</span></>
              ) : composer.slides.length >= 2 ? (
                <><Layers size={12} className="text-secondary" /><span>Carousel · {composer.slides.length}/10 photos</span></>
              ) : composer.slides.length === 1 ? (
                <><ImageIcon size={12} className="text-secondary" /><span>Single photo · add more to make a carousel</span></>
              ) : (
                <><Sparkles size={12} className="text-secondary" /><span>Add up to 10 photos for a carousel, or one ≤30s video for a Reel.</span></>
              )}
            </div>

            {/* Carousel/photo previews */}
            {composer.mode === 'photos' && composer.slides.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3" data-testid="photo-previews">
                {composer.slides.map((s, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group">
                    <img src={s.image.startsWith('http') || s.image.startsWith('data:') ? s.image : `${process.env.REACT_APP_BACKEND_URL}${s.image}`} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeSlide(i)}
                      className="absolute top-1 right-1 bg-black/65 hover:bg-black text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Remove slide ${i + 1}`}
                      data-testid={`remove-slide-${i}`}
                    >
                      <X size={12} />
                    </button>
                    <span className="absolute bottom-1 left-1 bg-black/55 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      {i + 1}
                    </span>
                  </div>
                ))}
                {composer.slides.length < 10 && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all" data-testid="add-more-photos">
                    <Plus size={20} className="text-text-muted" />
                    <input type="file" accept="image/*" multiple onChange={handlePhotosPicked} className="hidden" />
                  </label>
                )}
              </div>
            )}

            {/* Reel preview */}
            {composer.mode === 'reel' && composer.reel && (
              <div className="relative mb-3 mx-auto" style={{ maxWidth: 220 }} data-testid="reel-preview">
                <video
                  src={composer.reel.url.startsWith('http') ? composer.reel.url : `${process.env.REACT_APP_BACKEND_URL}${composer.reel.url}`}
                  controls
                  className="w-full rounded-xl bg-black"
                  style={{ aspectRatio: '9 / 16' }}
                />
                <button
                  type="button"
                  onClick={removeReel}
                  className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-100"
                  aria-label="Remove video"
                  data-testid="remove-reel"
                >
                  <X size={14} />
                </button>
                <p className="text-[11px] text-emerald-600 font-semibold mt-1.5 text-center">
                  Reel · {formatBytes(composer.reel.size_bytes)} · {composer.reel.duration_seconds}s
                </p>
              </div>
            )}

            {/* Upload progress bar */}
            {uploading && (
              <div className="mb-3">
                <div className="flex items-center gap-2 text-[11px] text-text-muted mb-1">
                  <Loader2 size={12} className="animate-spin" /> Uploading… {uploadProgress}%
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-secondary transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {/* Pickers — hidden when a reel is already attached or carousel is full */}
            {composer.mode !== 'reel' && composer.slides.length === 0 && (
              <div className="flex gap-3">
                <label className="flex-1 border-2 border-dashed border-gray-300 rounded-xl p-3 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all" data-testid="photos-picker">
                  <Layers className="mx-auto mb-1 text-text-muted" size={24} />
                  <span className="text-sm text-text-secondary block">Add Photos</span>
                  <span className="text-[10px] text-text-muted block mt-0.5">1–10 · JPG/PNG/WebP · 11 MB each</span>
                  <input type="file" accept="image/*" multiple onChange={handlePhotosPicked} className="hidden" data-testid="photos-input" />
                </label>
                <label className="flex-1 border-2 border-dashed border-gray-300 rounded-xl p-3 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all" data-testid="reel-picker">
                  <Film className="mx-auto mb-1 text-text-muted" size={24} />
                  <span className="text-sm text-text-secondary block">Add Reel</span>
                  <span className="text-[10px] text-text-muted block mt-0.5">MP4/MOV · ≤ 30s · 50 MB</span>
                  <input type="file" accept="video/*" onChange={handleReelPicked} className="hidden" data-testid="reel-input" />
                </label>
              </div>
            )}

            <button
              onClick={handleCreatePost}
              disabled={posting || uploading}
              className="w-full mt-4 bg-primary hover:bg-primary-hover text-white font-medium py-3 rounded-full shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="submit-post-button"
            >
              {posting ? 'Posting...' : 'Post (+20 points)'}
            </button>
          </motion.div>
        </div>
      )}

      {sharingPost && (
        <ShareMenu
          post={sharingPost}
          onShared={confirmShare}
          onClose={() => setSharingPost(null)}
        />
      )}

      {storyGroup && (
        <StoryViewer
          group={storyGroup}
          onClose={() => setStoryGroup(null)}
          onNextGroup={() => setStoryGroup(null)}
          onPrevGroup={() => setStoryGroup(null)}
        />
      )}
    </div>
  );
};

const PostCard = ({ post, currentUserId, onLike, onComment, onShare, onUserClick, onDeletePost, onEditPost, onDeleteComment, index, isAdmin, onAdminDelete, onAdminHide }) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showHeart, setShowHeart] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(post.content || '');
  const [savingEdit, setSavingEdit] = useState(false);
  const lastTapRef = useRef(0);
  const isLiked = post.likes.includes(currentUserId);
  const isAuto = !!post.is_auto_narrated;
  const isOwner = post.user_id === currentUserId;

  const handleCommentSubmit = () => {
    if (commentText.trim()) {
      onComment(post.id, commentText);
      setCommentText('');
    }
  };

  const handleMediaTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // double-tap
      if (!isLiked) onLike(post.id);
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 700);
    }
    lastTapRef.current = now;
  };

  const hasMedia = !!(post.image || post.video || (Array.isArray(post.slides) && post.slides.length));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.04 }}
      className={`rounded-2xl overflow-hidden transition-shadow ${
        isAuto
          ? 'bg-gradient-to-br from-secondary/10 via-white to-secondary/5 border-2 border-transparent shadow-md'
          : 'bg-white border border-gray-100 shadow-sm hover:shadow-md'
      }`}
      style={isAuto ? { backgroundClip: 'padding-box', borderImage: 'linear-gradient(135deg, #f5d76e, #c79a2a) 1' } : undefined}
      data-testid={`post-card-${index}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="relative">
          <Avatar
            className="w-12 h-12 cursor-pointer ring-2 ring-white shadow-md border-2 border-secondary/30 hover:scale-105 transition-transform"
            onClick={() => onUserClick(post.user_id, post.username)}
            data-testid={`post-author-avatar-${index}`}
          >
            <AvatarImage src={post.user_photo} alt={post.username} className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white font-bold">
              {post.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isAuto && (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-secondary rounded-full ring-2 ring-white flex items-center justify-center">
              <Sparkles size={9} className="text-primary" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-text-primary text-sm truncate cursor-pointer hover:text-primary transition-colors" onClick={() => onUserClick(post.user_id, post.username)}>
              {post.username}
            </h3>
            <NetworkScore score={post.user_score} size="small" animate={false} />
            {post.rising_networker && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm"
                data-testid={`rising-networker-badge-${index}`}
                title={post.visibility_boost >= 3 ? 'Top 1% Networker — boosted visibility' : 'Top 10% Networker — boosted visibility'}
              >
                ▲ Rising Networker
              </span>
            )}
            {isAuto && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-secondary to-yellow-500 text-primary shadow-sm"
                data-testid={`auto-badge-${index}`}
              >
                <Sparkles size={10} /> Auto
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-muted">
            {new Date(post.created_at).toLocaleDateString()}
            {post.edited_at && <span className="ml-1.5 italic">· edited</span>}
          </p>
        </div>

        {/* Owner / Admin actions menu */}
        {(isOwner || isAdmin) && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 rounded-full hover:bg-gray-100 text-text-secondary"
              aria-label="Post actions"
              data-testid={`post-menu-button-${index}`}
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden" data-testid={`post-menu-${index}`}>
                  {isOwner && (
                    <>
                      <button
                        onClick={() => { setEditing(true); setEditValue(post.content || ''); setMenuOpen(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-text-primary"
                        data-testid={`post-edit-button-${index}`}
                      >
                        <Edit2 size={14} /> Edit post
                      </button>
                      <button
                        onClick={() => { setMenuOpen(false); onDeletePost && onDeletePost(post.id); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600 border-t border-gray-100"
                        data-testid={`post-delete-button-${index}`}
                      >
                        <Trash2 size={14} /> Delete post
                      </button>
                    </>
                  )}
                  {/* Iter 56e — Admin moderation actions */}
                  {isAdmin && (
                    <>
                      {isOwner && <div className="border-t border-gray-100" />}
                      <div className="px-4 py-1.5 bg-amber-50 text-[10px] uppercase tracking-wider font-bold text-amber-700">Admin actions</div>
                      <button
                        onClick={() => { setMenuOpen(false); onAdminHide && onAdminHide(post.id, !post.hidden); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-amber-50 flex items-center gap-2 text-amber-700"
                        data-testid={`post-admin-hide-${index}`}
                      >
                        {post.hidden ? <><Eye size={14} /> Restore post</> : <><EyeOff size={14} /> Hide from feed</>}
                      </button>
                      <button
                        onClick={() => { setMenuOpen(false); onAdminDelete && onAdminDelete(post.id); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-700 border-t border-gray-100"
                        data-testid={`post-admin-delete-${index}`}
                      >
                        <Trash2 size={14} /> Delete (admin)
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Iter 56e — Hidden-post badge (visible to admins viewing hidden posts) */}
      {post.hidden && (
        <div className="mx-4 mb-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-1.5" data-testid={`post-hidden-badge-${index}`}>
          <EyeOff size={11} /> This post is hidden from the public feed{post.hidden_by ? ` · by @${post.hidden_by}` : ''}{post.hidden_reason ? ` · ${post.hidden_reason}` : ''}
        </div>
      )}

      {/* Content text — switches to inline editor when owner taps Edit */}
      {editing ? (
        <div className="px-4 pb-3 space-y-2" data-testid={`post-edit-area-${index}`}>
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={3}
            maxLength={5000}
            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none"
            data-testid={`post-edit-input-${index}`}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setEditing(false); setEditValue(post.content || ''); }}
              disabled={savingEdit}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-text-secondary hover:bg-gray-50 border border-gray-200 disabled:opacity-50"
              data-testid={`post-edit-cancel-${index}`}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                const v = editValue.trim();
                if (!v) return;
                if (v === (post.content || '')) { setEditing(false); return; }
                setSavingEdit(true);
                const ok = await onEditPost(post.id, v);
                setSavingEdit(false);
                if (ok) setEditing(false);
              }}
              disabled={savingEdit || !editValue.trim()}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-primary text-white hover:bg-primary-hover disabled:opacity-50 inline-flex items-center gap-1.5"
              data-testid={`post-edit-save-${index}`}
            >
              <Check size={12} /> {savingEdit ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        post.content && (
          <div className="px-4 pb-3">
            <HashtagText text={post.content} className="text-text-primary text-sm whitespace-pre-wrap" />
          </div>
        )
      )}

      {/* Full-bleed media with double-tap to like — supports single, carousel, reel. */}
      {hasMedia && (
        <div className="relative" onDoubleClick={handleMediaTap}>
          <MediaRenderer post={post} onMediaTap={handleMediaTap} indexKey={String(index)} />
          <AnimatePresence>
            {showHeart && (
              <motion.div
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1.2 }}
                exit={{ opacity: 0, scale: 1.6 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <Heart size={110} className="text-white drop-shadow-2xl" fill="currentColor" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-6 text-text-secondary px-4 py-3">
        <button
          onClick={() => onLike(post.id)}
          className={`flex items-center gap-1.5 transition-colors ${isLiked ? 'text-red-500' : 'hover:text-red-500'}`}
          data-testid={`like-button-${index}`}
        >
          <motion.span whileTap={{ scale: 1.4 }} transition={{ duration: 0.2 }}>
            <Heart size={22} fill={isLiked ? 'currentColor' : 'none'} />
          </motion.span>
          <span className="text-sm font-medium">{post.likes.length}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 hover:text-primary transition-colors"
          data-testid={`comment-button-${index}`}
        >
          <MessageCircle size={22} />
          <span className="text-sm font-medium">{post.comments.length}</span>
        </button>

        <button
          onClick={() => onShare(post.id)}
          className="flex items-center gap-1.5 hover:text-secondary transition-colors"
          data-testid={`share-button-${index}`}
        >
          <Share2 size={22} />
          <span className="text-sm font-medium">{post.shares}</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {post.comments.map((comment) => {
            const canDeleteComment = comment.user_id === currentUserId || isOwner;
            return (
              <div key={comment.id} className="flex gap-2 group">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={comment.user_photo} />
                  <AvatarFallback>{comment.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 bg-gray-50 rounded-xl p-3 relative">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-text-primary">{comment.username}</p>
                    {canDeleteComment && (
                      <button
                        onClick={() => onDeleteComment && onDeleteComment(post.id, comment.id)}
                        className="text-text-muted hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 -m-1"
                        aria-label="Delete comment"
                        data-testid={`comment-delete-${comment.id}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <HashtagText text={comment.content} className="text-sm text-text-secondary" />
                </div>
              </div>
            );
          })}

          <div className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
              onKeyPress={(e) => e.key === 'Enter' && handleCommentSubmit()}
              data-testid={`comment-input-${index}`}
            />
            <button
              onClick={handleCommentSubmit}
              className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-full font-medium text-sm transition-all active:scale-95"
              data-testid={`comment-submit-${index}`}
            >
              Post
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default FeedPage;
