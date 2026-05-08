// Network Capital — public-facing brand domain for share URLs.
// We never expose internal preview hostnames in user-shared content.
// In production the site lives at networkcapitalapp.co.za.

const PRODUCTION_DOMAIN = 'https://networkcapitalapp.co.za';

/**
 * Returns the canonical brand origin for share/invite links.
 * Uses the production domain unconditionally so referral / Stokvel invite links
 * never carry preview-only hostnames (e.g., emergentagent.com).
 */
export const getShareOrigin = () => PRODUCTION_DOMAIN;

export { PRODUCTION_DOMAIN };
