# Sistem Nilai — Zero Trust Security

Tugas Praktikum mata kuliah **Keamanan Informasi** dengan topik **Zero Trust Security**: aplikasi pengelolaan nilai mahasiswa dengan arsitektur API Gateway, Policy Engine, token-based authentication, validasi perangkat, dan audit log.

---

## Cara Menjalankan

### Prasyarat

- Node.js (v20 atau lebih baru) + npm
- Akun Supabase dengan project yang sudah dibuat

### 1. Install dependensi

```bash
npm install
```

### 2. Konfigurasi environment

Buat file `.env` di root proyek dengan isi berikut (sesuaikan nilainya dengan project Supabase masing-masing):

```env
# Frontend
VITE_API_BASE_URL=http://localhost:3000

# API Gateway
GATEWAY_PORT=3000
JWT_ACCESS_SECRET=ganti-dengan-secret-acak
JWT_REFRESH_SECRET=ganti-dengan-secret-acak
JWT_SERVICE_SECRET=ganti-dengan-secret-acak
GATEWAY_SECRET=ganti-dengan-secret-acak
ACCESS_TIMEZONE=Asia/Jakarta
SERVICE_CLIENT_ID=nilai-service
SERVICE_CLIENT_SECRET=nilai-service-demo-secret

# Supabase — hanya untuk backend
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Service Nilai
NILAI_PORT=3001
GATEWAY_BASE_URL=http://localhost:3000

# Service Transkrip
TRANSKRIP_PORT=3002
```

### 3. Siapkan database Supabase

Buka **SQL Editor** di dashboard Supabase, lalu jalankan berurutan:

1. `database/migrations/001_init.sql` — membuat 10 tabel beserta constraint dan RLS
2. `database/seed.sql` — mengisi data awal seluruh sistem (daftar lengkap di bawah)

### 4. Jalankan aplikasi

```bash
npm run dev
```

Semua service berjalan sekaligus:

| Komponen | URL | Peran |
|---|---|---|
| Frontend | http://localhost:5173 | UI React |
| API Gateway | http://localhost:3000 | PEP + Policy Engine + Audit Log |
| Service Nilai | http://localhost:3001 | Logika nilai & finalisasi (internal) |
| Service Transkrip | http://localhost:3002 | Transkrip & sinkronisasi (internal) |

### 5. Kembalikan data awal (opsional)

```bash
npm run reset:seed
```

Mengembalikan state data ke kondisi awal (kelas IF-2101 kembali draf, transkrip & audit log dibersihkan) tanpa perlu menjalankan ulang seed SQL.

---

## Daftar Akun

Semua akun menggunakan password yang sudah di-hash bcrypt di database.

| Peran | Nama | Email | Password | NIM |
|---|---|---|---|---|
| Admin | Admin Demo | `admin@demo.id` | `admin-demo-123` | — |
| Dosen | Dosen Satu | `dosen.satu@demo.id` | `dosen-demo-123` | — |
| Dosen | Dosen Dua | `dosen.dua@demo.id` | `dosen-demo-123` | — |
| Mahasiswa | Mahasiswa Satu | `mahasiswa.satu@demo.id` | `mahasiswa-demo-123` | 2100001 |
| Mahasiswa | Mahasiswa Dua | `mahasiswa.dua@demo.id` | `mahasiswa-demo-123` | 2100002 |
| Mahasiswa | Mahasiswa Tiga | `mahasiswa.tiga@demo.id` | `mahasiswa-demo-123` | 2100003 |

---

## Device ID Terdaftar

Setiap user memiliki satu perangkat terdaftar. Login dan seluruh request dari user wajib menyertakan header `X-Device-ID` yang cocok dengan pemiliknya.

| Device ID | Pemilik | Nama Device |
|---|---|---|
| `10000000-0000-0000-0000-000000000001` | admin@demo.id | Admin Laptop |
| `10000000-0000-0000-0000-000000000002` | dosen.satu@demo.id | Dosen Satu Laptop |
| `10000000-0000-0000-0000-000000000003` | dosen.dua@demo.id | Dosen Dua Laptop |
| `10000000-0000-0000-0000-000000000004` | mahasiswa.satu@demo.id | Mahasiswa Satu Laptop |
| `10000000-0000-0000-0000-000000000005` | mahasiswa.dua@demo.id | Mahasiswa Dua Laptop |
| `10000000-0000-0000-0000-000000000006` | mahasiswa.tiga@demo.id | Mahasiswa Tiga Laptop |

---

## Data Awal Lainnya

### Kelas

| ID | Kelas | Mata Kuliah | Pengampu | Status |
|---|---|---|---|---|
| `20000000-0000-0000-0000-000000000001` | IF-2101 | Pemrograman Web | Dosen Satu | Belum final |
| `20000000-0000-0000-0000-000000000002` | IF-2202 | Basis Data | Dosen Dua | Final |

### Enrollments (Mahasiswa ↔ Kelas)

| ID | Mahasiswa | Kelas |
|---|---|---|
| `30000000-0000-0000-0000-000000000001` | Mahasiswa Satu (2100001) | IF-2101 |
| `30000000-0000-0000-0000-000000000002` | Mahasiswa Dua (2100002) | IF-2101 |
| `30000000-0000-0000-0000-000000000003` | Mahasiswa Dua (2100002) | IF-2202 |
| `30000000-0000-0000-0000-000000000004` | Mahasiswa Tiga (2100003) | IF-2202 |

### Nilai

| ID | Mahasiswa | Kelas | Nilai | Status |
|---|---|---|---|---|
| `40000000-0000-0000-0000-000000000001` | Mahasiswa Satu | IF-2101 | 88 | Draf (dapat diubah) |
| `40000000-0000-0000-0000-000000000002` | Mahasiswa Dua | IF-2101 | 75 | Draf (dapat diubah) |
| `40000000-0000-0000-0000-000000000003` | Mahasiswa Dua | IF-2202 | 90 | Final |
| `40000000-0000-0000-0000-000000000004` | Mahasiswa Tiga | IF-2202 | 67 | Final |

### Service Client

Kredensial yang dipakai Service Nilai untuk memperoleh token service dari `POST /auth/service`:

| Client ID | Client Secret |
|---|---|
| `nilai-service` | `nilai-service-demo-secret` |

---

## Identitas

**Chandra Adipraja** — NPM 247006111194 — Kelas G
