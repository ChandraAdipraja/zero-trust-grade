export interface DemoDevice {
  id: string;
  label: string;
  role: "admin" | "dosen" | "mahasiswa";
  emailHint: string;
}

export const DEMO_DEVICES: DemoDevice[] = [
  { id: "10000000-0000-0000-0000-000000000001", label: "Workstation Administrasi", role: "admin", emailHint: "admin@demo.id" },
  { id: "10000000-0000-0000-0000-000000000002", label: "Notebook Sekretariat", role: "dosen", emailHint: "dosen.satu@demo.id" },
  { id: "10000000-0000-0000-0000-000000000003", label: "Notebook Laboratorium", role: "dosen", emailHint: "dosen.dua@demo.id" },
  { id: "10000000-0000-0000-0000-000000000004", label: "Laptop Kampus 01", role: "mahasiswa", emailHint: "mahasiswa.satu@demo.id" },
  { id: "10000000-0000-0000-0000-000000000005", label: "Laptop Kampus 02", role: "mahasiswa", emailHint: "mahasiswa.dua@demo.id" },
  { id: "10000000-0000-0000-0000-000000000006", label: "Laptop Kampus 03", role: "mahasiswa", emailHint: "mahasiswa.tiga@demo.id" },
];

export function deviceForEmail(email: string): DemoDevice | undefined {
  const normalized = email.trim().toLowerCase();
  return DEMO_DEVICES.find((device) => device.emailHint === normalized);
}

export function deviceLabel(deviceId: string): string {
  const device = DEMO_DEVICES.find((item) => item.id === deviceId);
  return device ? device.label : "Perangkat terdaftar";
}
