import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, ArrowLeft, Search, Share2 } from 'lucide-react';
import { axiosInstance } from '../App';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import FeatureIntroModal from '../components/FeatureIntroModal';

const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString();
};

const MessagesPage = ({ user }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sharePostId = params.get('share_post');
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const r = await axiosInstance.get('/dm/threads');
        setThreads(r.data.threads || []);
      } catch {}
      setLoading(false);
    };
    load();
    // poll every 5s for fresh threads
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const filtered = query
    ? threads.filter((t) =>
        (t.other_username || '').toLowerCase().includes(query.toLowerCase()) ||
        (t.other_full_name || '').toLowerCase().includes(query.toLowerCase())
      )
    : threads;

  return (
    <div className="min-h-screen bg-background-DEFAULT" data-testid="messages-page">
      <FeatureIntroModal
        featureKey="messages"
        icon={<MessageCircle size={20} />}
        title="Direct Messages"
        subtitle="Private 1-to-1 chat with anyone in the Network Capital community."
        bullets={[
          { icon: <MessageCircle size={14} />, label: 'Text, voice & images', body: 'Send messages, voice notes (3MB), images (3MB), or share a post directly into a chat.' },
          { icon: <Search size={14} />, label: 'Open messaging', body: 'No pre-approval needed — DM anyone you discover in Hubs or the Feed.' },
          { icon: <Share2 size={14} />, label: 'Compliance-aware', body: 'Financial-claim words are flagged automatically to keep our community POPIA-aligned.' },
        ]}
      />
      <div className="sticky top-0 z-10 bg-gradient-to-r from-[#0a1628] via-primary to-[#0a1628] border-b border-white/10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/profile')} className="p-2 text-white/80 hover:text-white" data-testid="messages-back">
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
            <MessageCircle className="text-primary" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-white">Messages</h1>
            <p className="text-xs text-white/60">{threads.length} conversation{threads.length === 1 ? '' : 's'}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {sharePostId && (
          <div className="mb-3 p-3 rounded-xl bg-secondary/20 border border-secondary/40 flex items-start gap-2" data-testid="share-post-banner">
            <Share2 size={16} className="text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-primary">Sharing a post</p>
              <p className="text-xs text-text-secondary">Pick a conversation to send it in.</p>
            </div>
          </div>
        )}

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className="w-full pl-9 pr-3 py-2 rounded-full bg-background-subtle border border-gray-200 focus:border-primary outline-none text-sm"
            data-testid="messages-search"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle className="mx-auto mb-3 text-text-muted" size={40} />
            <p className="text-text-secondary font-medium">No conversations yet</p>
            <p className="text-xs text-text-muted mt-1">Open any profile and tap “Message” to start one.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filtered.map((t, idx) => (
              <motion.li
                key={t.thread_key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx, 6) * 0.03 }}
              >
                <button
                  onClick={() => navigate(sharePostId ? `/messages/${t.other_user_id}?share_post=${sharePostId}` : `/messages/${t.other_user_id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-background-subtle transition-colors"
                  data-testid={`thread-${t.other_user_id}`}
                >
                  <Avatar className="w-12 h-12 flex-shrink-0">
                    <AvatarImage src={t.other_photo} />
                    <AvatarFallback>{(t.other_username || '?')[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-text-primary truncate">
                        {t.other_full_name || t.other_username}
                      </p>
                      <p className="text-[11px] text-text-muted flex-shrink-0 ml-2">{timeAgo(t.last_at)}</p>
                    </div>
                    <p className="text-sm text-text-secondary truncate">
                      {t.last_sender_id === user.id ? 'You: ' : ''}
                      {t.last_text || '(media)'}
                    </p>
                  </div>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
