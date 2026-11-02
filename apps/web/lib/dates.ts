const at = (date: string) => new Date(`${date}T12:00:00Z`);
const long = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const short = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const dayMonth = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });

/** "Saturday 17 October" for a YYYY-MM-DD calendar date. */
export const longDay = (date: string) => long.format(at(date)).replace(',', '');
/** "Sat 17 Oct". */
export const shortDay = (date: string) => short.format(at(date)).replace(',', '');
/** "17 Oct". */
export const dayAndMonth = (date: string) => dayMonth.format(at(date));
