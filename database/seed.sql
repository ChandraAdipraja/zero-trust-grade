truncate table audit_logs, transcript_items, transcripts, grades, enrollments, refresh_tokens, classes, devices, service_clients, users cascade;

insert into users (id, nim, name, email, password_hash, role) values
  ('00000000-0000-0000-0000-000000000001', null, 'Admin Demo', 'admin@demo.id', '$2b$10$kQ/9QW/5h.G6.RQzWTuFqOUe1DXzQpFaK1QUUf1/xDgFAxkA7tG/S', 'admin'),
  ('00000000-0000-0000-0000-000000000002', null, 'Dosen Satu', 'dosen.satu@demo.id', '$2b$10$7Pv5zFY7eOjsxbFD//chhO5I8nOMXzwAJRoAknod.1PqVr9.Wx3cq', 'dosen'),
  ('00000000-0000-0000-0000-000000000003', null, 'Dosen Dua', 'dosen.dua@demo.id', '$2b$10$7Pv5zFY7eOjsxbFD//chhO5I8nOMXzwAJRoAknod.1PqVr9.Wx3cq', 'dosen'),
  ('00000000-0000-0000-0000-000000000004', '2100001', 'Mahasiswa Satu', 'mahasiswa.satu@demo.id', '$2b$10$vm9/EkvaOLTlhuhcvke4f.xmf356qhoFEsBVYx0bY5WSVPJGo5uSa', 'mahasiswa'),
  ('00000000-0000-0000-0000-000000000005', '2100002', 'Mahasiswa Dua', 'mahasiswa.dua@demo.id', '$2b$10$vm9/EkvaOLTlhuhcvke4f.xmf356qhoFEsBVYx0bY5WSVPJGo5uSa', 'mahasiswa'),
  ('00000000-0000-0000-0000-000000000006', '2100003', 'Mahasiswa Tiga', 'mahasiswa.tiga@demo.id', '$2b$10$vm9/EkvaOLTlhuhcvke4f.xmf356qhoFEsBVYx0bY5WSVPJGo5uSa', 'mahasiswa');

insert into devices (id, user_id, device_name, is_active) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Admin Laptop', true),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Dosen Satu Laptop', true),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'Dosen Dua Laptop', true),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'Mahasiswa Satu Laptop', true),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', 'Mahasiswa Dua Laptop', true),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000006', 'Mahasiswa Tiga Laptop', true);

insert into classes (id, class_name, course_name, lecturer_id, is_finalized, finalized_at) values
  ('20000000-0000-0000-0000-000000000001', 'IF-2101', 'Pemrograman Web', '00000000-0000-0000-0000-000000000002', false, null),
  ('20000000-0000-0000-0000-000000000002', 'IF-2202', 'Basis Data', '00000000-0000-0000-0000-000000000003', true, now());

insert into enrollments (id, class_id, student_id) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006');

insert into grades (id, enrollment_id, score, is_finalized) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 88, false),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 75, false),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 90, true),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 67, true);

insert into service_clients (id, client_id, client_secret_hash, is_active) values
  ('50000000-0000-0000-0000-000000000001', 'nilai-service', '$2b$10$nUl5zwzlD5WSUDkkSk1p2e49LXiPlr5y4XFwo7f92KPaqprQGNuIq', true);
