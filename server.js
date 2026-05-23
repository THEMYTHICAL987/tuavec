const fs = require('fs');
const path = require('path');

require('dotenv').config();

const entryCandidates = [
  path.join(__dirname, 'tuavec-complete-final', 'backend', 'server.js'),
  path.join(__dirname, 'backend', 'server.js'),
  path.join(__dirname, 'server.js')
];

const entryPoint = entryCandidates.find(candidate => fs.existsSync(candidate));

if (!entryPoint) {
  const lookedAt = entryCandidates.map(p => path.relative(__dirname, p)).join(', ');
  throw new Error(`Cannot find backend server entrypoint. Tried: ${lookedAt}`);
}

require(entryPoint);
