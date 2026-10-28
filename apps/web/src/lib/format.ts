export function wibParts(now: Date = new Date()): { hour: number; time: string; date: string } {
  const time = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const hour = Number.parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "numeric", hourCycle: "h23" }).format(now),
    10,
  );
  const date = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(now);
  return { hour, time, date };
}

export function withinAccessWindow(now: Date = new Date()): boolean {
  const { hour } = wibParts(now);
  return hour >= 7 && hour < 21;
}

export function wibTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export const ROLE_LABEL: Record<string, string> = {
  admin: "Operator Administrasi",
  dosen: "Pengampu Mata Kuliah",
  mahasiswa: "Mahasiswa",
};

export function roleShort(role: string): string {
  return role.toUpperCase();
}
