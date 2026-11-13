import { tr } from './i18n.mjs';
export function normalizeBrowserUrl(input) {
  const value = String(input || "").trim();
  if (!value) throw new Error(tr("กรุณาระบุ URL"));
  const normalized = /^(https?):\/\//i.test(value)
    ? value
    : /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(value)
      ? `http://${value}`
      : /^[\w.-]+(:\d+)?(\/|$)/.test(value) && !/^[a-z]+:/i.test(value)
        ? `https://${value}`
        : value;
  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error(tr("URL ไม่ถูกต้อง กรุณาใช้ http:// หรือ https://"));
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(tr("อนุญาตเฉพาะ URL แบบ http/https ที่ไม่มีรหัสผ่าน"));
  return url.href;
}
