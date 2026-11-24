import EN from "../i18n/en.json";

/*
 * Standalone replacement for the LMS's TranslationContext (i18next, 20 languages).
 * English only: en.json holds the LMS's English text for every key these pages use.
 * To add a language, add another JSON file and pick it here.
 * Keys without text are shown as words ("chapter_completed" -> "Chapter completed"), as in the LMS.
 */
const interpolate = (text, options) =>
  options ? text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, name) => (options[name] !== undefined ? String(options[name]) : m)) : text;

export function t(key, options) {
  if (!key) return "";
  if (EN[key] !== undefined) return interpolate(EN[key], options);
  if (typeof options?.defaultValue === "string") return interpolate(options.defaultValue, options);
  const bare = String(key).split(":").pop();
  if (!/^[a-z0-9]+(_[a-z0-9]+)+$/.test(bare)) return key;
  const words = bare.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const useTranslation = () => ({ t, currentLanguage: "en", changeLanguage: () => {} });
