/**
 * Единая валидация способов связи (анкеты здоровья и команда)
 */

export const QUESTIONNAIRE_CONTACT_KEYS = [
  'contact_telegram',
  'contact_instagram',
  'contact_whatsapp',
  'contact_max'
] as const;

export function normalizeTelegramUsername(value: string): string {
  return value.replace(/^@+/, '').trim();
}

export function normalizePhoneInput(value: string): string {
  return value.replace(/[^\d+\s()\-]/g, '');
}

function countDigits(s: string): number {
  return (s.match(/\d/g) || []).length;
}

function validateTelegramRaw(value: string): boolean {
  if (!value.trim()) return true;
  return /^[a-zA-Z0-9_]{5,32}$/.test(value);
}

function validateInstagramRaw(value: string): boolean {
  if (!value.trim()) return true;
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(value)) return false;
  if (value.startsWith('.') || value.endsWith('.')) return false;
  if (value.includes('..')) return false;
  return true;
}

function validateWhatsAppRaw(value: string): boolean {
  if (!value.trim()) return true;
  const d = countDigits(value);
  return d >= 10 && d <= 15;
}

function validateMaxRaw(value: string): boolean {
  if (!value.trim()) return true;
  const t = value.trim();
  return t.length >= 2 && t.length <= 50;
}

export function hasAnyHealthContact(fd: Record<string, any>): boolean {
  return QUESTIONNAIRE_CONTACT_KEYS.some((k) => String(fd[k] ?? '').trim() !== '');
}

export function getHealthContactFieldErrors(
  fd: Record<string, any>,
  lang: 'ru' | 'en'
): Record<string, string> {
  const e: Record<string, string> = {};
  const msg = {
    needOne:
      lang === 'en' ? 'Please add at least one way to reach you' : 'Укажите хотя бы один способ связи',
    tg: lang === 'en' ? '5–32 characters: letters, numbers, _' : '5–32 символа: латиница, цифры, _',
    ig:
      lang === 'en' ? '1–30 characters: letters, numbers, . _' : '1–30 символов: латиница, цифры, . _',
    wa:
      lang === 'en'
        ? 'Phone: 10–15 digits (with country code)'
        : 'Номер: 10–15 цифр (с кодом страны)',
    max: lang === 'en' ? '2–50 characters (phone or MAX)' : '2–50 символов (телефон или MAX)'
  };

  if (!hasAnyHealthContact(fd)) {
    e.contacts = msg.needOne;
  }

  const tg = normalizeTelegramUsername(String(fd.contact_telegram ?? ''));
  if (tg && !validateTelegramRaw(tg)) e.contact_telegram = msg.tg;

  const ig = normalizeTelegramUsername(String(fd.contact_instagram ?? ''));
  if (ig && !validateInstagramRaw(ig)) e.contact_instagram = msg.ig;

  const wa = String(fd.contact_whatsapp ?? '');
  if (wa.trim() && !validateWhatsAppRaw(wa)) e.contact_whatsapp = msg.wa;

  const mx = String(fd.contact_max ?? '');
  if (mx.trim() && !validateMaxRaw(mx)) e.contact_max = msg.max;

  return e;
}

/** Только формат отдельных полей (без ошибки «нужен хотя бы один») — для подсказок при вводе */
export function getHealthContactFormatOnlyErrors(
  fd: Record<string, any>,
  lang: 'ru' | 'en'
): Record<string, string> {
  const e = { ...getHealthContactFieldErrors(fd, lang) };
  delete e.contacts;
  return e;
}

/** Готово к отправке: есть хотя бы один контакт и заполненные поля валидны */
export function isHealthContactBlockValid(fd: Record<string, any>): boolean {
  return Object.keys(getHealthContactFieldErrors(fd, 'ru')).length === 0;
}
