const http = require('http');

const API = 'http://localhost:3000/api';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API);
    const data = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API);
    const req = http.request(url, {
      headers: { 'Authorization': `Bearer *** ` }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Login 
  const student = await post('/auth/login/password', { unifiedCode: '2025001', password: '123456+-' });
  const admin = await post('/auth/login/password', { unifiedCode: '0000000', password: 'admin123456+-' });
  
  const sToken = student.body.accessToken;
  const aToken = admin.body.accessToken;
  
  console.log('Student:', student.body.user.id, student.body.user.name);
  console.log('Admin:', admin.body.user.id, admin.body.user.name);
  
  // Get own certs
  const myCerts = await get('/certificates/my', sToken);
  console.log('\n=== MY CERTS (Student) ===');
  console.log(JSON.stringify(myCerts.body, null, 2).slice(0, 1000));
  
  const adminCerts = await get('/certificates/my', aToken);
  console.log('\n=== ADMIN CERTS ===');
  console.log(JSON.stringify(adminCerts.body, null, 2).slice(0, 1000));
  
  // ATTACK: Student tries to access admin's certificate preview
  const ac = Array.isArray(adminCerts.body) ? adminCerts.body : (adminCerts.body.data || adminCerts.body.items || []);
  if (ac.length > 0) {
    const certId = ac[0].id;
    console.log(`\n=== ATTACK: Student accessing admin cert ${certId} ===`);
    const hijack = await get(`/certificates/${certId}/preview`, sToken);
    console.log('Status:', hijack.status);
    if (typeof hijack.body === 'string') {
      console.log('Body (hex):', Buffer.from(hijack.body).toString('hex').slice(0, 100));
    } else {
      console.log('Body:', JSON.stringify(hijack.body).slice(0, 500));
    }
    
    // Try public verify
    const certNo = ac[0].certificateNo;
    if (certNo) {
      console.log(`\n=== PUBLIC VERIFY: ${certNo} ===`);
      const pub = await get(`/certificates/public/${certNo}`, sToken);
      console.log('Status:', pub.status);
      console.log(JSON.stringify(pub.body, null, 2).slice(0, 1000));
    }
  }
}

main().catch(console.error);
