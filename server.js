import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// 👉 TU API KEY (luego la pondremos como variable de entorno)
const API_KEY = process.env.GEMINI_API_KEY;

// 👉 Endpoint principal
app.post("/gemini", async (req, res) => {
  try {
    const { mensaje, contexto } = req.body;

    // 🔒 Validaciones
    if (!mensaje || mensaje.length > 300) {
      return res.json({
        respuesta: "Por favor, resume tu consulta."
      });
    }

    // 👉 Instrucciones del sistema
    const systemInstruction = `
Eres un asistente de la plataforma AlivioZen.

Reglas:
1. SOLO responde temas de salud, masajes o bienestar.
2. Usa estos profesionales: ${contexto}
3. Si uno encaja, nómbralo.
4. Respuesta breve (máx 1 párrafo).
5. No des diagnósticos médicos.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: systemInstruction + "\n\nConsulta: " + mensaje
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 400,
            temperature: 0.7
          }
        })
      }
    );

    const data = await response.json();

    const texto =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No pude procesar tu solicitud.";

    res.json({ respuesta: texto });

  } catch (error) {
    console.error(error);
    res.json({
      respuesta: "Error en el servidor, intenta nuevamente."
    });
  }
});

// 👉 Puerto dinámico (IMPORTANTE para Render)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});