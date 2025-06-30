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

  console.log(`📖 Reading tech list from: ${techFileName}`);
  console.log(`📖 Reading fittings from: ${fitFileName}`);

  // 1) Upsert technicians
  const techWb = XLSX.readFile(techPath);
  console.log(`📋 Found sheets: ${techWb.SheetNames.join(', ')}`);
  
  let totalTechs = 0;
  
  for (const sheetName of techWb.SheetNames) {
    console.log(`\n🔄 Processing sheet: ${sheetName}`);
    const sheet = techWb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    
    if (rows.length === 0) {
      console.log(`⚠️  Sheet ${sheetName} is empty, skipping`);
      continue;
    }

    // Debug: Show first row to understand structure
    console.log('🔍 First row structure:', Object.keys(rows[0]));
    console.log('🔍 First row data:', rows[0]);
    
    // Skip the header row (first row contains labels like "Tech #", "First Name", etc.)
    const dataRows = rows.slice(1);
    console.log(`📊 Processing ${dataRows.length} data rows`);
    
    for (const row of dataRows) {
      try {
        // Try multiple possible column names for tech ID
        const techIdRaw = row[Object.keys(row)[0]] || // First column (usually contains tech #)
                          row['Tech #'] || 
                          row['Tech'] || 
                          row['tech_id'] ||
                          row['Wichita - Day Shift']; // Specific to your file structure
        
        if (!techIdRaw || techIdRaw === 'Tech #') continue; // Skip header rows and empty rows
        
        const techId = Number(techIdRaw);
        if (isNaN(techId)) {
          console.log(`⚠️  Invalid tech ID: ${techIdRaw}, skipping`);
          continue;
        }
        
        // Try multiple possible column names for first/last name
        const columnKeys = Object.keys(row);
        const firstName = row[columnKeys[1]] || row['First Name'] || row['First'] || '';
        const lastName = row[columnKeys[2]] || row['Last Name'] || row['Last'] || '';
        
        const name = `${firstName} ${lastName}`.trim();
        if (!name) {
          console.log(`⚠️  No name found for tech ID ${techId}, skipping`);
          continue;
        }
        
        const barcodeValue = `TECH-${String(techId).padStart(4, '0')}`;

        await prisma.technician.upsert({
          where: { techId },
          update: { name, barcodeValue },
          create: { techId, name, barcodeValue }
        });
        
        console.log(`✅ Processed tech ${techId}: ${name}`);
        totalTechs++;
        
      } catch (error) {
        console.error(`❌ Error processing row:`, row, error.message);
      }
    }
  }
  
  console.log(`\n🎉 Total technicians processed: ${totalTechs}`);

  // 2) Insert check-ins
  console.log('\n🔄 Processing check-ins...');
  try {
    const fitWb = XLSX.readFile(fitPath);
    console.log(`📋 Fitting sheets: ${fitWb.SheetNames.join(', ')}`);
    
    const fitSheet = fitWb.Sheets[fitWb.SheetNames[0]];
    const fitRows = XLSX.utils.sheet_to_json(fitSheet, { defval: null });
    
    if (fitRows.length === 0) {
      console.log('⚠️  No fitting data found');
      return;
    }
    
    console.log('🔍 Fitting file structure:', Object.keys(fitRows[0]));
    console.log('🔍 First fitting row:', fitRows[0]);
    
    // Skip header row if needed
    const fittingDataRows = fitRows[0]['Cintas ID'] ? fitRows : fitRows.slice(1);
    console.log(`📊 Processing ${fittingDataRows.length} fitting records`);
    
    let totalCheckIns = 0;
    
    for (const row of fittingDataRows) {
      try {
        const columnKeys = Object.keys(row);
        const idRaw = row['Cintas ID'] || 
                     row['Tech #'] || 
                     row['tech_id'] ||
                     row[columnKeys[0]]; // First column
        
        const uniform = row['Uniform Set'] || 
                       row['Pants'] || 
                       row['Shirt'] || 
                       row[columnKeys.find(key => key.toLowerCase().includes('uniform'))] ||
                       'Unknown';
        
        const dateRaw = row['Date'] || 
                       row['Fit Date'] || 
                       row['Date Fitted'] ||
                       row[columnKeys.find(key => key.toLowerCase().includes('date'))];
        
        if (!idRaw) {
          console.log('⚠️  No tech ID found in row, skipping');
          continue;
        }

        const techId = Number(idRaw);
        if (isNaN(techId)) {
          console.log(`⚠️  Invalid tech ID: ${idRaw}, skipping`);
          continue;
        }
        
        const tech = await prisma.technician.findUnique({ where: { techId } });
        if (!tech) {
          console.warn(`⚠️  No technician found for techId ${techId}, skipping check-in.`);
          continue;
        }

        const createdAt = dateRaw ? new Date(dateRaw) : new Date();
        
        // Validate date
        if (isNaN(createdAt.getTime())) {
          console.log(`⚠️  Invalid date: ${dateRaw}, using current date`);
          createdAt = new Date();
        }
        
        await prisma.checkIn.create({
          data: {
            technicianId: tech.id,
            uniformSet: uniform,
            createdAt
          }
        });
        
        console.log(`✅ Check-in recorded for tech ${techId}: ${uniform}`);
        totalCheckIns++;
        
      } catch (error) {
        console.error(`❌ Error processing check-in:`, row, error.message);
      }
    }
    
    console.log(`\n🎉 Total check-ins processed: ${totalCheckIns}`);
    
  } catch (error) {
    console.error('❌ Error processing check-ins:', error.message);
  }

  console.log('\n✅ Seed complete');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});