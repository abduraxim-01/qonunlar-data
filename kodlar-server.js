import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import pg from "pg";

const app = express();
app.use(express.json());

// Faqat Kodlarga ulanadigan alohida DB Pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const mcpServer = new Server({
  name: "kodlar-api",
  version: "1.0.0"
}, {
  capabilities: { tools: {} }
});

const transports = new Map();

// 1. Tool'larni ro'yxatdan o'tkazish (Faqat kodlarga oid bittagina yengil tool)
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "kodlar_qidiruv",
        description: "O'zbekiston Respublikasi qonunlaridagi turli kodlar (masalan, Iqtisodiy faoliyat turlari klassifikatori kodlari) bo'yicha dynamic qidirish",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Kod raqami yoki kalit so'z (masalan: OKED, TN VED)" }
          },
          required: ["query"]
        }
      }
    ]
  };
});

// 2. Qidiruvni bajarish (Ma'lumotni cheklangan hajmda - LIMIT bilan qaytarish)
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const query = args?.query;

  if (name !== "kodlar_qidiruv") {
    throw new Error("Noma'lum tool chaqirildi");
  }

  try {
    // ILIKE orqali matndan, raqam orqali aniq koddan qidirish va LIMIT 5 bilan yukni kamaytirish
    const res = await pool.query(
      "SELECT kod, matn FROM kodlar WHERE matn ILIKE $1 OR kod::text = $2 LIMIT 5",
      [`%${query}%`, query]
    );
    
    return {
      content: [{ type: "text", text: JSON.stringify(res.rows) }]
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Xatolik yuz berdi: ${error.message}` }],
      isError: true
    };
  }
});

// --- SSE Routerlari ---
app.get("/api/sse", async (req, res) => {
  const sessionId = req.query.sessionId || "kodlar-session";
  const transport = new SSEServerTransport("/api/sse", res);
  transports.set(sessionId, transport);
  
  await mcpServer.connect(transport);
  
  req.on("close", () => {
    transports.delete(sessionId);
  });
});

app.post("/api/sse", async (req, res) => {
  const sessionId = req.query.sessionId || "kodlar-session";
  const transport = transports.get(sessionId);
  
  if (!transport) {
    return res.status(202).json({ status: "initializing" });
  }
  await transport.handleMessage(req, res);
});

app.delete("/api/sse", (req, res) => {
  const sessionId = req.query.sessionId || "kodlar-session";
  transports.delete(sessionId);
  res.status(200).json({ status: "disconnected" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Kodlar MCP Server ${PORT}-portda ishlamoqda`);
});