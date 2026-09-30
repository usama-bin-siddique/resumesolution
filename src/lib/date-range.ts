const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
function dateValue(value: string): number | null {
 const text = value.trim().toLowerCase();
 if (/^\d{4}$/.test(text)) return Number(text) * 12;
 const named = text.match(/^([a-z]+)\s+(\d{4})$/);
 if (named) { const month = months.indexOf(named[1].slice(0,3)); return month < 0 ? null : Number(named[2]) * 12 + month; }
 const iso = text.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
 return iso ? Number(iso[1]) * 12 + Number(iso[2]) - 1 : null;
}
export function dateRangeError(start: string, end: string, now = new Date()): string {
 if (!start.trim() || !end.trim()) return '';
 const from = dateValue(start);
 const to = /^present$/i.test(end.trim()) ? now.getFullYear() * 12 + now.getMonth() : dateValue(end);
 if (from === null || to === null) return 'Choose a month and year from the calendar, or enter a year (for example, 2022).';
 return from >= to ? 'Start date must be earlier than end date.' : '';
}
