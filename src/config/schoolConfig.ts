/**
 * ============================================================================
 * SCHOOL BRAND & IDENTITY TEMPLATE CONFIGURATION
 * ============================================================================
 * 
 * This file serves as the SINGLE SOURCE OF TRUTH for customizing this school
 * management system, student result portal, and continuous assessment system
 * for any school.
 * 
 * HOW TO USE FOR A NEW SCHOOL DEPLOYMENT:
 * ----------------------------------------------------------------------------
 * 1. Modify the `DEFAULT_SCHOOL_CONFIG` values below with the new school's details:
 *    - School Name, Acronym, Motto, Address, Phone, WhatsApp, Email, Logo
 * 
 * 2. (Optional) Place the new school's logo in `/public/school-logo.png`
 *    OR provide an image URL / base64 image string in `logoUrl`.
 * 
 * 3. (Optional) In production environments (Vercel, Netlify, Cloud Run, etc.),
 *    you can also override these values dynamically using Environment Variables:
 *    - VITE_SCHOOL_NAME="Your School Name"
 *    - VITE_SCHOOL_SHORT_NAME="Your School"
 *    - VITE_SCHOOL_MOTTO="Your School Motto"
 *    - VITE_SCHOOL_PHONE="08012345678"
 *    - VITE_SCHOOL_WHATSAPP="08012345678"
 *    - VITE_SCHOOL_ADDRESS="123 Education Boulevard"
 *    - VITE_SCHOOL_CITY_STATE="Lagos, Nigeria"
 *    - VITE_SCHOOL_EMAIL="admin@yourschool.edu.ng"
 *    - VITE_SCHOOL_LOGO_URL="/school-logo.png"
 * 
 * 4. You can also customize all identifiers directly from the live app
 *    via Admin Dashboard -> School Profile & White-Label Setup.
 */

export interface SchoolTemplateConfig {
  /** Full official legal/institution name for headers, certificates, report cards */
  schoolName: string;
  /** Short or everyday name used in mobile navigation and tight UI spaces */
  shortName: string;
  /** Acronym / initials for badges and icons (e.g. "DGOS", "ERC") */
  acronym: string;
  /** Primary institutional motto */
  motto: string;
  /** Sub-motto or core pillars displayed on stamps and banners */
  subMotto: string;
  /** Path or URL to official school crest/logo (e.g. "/school-logo.png" or web link) */
  logoUrl: string;
  /** Optional secondary crest or icon used inside stamps */
  stampLogoUrl?: string;
  /** Top curved arc text on official rubber stamp (defaults to uppercase school name) */
  stampTopText: string;
  /** Bottom curved arc text on official rubber stamp (e.g. "OFFICIAL SEAL • APPROVED") */
  stampBottomText: string;
  /** Campus physical street address */
  campusAddress: string;
  /** Campus city, state, and province */
  cityState: string;
  /** Country */
  country: string;
  /** Primary administrative phone number */
  phonePrimary: string;
  /** Secondary hotline / customer service phone number */
  phoneSecondary: string;
  /** Official administrative email address */
  emailContact: string;
  /** WhatsApp enquiry number for instant chat links (international format or local) */
  whatsAppNumber: string;
  /** Administrative office enquiry hours */
  visitingHours: string;
  /** Live admissions status announcement badge */
  admissionStatus: string;
  /** Name of Head Teacher, Principal, or Academic Director */
  principalName: string;
  /** Title of Head Teacher or Principal */
  principalTitle: string;
  /** Portal header title */
  portalTitle: string;
  /** Homepage welcome banner headline */
  welcomeHeadline: string;
  /** Homepage welcome banner subheadline */
  welcomeSubheadline: string;
  /** Comprehensive about section narrative */
  aboutText: string;
}

/**
 * DEFAULT TEMPLATE PRESET
 * Edit the values below to pre-brand this repository for another school.
 */
export const DEFAULT_SCHOOL_CONFIG: SchoolTemplateConfig = {
  schoolName: 'EMINENT ROYAL CROWN ACADEMY',
  shortName: 'ERCA',
  acronym: 'ERCA',
  motto: 'Knowledge and achievements',
  subMotto: '',
  logoUrl: '/school-logo.png',
  stampLogoUrl: '',
  stampTopText: 'EMINENT ROYAL CROWN ACADEMY',
  stampBottomText: 'OFFICIAL SEAL • VERIFIED',
  campusAddress: 'Main Campus Road, Academic Layout',
  cityState: 'State, Nigeria',
  country: 'Nigeria',
  phonePrimary: '+2348000000000',
  phoneSecondary: '',
  emailContact: 'info@schoolportal.edu.ng',
  whatsAppNumber: '+2348000000000',
  visitingHours: 'Monday – Friday: 7:30 AM – 4:30 PM (Administrative Enquiries)',
  admissionStatus: 'Admissions Ongoing for Current Academic Session',
  principalName: 'The Principal',
  principalTitle: 'Head Teacher / Principal',
  portalTitle: 'Academic Management & Student Result Portal',
  welcomeHeadline: 'Welcome to Our Academic Portal',
  welcomeSubheadline: 'A premier educational institution dedicated to academic distinction, high moral standards, leadership development, and holistic education.',
  aboutText: 'Our institution is committed to providing standard, future-ready education anchored on knowledge, discipline, and success. Our campus provides a stimulating, secure, and nurturing atmosphere where students from early years through secondary education are empowered to realize their highest potential.'
};

export const BRANDING_STORAGE_KEY = 'school_branding_config';

/**
 * Resolves the active school configuration by merging:
 * 1. Default base config from this file
 * 2. Optional build-time / runtime environment variables (`VITE_SCHOOL_*`)
 * 3. Saved dynamic CMS configuration from localStorage/Firestore if available
 */
export function getActiveSchoolConfig(overrides?: Partial<SchoolTemplateConfig>): SchoolTemplateConfig {
  // 1. Start with base defaults
  const resolved: SchoolTemplateConfig = { ...DEFAULT_SCHOOL_CONFIG };

  // 2. Apply Vite environment variables if defined at build/runtime
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
    if (metaEnv) {
      if (metaEnv.VITE_SCHOOL_NAME) resolved.schoolName = String(metaEnv.VITE_SCHOOL_NAME).trim();
      if (metaEnv.VITE_SCHOOL_SHORT_NAME) resolved.shortName = String(metaEnv.VITE_SCHOOL_SHORT_NAME).trim();
      if (metaEnv.VITE_SCHOOL_ACRONYM) resolved.acronym = String(metaEnv.VITE_SCHOOL_ACRONYM).trim();
      if (metaEnv.VITE_SCHOOL_MOTTO) resolved.motto = String(metaEnv.VITE_SCHOOL_MOTTO).trim();
      if (metaEnv.VITE_SCHOOL_SUB_MOTTO) resolved.subMotto = String(metaEnv.VITE_SCHOOL_SUB_MOTTO).trim();
      if (metaEnv.VITE_SCHOOL_LOGO_URL) resolved.logoUrl = String(metaEnv.VITE_SCHOOL_LOGO_URL).trim();
      if (metaEnv.VITE_SCHOOL_PHONE) resolved.phonePrimary = String(metaEnv.VITE_SCHOOL_PHONE).trim();
      if (metaEnv.VITE_SCHOOL_PHONE_SEC) resolved.phoneSecondary = String(metaEnv.VITE_SCHOOL_PHONE_SEC).trim();
      if (metaEnv.VITE_SCHOOL_WHATSAPP) resolved.whatsAppNumber = String(metaEnv.VITE_SCHOOL_WHATSAPP).trim();
      if (metaEnv.VITE_SCHOOL_ADDRESS) resolved.campusAddress = String(metaEnv.VITE_SCHOOL_ADDRESS).trim();
      if (metaEnv.VITE_SCHOOL_CITY_STATE) resolved.cityState = String(metaEnv.VITE_SCHOOL_CITY_STATE).trim();
      if (metaEnv.VITE_SCHOOL_EMAIL) resolved.emailContact = String(metaEnv.VITE_SCHOOL_EMAIL).trim();
    }
  } catch {
    // Ignore in non-Vite execution contexts
  }

  // 3. Apply cached user/admin customizations from browser storage if present
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const cached =
        window.localStorage.getItem(BRANDING_STORAGE_KEY) ||
        window.localStorage.getItem('school_website_config_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.schoolName !== undefined && parsed.schoolName !== '') resolved.schoolName = parsed.schoolName;
        if (parsed.shortName !== undefined && parsed.shortName !== '') resolved.shortName = parsed.shortName;
        if (parsed.acronym !== undefined && parsed.acronym !== '') resolved.acronym = parsed.acronym;
        if (parsed.motto !== undefined) resolved.motto = parsed.motto;
        if (parsed.subMotto !== undefined) resolved.subMotto = parsed.subMotto;
        if (parsed.logoUrl !== undefined && parsed.logoUrl !== '') resolved.logoUrl = parsed.logoUrl;
        if (parsed.stampLogoUrl !== undefined) resolved.stampLogoUrl = parsed.stampLogoUrl;
        if (parsed.stampTopText !== undefined && parsed.stampTopText !== '') resolved.stampTopText = parsed.stampTopText;
        if (parsed.stampBottomText !== undefined && parsed.stampBottomText !== '') resolved.stampBottomText = parsed.stampBottomText;
        if (parsed.campusAddress !== undefined && parsed.campusAddress !== '') resolved.campusAddress = parsed.campusAddress;
        if (parsed.cityState !== undefined && parsed.cityState !== '') resolved.cityState = parsed.cityState;
        if (parsed.country !== undefined && parsed.country !== '') resolved.country = parsed.country;
        if (parsed.phonePrimary !== undefined && parsed.phonePrimary !== '') resolved.phonePrimary = parsed.phonePrimary;
        if (parsed.phoneSecondary !== undefined) resolved.phoneSecondary = parsed.phoneSecondary;
        if (parsed.emailContact !== undefined && parsed.emailContact !== '') resolved.emailContact = parsed.emailContact;
        if (parsed.whatsAppNumber !== undefined && parsed.whatsAppNumber !== '') resolved.whatsAppNumber = parsed.whatsAppNumber;
        if (parsed.principalName !== undefined && parsed.principalName !== '') resolved.principalName = parsed.principalName;
        if (parsed.principalTitle !== undefined && parsed.principalTitle !== '') resolved.principalTitle = parsed.principalTitle;
        if (parsed.admissionStatus !== undefined && parsed.admissionStatus !== '') resolved.admissionStatus = parsed.admissionStatus;
        if (parsed.welcomeHeadline !== undefined && parsed.welcomeHeadline !== '') resolved.welcomeHeadline = parsed.welcomeHeadline;
        if (parsed.welcomeSubheadline !== undefined && parsed.welcomeSubheadline !== '') resolved.welcomeSubheadline = parsed.welcomeSubheadline;
        if (parsed.aboutText !== undefined && parsed.aboutText !== '') resolved.aboutText = parsed.aboutText;
      }
    }
  } catch {
    // Storage access fallback
  }

  // 4. Apply direct overrides if supplied (e.g. from props or state)
  if (overrides) {
    Object.assign(resolved, overrides);
  }

  return resolved;
}

/**
 * Persists updated branding settings locally and dispatches a live update event
 */
export function saveSchoolBrandingLocally(updates: Partial<SchoolTemplateConfig>): SchoolTemplateConfig {
  const current = getActiveSchoolConfig();
  const updated: SchoolTemplateConfig = { ...current, ...updates };

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const json = JSON.stringify(updated);
      window.localStorage.setItem(BRANDING_STORAGE_KEY, json);
      window.localStorage.setItem('school_website_config_cache', json);
    }
  } catch (e) {
    console.warn('Failed to save branding locally:', e);
  }

  // Update document title dynamically
  if (typeof document !== 'undefined') {
    const titleText = `${updated.schoolName} Portal`;
    document.title = titleText;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', titleText);
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta && updated.welcomeSubheadline) descMeta.setAttribute('content', updated.welcomeSubheadline);
  }

  // Broadcast event for all components listening in the app
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('school_branding_updated', { detail: updated }));
  }

  return updated;
}

/**
 * Standard WhatsApp link generator using active school configuration
 */
export function getSchoolWhatsAppLink(phoneOrWhatsApp?: string, message?: string, schoolName?: string): string {
  const active = getActiveSchoolConfig();
  const targetNumber = (phoneOrWhatsApp || active.whatsAppNumber || '').replace(/[^0-9]/g, '');
  const cleanNumber = targetNumber.startsWith('0') ? `234${targetNumber.slice(1)}` : targetNumber;
  const name = schoolName || active.schoolName;
  const text = message || `Hello ${name}, I would like to make an enquiry regarding admissions and academic programmes.`;
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;
}
