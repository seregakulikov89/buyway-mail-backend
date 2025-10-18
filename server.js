import express from "express";
import cors from "cors";
import dns from "dns";

console.log("🚀 Booting BuyWay Mail backend (Resend)...");
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
      !origin || allowed.includes(origin)
        ? cb(null, true)
        : cb(new Error("Not allowed by CORS")),
  })
);
app.use(express.json());

// --- Healthcheck ---
app.get("/", (_, res) => res.send("OK"));
app.get("/healthz", (_, res) => res.status(200).send("ok"));

// Простой чек на email (для Reply-To)
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

// === УКАЖИ адрес отправителя ПОСЛЕ валидации домена в Resend ===
// Если верифицировал корень:  "noreply@buyway.su"
// Если поддомен mail.buyway.su: "noreply@mail.buyway.su"
const FROM_ADDRESS = "BuyWay <noreply@buyway.su>";

// --- API: приём формы ---
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

  const replyTo = emailRe.test(String(contact).trim())
    ? String(contact).trim()
    : undefined;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,                          // отправитель (должен быть с верифицированного домена)
        to: ["buyway.service@gmail.com"],            // получатель(и)
        subject: "Новая заявка с сайта BuyWay",
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),   // чтобы «Ответить» шло клиенту, если он указал email
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("Resend error:", data);
      throw new Error(data?.message || JSON.stringify(data));
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("MAIL ERROR:", e);
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

// --- Старт ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ API listening on :${PORT}`));
