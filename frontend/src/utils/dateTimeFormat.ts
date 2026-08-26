/** Format API/MySQL datetime in the user's local timezone (h:mm, 12hr without AM/PM). */
export const formatTimeHHMM = (value?: string | null): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return String(value).replace(' ', 'T').split('T')[1]?.slice(0, 5) || '';
  }
  let hours = d.getHours();
  const minutes = d.getMinutes();
  // 12hr format without AM/PM
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
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

/** Format a Date object to 12hr without AM/PM (h:mm). */
export const formatTime12NoAmPm = (d: Date): string => {
  let hours = d.getHours();
  const minutes = d.getMinutes();
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
};

/** Format a Date object to 12hr without AM/PM with seconds (h:mm:ss). */
export const formatTime12NoAmPmSec = (d: Date): string => {
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};
