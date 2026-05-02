import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { axiosInstance } from '../App';

const DURATION_MS = 5000;

const StoryViewer = ({ group, onClose, onNextGroup, onPrevGroup }) => {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const story = group.stories[idx];

  const markViewed = useCallback(async (id) => {
    try { await axiosInstance.post(`/stories/${id}/view`); } catch {}
  }, []);

  useEffect(() => {
    if (!story) return;
    markViewed(story.id);
    setProgress(0);
    const start = Date.now();
    const interval = setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / DURATION_MS) * 100);
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        if (idx < group.stories.length - 1) setIdx(idx + 1);
        else if (onNextGroup) onNextGroup();
        else onClose();
      }
    }, 50);
    return () => clearInterval(interval);
  }, [story, idx, group.stories.length, markViewed, onClose, onNextGroup]);

  const handleTap = (e) => {
    const { clientX, currentTarget } = e;
    const width = currentTarget.getBoundingClientRect().width;
    if (clientX < width / 3) {
      if (idx > 0) setIdx(idx - 1);
      else if (onPrevGroup) onPrevGroup();
    } else {
      if (idx < group.stories.length - 1) setIdx(idx + 1);
      else if (onNextGroup) onNextGroup();
      else onClose();
    }
  };

  if (!story) return null;

  return (
    <div className="fixed inset-0 bg-black z-[60] flex items-center justify-center" onClick={onClose} data-testid="story-viewer">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative w-full h-full max-w-md mx-auto bg-black flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 z-10 flex gap-1">
          {group.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{ width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-3 right-3 z-10 flex items-center gap-2 pt-2">
          {group.user_photo ? (
            <img src={group.user_photo} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-primary text-xs font-bold">
              {group.username[0].toUpperCase()}
            </div>
          )}
          <span className="text-white text-sm font-semibold">{group.username}</span>
          <span className="text-white/50 text-xs ml-auto">
            {new Date(story.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button onClick={onClose} className="text-white" data-testid="story-close"><X size={20} /></button>
        </div>

        {/* Media */}
        <div className="w-full h-full" onClick={handleTap}>
          {story.media_type === 'video' ? (
            <video src={story.media_url} autoPlay muted playsInline className="w-full h-full object-contain" />
          ) : (
            <img src={story.media_url} alt="" className="w-full h-full object-contain" />
          )}
          {story.caption && (
            <div className="absolute bottom-16 left-0 right-0 text-center px-6">
              <p className="text-white text-base drop-shadow-lg">{story.caption}</p>
            </div>
          )}
        </div>

        {/* Tap zones */}
        <button onClick={() => idx > 0 ? setIdx(idx - 1) : onPrevGroup && onPrevGroup()} className="absolute left-0 top-0 bottom-0 w-1/4 flex items-center justify-start pl-2 text-white/0 hover:text-white/30 transition-colors">
          <ChevronLeft size={32} />
        </button>
        <button onClick={() => idx < group.stories.length - 1 ? setIdx(idx + 1) : (onNextGroup ? onNextGroup() : onClose())} className="absolute right-0 top-0 bottom-0 w-1/4 flex items-center justify-end pr-2 text-white/0 hover:text-white/30 transition-colors">
          <ChevronRight size={32} />
        </button>
      </motion.div>
    </div>
  );
};

export default StoryViewer;
