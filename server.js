import express from "express";
import cors from "cors";
import { Resend } from "resend";

// --- Диагностика старта
console.log("🚀 Booting BuyWay Mail backend (Resend)...");
process.on("uncaughtException", (e) => console.error("Uncaught:", e));
process.on("unhandledRejection", (e) => console.error("Unhandled:", e));

const app = express();

// --- CORS: разрешаем домены
const allowed = [
  "https://buyway.su",
  "https://www.buyway.su",
  "http://localhost:5173",
  "http://localhost:3000"
];
app.use(cors({
  origin: (origin, cb) =>
    !origin || allowed.includes(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS")),
}));
app.use(express.json());

// --- Resend
const resend = new Resend(process.env.RESEND_API_KEY);
const SENDER   = (process.env.SENDER_EMAIL   || "service@buyway.su").trim();
const RECEIVER = (process.env.RECEIVER_EMAIL || "service@buyway.su").trim();

// --- health
app.get("/",       (_, res) => res.send("OK"));
app.get("/healthz",(_, res) => res.status(200).send("ok"));

// --- Тестовое письмо
app.get("/test-email", async (_, res) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `BuyWay <${SENDER}>`,
      to: [RECEIVER],
      subject: "Тестовое письмо от BuyWay (Resend)",
      html: `<h2>Проверка почты</h2>
             <p>Если вы видите это письмо — Resend настроен ✅</p>
             <p><i>${new Date().toLocaleString()}</i></p>`
    });
    if (error) {
      console.error("Resend error:", error);
      return res.status(500).json({ ok: false, error });
    }
    res.json({ ok: true, id: data?.id ?? null });
  } catch (e) {
    console.error("TEST SEND ERROR:", e);
    res.status(500).json({ ok: false, error: "Mail send failed" });
  }
});

// --- Продовый эндпоинт формы
app.post("/api/submit", async (req, res) => {
  const { name, contact, link, comment } = req.body || {};
  if (!name || !contact) {
    return res.status(400).json({ ok: false, error: "Имя и контакт обязательны" });
  }

  const html = `
    <h2>Новая заявка с сайта BuyWay</h2>
    <p><b>Имя:</b> ${escapeHtml(name)}</p>
    <p><b>Контакт:</b> ${escapeHtml(contact)}</p>
    <p><b>Ссылка:</b> ${escapeHtml(link || "—")}</p>
    <p><b>Комментарий:</b> ${escapeHtml(comment || "—")}</p>
    <p><i>${new Date().toLocaleString()}</i></p>
  `;

  try {
    const { error } = await resend.emails.send({
      from: `BuyWay <${SENDER}>`,
      to: [RECEIVER],
      subject: "Новая заявка с сайта BuyWay",
      html
    });
    if (error) {
      console.error("Resend error:", error);
      return res.status(500).json({ ok: false, error: "Mail send failed" });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("SUBMIT SEND ERROR:", e);
    res.status(500).json({ ok: false, error: "Mail send failed" });
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ API listening on :${PORT}`));
