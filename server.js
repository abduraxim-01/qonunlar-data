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
        name: "soliq_kodeksi",
        description: "Soliq kodeksidan moddalar, soliq stavkalari va majburiyatlarni qidirish",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Modda raqami yoki qidirilayotgan kalit so'z (masalan: QQS)" }
          },
          required: ["query"]
        }
      },
      {
        name: "jinoyat_kodeksi",
        description: "Jinoyat kodeksidan moddalar, jazo turlari va huquqbuzarliklarni qidirish",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Modda raqami yoki jinoyat turi" }
          },
          required: ["query"]
        }
      },
      {
        name: "mehnat_kodeksi",
        description: "Mehnat kodeksidan ish vaqti, ta'tillar va shartnomaga oid normalarni qidirish",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Modda raqami yoki mehnat huquqi masalasi" }
          },
          required: ["query"]
        }
      },
      {
        name: "fuqarolik_kodeksi",
        description: "Fuqarolik kodeksidan shartnomalar, mulk huquqi va majburiyatlarni qidirish",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Modda raqami yoki fuqarolik munosabati" }
          },
          required: ["query"]
        }
      },
      {
        name: "konstitutsiya",
        description: "O'zbekiston Respublikasi Konstitutsiyasi moddalarini qidirish",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Modda raqami yoki asosiy qonun matni" }
          },
          required: ["query"]
        }
      }
    ]
  };
});

// Handle tool calls
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const query = args?.query;

  try {
    switch (name) {
      case "soliq_kodeksi": {
        const res = await pool.query(
          "SELECT modda, matn FROM soliq_kodeksi WHERE matn ILIKE $1 OR modda::text = $2 LIMIT 5",
          [`%${query}%`, query]
        );
        return { content: [{ type: "text", text: JSON.stringify(res.rows) }] };
      }

      case "jinoyat_kodeksi": {
        const res = await pool.query(
          "SELECT modda, matn FROM jinoyat_kodeksi WHERE matn ILIKE $1 OR modda::text = $2 LIMIT 5",
          [`%${query}%`, query]
        );
        return { content: [{ type: "text", text: JSON.stringify(res.rows) }] };
      }

      case "mehnat_kodeksi": {
        const res = await pool.query(
          "SELECT modda, matn FROM mehnat_kodeksi WHERE matn ILIKE $1 OR modda::text = $2 LIMIT 5",
          [`%${query}%`, query]
        );
        return { content: [{ type: "text", text: JSON.stringify(res.rows) }] };
      }

      case "fuqarolik_kodeksi": {
        const res = await pool.query(
          "SELECT modda, matn FROM fuqarolik_kodeksi WHERE matn ILIKE $1 OR modda::text = $2 LIMIT 5",
          [`%${query}%`, query]
        );
        return { content: [{ type: "text", text: JSON.stringify(res.rows) }] };
      }

      case "konstitutsiya": {
        const res = await pool.query(
          "SELECT modda, matn FROM konstitutsiya WHERE matn ILIKE $1 OR modda::text = $2 LIMIT 5",
          [`%${query}%`, query]
        );
        return { content: [{ type: "text", text: JSON.stringify(res.rows) }] };
      }

      default:
        throw new Error(`Noma'lum kodeks turi: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Qidiruvda xatolik yuz berdi: ${error.message}` }],
      isError: true
    };
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
