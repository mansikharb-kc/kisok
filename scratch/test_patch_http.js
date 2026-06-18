const http = require('http');

// 1. We will sign a JWT token for pihu@gmail.com (ONB_LEAD)
// Since we don't want to run Next.js server verification locally, we can sign a valid session cookie.
// Wait! Let's check how the AUTH_SECRET is defined. It is in .env file.
// Let's read .env file to get the AUTH_SECRET, or we can just import from auth.ts!
// Wait, we can write a script using next/dist or we can just run a script that imports `signSession` and makes the request!
// Even simpler, we can write a script that does it inside the Next.js context or run it as a JS script that imports tsx.

const { jose } = require('jose');
const dotenv = require('dotenv');
const fs = require('fs');

if (fs.existsSync('.env')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

async function testHttp() {
  const { signSession } = require('../src/lib/auth');
  const token = await signSession({
    uid: '3', // Pihu Nair ID
    email: 'pihu@gmail.com',
    name: 'Pihu Nair',
    roles: [
      {
        roleId: '3',
        code: 'ONB_LEAD',
        branchId: '1' // KC Bangalore
      }
    ]
  });

  const payload = {
    name: 'Asian Paints Ltd Modified',
    sellerCode: 'SLR-AP-BLR',
    membershipId: 'MEM-1002',
    status: 'active',
    memberType: 'Paid',
    salesperson: 'Test Salesperson',
    spocName: 'Test SPOC',
    spocPhone: '9876543210',
    spocEmail: 'test@gmail.com',
    customFields: {},
    brandIds: [2],
    categoryIds: [2, 3],
    contracts: [
      {
        programId: '2',
        collaborationTenure: '1 Year',
        fitoutPeriod: '15 Days',
        contractStart: '2024-03-01',
        contractEnd: '2025-02-28',
        verified: true,
        remarks: 'Test remarks',
        obExecUserId: '5',
        contractMediaId: null,
        customFields: {}
      }
    ]
  };

  const bodyData = JSON.stringify(payload);

  const req = http.request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/sellers/2',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `kc_session=${token}`,
        'Content-Length': Buffer.byteLength(bodyData)
      }
    },
    (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        console.log('HEADERS:', res.headers);
        console.log('RESPONSE:', data);
        process.exit(0);
      });
    }
  );

  req.on('error', (e) => {
    console.error('ERROR:', e);
    process.exit(1);
  });

  req.write(bodyData);
  req.end();
}

testHttp().catch(console.error);
