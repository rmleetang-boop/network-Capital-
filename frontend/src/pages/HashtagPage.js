import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Hash } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { axiosInstance } from '../App';

const HashtagPage = () => {
  const { tag } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance.get(`/hashtags/${tag}/posts`).then((r) => {
      setPosts(r.data.posts || []);
    }).finally(() => setLoading(false));
  }, [tag]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] pb-24" data-testid="hashtag-page">
      <div className="sticky top-0 z-10 bg-[#0a1628]/95 backdrop-blur-lg border-b border-white/10 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 text-white/60 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
            <Hash className="text-primary" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-white">#{tag}</h1>
            <p className="text-xs text-white/60">{posts.length} post{posts.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto p-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-white/50 py-20">No posts with #{tag} yet</p>
        ) : (
          <div className="grid grid-cols-3 gap-1" data-testid="hashtag-grid">
            {posts.map((p, idx) => {
              const media = p.image || p.video;
              return (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
                  className="aspect-square bg-white/5 overflow-hidden"
                  data-testid={`hashtag-post-${p.id}`}
                >
                  {media ? (
                    p.video ? <video src={media} muted className="w-full h-full object-cover" />
                            : <img src={media} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2 bg-gradient-to-br from-primary to-secondary/60">
                      <p className="text-white text-xs line-clamp-4 text-center">{p.content}</p>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HashtagPage;
