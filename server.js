import express from "express";
import cors from "cors";
import dns from "dns";
import fetch from "node-fetch"; // важно: Render уже поддерживает node-fetch

console.log("🚀 Booting BuyWay Mail backend...");
dns.setDefaultResultOrder?.("ipv4first");

const app = express();

// --- CORS: разрешаем нужные домены ---
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

// --- API: приём формы ---
app.post("/api/submit", async (req, res) => {
  const { name, contact, link, comment } = req.body || {};
  if (!name || !contact)
    return res
      .status(400)
      .json({ ok: false, error: "Имя и контакт обязательны" });

  const html = `
    <h2>Новая заявка с сайта BuyWay</h2>
    <p><b>Имя:</b> ${name}</p>
    <p><b>Контакт:</b> ${contact}</p>
    <p><b>Ссылка:</b> ${link || "—"}</p>
    <p><b>Комментарий:</b> ${comment || "—"}</p>
    <p><i>${new Date().toLocaleString()}</i></p>
  `;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BuyWay <onboarding@resend.dev>", // временно, потом заменим на buyway.su
        to: ["buyway.service@gmail.com"],
        subject: "Новая заявка с сайта BuyWay",
        html,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("Resend error:", data);
      throw new Error(data.message || "Send failed");
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
