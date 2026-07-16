const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// JSON fayllarni yuklash
const dataDir = __dirname;
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

// API endpoints

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
    message: 'Qonunlar API',
    endpoints: {
      '/api/data': 'Barcha ma\'lumotlar',
      '/api/buxgalteriya': 'Buxgalteriya Hisobi',
      '/api/kodlar': 'Kodlar',
      '/api/mehnat-kodeks': 'Mehnat Kodeksi',
      '/api/qisqartmalar': 'Qisqartmalar',
      '/api/soliq-kodeks': 'Soliq Kodeksi',
      '/api/constants': 'Constants',
      '/api/standartlar': 'Standartlar',
      '/health': 'Health check'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlayapti`);
});

