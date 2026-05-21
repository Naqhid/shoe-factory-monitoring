/** Format API/MySQL datetime in the user's local timezone (HH:mm). */
export const formatTimeHHMM = (value?: string | null): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return String(value).replace(' ', 'T').split('T')[1]?.slice(0, 5) || '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const formatTimeRangeHHMM = (start?: string | null, finish?: string | null): string => {
  const startLabel = formatTimeHHMM(start);
  const finishLabel = formatTimeHHMM(finish);
  if (!startLabel || !finishLabel) return startLabel;
  return `${startLabel} to ${finishLabel}`;
};

export const formatSinceTimeHHMM = (value?: string | null): string => {
  const label = formatTimeHHMM(value);
  return label ? `Since ${label}` : '';
};
