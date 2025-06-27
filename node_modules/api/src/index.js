// api/src/index.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// --- Routes ---

// 1) List all technicians (with their check-ins, newest first)
app.get('/api/technicians', async (req, res) => {
  try {
    const techs = await prisma.technician.findMany({
      include: {
        checkIns: { orderBy: { createdAt: 'desc' } }
      },
      orderBy: { techId: 'asc' }
    });
    res.json(techs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch technicians' });
  }
});

// 2) Create a new technician
app.post('/api/technicians', async (req, res) => {
  const { name, techId, barcodeValue } = req.body;
  if (!name || !techId || !barcodeValue) {
    return res.status(400).json({ error: 'Missing name, techId, or barcodeValue' });
  }
  try {
    const tech = await prisma.technician.create({
      data: { name, techId, barcodeValue }
    });
    res.status(201).json(tech);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create technician' });
  }
});

// 3) Delete a technician
app.delete('/api/technicians/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.technician.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete technician' });
  }
});

// 4) Record a check-in
app.post('/api/technicians/:id/checkin', async (req, res) => {
  const technicianId = Number(req.params.id);
  const { uniformSet } = req.body;
  if (!uniformSet) {
    return res.status(400).json({ error: 'Missing uniformSet' });
  }
  try {
    const checkIn = await prisma.checkIn.create({
      data: { technicianId, uniformSet }
    });
    res.status(201).json(checkIn);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record check-in' });
  }
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 API listening on port ${PORT}`);
});
