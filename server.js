import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const app = express();
app.use(cors());
app.use(express.json());

// JSON fayllarni yuklash
const dataDir = path.dirname(new URL(import.meta.url).pathname);
const dataFiles = {
  buxgalteriya: 'BuxgalteriyaHisobi.json',
  kodlar: 'Kodlar.json',
  mehnatKodeks: 'MehnatKodeks.json',
  qisqartmalar: 'Qisqartmalar.json',
  soliqKodeks: 'SoliqKodeks.json',
  constants: 'constants.json',
  standartlarFar: 'standartlarFar.json'
};

// Cache uchun
const cache = {};

// Ma'lumotlarni yuklash
Object.entries(dataFiles).forEach(([key, filename]) => {
  try {
    const filepath = path.join(dataDir, filename);
    cache[key] = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (err) {
    console.error(`${filename} yuklashda xato:`, err.message);
  }
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

let currentTransport = null;

// Register tools for MCP
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_all_data',
        description: 'Get all legal documents and regulations data',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_buxgalteriya',
        description: 'Get Buxgalteriya Hisobi (Accounting Code)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_kodlar',
        description: 'Get Kodlar (Codes)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_mehnat_kodeks',
        description: 'Get Mehnat Kodeksi (Labor Code)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_qisqartmalar',
        description: 'Get Qisqartmalar (Abbreviations)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_soliq_kodeks',
        description: 'Get Soliq Kodeksi (Tax Code)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_constants',
        description: 'Get Constants and fixed values',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_standartlar',
        description: 'Get Standartlar (Standards)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ]
  };
});

// Handle tool calls
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  let result;

  switch (toolName) {
    case 'get_all_data':
      result = { data: cache, status: 'ok' };
      break;
    case 'get_buxgalteriya':
      result = cache.buxgalteriya || { error: 'Ma\'lumot topilmadi' };
      break;
    case 'get_kodlar':
      result = cache.kodlar || { error: 'Ma\'lumot topilmadi' };
      break;
    case 'get_mehnat_kodeks':
      result = cache.mehnatKodeks || { error: 'Ma\'lumot topilmadi' };
      break;
    case 'get_qisqartmalar':
      result = cache.qisqartmalar || { error: 'Ma\'lumot topilmadi' };
      break;
    case 'get_soliq_kodeks':
      result = cache.soliqKodeks || { error: 'Ma\'lumot topilmadi' };
      break;
    case 'get_constants':
      result = cache.constants || { error: 'Ma\'lumot topilmadi' };
      break;
    case 'get_standartlar':
      result = cache.standartlarFar || { error: 'Ma\'lumot topilmadi' };
      break;
    default:
      return { error: `Unknown tool: ${toolName}` };
  }

  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

// ============================================
// MCP SSE Transport Endpoints
// ============================================

app.get("/api/sse", async (req, res) => {
  console.log("Yangi SSE ulanish keldi");
  
  // Agarda Groq xabarlarni ham /api/sse ga POST qilayotgan bo'lsa, 
  // birinchi argumentni ham "/api/sse" qiling:
  currentTransport = new SSEServerTransport("/api/sse", res);
  
  await mcpServer.connect(currentTransport);
  
  req.on("close", () => {
    console.log("Ulanish yopildi");
    currentTransport = null;
  });
});

// POST so'rovini qabul qiladigan router
app.post("/api/sse", async (req, res) => {
  if (!currentTransport) {
    return res.status(400).send("Aktiv SSE sessiyasi topilmadi");
  }
  await currentTransport.handleMessage(req, res);
});

// ============================================
// REST API ENDPOINTS (Original)
// ============================================

// Barcha ma'lumotlar
app.get('/api/data', (req, res) => {
  res.json({ data: cache, status: 'ok' });
});

// Har bir qonun alohida
app.get('/api/buxgalteriya', (req, res) => {
  res.json(cache.buxgalteriya || { error: 'Ma\'lumot topilmadi' });
});

app.get('/api/kodlar', (req, res) => {
  res.json(cache.kodlar || { error: 'Ma\'lumot topilmadi' });
});

app.get('/api/mehnat-kodeks', (req, res) => {
  res.json(cache.mehnatKodeks || { error: 'Ma\'lumot topilmadi' });
});

app.get('/api/qisqartmalar', (req, res) => {
  res.json(cache.qisqartmalar || { error: 'Ma\'lumot topilmadi' });
});

app.get('/api/soliq-kodeks', (req, res) => {
  res.json(cache.soliqKodeks || { error: 'Ma\'lumot topilmadi' });
});

app.get('/api/constants', (req, res) => {
  res.json(cache.constants || { error: 'Ma\'lumot topilmadi' });
});

app.get('/api/standartlar', (req, res) => {
  res.json(cache.standartlarFar || { error: 'Ma\'lumot topilmadi' });
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
      '/api/data': 'Barcha ma\'lumotlar',
      '/api/buxgalteriya': 'Buxgalteriya Hisobi',
      '/api/kodlar': 'Kodlar',
      '/api/mehnat-kodeks': 'Mehnat Kodeksi',
      '/api/qisqartmalar': 'Qisqartmalar',
      '/api/soliq-kodeks': 'Soliq Kodeksi',
      '/api/constants': 'Constants',
      '/api/standartlar': 'Standartlar',
      '/health': 'Health check',
      '/api/sse': 'MCP SSE Endpoint (for Groq)',
      '/api/messages': 'MCP Messages Endpoint (for Groq)'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlayapti`);
  console.log(`MCP SSE endpoint: http://localhost:${PORT}/api/sse`);
  console.log(`MCP Messages endpoint: http://localhost:${PORT}/api/messages`);
});
