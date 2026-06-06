import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Share2, Image as ImageIcon, Video as VideoIcon, X, Sparkles, Compass, MoreHorizontal, Edit2, Trash2, Check } from 'lucide-react';
import ShareMenu from '../components/ShareMenu';
import NativeFeedAd from '../components/NativeFeedAd';
import StoriesRibbon from '../components/StoriesRibbon';
import StoryViewer from '../components/StoryViewer';
import HashtagText from '../components/HashtagText';
import FeatureIntroModal from '../components/FeatureIntroModal';
import MediaPreparer from '../components/MediaPreparer';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import NetworkScore from '../components/NetworkScore';
import { useNavigate } from 'react-router-dom';

const FeedPage = ({ user }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPost, setNewPost] = useState({ content: '', image: '', video: '' });
  const [sharingPost, setSharingPost] = useState(null);
  const [posting, setPosting] = useState(false);
  const [storyGroup, setStoryGroup] = useState(null);
  const [preparingFile, setPreparingFile] = useState(null);  // optional crop/compress modal
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await axiosInstance.get('/posts');
      setPosts(response.data);
    } catch (error) {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.content.trim()) {
      const hasMedia = Boolean(newPost.image || newPost.video);
      toast.error(
        hasMedia
          ? 'Add a caption to share your post — even one line helps your community connect.'
          : 'Please write something to share with your community.'
      );
      return;
    }

    setPosting(true);
    try {
      const response = await axiosInstance.post('/posts', newPost);
      setPosts([response.data, ...posts]);
      setNewPost({ content: '', image: '', video: '' });
      setShowCreatePost(false);
      toast.success('Post created! +20 points');
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      if (status === 413) {
        toast.error(detail || 'Your post exceeds the 11 MB upload limit. Please compress your media and try again.');
      } else if (status === 400) {
        toast.error(detail || 'Your post contains restricted language. Please rephrase and try again.');
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
    } catch {}
    setSharingPost(null);
  };

  const formatBytes = (b) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(`That file isn't an image — selected type: ${file.type || 'unknown'}. Please choose a JPG, PNG, GIF or WebP.`);
      e.target.value = '';
      return;
    }
    if (file.size > 11 * 1024 * 1024) {
      toast.error(`Image is ${formatBytes(file.size)} — over the 11 MB limit. Please compress it or pick a smaller picture.`);
      e.target.value = '';
      return;
    }
    setPreparingFile(file);   // opens MediaPreparer for optional crop/compress
    e.target.value = '';
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error(`That file isn't a video — selected type: ${file.type || 'unknown'}. Please choose an MP4, MOV or WebM clip.`);
      e.target.value = '';
      return;
    }
    if (file.size > 11 * 1024 * 1024) {
      toast.error(`Video is ${formatBytes(file.size)} — over the 11 MB limit. Try a shorter clip or compress it before uploading.`);
      e.target.value = '';
      return;
    }
    setPreparingFile(file);   // opens MediaPreparer (videos pass through unchanged)
    e.target.value = '';
  };

  const handleMediaPrepared = ({ dataUrl, sizeBytes, name, type }) => {
    if (type.startsWith('image/')) {
      setNewPost({ ...newPost, image: dataUrl, video: '', _imageSize: sizeBytes, _imageName: name });
      toast.success(`Image attached · ${formatBytes(sizeBytes)}`);
    } else {
      setNewPost({ ...newPost, video: dataUrl, image: '', _videoSize: sizeBytes, _videoName: name });
      toast.success(`Video attached · ${formatBytes(sizeBytes)}`);
    }
    setPreparingFile(null);
  };

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

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <NativeFeedAd />
        {posts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={user.id}
            onLike={handleLike}
            onComment={handleComment}
            onShare={handleShare}
            onUserClick={(userId, username) => navigate(username ? `/u/${username}` : `/profile/${userId}`)}
            onDeletePost={handleDeletePost}
            onEditPost={handleEditPost}
            onDeleteComment={handleDeleteComment}
            index={index}
          />
        ))}

        {posts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-text-secondary">No posts yet. Be the first to post!</p>
          </div>
        )}
      </div>

      {showCreatePost && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreatePost(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold">Create Post</h2>
              <button
                onClick={() => setShowCreatePost(false)}
                className="text-text-muted hover:text-text-primary transition-colors"
                data-testid="close-create-post"
              >
                <X size={24} />
              </button>
            </div>

            <textarea
              value={newPost.content}
              onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
              placeholder="What's on your mind? Use #hashtags to join the conversation"
              rows={5}
              className="w-full p-3 border border-gray-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none mb-4"
              data-testid="post-content-input"
            />

            {newPost.image && (
              <div className="relative mb-4">
                <img src={newPost.image} alt="Preview" className="w-full h-48 object-cover rounded-xl" />
                <button
                  onClick={() => setNewPost({ ...newPost, image: '' })}
                  className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-md hover:bg-gray-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {newPost.video && (
              <div className="relative mb-4">
                <video src={newPost.video} controls className="w-full max-h-72 rounded-xl bg-black" />
                <button
                  onClick={() => setNewPost({ ...newPost, video: '' })}
                  className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-md hover:bg-gray-100 transition-colors"
                  data-testid="remove-video"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <label className="flex-1 border-2 border-dashed border-gray-300 rounded-xl p-3 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
                <ImageIcon className="mx-auto mb-1 text-text-muted" size={24} />
                <span className="text-sm text-text-secondary block">Add Image</span>
                <span className="text-[10px] text-text-muted block mt-0.5">JPG/PNG/GIF · max 11 MB · crop &amp; compress on next step</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  data-testid="image-upload-input"
                />
              </label>
              <label className="flex-1 border-2 border-dashed border-gray-300 rounded-xl p-3 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all" data-testid="video-upload-tile">
                <VideoIcon className="mx-auto mb-1 text-text-muted" size={24} />
                <span className="text-sm text-text-secondary block">Add Video</span>
                <span className="text-[10px] text-text-muted block mt-0.5">MP4/MOV · max 11 MB</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                  data-testid="video-upload-input"
                />
              </label>
            </div>
            {(newPost._imageSize || newPost._videoSize) && (
              <p className="text-[11px] text-emerald-600 font-semibold mt-1" data-testid="upload-size-hint">
                Attached: <strong>{newPost._imageName || newPost._videoName}</strong> · {formatBytes(newPost._imageSize || newPost._videoSize)}
              </p>
            )}

            <button
              onClick={handleCreatePost}
              disabled={posting}
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

      {preparingFile && (
        <MediaPreparer
          file={preparingFile}
          onClose={() => setPreparingFile(null)}
          onConfirm={handleMediaPrepared}
        />
      )}
    </div>
  );
};

const PostCard = ({ post, currentUserId, onLike, onComment, onShare, onUserClick, onDeletePost, onEditPost, onDeleteComment, index }) => {
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

  const hasMedia = !!(post.image || post.video);

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

        {/* Owner-only actions menu */}
        {isOwner && (
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
                <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden" data-testid={`post-menu-${index}`}>
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
                </div>
              </>
            )}
          </div>
        )}
      </div>

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

      {/* Full-bleed media with double-tap to like */}
      {hasMedia && (
        <div
          className="relative bg-black select-none"
          onClick={handleMediaTap}
          onDoubleClick={handleMediaTap}
          data-testid={`post-media-${index}`}
        >
          {post.image && (
            <img src={post.image} alt="Post" className="w-full max-h-[560px] object-contain bg-black" draggable={false} />
          )}
          {post.video && (
            <video src={post.video} controls className="w-full max-h-[560px] bg-black" />
          )}
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
