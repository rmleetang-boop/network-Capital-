import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Star, Plus, List, Map as MapIcon, Loader2 } from 'lucide-react';
import { axiosInstance } from '../App';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet marker icons (webpack hides them)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CATEGORIES = [
  { v: 'all',        l: 'All',         emoji: '✶' },
  { v: 'restaurant', l: 'Restaurants', emoji: '🍽' },
  { v: 'store',      l: 'Stores',      emoji: '🛍' },
  { v: 'guesthouse', l: 'Guesthouses', emoji: '🛏' },
  { v: 'salon',      l: 'Salons',      emoji: '✂' },
  { v: 'service',    l: 'Services',    emoji: '⚙' },
  { v: 'other',      l: 'Other',       emoji: '◇' },
];

const StarRow = ({ value = 0, size = 12 }) => (
  <div className="inline-flex items-center gap-0.5" data-testid="star-row">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star
        key={s}
        size={size}
        className={s <= Math.round(value) ? 'text-secondary fill-secondary' : 'text-gray-300'}
      />
    ))}
  </div>
);

const PlacesPage = ({ user }) => {
  const navigate = useNavigate();
  const [view, setView] = useState('list'); // list | map
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (category !== 'all') params.category = category;
      if (query.trim()) params.q = query.trim();
      const r = await axiosInstance.get('/places', { params });
      setPlaces(r.data || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [category]);

  const geo = useMemo(() => {
    const pts = places.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number');
    if (!pts.length) return { center: [-26.2041, 28.0473], zoom: 5 }; // Johannesburg default
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    return { center: [lat, lng], zoom: 5 };
  }, [places]);

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="places-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h1 className="font-heading font-bold text-primary text-lg">My Places</h1>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full bg-gray-100 p-1" data-testid="places-view-toggle">
              <button
                onClick={() => setView('list')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${view === 'list' ? 'bg-white shadow text-primary' : 'text-text-secondary'}`}
                data-testid="places-view-list">
                <List size={12} /> List
              </button>
              <button
                onClick={() => setView('map')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${view === 'map' ? 'bg-white shadow text-primary' : 'text-text-secondary'}`}
                data-testid="places-view-map">
                <MapIcon size={12} /> Map
              </button>
            </div>
            <button
              onClick={() => navigate('/places/new')}
              className="bg-secondary text-primary font-bold px-3 py-1.5 rounded-full text-xs inline-flex items-center gap-1 active:scale-95"
              data-testid="places-new-button">
              <Plus size={12} /> Add place
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="Search restaurants, stores, guesthouses…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm outline-none focus:border-primary"
              data-testid="places-search-input"
            />
          </div>
          <button
            onClick={load}
            className="bg-primary text-white text-xs font-semibold px-3 py-2 rounded-full"
            data-testid="places-search-button">
            Go
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto -mx-2 px-2 pb-1 scrollbar-hide">
          {CATEGORIES.map((c) => (
            <button
              key={c.v}
              onClick={() => setCategory(c.v)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap inline-flex items-center gap-1 transition-all ${
                category === c.v
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
              }`}
              data-testid={`category-chip-${c.v}`}>
              <span>{c.emoji}</span> {c.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>
      ) : view === 'list' ? (
        <div className="max-w-3xl mx-auto p-4 space-y-3">
          {places.length === 0 ? (
            <div className="text-center text-text-muted py-12">
              <MapPin size={40} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No places yet. Be the first to add one!</p>
            </div>
          ) : places.map((p) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/places/${p.id}`)}
              className="bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
              data-testid={`place-row-${p.id}`}>
              <div className="flex items-start gap-3">
                {p.photo ? (
                  <img src={p.photo} alt={p.name} className="w-16 h-16 rounded-xl object-cover bg-gray-100" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/20 flex items-center justify-center text-2xl">
                    {CATEGORIES.find((c) => c.v === p.category)?.emoji || '◇'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-text-primary truncate">{p.name}</h3>
                    {p.claim_status === 'claimed' && (
                      <span className="bg-secondary/15 text-[10px] font-bold uppercase tracking-wider text-primary px-1.5 py-0.5 rounded-full">Claimed</span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary truncate">{p.city || p.address || 'Location TBA'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StarRow value={p.average_rating || 0} />
                    <span className="text-[11px] text-text-muted">
                      {Number(p.average_rating || 0).toFixed(1)} · {p.review_count || 0} review{p.review_count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-[calc(100vh-200px)] w-full" data-testid="places-map-view">
          <MapContainer center={geo.center} zoom={geo.zoom} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {places.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number').map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]}>
                <Popup>
                  <div className="text-sm">
                    <strong>{p.name}</strong><br />
                    <span className="text-xs text-gray-600">{p.city}</span><br />
                    <div className="flex items-center gap-1 mt-1">
                      <StarRow value={p.average_rating || 0} size={10} />
                      <span className="text-[10px]">{Number(p.average_rating || 0).toFixed(1)}</span>
                    </div>
                    <button
                      onClick={() => navigate(`/places/${p.id}`)}
                      className="mt-2 text-primary font-semibold text-xs"
                      data-testid={`map-popup-open-${p.id}`}>
                      View →
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
};

export default PlacesPage;
