/**
 * Site-wide configuration.
 * Fill these in when the real endpoints and profiles exist. Empty values are
 * handled honestly by the UI (forms complete locally; social links are hidden).
 */
export const SITE = {
  name: 'Ek भारत.AI',
  owner: 'Core5 Systems and Services Pvt. Ltd.',
  /** POST endpoint that receives JSON form submissions (Build With Us, Contact). */
  formEndpoint: (import.meta.env.VITE_FORM_ENDPOINT as string) || 'http://localhost:5501/api/contact',
  /** Base URL of the backend API ('' = same origin; the Vite dev server proxies /api to the backend). */
  apiBase: ((import.meta.env.VITE_API_BASE as string) || '').replace(/\/$/, ''),
  /** Public contact email, e.g. 'hello@example.com'. */
  contactEmail: (import.meta.env.VITE_CONTACT_EMAIL as string) || 'enquiry@core5.co.in',
  social: {
    linkedin: '',
    x: '',
    github: '',
    youtube: '',
  } as Record<string, string>,
}
