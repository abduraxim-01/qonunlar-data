import express from 'express';
import cors from 'cors';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import pg from 'pg';

const app = express();
app.use(cors());
app.use(express.json());

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});



// ============================================
// MCP SERVER CONFIGURATION
// ============================================

const mcpServer = new Server(
  {
    name: "qonunlar-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  }
);

const transports = new Map();

// Register tools for MCP
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "qonun_qidirish",
        description: "O'zbekiston Respublikasi qonunlaridan (Soliq kodeksi, Mehnat kodeksi, Kodlar, Farmonlar) ma'lumotlarni qidirish",
        inputSchema: {
          type: "object",
          properties: {
            tur: { type: "string", description: "Qidirilayotgan qonun turi (soliq, mehnat, kodlar, farmonlar)", enum: ["soliq", "mehnat", "kodlar", "farmonlar"] },
            query: { type: "string", description: "Modda raqami, sanasi yoki kalit so'z" }
          },
          required: ["tur", "query"]
        }
      }
    ]
  };
});

// Handle tool calls
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name !== "qonun_qidirish") {
    throw new Error(`Noma'lum tool chaqirildi: ${name}`);
  }

  const { tur, query } = args;
  const cleanQuery = decodeURIComponent(query || "").trim();

  let client;
  try {
    client = await pool.connect();
    
    switch (tur) {
      case "soliq": {
        const res = await client.query(
          "SELECT modda, matn FROM soliq_kodeksi WHERE matn ILIKE $1 OR modda::text = $2 LIMIT 3",
          [`%${cleanQuery}%`, cleanQuery]
        );
        return { content: [{ type: "text", text: JSON.stringify(res.rows) }] };
      }

      case "mehnat": {
        const res = await client.query(
          "SELECT modda, matn FROM mehnat_kodeksi WHERE matn ILIKE $1 OR modda::text = $2 LIMIT 3",
          [`%${cleanQuery}%`, cleanQuery]
        );
        return { content: [{ type: "text", text: JSON.stringify(res.rows) }] };
      }

      case "kodlar": {
        const res = await client.query(
          "SELECT kod, matn FROM kodlar WHERE matn ILIKE $1 OR kod::text = $2 LIMIT 3",
          [`%${cleanQuery}%`, cleanQuery]
        );
        return { content: [{ type: "text", text: JSON.stringify(res.rows) }] };
      }

      case "farmonlar": {
        const res = await client.query(
          "SELECT raqam, sana, matn FROM standartlar_far WHERE matn ILIKE $1 OR raqam::text ILIKE $2 OR sana::text ILIKE $3 LIMIT 3",
          [`%${cleanQuery}%`, `%${cleanQuery}%`, `%${cleanQuery}%`]
        );
        return { content: [{ type: "text", text: JSON.stringify(res.rows) }] };
      }

      default:
        throw new Error(`Noma'lum qonun turi: ${tur}`);
    }
  } catch (error) {
    return { content: [{ type: "text", text: error.message }], isError: true };
  } finally {
    if (client) client.release();
  }
});

// ============================================
// MCP SSE Transport Endpoints
// ============================================

app.get("/api/sse", async (req, res) => {
  const sessionId = req.query.sessionId || "default-session";
  
  const transport = new SSEServerTransport("/api/sse", res);
  transports.set(sessionId, transport);
  
  await mcpServer.connect(transport);
  
  req.on("close", () => {
    transports.delete(sessionId);
  });
});

app.post("/api/sse", async (req, res) => {
  const sessionId = req.query.sessionId || "default-session";
  const transport = transports.get(sessionId);
  
  if (!transport) {
    return res.status(202).json({ status: "accepted", message: "Session initializing" });
  }
  
  try {
    await transport.handleMessage(req, res);
  } catch (error) {
    console.error("Xabarda xato:", error);
    res.status(500).send("Internal Server Error");
  }
});

// 3. ENg MUHIMI: DELETE routerini qo'shish (Groq ulanishni yopganda xato bermasligi uchun)
app.delete("/api/sse", (req, res) => {
  const sessionId = req.query.sessionId || "default-session";
  transports.delete(sessionId);
  res.status(200).json({ status: "disconnected" });
});



// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Qonunlar API with MCP Server',
    endpoints: {
      '/health': 'Health check',
      '/api/sse': 'MCP SSE Endpoint (for Groq)'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlayapti`);
  console.log(`MCP SSE endpoint: http://localhost:${PORT}/api/sse`);
});
