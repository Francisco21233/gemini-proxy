import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// 🔑 IMPORTANTE: En Render la variable DEBE llamarse GROQ_API_KEY
const API_KEY = process.env.GROQ_API_KEY;

let peticionesPorIP = {};
let solicitudesActivas = 0;
const LIMITE_GLOBAL = 5;

// Endpoint que coincide con tu URL: https://gemini-proxy-lwvz.onrender.com/groq
app.post("/groq", async (req, res) => {
  const ip = req.ip;

  // Control de saturación
  if (solicitudesActivas >= LIMITE_GLOBAL) {
    return res.json({ respuesta: "⚠️ Sistema saturado. Reintenta en 5 segundos." });
  }

  // Control de Spam (5 segundos entre preguntas por usuario)
  if (peticionesPorIP[ip] && Date.now() - peticionesPorIP[ip] < 5000) {
    return res.json({ respuesta: "⚠️ Por favor, espera 5 segundos entre consultas." });
  }

  peticionesPorIP[ip] = Date.now();
  solicitudesActivas++;

  try {
    const { mensaje, contexto } = req.body;
    
    // --- LOG DE DEPURACIÓN 1 ---
    console.log("-----------------------------------------");
    console.log("📥 MENSAJE RECIBIDO DE LA WEB:", mensaje);

    if (!mensaje || mensaje.length < 3) {
      return res.json({ respuesta: "Consulta demasiado corta." });
    }

    const systemInstruction = `Eres el asistente de AlivioZen.Especialistas: ${contexto}. 
    REGLAS DE SERVICIO:
    1. NO HAY PENALIDADES por cancelar o reprogramar. 
    2. RESERVA: El usuario tiene que elegir la fecha, horario, tipo de servicio si lo hubiese y colocar sus datos en el calendario del prestador del servicio, si en caso la atencion es a domicilio, debe colocar de forma obligatoria su direccion y referencia, ademas de describir si presenta algun sintoma o problema de salud.
    3. CONTACTO: El prestador del servicio se contactará con el usuario por WhatsApp tras el registro, por eso es importante colocar su numero correctamente.
    4. PAGO Y GPS: El usuario debe enviar captura de pago y ubicación GPS al profesional, la ubicacion es siempre y cuando la atencion sea a domicilio por WhatsApp.
    5. REPROGRAMAR: Avisar al profesional y volver a registrarse en el calendario de la web.
    
    REGLAS DE IA: 
    1. Si el usuario pregunta algo ajeno a la salud o bienestar, responde:"En AlivioZen nos enfocamos en tu salud física y mental. ¿En qué dolencia o servicio de bienestar puedo ayudarte hoy?". 
    2. Profesionales disponibles: ${contexto}. 
    3. Si uno encaja con el problema, nómbralo específicamente.
    4. Si no encuentras un profesional específico para su dolencia en la lista, recomienda una especialidad ligado a su dolencia e invitalo atenderse con un espacialista relacionado a su dolencia.
    5. Respuesta corta (máx 1 párrafo). 
    6. Nunca inventes servicios que no ofrecemos.
    7. Si te dice una lista de problemas de salud y te pregunta que me recomiendas o palabras relacionadas a ello, explicale muy brevemente con que enfermedades se podrian relacionar y recomiendale un profesional de nuestra lista si esta disponible, sino dile que vaya a un especialista relacionado con sus malestares. 
    8. Ante síntomas de infarto o asfixia, pide al usuario llamar a emergencias inmediatamente.
    9. No des diagnósticos médicos.`;

    // Llamada a Groq
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", 
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: mensaje }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });

    const data = await response.json();

    // --- LOG DE DEPURACIÓN 2 ---
    console.log("📤 RESPUESTA DE GROQ:", JSON.stringify(data));

    if (data.error) {
      console.error("❌ ERROR DETECTADO EN GROQ:", data.error.message);
      return res.json({ respuesta: "Error de la IA: " + data.error.message });
    }

    const texto = data?.choices?.[0]?.message?.content || "No recibí una respuesta válida.";
    res.json({ respuesta: texto });

  } catch (error) {
    // --- LOG DE DEPURACIÓN 3 ---
    console.error("❌ ERROR CRÍTICO EN EL SERVIDOR:", error.message);
    res.json({ respuesta: "Error de conexión: " + error.message });
  } finally {
    solicitudesActivas--;
    console.log("✅ Proceso finalizado para esta solicitud.");
    console.log("-----------------------------------------");
  }
});

app.get("/", (req, res) => res.send("Servidor de AlivioZen (Groq) funcionando correctamente 🚀"));

const PORT = process.env.PORT || 10000; 
app.listen(PORT, () => console.log("Servidor escuchando en puerto", PORT));
