import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = process.env.GROQ_API_KEY;

// 👉 NUEVO ENDPOINT
app.post("/groq", async (req, res) => {
  try {
    const { mensaje, contexto } = req.body;

    // 🔒 VALIDACIONES
    if (!mensaje || mensaje.length > 300) {
      return res.json({
        respuesta: "Por favor, resume tu consulta."
      });
    }

    const systemInstruction = `
Eres un asistente de la plataforma AlivioZen.

Reglas:
1. SOLO responde temas de salud, masajes o bienestar.
2. Usa estos profesionales: ${contexto}
3. Si uno encaja con el problema, nómbralo.
4. Si no, recomienda una especialidad.
5. Respuesta corta (máx 1 párrafo).
6. No des diagnósticos médicos.
`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [
          {
            role: "system",
            content: systemInstruction
          },
          {
            role: "user",
            content: mensaje
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("ERROR GROQ:", data);
      return res.json({
        respuesta: "Error con la IA. Intenta nuevamente."
      });
    }

    const texto = data?.choices?.[0]?.message?.content || "No pude responder.";

    res.json({ respuesta: texto });

  } catch (error) {
    console.error(error);
    res.json({
      respuesta: "Error en el servidor."
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});
