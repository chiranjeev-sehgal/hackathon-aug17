'use strict';

const { clearAll, ensureDataDir, listCollections, collectionPath } = require('../src/db/jsonDb');
const { seedUsers } = require('../src/store');

async function main() {
  ensureDataDir();
  clearAll();
  await seedUsers();

  console.log('Cleared JSON database collections:');
  for (const name of listCollections()) {
    console.log(`  - ${collectionPath(name)}`);
  }
  console.log('Seed users restored (admin, emp, guest).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
