// Iter 55 — Image with graceful fallback.
// Tries the primary `src`. If that 404s (typical after a container redeploy
// wipes /app/backend/uploads/), swaps to `fallbackSrc` (base64 data URL).
// If both fail, shows a tiny "image unavailable" placeholder instead of the
// broken-image icon the browser draws by default.
import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { resolveMediaUrl } from '../lib/mediaUpload';

const SafeImage = ({ src, fallbackSrc, alt = '', className = '', style, draggable, ...rest }) => {
  const [stage, setStage] = useState('primary');  // primary → fallback → broken
  const resolved =
    stage === 'primary' ? resolveMediaUrl(src) :
    stage === 'fallback' ? resolveMediaUrl(fallbackSrc || src) :
    null;

  if (!resolved) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400 ${className}`}
        style={{ minHeight: 120, ...style }}
        data-testid="safe-image-broken"
        aria-label="Image unavailable"
      >
        <div className="flex flex-col items-center gap-1 px-3 py-2 text-center">
          <ImageOff size={28} />
          <span className="text-[10px] uppercase tracking-wider font-semibold opacity-70">Image unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      style={style}
      draggable={draggable}
      onError={() => {
        if (stage === 'primary' && fallbackSrc) setStage('fallback');
        else setStage('broken');
      }}
      {...rest}
    />
  );
};

export default SafeImage;
