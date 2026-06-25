// Tiny helpers for the Stokvel onboarding intro gate.
// Extracted out of pages/StokvelIntroPage so App.js can import these without
// pulling the full intro page bundle eagerly (App.js code-splitting).
const STORAGE_KEY = 'nc_stokvel_intro_seen';

export const markStokvelIntroSeen = () => {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignored */ }
};

export const hasSeenStokvelIntro = () => {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
};
