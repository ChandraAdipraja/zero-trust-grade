import bcrypt from "bcryptjs";

const credentials = {
  admin: "admin-demo-123",
  dosen: "dosen-demo-123",
  mahasiswa: "mahasiswa-demo-123",
  serviceClient: "nilai-service-demo-secret",
};

for (const [name, value] of Object.entries(credentials)) {
  console.log(`${name}=${bcrypt.hashSync(value, 10)}`);
}
