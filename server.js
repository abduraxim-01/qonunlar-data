import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

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

const transport = new StdioServerTransport();
const serverOptions = {
  name: 'qonunlar-mcp',
  version: '1.0.0',
  capabilities: {
    tools: true,
    resources: false,
    prompts: false
  },
  transport: transport,
};
const mcpServer = new Server(serverOptions);

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

// ============================================
// MCP SSE ENDPOINT for Groq Integration
// ============================================

app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send server info event
  res.write(`event: server_info\n`);
  res.write(`data: ${JSON.stringify({
    name: 'qonunlar-mcp',
    version: '1.0.0',
    capabilities: {
      tools: true,
      resources: false,
      prompts: false
    }
  })}\n\n`);

  // Send tools list
  res.write(`event: tools_list\n`);
  res.write(`data: ${JSON.stringify({
    tools: [
      'get_all_data',
      'get_buxgalteriya',
      'get_kodlar',
      'get_mehnat_kodeks',
      'get_qisqartmalar',
      'get_soliq_kodeks',
      'get_constants',
      'get_standartlar'
    ]
  })}\n\n`);

  // Keep connection alive
  const interval = setInterval(() => {
    res.write(`:keep-alive\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

// ============================================
// MCP INITIALIZE ENDPOINT
// ============================================

app.post('/api/mcp/initialize', (req, res) => {
  res.json({
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {
        listChanged: true
      }
    },
    serverInfo: {
      name: 'qonunlar-mcp',
      version: '1.0.0'
    }
  });
});

// ============================================
// MCP TOOLS ENDPOINT
// ============================================

app.get('/api/mcp/tools', (req, res) => {
  res.json({
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
  });
});

// ============================================
// MCP CALL TOOL ENDPOINT
// ============================================

app.post('/api/mcp/call', (req, res) => {
  const { tool, params } = req.body;
  let result;

  switch (tool) {
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
      return res.status(400).json({ error: `Unknown tool: ${tool}` });
  }

  res.json({ result, success: true });
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
      '/sse': 'MCP SSE Endpoint (for Groq)',
      '/api/mcp/initialize': 'MCP Initialize',
      '/api/mcp/tools': 'List MCP Tools',
      '/api/mcp/call': 'Call MCP Tool'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlayapti`);
  console.log(`MCP SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`MCP Tools endpoint: http://localhost:${PORT}/api/mcp/tools`);
});

