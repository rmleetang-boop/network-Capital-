import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Send } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const StoriesRibbon = ({ currentUser, onOpenViewer }) => {
  const [groups, setGroups] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const r = await axiosInstance.get('/stories/feed');
      setGroups(r.data.groups || []);
    } catch {}
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 11 * 1024 * 1024) { toast.error(`File is ${(file.size/1024/1024).toFixed(1)} MB — over the 11 MB limit. Please compress and try again.`); return; }
    const isVideo = file.type.startsWith('video/');
    setUploading(true);
    try {
      const r = new FileReader();
      r.onload = async () => {
        try {
          await axiosInstance.post('/stories', {
            media_type: isVideo ? 'video' : 'image',
            media_url: r.result,
          });
          toast.success('Story posted! +5');
          setShowCreate(false);
          load();
        } catch (e) {
          toast.error('Failed to post story');
        } finally { setUploading(false); }
      };
      r.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  };

  return (
    <div className="px-4 pt-3 pb-2 overflow-x-auto" data-testid="stories-ribbon">
      <div className="flex gap-3 w-max">
        {/* Your Story (create) */}
        <button
          onClick={() => setShowCreate(true)}
          className="flex flex-col items-center gap-1 w-16 flex-shrink-0"
          data-testid="create-story-button"
        >
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-secondary/30 to-primary/30 border-2 border-dashed border-white/30 flex items-center justify-center">
            {currentUser?.photo ? (
              <img src={currentUser.photo} alt="" className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                {currentUser?.username?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-secondary rounded-full flex items-center justify-center border-2 border-white">
              <Plus size={12} className="text-primary" />
            </div>
          </div>
          <span className="text-[10px] text-white/70 truncate max-w-full">Your story</span>
        </button>

        {groups.map((g) => {
          const ring = g.all_viewed ? 'from-gray-400 to-gray-500' : 'from-secondary via-pink-500 to-purple-500';
          return (
            <button
              key={g.user_id}
              onClick={() => onOpenViewer(g)}
              className="flex flex-col items-center gap-1 w-16 flex-shrink-0"
              data-testid={`story-${g.user_id}`}
            >
              <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${ring} p-0.5`}>
                <div className="w-full h-full rounded-full bg-[#0a1628] p-0.5">
                  {g.user_photo ? (
                    <img src={g.user_photo} alt={g.username} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                      {g.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-white/70 truncate max-w-full">{g.username}</span>
            </button>
          );
        })}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !uploading && setShowCreate(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0a1628] rounded-2xl border border-white/20 max-w-sm w-full p-6 text-center"
            onClick={(e) => e.stopPropagation()}
            data-testid="create-story-modal"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Post a story</h3>
              <button onClick={() => setShowCreate(false)} className="text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <p className="text-white/60 text-sm mb-5">Disappears after 24 hours. +5 pts.</p>
            <label className="block cursor-pointer bg-gradient-to-r from-secondary to-yellow-500 text-primary font-bold py-4 rounded-2xl" data-testid="story-upload-tile">
              <Send className="mx-auto mb-1" size={24} />
              {uploading ? 'Uploading...' : 'Choose photo or video'}
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default StoriesRibbon;
