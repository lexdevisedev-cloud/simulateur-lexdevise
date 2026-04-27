import express from "express";
import { Resend } from "resend";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(express.json());
app.use(express.static(__dirname));

app.post("/api/send-estimation", async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      startDate,
      loanAmount,
      duration,
      estimationRange
    } = req.body;

    if (!fullName || !email || !phone || !startDate || !loanAmount || !duration || !estimationRange) {
      return res.status(400).json({ error: "Informations incomplètes." });
    }

    const { data, error } = await resend.emails.send({
      from: "LexDevise <onboarding@resend.dev>",
      to: ["louis.mermet@lexdevise.fr"],
      reply_to: email,
      subject: `Nouveau lead simulateur - ${fullName}`,
      html: `
        <h2>Nouvelle demande simulateur LexDevise</h2>
        <p><strong>Nom :</strong> ${fullName}</p>
        <p><strong>Email :</strong> ${email}</p>
        <p><strong>Téléphone :</strong> ${phone}</p>
        <p><strong>Date de début du prêt :</strong> ${startDate}</p>
        <p><strong>Montant du crédit :</strong> ${loanAmount} €</p>
        <p><strong>Durée :</strong> ${duration} ans</p>
        <p><strong>Préjudice estimé :</strong> ${estimationRange}</p>
      `
    });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Erreur Resend." });
    }

    return res.json({ ok: true, data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur." });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});