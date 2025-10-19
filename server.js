import express from "express";
import cors from "cors";
import { Resend } from "resend";

// --- Диагностика запуска
console.log("🚀 Booting BuyWay Mail backend (Resend)...");
process.on("uncaughtException", (e) => console.error("Uncaught:", e));
process.on("unhandledRejection", (e) => console.error("Unhandled:", e));

const app = express();

// --- Разрешённые источники (CORS)
const allowedOrigins = [
  "https://buyway.su",
  "https://www.buyway.su",
  "http://localhost:5173",
  "http://localhost:3000"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  })
);

app.use(express.json());

// --- Подключение Resend
const resend = new Resend(process.env.RESEND_API_KEY);
const SENDER = process.env.SENDER_EMAIL?.trim() || "service@buyway.su";
const RECEIVER = process.env.RECEIVER_EMAIL?.trim() || "service@buyway.su";

// --- Проверка статуса
app.get("/", (_, res) => res.send("OK"));
app.get("/healthz", (_, res) => res.status(200).send("ok"));

// --- Тестовое письмо
app.get("/test-email", async (_, res) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `BuyWay <${SENDER}>`,
      to: [RECEIVER],
      subject: "Тестовое письмо от BuyWay (Resend)",
      html: `<h2>Проверка почты</h2>
             <p>Если ты видишь это письмо — Resend работает ✅</p>
             <p><i>${new Date().toLocaleString()}</i></p>`
    });

    if (error) {
      console.error("Resend error:", error);
      return res.status(500).json({ ok: false, error });
    }

    res.json({ ok: true, id: data?.id || null });
  } catch (e) {
    console.error("TEST SEND ERROR:", e);
    res.status(500).json({ ok: false, error: "Mail send failed" });
  }
});

// --- Обработка формы с сайта
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

// --- Функция защиты HTML
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Запуск сервера
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ BuyWay Mail API listening on port ${PORT}`));
