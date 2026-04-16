const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const DEV_PARAM_VER = 3;
const COMP_PARAM_VER = 1;
const POWER_PARAM_VER = 2;
const LOG_DIR = path.join(__dirname, "logs");
const SAMPLE_USER = {
  paramVer: POWER_PARAM_VER,
  accNo: 9001,
  name: "TEST CLOUD",
  opType: 1,
  cardSN: "",
  password: "",
  beginExpDate: null,
  endExpDate: "2099-01-01 00:00:00",
  timeGroup: 0,
  faceId1: -1,
  faceImage1: null,
  isManager: 0,
  fpId1: 0,
  fpId2: 0,
  fp1: null,
  fp2: null,
};

const DEVICE_PARAM_RESPONSE = {
  paramVer: DEV_PARAM_VER,
  logSaveType: 1,
  reVerify: 0,
  wgInputFormat: 0,
  wgOutputEnable: 0,
  wgOutputModel: 1,
  wgOutputFormat: 0,
  maintainTimeList: [{ maintainTime: 0 }],
  lightTime: [
    { beginTime: 0, endTime: 0 },
    { beginTime: 0, endTime: 0 },
    { beginTime: 0, endTime: 0 },
  ],
  doorParam: [
    {
      appDoorLock: 1,
      closeDelay: 3,
      closeOutDelay: 0,
      appKeyButton: 1,
      openPwd: "",
      timeGroup: 0,
      doorWorkWay: 0,
      appIllegalOpen: 0,
      passOpendoor: 0,
      entrAndExitType: 0,
    },
  ],
  screenType: 1,
  faceLiving: 0,
  faceThreshold: 55,
  autoMaintain: 0,
  maintainCycle: 8,
  lightEnable: 1,
  isCheckStranger: 0,
  Language: 0,
  isphoto: 1,
  sanpCardEnable: 1,
  displayStandbyTime: 0,
  faceRepeatEnable: 0,
  isStrangerOpen: 0,
  firealarmSwitch: 0,
  isQrcode: 0,
  qrcodeTimeout: 0,
  isCapture: 1,
};

const COMPANY_PARAM_RESPONSE = {
  heartInterval: 60,
  paramVer: COMP_PARAM_VER,
};

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogFilePath() {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `traffic-${date}.log`);
}

function normalizeForLog(value) {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    if (value.length > 2000) {
      return `${value.slice(0, 2000)}...[TRUNCATED ${value.length - 2000} chars]`;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForLog(item));
  }

  if (value && typeof value === "object") {
    const normalized = {};

    for (const [key, item] of Object.entries(value)) {
      normalized[key] = normalizeForLog(item);
    }

    return normalized;
  }

  return value;
}

function appendTrafficLog(entry) {
  ensureLogDir();
  const filePath = getLogFilePath();
  const line = `${JSON.stringify(entry)}\n`;
  fs.appendFileSync(filePath, line, "utf8");
}

function pickLogPayload(body) {
  if (!body || typeof body !== "object") {
    return {};
  }

  if (body.havLog) {
    if (Array.isArray(body.havLog) && body.havLog.length > 0) {
      return body.havLog[0];
    }

    if (typeof body.havLog === "object") {
      return body.havLog;
    }
  }

  return body;
}

function saveDebugPayload(accNo, payload) {
  const safeAccNo = accNo || "UNKNOWN";
  const fileName = `DEBUG_UP_LOG_${safeAccNo}_${Date.now()}.json`;
  const filePath = path.join(__dirname, fileName);

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  return fileName;
}

// Set limit besar karena data foto Base64 cukup berat (sekitar 2-5MB)
app.use(express.json({ limit: "50mb" }));
app.use((req, res, next) => {
  const startedAt = Date.now();
  let responseBody = null;
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on("finish", () => {
    try {
      appendTrafficLog({
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        requestBody: normalizeForLog(req.body),
        responseBody: normalizeForLog(responseBody),
      });
    } catch (error) {
      console.log("Gagal menulis traffic log:", error.message);
    }
  });

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

app.post("/MJApi/codeResult", (req, res) => {
  console.log("Hasil sinkronisasi codeResult diterima:", req.body);
  res.json({ result: 1, message: "success", data: null });
});

app.post("/MJApi/dev_param", (req, res) => {
  console.log("Device meminta Device Param");
  console.log(
    `Versi config dari device: ${req.body.paramVer} -> server kirim: ${DEV_PARAM_VER}`,
  );
  res.json({
    result: 1,
    message: "success",
    data: DEVICE_PARAM_RESPONSE,
  });
});

app.post("/MJApi/comp_param", (req, res) => {
  console.log("Device meminta Company Param");
  res.json({
    result: 1,
    message: "success",
    data: COMPANY_PARAM_RESPONSE,
  });
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
  console.log(
    "Ringkasan request user_power:",
    JSON.stringify(
      {
        paramVer: req.body.paramVer,
        reqSeqNo: req.body.reqSeqNo,
        accNo: req.body.accNo,
        opType: req.body.opType,
        userCount: Array.isArray(req.body.userList)
          ? req.body.userList.length
          : 0,
      },
      null,
      2,
    ),
  );

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
  } else {
    console.log(
      "user_power dipanggil tanpa userList. Ini mengindikasikan device sedang meminta sinkronisasi dari cloud.",
    );
  }

  if ((req.body.paramVer || 0) < POWER_PARAM_VER) {
    console.log(
      `Mengirim user contoh ke device: ${SAMPLE_USER.name} (ID: ${SAMPLE_USER.accNo})`,
    );
    res.json({
      result: 1,
      message: "success",
      data: SAMPLE_USER,
    });
    return;
  }

  // Jika device sudah berada di versi yang sama, akhiri pull dengan result: 2.
  res.json({ result: 2, message: "no new data", data: null });
});

app.post("/MJApi/up_log", (req, res) => {
  console.log("\n=================================================");
  console.log("LOG MASUK TERDETEKSI!");

  // 1. Cek semua field yang dikirim alat
  const keys = Object.keys(req.body);
  console.log("Field yang dikirim alat:", keys);

  const logPayload = pickLogPayload(req.body);
  const payloadKeys = Object.keys(logPayload);
  console.log("Field log yang dipakai server:", payloadKeys);

  const accNo = logPayload.accNo || req.body.accNo;
  const passTime = logPayload.passTime || req.body.passTime;
  const capJpgBase64 =
    logPayload.capJpgBase64 ||
    logPayload.capPhoto ||
    logPayload.photoBase64 ||
    req.body.capJpgBase64;

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
      "Status Gambar  : TIDAK ADA di root/havLog (field umum tidak ditemukan)",
    );
    const debugFile = saveDebugPayload(accNo, req.body);
    console.log(`Debug Payload  : Disimpan ke ${debugFile}`);
    console.log(
      "Saran          : Periksa setting upload foto di alat dan lihat file debug untuk nama field aslinya.",
    );
  }

  console.log("=================================================\n");

  res.json({ result: 1, message: "success", data: "" });
});

// --- 3. HEARTBEAT (Pemicu Sinkronisasi) ---
app.post("/MJApi/heartbeat", (req, res) => {
  console.log("Heartbeat diterima dari device");
  console.log(
    "Versi dari device:",
    JSON.stringify(
      {
        compParamVer: req.body.compParamVer,
        devConfigVer: req.body.devConfigVer,
        timePartVer: req.body.timePartVer,
        timeGroupVer: req.body.timeGroupVer,
        holidayVer: req.body.holidayVer,
        powerParamVer: req.body.powerParamVer,
      },
      null,
      2,
    ),
  );

  if (req.body.powerParamVer !== POWER_PARAM_VER) {
    console.log(
      `Device belum sinkron data user. powerParamVer device=${req.body.powerParamVer}, server=${POWER_PARAM_VER}`,
    );
  } else {
    console.log("Device sudah sinkron dengan power_param server.");
  }

  if (req.body.devConfigVer !== DEV_PARAM_VER) {
    console.log(
      `Device belum sinkron config. devConfigVer device=${req.body.devConfigVer}, server=${DEV_PARAM_VER}`,
    );
  } else {
    console.log("Device sudah sinkron dengan dev_param server.");
  }

  res.json({
    result: 1,
    message: "success",
    data: {
      compParamVer: COMP_PARAM_VER,
      devConfigVer: DEV_PARAM_VER,
      timePartVer: req.body.timePartVer,
      timeGroupVer: req.body.timeGroupVer,
      holidayVer: req.body.holidayVer,
      powerParamVer: POWER_PARAM_VER,
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
