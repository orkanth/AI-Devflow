
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const files = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'dist', '.env'),
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log({ file, exists: false });
    continue;
  }

  const config = dotenv.parse(fs.readFileSync(file));

  console.log({
    file,
    exists: true,
    hasDB_PASSWORD: Object.hasOwn(config, 'DB_PASSWORD'),
    passwordMatchesDevflow: config.DB_PASSWORD === 'devflow',
  });
}
