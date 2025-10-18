import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/healthz", (req, res) => res.send("ok"));

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

app.post("/api/submit", async (req, res) => {
  try {
    const { name, contact, link, comment } = req.body;

    await transporter.sendMail({
      from: `"BuyWay" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      subject: "Новая заявка с сайта",
      html: `
        <h3>Новая заявка:</h3>
        <p><b>Имя:</b> ${name}</p>
        <p><b>Контакт:</b> ${contact}</p>
        <p><b>Ссылка:</b> ${link}</p>
        <p><b>Комментарий:</b> ${comment}</p>
      `
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("MAIL ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ API listening on port ${PORT}`));
