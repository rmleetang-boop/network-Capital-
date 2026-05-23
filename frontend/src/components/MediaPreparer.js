import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import imageCompression from 'browser-image-compression';
import { X, Crop as CropIcon, Sparkles, Loader2, Check, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

/**
 * MediaPreparer — optional crop + compress before posting.
 *
 * Both steps are entirely optional: the user can hit "Use as is" and the
 * original file is returned unchanged. Compression and cropping are toggled
 * independently and previewed in real time.
 *
 * Props:
 *   file         — the originally selected File
 *   onClose()    — close without committing
 *   onConfirm({ dataUrl, sizeBytes, name, type })  — committed result
 */
const formatBytes = (b) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const dataUrlToBlob = async (dataUrl) => {
  const res = await fetch(dataUrl);
  return res.blob();
};

const getCroppedImage = async (imageSrc, pixelCrop) => {
  // Decode → draw the cropped region on canvas → re-export as JPEG/PNG.
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    img,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height,
  );
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.92);
  });
};

const MediaPreparer = ({ file, onClose, onConfirm }) => {
  const isImage = file?.type?.startsWith('image/');
  const [origDataUrl] = useState(() => URL.createObjectURL(file));
  const [working, setWorking] = useState(false);
  const [cropOn, setCropOn] = useState(false);
  const [compressOn, setCompressOn] = useState(false);
  const [aspect, setAspect] = useState(1);   // 1=square, 4/5=portrait, 16/9=landscape, null=free
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [previewDataUrl, setPreviewDataUrl] = useState(null);  // result after apply
  const [previewSize, setPreviewSize] = useState(file.size);
  const originalSize = file.size;
  const aspectButtonsRef = useRef(null);

  const onCropComplete = useCallback((_, area) => setCroppedAreaPixels(area), []);

  const applyTransforms = async () => {
    if (!cropOn && !compressOn) {
      // Nothing to do — pass the original file through.
      const reader = new FileReader();
      reader.onloadend = () => onConfirm({
        dataUrl: reader.result, sizeBytes: file.size, name: file.name, type: file.type,
      });
      reader.readAsDataURL(file);
      return;
    }
    setWorking(true);
    try {
      let workingDataUrl = origDataUrl;
      let workingSize = file.size;

      // Step 1: Crop (image only)
      if (cropOn && isImage && croppedAreaPixels) {
        workingDataUrl = await getCroppedImage(origDataUrl, croppedAreaPixels);
        const blob = await dataUrlToBlob(workingDataUrl);
        workingSize = blob.size;
      }

      // Step 2: Compress (image only — video compression is not feasible client-side at scale)
      if (compressOn && isImage) {
        // Convert current dataUrl to a File for the compressor
        const blob = await dataUrlToBlob(workingDataUrl);
        const inputFile = new File([blob], file.name, { type: 'image/jpeg' });
        const compressed = await imageCompression(inputFile, {
          maxSizeMB: 1.0,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          initialQuality: 0.85,
        });
        workingDataUrl = await imageCompression.getDataUrlFromFile(compressed);
        workingSize = compressed.size;
      }

      setPreviewDataUrl(workingDataUrl);
      setPreviewSize(workingSize);
      toast.success(`Ready · ${formatBytes(workingSize)}${workingSize < originalSize ? ` (saved ${(((originalSize - workingSize) / originalSize) * 100).toFixed(0)}%)` : ''}`);
    } catch (e) {
      toast.error('Could not process the image. You can still upload the original.');
    }
    setWorking(false);
  };

  const confirm = () => {
    if (previewDataUrl) {
      onConfirm({ dataUrl: previewDataUrl, sizeBytes: previewSize, name: file.name, type: file.type });
      return;
    }
    // Pass original through
    const reader = new FileReader();
    reader.onloadend = () => onConfirm({
      dataUrl: reader.result, sizeBytes: file.size, name: file.name, type: file.type,
    });
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose} data-testid="media-preparer">
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-2">
          <h3 className="font-heading font-bold text-base flex-1 inline-flex items-center gap-2"><ImageIcon size={16} className="text-secondary" /> Edit before posting</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100" data-testid="media-preparer-close"><X size={14} /></button>
        </div>

        <div className="p-4 space-y-3">
          {/* Preview / cropper area */}
          <div className="relative w-full h-64 bg-black rounded-2xl overflow-hidden" data-testid="media-preparer-canvas">
            {cropOn && isImage && !previewDataUrl ? (
              <Cropper
                image={origDataUrl}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            ) : previewDataUrl ? (
              <img src={previewDataUrl} alt="" className="w-full h-full object-contain" />
            ) : isImage ? (
              <img src={origDataUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <video src={origDataUrl} controls className="w-full h-full object-contain" />
            )}
          </div>

          {/* Sizes */}
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>Original: <strong className="text-text-primary">{formatBytes(originalSize)}</strong></span>
            {previewDataUrl && (
              <span data-testid="media-preparer-new-size">After edits: <strong className="text-emerald-600">{formatBytes(previewSize)}</strong></span>
            )}
          </div>

          {/* Optional toggles */}
          <div className="space-y-2">
            {isImage && (
              <ToggleRow
                testId="toggle-crop"
                icon={<CropIcon size={14} />}
                title="Crop"
                subtitle="Frame your photo before posting"
                checked={cropOn}
                onChange={(v) => { setCropOn(v); setPreviewDataUrl(null); }}
              />
            )}
            {isImage && (
              <ToggleRow
                testId="toggle-compress"
                icon={<Sparkles size={14} />}
                title="Auto-compress"
                subtitle="Shrink to ~1 MB while keeping the photo sharp"
                checked={compressOn}
                onChange={(v) => { setCompressOn(v); setPreviewDataUrl(null); }}
              />
            )}
            {!isImage && (
              <p className="text-[11px] text-text-muted bg-gray-50 rounded-xl p-2.5 text-center">
                Crop and compress are available for images only. Videos are uploaded as-is.
              </p>
            )}
          </div>

          {/* Aspect picker (only when cropping is ON) */}
          {cropOn && isImage && !previewDataUrl && (
            <div ref={aspectButtonsRef} className="flex gap-2 flex-wrap" data-testid="aspect-picker">
              {[
                { v: 1, label: '1:1' },
                { v: 4 / 5, label: '4:5' },
                { v: 16 / 9, label: '16:9' },
                { v: null, label: 'Free' },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={() => setAspect(a.v)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${aspect === a.v ? 'bg-primary text-white border-primary' : 'bg-white text-text-secondary border-gray-200'}`}
                  data-testid={`aspect-${a.label}`}>
                  {a.label}
                </button>
              ))}
              <div className="flex-1" />
              <span className="text-[10px] text-text-muted self-center">Pinch / scroll to zoom</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={confirm}
              disabled={working}
              className="flex-1 bg-gray-100 text-text-primary font-semibold py-2.5 rounded-full text-sm disabled:opacity-50"
              data-testid="media-preparer-skip">
              Use as is
            </button>
            {(cropOn || compressOn) && !previewDataUrl && (
              <button
                onClick={applyTransforms}
                disabled={working || (cropOn && !croppedAreaPixels)}
                className="flex-1 bg-primary text-white font-bold py-2.5 rounded-full text-sm disabled:opacity-50 inline-flex items-center justify-center gap-1"
                data-testid="media-preparer-apply">
                {working ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Apply
              </button>
            )}
            {previewDataUrl && (
              <button
                onClick={confirm}
                className="flex-1 bg-emerald-600 text-white font-bold py-2.5 rounded-full text-sm inline-flex items-center justify-center gap-1"
                data-testid="media-preparer-confirm">
                <Check size={14} /> Use this version
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ToggleRow = ({ icon, title, subtitle, checked, onChange, testId }) => (
  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-2xl cursor-pointer hover:border-primary transition-colors">
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${checked ? 'bg-primary text-white' : 'bg-gray-100 text-text-muted'}`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-text-primary">{title}</p>
      <p className="text-[10px] text-text-muted">{subtitle}</p>
    </div>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-primary" data-testid={testId} />
  </label>
);

export default MediaPreparer;
