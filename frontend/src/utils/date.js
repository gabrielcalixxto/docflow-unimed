export function getCurrentLocalDateISO() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function toISODateString(localDate) {
  const timezoneOffsetMs = localDate.getTimezoneOffset() * 60 * 1000;
  return new Date(localDate.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export function getLocalDatePlusYearsISO(years) {
  const now = new Date();
  const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  localDate.setFullYear(localDate.getFullYear() + years);
  return toISODateString(localDate);
}
