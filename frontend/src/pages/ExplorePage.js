import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, Hash, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../App';
import FeatureIntroModal from '../components/FeatureIntroModal';

const ExplorePage = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axiosInstance.get('/explore'),
      axiosInstance.get('/hashtags/trending'),
    ]).then(([p, t]) => {
      setPosts(p.data.posts || []);
      setTags(t.data.tags || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] pb-24" data-testid="explore-page">
      <FeatureIntroModal
        featureKey="explore"
        icon={<Sparkles size={20} />}
        title="Explore what's trending"
        subtitle="Discover the most-loved posts and hashtags across the Network Capital community."
        bullets={[
          { icon: <TrendingUp size={14} />, label: 'Trending hashtags', body: 'Tap any tag to see every post in that conversation.' },
          { icon: <Hash size={14} />, label: 'Top posts last 7 days', body: 'Ranked by engagement so you always see the highest-quality content.' },
          { icon: <ImageIcon size={14} />, label: 'Visual-first grid', body: 'Tap any tile to open the full post in your feed.' },
        ]}
      />
      <div className="sticky top-0 z-10 bg-[#0a1628]/95 backdrop-blur-lg border-b border-white/10 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
            <Sparkles className="text-primary" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-white">Explore</h1>
            <p className="text-xs text-white/60">Trending in the community</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-5">
        {/* Trending hashtags */}
        {tags.length > 0 && (
          <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-secondary" />
              <span className="text-white font-bold text-sm">Trending hashtags</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t.tag}
                  onClick={() => navigate(`/hashtag/${t.tag}`)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white text-xs flex items-center gap-1 transition-colors"
                  data-testid={`trending-${t.tag}`}
                >
                  <Hash size={12} />
                  {t.tag}
                  <span className="text-secondary">· {t.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Visual grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1" data-testid="explore-grid">
            {posts.map((p, idx) => {
              const media = p.image || p.video;
              const isVideo = !!p.video;
              return (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => navigate(`/?post=${p.id}`)}
                  className="aspect-square relative bg-white/5 overflow-hidden"
                  data-testid={`explore-post-${p.id}`}
                >
                  {media ? (
                    isVideo ? (
                      <>
                        <video src={media} muted className="w-full h-full object-cover" />
                        <VideoIcon size={14} className="absolute top-1 right-1 text-white drop-shadow-md" />
                      </>
                    ) : (
                      <img src={media} alt="" className="w-full h-full object-cover" />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2 bg-gradient-to-br from-primary to-secondary/60">
                      <p className="text-white text-xs text-center line-clamp-4">{p.content}</p>
                    </div>
                  )}
                  <div className="absolute bottom-1 left-1 text-[10px] text-white font-medium drop-shadow-md flex items-center gap-2">
                    ♥ {(p.likes || []).length} · ↗ {p.shares || 0}
                  </div>
                </motion.button>
              );
            })}
            {posts.length === 0 && (
              <p className="col-span-3 text-center text-white/50 py-10">Nothing trending yet — be the first to post!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExplorePage;
