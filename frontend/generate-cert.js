import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔐 Generating self-signed SSL certificate...\n');

try {
  // Check if OpenSSL is available
  try {
    execSync('openssl version', { stdio: 'ignore' });
  } catch (e) {
    console.error('❌ OpenSSL not found. Please install OpenSSL:');
    console.error('   Download from: https://slproweb.com/products/Win32OpenSSL.html');
    console.error('   Or use Git Bash which includes OpenSSL');
    process.exit(1);
  }

  const certDir = path.join(__dirname, 'cert');
  
  // Create cert directory if it doesn't exist
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir);
  }

  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');

  // Generate private key and certificate
  const command = `openssl req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${certPath}" -days 365 -config "${path.join(__dirname, 'openssl.cnf')}"`;
  
  execSync(command, { stdio: 'inherit' });

  console.log('\n✅ Certificate generated successfully!');
  console.log(`📁 Certificate location: ${certDir}`);
  console.log('\n📱 Next steps:');
  console.log('1. Copy cert/cert.pem to mobile devices');
  console.log('2. Install certificate on each device:');
  console.log('   - Android: Settings → Security → Install from storage');
  console.log('   - iOS: AirDrop → Install Profile → Trust');
  console.log('3. Run: npm run dev');
  console.log('4. Access: https://192.168.1.11:3000\n');

} catch (error) {
  console.error('❌ Error generating certificate:', error.message);
  process.exit(1);
}
