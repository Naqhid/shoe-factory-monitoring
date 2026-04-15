const fs = require('fs');

let content = fs.readFileSync('backend/src/controllers/productionRoutingController.js', 'utf8');

// Remove the validateHeader method (from '  validateHeader(header) {' to the closing '}')
const validateHeaderPattern = /  validateHeader\(header\) \{[\s\S]*?return null;\r?\n  \}\r?\n/;
content = content.replace(validateHeaderPattern, '');

// Remove the calls to validateHeader and their error handling
const callPattern = /      const headerError = this\.validateHeader\(header\);\r?\n      if \(headerError\) \{\r?\n        await connection\.rollback\(\);\r?\n        return res\.status\(400\)\.json\(\{ success: false, error: headerError \}\);\r?\n      \}\r?\n/g;
content = content.replace(callPattern, '');

fs.writeFileSync('backend/src/controllers/productionRoutingController.js', content);
console.log('Done!');