const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

// Set limit besar karena data foto Base64 cukup berat (sekitar 2-5MB)
app.use(express.json({ limit: "50mb" }));
app.use((req, res, next) => {
  console.log(`Ada request masuk ke: ${req.url}`);
  next();
});
// 1. Endpoint Sign-in (Handshake awal)
app.post("/MJApi/sign", (req, res) => {
  console.log(
    `[${new Date().toLocaleTimeString()}] Device Sign-in:`,
    req.body.head.deviceKey,
  );
  res.json({
    result: 1,
    message: "success",
    data: {
      serverTime: new Date().toISOString().replace("T", " ").substring(0, 19),
      mainKey: "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", // Kunci default komunikasi
    },
  });
});

// Tambahkan rute yang muncul di log kamu tadi
app.post("/MJApi/time_timing", (req, res) => {
  console.log("Device meminta Time Timing");
  res.json({ result: 2, message: "no new data", data: null });
});

// Tambahkan rute tambahan untuk jaga-jaga
app.post("/MJApi/dev_config", (req, res) => {
  res.json({ result: 2, message: "no new data", data: null });
});

app.post("/MJApi/up_alarm", (req, res) => {
  console.log("!!! ALARM MASUK !!! Data:", req.body);
  res.json({ result: 1, message: "success" });
});

app.post("/MJApi/dev_param", (req, res) => {
  console.log("Device meminta Device Param");
  // Gunakan result: 2 agar device berhenti meminta
  res.json({ result: 2, message: "no new data", data: null });
});

app.post("/MJApi/comp_param", (req, res) => {
  console.log("Device meminta Company Param");
  res.json({ result: 2, message: "no new data", data: null });
});

// Tambahkan ini di script kamu untuk melengkapi protokol
app.post("/MJApi/time_part", (req, res) => {
  res.json({ result: 2, message: "no new data", data: null });
});

app.post("/MJApi/time_group", (req, res) => {
  res.json({ result: 2, message: "no new data", data: null });
});

app.post("/MJApi/time_holiday", (req, res) => {
  res.json({ result: 2, message: "no new data", data: null });
});

// --- 2. ENDPOINT UNTUK DATA USER TERDAFTAR (REGISTER) ---
app.post("/MJApi/user_power", (req, res) => {
  console.log("--- Sinkronisasi Data User Terdeteksi ---");

  // Jika alat mengirimkan data user yang dia punya (Backup dari alat ke Cloud)
  if (req.body.userList && req.body.userList.length > 0) {
    req.body.userList.forEach((user) => {
      console.log(`User Terdaftar: ${user.name} (ID: ${user.accNo})`);

      // Jika ada foto profil user (faceImage1)
      if (user.faceImage1) {
        const profilePic = `PROFIL_${user.accNo}_${user.name}.jpg`;
        fs.writeFileSync(
          path.join(__dirname, profilePic),
          Buffer.from(user.faceImage1, "base64"),
        );
        console.log(`---> Foto Profil ${user.name} berhasil ditarik!`);
      }
    });
  }

  // Jika result: 2, berarti Cloud tidak mengirim data user baru ke alat
  res.json({ result: 2, message: "no new data", data: null });
});

app.post("/MJApi/up_log", (req, res) => {
  console.log("\n=================================================");
  console.log("LOG MASUK TERDETEKSI!");

  // 1. Cek semua field yang dikirim alat
  const keys = Object.keys(req.body);
  console.log("Field yang dikirim alat:", keys);

  const { accNo, passTime, capJpgBase64 } = req.body;

  // 2. Tampilkan info dasar
  console.log(`Waktu Kejadian : ${passTime}`);
  console.log(`ID User        : ${accNo}`);

  // 3. Validasi Gambar
  if (capJpgBase64) {
    const dataSize = (capJpgBase64.length / 1024).toFixed(2);
    console.log(`Status Gambar  : DITEMUKAN (Ukuran: ${dataSize} KB)`);

    if (capJpgBase64.length > 10) {
      const fileName = `FOTO_LOGIN_${accNo}_${Date.now()}.jpg`;
      const buffer = Buffer.from(capJpgBase64, "base64");

      try {
        fs.writeFileSync(path.join(__dirname, fileName), buffer);
        console.log(`---> SUKSES: Gambar disimpan sebagai ${fileName}`);
      } catch (err) {
        console.log("---> ERROR: Gagal menulis file!", err.message);
      }
    } else {
      console.log(
        "---> PERINGATAN: String gambar terlalu pendek (Base64 kosong).",
      );
    }
  } else {
    console.log(
      "Status Gambar  : TIDAK ADA (Field 'capJpgBase64' tidak dikirim)",
    );
    console.log("Saran          : Periksa menu 'Upload Photo' di alat fisik.");
  }

  console.log("=================================================\n");

  res.json({ result: 1, message: "success", data: "" });
});

// --- 3. HEARTBEAT (Pemicu Sinkronisasi) ---
app.post("/MJApi/heartbeat", (req, res) => {
  res.json({
    result: 1,
    message: "success",
    data: {
      compParamVer: req.body.compParamVer,
      devConfigVer: req.body.devConfigVer,
      timePartVer: req.body.timePartVer,
      timeGroupVer: req.body.timeGroupVer,
      holidayVer: req.body.holidayVer,
      // Ganti powerParamVer ke angka yang lebih tinggi jika ingin memicu alat
      // mengirim ulang semua data usernya ke Cloud
      powerParamVer: req.body.powerParamVer,
    },
  });
});

const PORT = 14441;
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`SERVER LISTENER AKTIF DI PORT ${PORT}`);
  console.log(`Menunggu data dari device (192.168.110.156)...`);
  console.log(`=================================================`);
});
