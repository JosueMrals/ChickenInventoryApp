export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
export function startOfWeek() {
  const now = new Date();
  const day = now.getDay(); // 0..6
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // week starts Monday
  const d = new Date(now.setDate(diff));
  d.setHours(0, 0, 0, 0);
  return d;
}
export function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
