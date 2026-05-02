import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Image as ImageIcon, Video as VideoIcon, X } from 'lucide-react';
import ShareMenu from '../components/ShareMenu';
import MockAdButton from '../components/MockAdButton';
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
      toast.error('Please write something');
      return;
    }

    setPosting(true);
    try {
      const response = await axiosInstance.post('/posts', newPost);
      setPosts([response.data, ...posts]);
      setNewPost({ content: '', image: '', video: '' });
      setShowCreatePost(false);
      toast.success('Post created! +10 points');
    } catch (error) {
      toast.error('Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId, isLiked) => {
    try {
      const response = await axiosInstance.post(`/posts/${postId}/like`);
      setPosts(posts.map(p => 
        p.id === postId 
          ? { ...p, likes: response.data.liked 
              ? [...p.likes, user.id] 
              : p.likes.filter(id => id !== user.id) }
          : p
      ));
      if (response.data.liked) {
        toast.success('+2 points for engagement!');
      }
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
      toast.success('Comment added! +5 points');
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const handleShare = (postId) => {
    const post = posts.find((p) => p.id === postId);
    if (post) setSharingPost(post);
  };

  const confirmShare = async () => {
    if (!sharingPost) return;
    try {
      const response = await axiosInstance.post(`/posts/${sharingPost.id}/share`);
      setPosts((prev) => prev.map(p => p.id === sharingPost.id ? { ...p, shares: response.data.shares } : p));
      toast.success('Post shared! +8 points');
    } catch {}
    setSharingPost(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) { toast.error('Image too large (max 3MB)'); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPost({ ...newPost, image: reader.result, video: '' });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) { toast.error('Video too large (max 3MB)'); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPost({ ...newPost, video: reader.result, image: '' });
      };
      reader.readAsDataURL(file);
    }
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
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="https://customer-assets.emergentagent.com/job_network-capital/artifacts/ujjy9ep3_185322.png" 
              alt="Network Capital" 
              className="h-10 w-auto"
            />
            <div>
              <p className="text-xs text-text-muted">Network Score</p>
              <p className="text-lg font-bold text-secondary">{user.network_score}</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreatePost(true)}
            className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-full font-medium shadow-md hover:shadow-lg active:scale-95 transition-all"
            data-testid="create-post-button"
          >
            Post
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <MockAdButton />
        {posts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={user.id}
            onLike={handleLike}
            onComment={handleComment}
            onShare={handleShare}
            onUserClick={(userId) => navigate(`/profile/${userId}`)}
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
              placeholder="What's on your mind?"
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
                <span className="text-sm text-text-secondary">Add Image</span>
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
                <span className="text-sm text-text-secondary">Add Video</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                  data-testid="video-upload-input"
                />
              </label>
            </div>

            <button
              onClick={handleCreatePost}
              disabled={posting}
              className="w-full mt-4 bg-primary hover:bg-primary-hover text-white font-medium py-3 rounded-full shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="submit-post-button"
            >
              {posting ? 'Posting...' : 'Post (+10 points)'}
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
    </div>
  );
};

const PostCard = ({ post, currentUserId, onLike, onComment, onShare, onUserClick, index }) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const isLiked = post.likes.includes(currentUserId);

  const handleCommentSubmit = () => {
    if (commentText.trim()) {
      onComment(post.id, commentText);
      setCommentText('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
      data-testid={`post-card-${index}`}
    >
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="w-12 h-12 cursor-pointer" onClick={() => onUserClick(post.user_id)}>
          <AvatarImage src={post.user_photo} />
          <AvatarFallback>{post.username[0].toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-text-primary cursor-pointer hover:text-primary transition-colors" onClick={() => onUserClick(post.user_id)}>
              {post.username}
            </h3>
            <NetworkScore score={post.user_score} size="small" animate={false} />
          </div>
          <p className="text-xs text-text-muted">{new Date(post.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <p className="text-text-primary mb-3 whitespace-pre-wrap">{post.content}</p>

      {post.image && (
        <img src={post.image} alt="Post" className="w-full rounded-xl mb-3 max-h-96 object-cover" />
      )}

      {post.video && (
        <video src={post.video} controls className="w-full rounded-xl mb-3 max-h-96 bg-black" />
      )}

      <div className="flex items-center gap-6 text-text-secondary border-t border-gray-100 pt-3">
        <button
          onClick={() => onLike(post.id, isLiked)}
          className={`flex items-center gap-2 hover:text-red-500 transition-colors ${isLiked ? 'text-red-500' : ''}`}
          data-testid={`like-button-${index}`}
        >
          <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
          <span className="text-sm font-medium">{post.likes.length}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 hover:text-primary transition-colors"
          data-testid={`comment-button-${index}`}
        >
          <MessageCircle size={20} />
          <span className="text-sm font-medium">{post.comments.length}</span>
        </button>

        <button
          onClick={() => onShare(post.id)}
          className="flex items-center gap-2 hover:text-secondary transition-colors"
          data-testid={`share-button-${index}`}
        >
          <Share2 size={20} />
          <span className="text-sm font-medium">{post.shares}</span>
        </button>
      </div>

      {showComments && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
          {post.comments.map((comment, idx) => (
            <div key={comment.id} className="flex gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={comment.user_photo} />
                <AvatarFallback>{comment.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 bg-gray-50 rounded-xl p-3">
                <p className="text-sm font-semibold text-text-primary">{comment.username}</p>
                <p className="text-sm text-text-secondary">{comment.content}</p>
              </div>
            </div>
          ))}

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