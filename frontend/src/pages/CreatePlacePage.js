import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Loader2, MapPin } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const CATEGORIES = [
  { v: 'restaurant', l: 'Restaurant' },
  { v: 'store',      l: 'Store' },
  { v: 'guesthouse', l: 'Guesthouse / Hotel' },
  { v: 'salon',      l: 'Salon / Beauty' },
  { v: 'service',    l: 'Service / Repair' },
  { v: 'other',      l: 'Other' },
];

const CreatePlacePage = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState({
    name: '', category: 'restaurant', description: '',
    address: '', city: '', country: '',
    lat: '', lng: '', phone: '', website: '', photo: '',
  });
  const [locating, setLocating] = useState(false);

  const uploadPhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) return toast.error('Photo must be under 3MB');
    const reader = new FileReader();
    reader.onloadend = () => setData((d) => ({ ...d, photo: reader.result }));
    reader.readAsDataURL(f);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error('Geolocation not supported in this browser');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setData((d) => ({ ...d, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }));
        setLocating(false);
        toast.success('Location captured');
      },
      () => { setLocating(false); toast.error('Could not get location'); },
      { timeout: 8000 },
    );
  };

  const submit = async () => {
    if (data.name.trim().length < 2) return toast.error('Name is required');
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        lat: data.lat ? Number(data.lat) : null,
        lng: data.lng ? Number(data.lng) : null,
      };
      const r = await axiosInstance.post('/places', payload);
      toast.success('Place added! Help the community by posting the first review.');
      navigate(`/places/${r.data.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not add place');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="create-place-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-heading font-bold text-primary flex-1">Add a place</h1>
        <button
          onClick={submit}
          disabled={submitting}
          className="bg-secondary text-primary font-bold px-4 py-1.5 rounded-full text-sm disabled:opacity-50 inline-flex items-center gap-1.5"
          data-testid="place-publish-button">
          {submitting && <Loader2 size={14} className="animate-spin" />} Publish
        </button>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <input
            value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="Place name *"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
            data-testid="place-name-input"
          />
          <select
            value={data.category} onChange={(e) => setData({ ...data, category: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
            data-testid="place-category-select">
            {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
          <textarea
            value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })}
            placeholder="Short description (optional)"
            rows={3} maxLength={1000}
            className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary resize-none"
            data-testid="place-description-input"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <input
            value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })}
            placeholder="Street address"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
            data-testid="place-address-input"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={data.city} onChange={(e) => setData({ ...data, city: e.target.value })}
              placeholder="City"
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
              data-testid="place-city-input"
            />
            <input
              value={data.country} onChange={(e) => setData({ ...data, country: e.target.value })}
              placeholder="Country"
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
              data-testid="place-country-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={data.lat} onChange={(e) => setData({ ...data, lat: e.target.value })}
              placeholder="Latitude" inputMode="decimal"
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
              data-testid="place-lat-input"
            />
            <input
              value={data.lng} onChange={(e) => setData({ ...data, lng: e.target.value })}
              placeholder="Longitude" inputMode="decimal"
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
              data-testid="place-lng-input"
            />
          </div>
          <button
            onClick={useMyLocation}
            disabled={locating}
            className="w-full bg-gray-50 hover:bg-gray-100 text-text-primary text-xs font-semibold py-2 rounded-full inline-flex items-center justify-center gap-1.5"
            data-testid="place-use-location-button">
            {locating ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />} Use my current location
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <input
            value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })}
            placeholder="Phone"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
            data-testid="place-phone-input"
          />
          <input
            value={data.website} onChange={(e) => setData({ ...data, website: e.target.value })}
            placeholder="Website (https://…)"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
            data-testid="place-website-input"
          />
          <label className="inline-flex items-center gap-1.5 text-sm text-text-secondary cursor-pointer">
            <Camera size={14} /> {data.photo ? 'Replace cover photo' : 'Add cover photo'}
            <input type="file" accept="image/*" onChange={uploadPhoto} className="hidden" data-testid="place-photo-input" />
          </label>
          {data.photo && (
            <img src={data.photo} alt="" className="w-full max-h-48 object-cover rounded-xl" />
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatePlacePage;
