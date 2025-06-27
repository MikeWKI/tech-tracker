// api/scripts/seed.js
const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

async function main() {
  const prisma = new PrismaClient();
  const dataDir = path.join(__dirname, '../data');

  // List whatever Excel files are in data/
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.xlsx'));
  console.log('🔍 Found data files:', files);

  // Find the tech-list workbook (match by partial name)
  const techFileName = files.find(f => f.toLowerCase().includes('tech list'));
  if (!techFileName) throw new Error('Tech List workbook not found in data/');
  const techPath = path.join(dataDir, techFileName);

  // Find the fitting workbook
  const fitFileName = files.find(f => f.toLowerCase().includes('cintas'));
  if (!fitFileName) throw new Error('Fitting workbook not found in data/');
  const fitPath = path.join(dataDir, fitFileName);

  // 1) Upsert technicians
  const techWb = XLSX.readFile(techPath);
  for (const sheetName of techWb.SheetNames) {
    const sheet = techWb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    for (const row of rows) {
      const techIdRaw = row['Tech #'] ?? row['Tech'] ?? row['tech_id'];
      if (!techIdRaw) continue;
      const techId = Number(techIdRaw);
      const first = row['First Name'] || row['First'] || '';
      const last  = row['Last Name']  || row['Last']  || '';
      const name  = `${first} ${last}`.trim();
      const barcodeValue = `TECH-${String(techId).padStart(4, '0')}`;

      await prisma.technician.upsert({
        where:  { techId },
        update: { name, barcodeValue },
        create: { techId, name, barcodeValue }
      });
    }
  }

  // 2) Insert check-ins
  const fitWb = XLSX.readFile(fitPath);
  const fitSheet = fitWb.Sheets[fitWb.SheetNames[0]];
  const fitRows  = XLSX.utils.sheet_to_json(fitSheet, { defval: null });

  for (const row of fitRows) {
    const idRaw     = row['Cintas ID']     ?? row['Tech #'] ?? row['tech_id'];
    const uniform   = row['Uniform Set']   || row['Pants']  || row['Shirt'] || 'Unknown';
    const dateRaw   = row['Date']          || row['Fit Date']  || row['Date Fitted'];
    if (!idRaw) continue;

    const techId = Number(idRaw);
    const tech   = await prisma.technician.findUnique({ where: { techId } });
    if (!tech) {
      console.warn(`⚠️  No technician found for techId ${techId}, skipping check-in.`);
      continue;
    }

    const createdAt = dateRaw ? new Date(dateRaw) : new Date();
    await prisma.checkIn.create({
      data: {
        technicianId: tech.id,
        uniformSet:   uniform,
        createdAt
      }
    });
  }

  console.log('✅ Seed complete');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
