export const formatLocalDateTimeForApi = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};

/** Wall-clock as-of for last-working-day compare (today = now; past dates = shift end). Seconds zeroed — minute precision is enough. */
export const getCompareAsOf = (selectedDate: string, now: Date) => {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (selectedDate === todayKey) {
    const rounded = new Date(now);
    rounded.setSeconds(0, 0);
    return formatLocalDateTimeForApi(rounded);
  }
  return `${selectedDate} 17:35:00`;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local calendar date YYYY-MM-DD (never UTC — avoids off-by-one near midnight). */
export const todayDateKey = (d = new Date()) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const parseDateKey = (value?: string | null): string => {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return todayDateKey(d);
};

export const dayBeforeDateKey = (dateKey: string) => {
  const part = parseDateKey(dateKey);
  if (!part) return part;
  const [y, m, d] = part.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return todayDateKey(dt);
};

export const dayAfterDateKey = (dateKey: string) => {
  const part = parseDateKey(dateKey);
  if (!part) return part;
  const [y, m, d] = part.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  return todayDateKey(dt);
};
