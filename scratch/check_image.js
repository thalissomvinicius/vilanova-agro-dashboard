const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'logo.png');
const buffer = fs.readFileSync(filePath);

// PNG header has dimensions at bytes 16-24
const width = buffer.readUInt32BE(16);
const height = buffer.readUInt32BE(20);

console.log(`Dimensions: ${width}x${height}`);
