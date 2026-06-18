const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const envPath = path.resolve(__dirname, '../.env');
  console.log('Reading .env from:', envPath);
  
  if (!fs.existsSync(envPath)) {
    console.error('.env file not found!');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const dbUrlLine = envContent.split('\n').find(line => line.startsWith('DATABASE_URL='));
  if (!dbUrlLine) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
  }
  
  const dbUrl = dbUrlLine.split('DATABASE_URL=')[1].replace(/"/g, '').trim();
  console.log('Database URL:', dbUrl);
  
  // Parse mysql URL
  const matches = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!matches) {
    console.error('Could not parse DATABASE_URL');
    process.exit(1);
  }
  
  const [_, user, password, host, port, database] = matches;
  
  console.log(`Connecting to database: ${database} on ${host}:${port}...`);
  const connection = await mysql.createConnection({
    host,
    port: parseInt(port, 10),
    user,
    password,
    database,
    multipleStatements: true
  });
  
  console.log('Truncating existing category and attribute tables...');
  await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
  await connection.query('TRUNCATE TABLE category_attributes;');
  await connection.query('TRUNCATE TABLE attribute_options;');
  await connection.query('TRUNCATE TABLE attributes;');
  await connection.query('TRUNCATE TABLE categories;');
  await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
  
  const sqlPath = path.resolve(__dirname, '../prisma/data/masters.sql');
  console.log('Reading SQL file from:', sqlPath);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('Executing SQL statements (this might take a few seconds)...');
  await connection.query(sql);
  
  console.log('✓ SQL statements executed successfully!');
  await connection.end();
}

run().catch(err => {
  console.error('Error executing seed:', err);
  process.exit(1);
});
