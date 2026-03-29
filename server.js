import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = process.env.GEMINI_API_KEY;

// 🔒 Control por IP
let peticionesPorIP = {};

// 🔒 Control de concurrencia
let solicitudesActivas = 0;
const LIMITE_GLOBAL = 5;

// 👉 Endpoint principal
app.post("/gemini", async (req, res) => {
  const ip = req.ip;

  // 🔒 Límite global
  if (solicitudesActivas >= LIMITE_GLOBAL) {
    return res.json({
      respuesta: "⚠️ Hay muchas consultas en este momento. Intenta en unos segundos."
    });
  }

  // 🔒 Límite por IP (5 segundos)
  if (peticionesPorIP[ip] && Date.now() - peticionesPorIP[ip] < 5000) {
    return res.json({
      respuesta: "⚠️ Espera unos segundos antes de volver a consultar."
    });
  }

  peticionesPorIP[ip] = Date.now();
  solicitudesActivas++;

  try {
    const { mensaje, contexto } = req.body;

    // 🔒 Validaciones
    if (!mensaje || mensaje.length < 5) {
      solicitudesActivas--;
      return res.json({ respuesta: "Consulta inválida" });
    }

    if (mensaje.length > 300) {
      solicitudesActivas--;
      return res.json({ respuesta: "Por favor, resume tu consulta." });
    }

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
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `INSTRUCCIONES: ${systemInstruction}\n\nPROFESIONALES DISPONIBLES: ${contexto}\n\nPREGUNTA DEL USUARIO: ${mensaje}` }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 200, // 🔥 reducido para ahorrar
            temperature: 0.7
          }
        })
      }
    );

    // --- BLOQUE DE DEPURACIÓN AÑADIDO ---
    const data = await response.json();
    console.log("Respuesta de Google:", JSON.stringify(data)); 

    // Si Google devuelve un error específico (ej. API Key inválida)
    if (data.error) {
        return res.json({ 
            respuesta: "Error de Google: " + data.error.message 
        });
    }
    // ------------------------------------

    const texto =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No pude procesar tu solicitud.";

    res.json({ respuesta: texto });

  } catch (error) {
    console.error(error);
    res.json({
      respuesta: "Error en el servidor, intenta nuevamente."
    });
  } finally {
    solicitudesActivas--;
  }
});

// 👉 Ruta base (para evitar "Cannot GET /")
app.get("/", (req, res) => {
  res.send("Servidor Gemini activo 🚀");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});
