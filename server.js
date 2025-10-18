import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dns from "dns";

// --- Диагностика ранних падений и приоритет IPv4 (на Render это помогает) ---
console.log("🚀 Booting BuyWay Mail backend...");
process.on("uncaughtException", (e) => console.error("Uncaught:", e));
process.on("unhandledRejection", (e) => console.error("Unhandled:", e));
dns.setDefaultResultOrder?.("ipv4first");

const app = express();

// --- CORS: разрешаем прод-домены и локалку ---
const allowed = [
  "https://buyway.su",
  "https://www.buyway.su",
  "http://localhost:5173",
  "http://localhost:3000",
];
app.use(
  cors({
    origin: (origin, cb) =>
      !origin || allowed.includes(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS")),
  })
);
app.use(express.json());

// --- Healthchecks ---
app.get("/", (_, res) => res.send("OK"));
app.get("/healthz", (_, res) => res.status(200).send("ok"));

// --- Создание SMTP транспорта Gmail (явно host/port/secure + таймауты) ---
function makeGmailTransport({ port, secure }) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port,          // 465 (TLS) или 587 (STARTTLS)
    secure,        // 465 -> true, 587 -> false
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
    tls: { servername: "smtp.gmail.com" },
  });
}

// Основной транспорт: 465/TLS
let transporter = makeGmailTransport({ port: 465, secure: true });

// Fallback отправка: если 465 не прошёл, пробуем 587/STARTTLS
async function sendMailWithFallback(options) {
  try {
    await transporter.sendMail(options);
  } catch (e) {
    console.error("MAIL ERROR primary (465):", e?.code || e?.message || e);
    const fallback = makeGmailTransport({ port: 587, secure: false });
    try {
      await fallback.verify();
    } catch (verr) {
      console.error("VERIFY 587:", verr?.code || verr?.message || verr);
    }
    await fallback.sendMail(options);
  }
}

// --- Диагностический маршрут для SMTP ---
app.get("/diag/smtp", async (_, res) => {
  try {
    await transporter.verify();
    res.json({ ok: true, msg: "SMTP OK (465/TLS)" });
  } catch (e1) {
    console.error("VERIFY 465:", e1?.code || e1?.message || e1);
    const fallback = makeGmailTransport({ port: 587, secure: false });
    try {
      await fallback.verify();
      res.json({ ok: true, msg: "SMTP OK (587/STARTTLS)" });
    } catch (e2) {
      console.error("VERIFY 587:", e2?.code || e2?.message || e2);
      res.status(500).json({
        ok: false,
        error: `SMTP verify failed: 465: ${e1?.message || e1}; 587: ${e2?.message || e2}`,
      });
    }
  }
});

// --- Основной API роут: приём формы ---
app.post("/api/submit", async (req, res) => {
  const { name, contact, link, comment } = req.body || {};
  if (!name || !contact) {
    return res.status(400).json({ ok: false, error: "Имя и контакт обязательны" });
  }

  const html = `
    <h2>Новая заявка с сайта BuyWay</h2>
    <p><b>Имя:</b> ${name}</p>
    <p><b>Контакт:</b> ${contact}</p>
    <p><b>Ссылка:</b> ${link || "—"}</p>
    <p><b>Комментарий:</b> ${comment || "—"}</p>
    <p><i>${new Date().toLocaleString()}</i></p>
  `;

  try {
    await sendMailWithFallback({
      from: `"BuyWay Service" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER, // при желании: "a@b.com, c@d.com"
      subject: "Новая заявка с сайта BuyWay",
      html,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("MAIL ERROR final:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e || "Mail send failed") });
  }
});

// --- Старт серверa ---
const PORT = process.env.PORT || 10000; // на Render PORT приходит из env
app.listen(PORT, "0.0.0.0", () => console.log(`✅ API listening on :${PORT}`));
