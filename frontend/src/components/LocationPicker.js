import React, { useEffect, useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { axiosInstance } from '../App';
import { MapPin } from 'lucide-react';

/**
 * Country → Province → City cascading selectors driven by /api/hubs/regions.
 * Calls onChange({country, province, city}) whenever any selection changes.
 *
 * `theme` = 'dark' (default, used on AuthPage) | 'light' (Profile, Settings).
 */
const LocationPicker = ({ value = {}, onChange, theme = 'dark', required = false, testIdPrefix = 'location' }) => {
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState(value.country || '');
  const [province, setProvince] = useState(value.province || '');
  const [city, setCity] = useState(value.city || '');

  useEffect(() => {
    axiosInstance.get('/hubs/regions').then((r) => setCountries(r.data.countries || [])).catch(() => {});
  }, []);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.value === country),
    [country, countries]
  );
  const selectedProvince = useMemo(
    () => selectedCountry?.provinces?.find((p) => p.value === province),
    [province, selectedCountry]
  );

  const handleCountry = (v) => {
    setCountry(v);
    setProvince('');
    setCity('');
    onChange?.({ country: v, province: '', city: '' });
  };
  const handleProvince = (v) => {
    setProvince(v);
    setCity('');
    onChange?.({ country, province: v, city: '' });
  };
  const handleCity = (v) => {
    setCity(v);
    onChange?.({ country, province, city: v });
  };

  const isDark = theme === 'dark';
  const labelClass = isDark
    ? 'text-[11px] uppercase tracking-wider text-white/60'
    : 'text-[11px] uppercase tracking-wider text-text-muted';
  const triggerClass = isDark
    ? 'bg-white/5 border-white/10 text-white'
    : '';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className={`${labelClass} flex items-center gap-1 mb-1`}>
          <MapPin size={11} /> Country {required && <span className="text-red-400">*</span>}
        </label>
        <Select value={country} onValueChange={handleCountry}>
          <SelectTrigger data-testid={`${testIdPrefix}-country`} className={triggerClass}>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {countries.map((c) => (
              <SelectItem key={c.value} value={c.value} data-testid={`${testIdPrefix}-country-${c.value}`}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className={`${labelClass} mb-1 block`}>Province / Region</label>
        <Select
          value={province}
          onValueChange={handleProvince}
          disabled={!selectedCountry}
        >
          <SelectTrigger data-testid={`${testIdPrefix}-province`} className={triggerClass}>
            <SelectValue placeholder={selectedCountry ? 'Select province' : '…'} />
          </SelectTrigger>
          <SelectContent>
            {(selectedCountry?.provinces || []).map((p) => (
              <SelectItem key={p.value} value={p.value} data-testid={`${testIdPrefix}-province-${p.value}`}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className={`${labelClass} mb-1 block`}>City</label>
        <Select
          value={city}
          onValueChange={handleCity}
          disabled={!selectedProvince}
        >
          <SelectTrigger data-testid={`${testIdPrefix}-city`} className={triggerClass}>
            <SelectValue placeholder={selectedProvince ? 'Select city' : '…'} />
          </SelectTrigger>
          <SelectContent>
            {(selectedProvince?.cities || []).map((c) => (
              <SelectItem key={c.value} value={c.value} data-testid={`${testIdPrefix}-city-${c.value}`}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default LocationPicker;
