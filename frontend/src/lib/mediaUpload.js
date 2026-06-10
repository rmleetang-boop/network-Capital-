// Iter 51 — disk-backed uploads for carousel slides + reels.
// Streams a single File to POST /api/uploads/media and returns the
// public URL the backend served back. Frontend treats the URL as opaque.
import { axiosInstance } from '../App';

const IMAGE_CAP = 11 * 1024 * 1024;        // 11 MB
const VIDEO_CAP = 50 * 1024 * 1024;        // 50 MB
const MAX_VIDEO_SECONDS = 30;              // hard cap (matches backend)

const formatBytes = (b) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

// Resolve a server-relative URL (e.g. /api/uploads/posts/abc.jpg)
// into an absolute URL the <img>/<video> tag can hit through ingress.
export const resolveMediaUrl = (url) => {
  if (!url) return url;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const base = process.env.REACT_APP_BACKEND_URL || '';
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
};

// Read a video file's duration in seconds without uploading it.
export const probeVideoDuration = (file) =>
  new Promise((resolve) => {
    const blobUrl = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(blobUrl);
      resolve(Number.isFinite(d) ? d : 0);
    };
    v.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      resolve(0);
    };
    v.src = blobUrl;
  });

export const validateMediaFile = (file, expected) => {
  if (!file) return 'No file selected.';
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (expected === 'image' && !isImage) return `That file isn't an image (got ${file.type || 'unknown'}).`;
  if (expected === 'video' && !isVideo) return `That file isn't a video (got ${file.type || 'unknown'}).`;
  if (isImage && file.size > IMAGE_CAP) return `Image is ${formatBytes(file.size)} — over the 11 MB limit.`;
  if (isVideo && file.size > VIDEO_CAP) return `Video is ${formatBytes(file.size)} — over the 50 MB limit.`;
  return null;
};

// Upload a single file. Returns { url, kind, size_bytes }.
// `onProgress` receives a 0-100 number.
export const uploadMedia = async (file, { scope = 'posts', onProgress } = {}) => {
  const form = new FormData();
  form.append('file', file);
  form.append('scope', scope);
  const res = await axiosInstance.post('/uploads/media', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (!onProgress || !evt.total) return;
      onProgress(Math.round((evt.loaded * 100) / evt.total));
    },
  });
  return res.data;
};

export { IMAGE_CAP, VIDEO_CAP, MAX_VIDEO_SECONDS, formatBytes };
