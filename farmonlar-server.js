import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import pg from "pg";

const app = express();


// Faqat Farmonlarga ulanadigan alohida DB Pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const mcpServer = new Server({
  name: "farmonlar-api",
  version: "1.0.0"
}, {
  capabilities: { tools: {} }
});

const transports = new Map();

// 1. Tool'larni ro'yxatdan o'tkazish (Faqat farmonlarga oid bittagina yengil tool)
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "farmonlar_qidiruv",
        description: "O'zbekiston Respublikasi Prezidentining farmonlari va qarorlari bo'yicha dynamic qidirish",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Farmon raqami, sanasi yoki kalit so'z (masalan: Prezident qarori, yer uchastkasi)" }
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

  if (name !== "farmonlar_qidiruv") {
    throw new Error("Noma'lum tool chaqirildi");
  }

  try {
    // ILIKE orqali matndan, raqam orqali aniq farmondan qidirish va LIMIT 5 bilan yukni kamaytirish
    const res = await pool.query(
      "SELECT raqam, sana, matn FROM standartlar_far WHERE matn ILIKE $1 OR raqam::text ILIKE $2 OR sana::text ILIKE $3 LIMIT 5",
      [`%${query}%`, `%${query}%`, `%${query}%`]
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
  const sessionId = req.query.sessionId || "farmonlar-session";
  const transport = new SSEServerTransport("/api/sse", res);
  transports.set(sessionId, transport);
  
  await mcpServer.connect(transport);
  
  req.on("close", () => {
    transports.delete(sessionId);
  });
});

app.post("/api/sse", async (req, res) => {
  const sessionId = req.query.sessionId || "farmonlar-session";
  const transport = transports.get(sessionId);
  
  if (!transport) {
    return res.status(202).json({ status: "initializing" });
  }
  await transport.handleMessage(req, res);
    
  // ENg muhimi: Express so'rovini muvaffaqiyatli yakunlash!
  // MCP standartiga ko'ra, POST so'rovi qabul qilingach, 200 yoki 202 status bilan yopilishi shart.
  if (!res.writableEnded) {
      res.status(200).end();
  }
});

app.delete("/api/sse", (req, res) => {
  const sessionId = req.query.sessionId || "farmonlar-session";
  transports.delete(sessionId);
  res.status(200).json({ status: "disconnected" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`Farmonlar MCP Server ${PORT}-portda ishlamoqda`);
});