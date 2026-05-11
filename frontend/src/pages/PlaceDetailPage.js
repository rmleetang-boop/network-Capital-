import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Star, Camera, Shield, X, Send, Loader2, Globe, Phone, MessageSquare } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const StarPicker = ({ value, onChange, size = 28 }) => (
  <div className="inline-flex items-center gap-1" data-testid="star-picker">
    {[1, 2, 3, 4, 5].map((s) => (
      <button
        key={s}
        type="button"
        onClick={() => onChange(s)}
        className="active:scale-90 transition-transform"
        data-testid={`star-pick-${s}`}>
        <Star
          size={size}
          className={s <= value ? 'text-secondary fill-secondary' : 'text-gray-300'}
        />
      </button>
    ))}
  </div>
);

const StarRow = ({ value = 0, size = 14 }) => (
  <div className="inline-flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star key={s} size={size} className={s <= Math.round(value) ? 'text-secondary fill-secondary' : 'text-gray-300'} />
    ))}
  </div>
);

const PlaceDetailPage = ({ user }) => {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const [place, setPlace] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [showReview, setShowReview] = useState(false);
  const [showClaim, setShowClaim] = useState(false);

  const isOwner = place && user && place.owner_id === user.id;

  const load = async () => {
    try {
      const [p, rs] = await Promise.all([
        axiosInstance.get(`/places/${placeId}`),
        axiosInstance.get(`/places/${placeId}/reviews`),
      ]);
      setPlace(p.data);
      setReviews(rs.data || []);
    } catch {
      toast.error('Place not found');
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [placeId]);

  if (!place) return <div className="p-10 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="place-detail-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-heading font-bold text-primary truncate flex-1">{place.name}</h1>
      </div>

      {place.photo && (
        <img src={place.photo} alt={place.name} className="w-full max-h-72 object-cover" />
      )}

      <div className="max-w-3xl mx-auto p-4 space-y-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="font-heading font-bold text-2xl text-primary">{place.name}</h2>
            {place.claim_status === 'claimed' && (
              <span className="bg-secondary/15 text-[10px] font-bold uppercase tracking-wider text-primary px-2 py-1 rounded-full inline-flex items-center gap-1">
                <Shield size={11} /> Claimed
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <StarRow value={place.average_rating || 0} />
            <span className="text-sm text-text-secondary">
              {Number(place.average_rating || 0).toFixed(1)} · {place.review_count} review{place.review_count === 1 ? '' : 's'}
            </span>
          </div>
          {place.description && <p className="text-sm text-text-secondary mb-3">{place.description}</p>}
          <div className="flex flex-wrap gap-2 text-xs">
            {place.address && (
              <span className="inline-flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-full text-text-secondary">
                <MapPin size={12} /> {place.address}{place.city ? `, ${place.city}` : ''}
              </span>
            )}
            {place.website && (
              <a href={place.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-full text-primary">
                <Globe size={12} /> Website
              </a>
            )}
            {place.phone && (
              <a href={`tel:${place.phone}`} className="inline-flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-full text-primary">
                <Phone size={12} /> {place.phone}
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowReview(true)}
            className="bg-primary text-white font-semibold py-2.5 rounded-full inline-flex items-center justify-center gap-1.5 active:scale-95"
            data-testid="review-place-button">
            <Star size={14} /> Write a review
          </button>
          {place.claim_status !== 'claimed' && (
            <button
              onClick={() => setShowClaim(true)}
              className="bg-secondary text-primary font-semibold py-2.5 rounded-full inline-flex items-center justify-center gap-1.5 active:scale-95"
              data-testid="claim-place-button">
              <Shield size={14} /> Claim this place
            </button>
          )}
          {place.claim_status === 'claimed' && isOwner && (
            <span className="bg-secondary/15 text-primary font-semibold py-2.5 rounded-full inline-flex items-center justify-center gap-1.5 text-xs">
              You own this listing
            </span>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="font-heading font-bold text-primary">Reviews ({reviews.length})</h3>
          {reviews.length === 0 ? (
            <p className="text-center text-text-muted text-sm py-6 bg-white rounded-2xl border border-dashed border-gray-200">
              No reviews yet. Be the first to share your experience.
            </p>
          ) : reviews.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4" data-testid={`review-${r.id}`}>
              <div className="flex items-center gap-2 mb-1">
                {r.photo ? (
                  <img src={r.photo} alt={r.username} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-xs font-bold flex items-center justify-center">
                    {(r.username || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text-primary">{r.username}</p>
                  <div className="flex items-center gap-1.5">
                    <StarRow value={r.rating} size={12} />
                    <span className="text-[10px] text-text-muted">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              {r.title && <p className="font-semibold text-text-primary text-sm mb-1">{r.title}</p>}
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{r.body}</p>
              {Array.isArray(r.photos) && r.photos.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto">
                  {r.photos.map((p, i) => (
                    <img key={i} src={p} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                  ))}
                </div>
              )}
              {r.owner_reply && (
                <div className="mt-3 ml-4 pl-3 border-l-2 border-secondary/40 bg-secondary/5 rounded-r-lg p-2.5">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-primary mb-0.5 inline-flex items-center gap-1">
                    <MessageSquare size={10} /> Owner response
                  </p>
                  <p className="text-xs text-text-secondary whitespace-pre-wrap">{r.owner_reply.body}</p>
                </div>
              )}
              {isOwner && !r.owner_reply && (
                <OwnerReplyForm
                  placeId={placeId}
                  reviewId={r.id}
                  onReplied={load}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {showReview && <ReviewModal placeId={placeId} onClose={() => setShowReview(false)} onSubmitted={() => { setShowReview(false); load(); }} />}
      {showClaim && <ClaimModal placeId={placeId} onClose={() => setShowClaim(false)} onSubmitted={() => { setShowClaim(false); load(); }} />}
    </div>
  );
};

const ReviewModal = ({ placeId, onClose, onSubmitted }) => {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const addPhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) return toast.error('Photo must be under 3MB.');
    const reader = new FileReader();
    reader.onloadend = () => setPhotos((arr) => [...arr, reader.result]);
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (body.trim().length < 4) return toast.error('Tell us more about your experience.');
    setSubmitting(true);
    try {
      await axiosInstance.post(`/places/${placeId}/reviews`, {
        rating, title: title.trim(), body: body.trim(), photos,
      });
      toast.success('Review submitted! +40 Network Score');
      onSubmitted();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={onClose} data-testid="review-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-md w-full p-5 relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100"><X size={18} /></button>
        <h3 className="font-heading font-bold text-lg mb-3">Write a review</h3>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">Your rating</label>
          <StarPicker value={rating} onChange={setRating} />
        </div>
        <input
          value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Summary (optional)"
          maxLength={120}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary mb-2"
          data-testid="review-title-input"
        />
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="What did you like? What could be better?"
          rows={5} maxLength={2000}
          className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary resize-none mb-2"
          data-testid="review-body-input"
        />
        <div className="flex items-center gap-2 mb-3">
          <label className="inline-flex items-center gap-1 text-xs text-text-secondary cursor-pointer">
            <Camera size={14} /> Add photo
            <input type="file" accept="image/*" onChange={addPhoto} className="hidden" data-testid="review-photo-input" />
          </label>
          <div className="flex gap-1 overflow-x-auto">
            {photos.map((p, i) => (
              <img key={i} src={p} alt="" className="w-12 h-12 rounded-lg object-cover" />
            ))}
          </div>
        </div>
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-primary text-white font-bold py-2.5 rounded-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
          data-testid="review-submit-button">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Submit review
        </button>
      </div>
    </div>
  );
};

const ClaimModal = ({ placeId, onClose, onSubmitted }) => {
  const [proof, setProof] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await axiosInstance.post(`/places/${placeId}/claim`, { proof, contact_email: email });
      toast.success('Claim submitted! Our team will review it shortly.');
      onSubmitted();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not submit claim');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={onClose} data-testid="claim-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-md w-full p-5 relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100"><X size={18} /></button>
        <h3 className="font-heading font-bold text-lg mb-1">Claim this place</h3>
        <p className="text-xs text-text-muted mb-3">Owners can claim their business to respond to reviews and feature in search.</p>
        <input
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Business contact email"
          type="email"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary mb-2"
          data-testid="claim-email-input"
        />
        <textarea
          value={proof} onChange={(e) => setProof(e.target.value)}
          placeholder="Brief proof of ownership (e.g., link to business registration, website, social handle)"
          rows={4}
          className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary resize-none mb-3"
          data-testid="claim-proof-input"
        />
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-secondary text-primary font-bold py-2.5 rounded-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
          data-testid="claim-submit-button">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />} Submit claim
        </button>
      </div>
    </div>
  );
};

const OwnerReplyForm = ({ placeId, reviewId, onReplied }) => {
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (reply.trim().length < 2) return;
    setSubmitting(true);
    try {
      await axiosInstance.post(`/places/${placeId}/reviews/${reviewId}/reply`, { reply: reply.trim() });
      toast.success('Reply posted');
      onReplied();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not reply');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="mt-3 flex items-center gap-2" data-testid={`owner-reply-form-${reviewId}`}>
      <input
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="Respond as the owner…"
        className="flex-1 px-3 py-2 border border-gray-200 rounded-full text-xs outline-none focus:border-primary"
        data-testid={`owner-reply-input-${reviewId}`}
      />
      <button
        onClick={submit}
        disabled={submitting}
        className="bg-primary text-white text-xs font-semibold px-3 py-2 rounded-full disabled:opacity-50"
        data-testid={`owner-reply-submit-${reviewId}`}>
        Reply
      </button>
    </div>
  );
};

export default PlaceDetailPage;
