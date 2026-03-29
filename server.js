import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// 🔑 Se usa el nombre de la variable que vayas a poner en Render
const API_KEY = process.env.GROQ_API_KEY;

// 🔒 Controles de seguridad
let peticionesPorIP = {};
let solicitudesActivas = 0;
const LIMITE_GLOBAL = 5;

// He dejado el nombre "/gemini" para que coincida con lo que tu Web busca, 
// pero por dentro usa el motor de GROQ que es más confiable.
app.post("/gemini", async (req, res) => {
  const ip = req.ip;

  // 1. Control de saturación
  if (solicitudesActivas >= LIMITE_GLOBAL) {
    return res.json({ respuesta: "⚠️ Sistema ocupado. Intenta en 5 segundos." });
  }

  // 2. Control de Spam por IP
  if (peticionesPorIP[ip] && Date.now() - peticionesPorIP[ip] < 5000) {
    return res.json({ respuesta: "⚠️ Por favor, espera un poco entre preguntas." });
  }

  peticionesPorIP[ip] = Date.now();
  solicitudesActivas++;

  try {
    const { mensaje, contexto } = req.body;

    // 3. Validaciones de entrada
    if (!mensaje || mensaje.length < 5) {
      return res.json({ respuesta: "Consulta muy corta." });
    }

    const systemInstruction = `Eres el asistente de AlivioZen. 
    REGLAS: 
    1. Solo salud y bienestar. 
    2. Usa estos profesionales: ${contexto}. 
    3. Si uno encaja, nómbralo. 
    4. Respuesta breve (máx 1 párrafo). 
    5. No des diagnósticos médicos.`;

    // 4. Llamada a GROQ (Formato compatible con OpenAI)
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192", // Este modelo es gratuito y vuela de rápido
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: mensaje }
        ],
        max_tokens: 250,
        temperature: 0.7
      })
    });

    const data = await response.json();

    // 5. Manejo de errores detallado (se verá en tu web si algo falla)
    if (data.error) {
      console.error("Error de Groq:", data.error);
      return res.json({ respuesta: "Error de la IA: " + data.error.message });
    }

    const texto = data?.choices?.[0]?.message?.content || "No tengo una respuesta clara en este momento.";
    res.json({ respuesta: texto });

  } catch (error) {
    console.error("Error Servidor:", error);
    res.json({ respuesta: "Error de conexión con el servidor." });
  } finally {
    solicitudesActivas--;
  }
});

app.get("/", (req, res) => res.send("Servidor de AlivioZen con Groq activo 🚀"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor corriendo en puerto", PORT));
