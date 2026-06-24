// Iter 51 — unified media renderer for the Feed.
// Drives three layouts based on `post.media_type`:
//   • single   → legacy single image / video (back-compat)
//   • carousel → 2-10 swipeable slides with dots + side arrows
//   • reel     → 9:16 vertical video, autoplay-muted, tap to unmute
//
// Double-tap on the active media still triggers the like animation via
// `onMediaTap`. Component does NOT manage state for likes — the parent does.
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Volume2, VolumeX, Play } from 'lucide-react';
import { resolveMediaUrl } from '../lib/mediaUpload';
import SafeImage from './SafeImage';

const Slide = ({ slide, isActive }) => {
  if (slide.video) {
    return (
      <video
        src={resolveMediaUrl(slide.video)}
        controls
        playsInline
        preload={isActive ? 'metadata' : 'none'}
        className="w-full max-h-[560px] bg-black object-contain"
        data-testid="carousel-slide-video"
      />
    );
  }
  return (
    <SafeImage
      src={slide.image}
      fallbackSrc={slide.image_data_url || slide.data_url}
      alt={slide.caption || 'Slide'}
      className="w-full max-h-[560px] bg-black object-contain"
      draggable={false}
      data-testid="carousel-slide-image"
    />
  );
};

const ReelPlayer = ({ src, onTap, testId }) => {
  const ref = useRef(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!ref.current) return;
        if (entry.isIntersecting) {
          ref.current.play().catch(() => {});
          setPlaying(true);
        } else {
          ref.current.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.6 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      className="relative bg-black select-none w-full mx-auto"
      style={{ aspectRatio: '9 / 16', maxHeight: '80vh' }}
      onClick={onTap}
      data-testid={testId}
    >
      <video
        ref={ref}
        src={resolveMediaUrl(src)}
        loop
        muted={muted}
        playsInline
        autoPlay
        className="w-full h-full object-cover"
        onClick={(e) => {
          e.stopPropagation();
          if (!ref.current) return;
          if (ref.current.paused) {
            ref.current.play().catch(() => {});
            setPlaying(true);
          } else {
            ref.current.pause();
            setPlaying(false);
          }
        }}
      />
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 rounded-full p-4">
            <Play size={36} className="text-white" />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMuted((m) => !m);
        }}
        className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 rounded-full p-2 text-white transition-colors"
        aria-label={muted ? 'Unmute' : 'Mute'}
        data-testid="reel-mute-toggle"
      >
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
      <span className="absolute top-3 left-3 bg-black/55 text-white text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full">
        Reel
      </span>
    </div>
  );
};

const Carousel = ({ slides, onMediaTap, testId }) => {
  const [idx, setIdx] = useState(0);
  const startXRef = useRef(null);
  const total = slides.length;

  const go = (delta) => setIdx((p) => Math.max(0, Math.min(total - 1, p + delta)));

  const onTouchStart = (e) => {
    startXRef.current = e.touches?.[0]?.clientX ?? null;
  };
  const onTouchEnd = (e) => {
    if (startXRef.current == null) return;
    const dx = (e.changedTouches?.[0]?.clientX ?? 0) - startXRef.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    startXRef.current = null;
  };

  return (
    <div
      className="relative bg-black select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={onMediaTap}
      data-testid={testId}
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {slides.map((s, i) => (
            <div key={i} className="min-w-full flex items-center justify-center">
              <Slide slide={s} isActive={i === idx} />
            </div>
          ))}
        </div>
      </div>

      {/* counter pill */}
      <span className="absolute top-3 right-3 bg-black/60 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
        {idx + 1}/{total}
      </span>

      {/* arrows (desktop hover) */}
      {idx > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); go(-1); }}
          className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 bg-white/85 hover:bg-white rounded-full p-1.5 shadow-md"
          aria-label="Previous slide"
          data-testid="carousel-prev"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      {idx < total - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); go(1); }}
          className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 bg-white/85 hover:bg-white rounded-full p-1.5 shadow-md"
          aria-label="Next slide"
          data-testid="carousel-next"
        >
          <ChevronRight size={18} />
        </button>
      )}

      {/* dots */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); setIdx(i); }}
            className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
            aria-label={`Go to slide ${i + 1}`}
            data-testid={`carousel-dot-${i}`}
          />
        ))}
      </div>

      {slides[idx]?.caption && (
        <p className="absolute bottom-6 left-3 right-3 text-white text-xs bg-black/45 backdrop-blur px-2 py-1 rounded">
          {slides[idx].caption}
        </p>
      )}
    </div>
  );
};

const MediaRenderer = ({ post, onMediaTap, indexKey = '' }) => {
  const slides = Array.isArray(post.slides) ? post.slides : [];
  const mediaType = post.media_type || (slides.length >= 2 ? 'carousel' : 'single');

  // Reel — vertical autoplay-muted video
  if (mediaType === 'reel') {
    const reelSrc = post.video || slides.find((s) => s.video)?.video;
    if (!reelSrc) return null;
    return <ReelPlayer src={reelSrc} onTap={onMediaTap} testId={`post-reel-${indexKey}`} />;
  }

  // Carousel — 2+ slides
  if (mediaType === 'carousel' && slides.length >= 2) {
    return <Carousel slides={slides} onMediaTap={onMediaTap} testId={`post-carousel-${indexKey}`} />;
  }

  // Single image / video (legacy back-compat path)
  if (!post.image && !post.video) return null;
  return (
    <div className="relative bg-black select-none" onClick={onMediaTap} data-testid={`post-media-${indexKey}`}>
      {post.image && (
        <SafeImage
          src={post.image}
          fallbackSrc={post.image_data_url || post.data_url}
          alt="Post"
          className="w-full max-h-[560px] object-contain bg-black"
          draggable={false}
        />
      )}
      {post.video && !post.image && (
        <video
          src={resolveMediaUrl(post.video)}
          controls
          playsInline
          className="w-full max-h-[560px] bg-black"
        />
      )}
    </div>
  );
};

export default MediaRenderer;
