import embeddedPostgres from 'embedded-postgres';
import path from 'path';
import fs from 'fs';

async function main() {
  const dataDir = path.resolve(__dirname, '../../.embedded-pg-data');
  const port = 5433;

  console.log(`[PG Runner] Initializing / Starting PostgreSQL on port ${port}...`);

  const pg = new embeddedPostgres({
    databaseDir: dataDir,
    port,
    user: 'postgres',
    password: 'postgrespassword',
    persistent: true,
  });

  const isInit = fs.existsSync(path.join(dataDir, 'PG_VERSION'));
  if (!isInit) {
    console.log('[PG Runner] Initializing new database cluster...');
    await pg.initialise();
  } else {
    // If postmaster.pid exists, remove stale pid before start
    const pidFile = path.join(dataDir, 'postmaster.pid');
    if (fs.existsSync(pidFile)) {
      try {
        fs.unlinkSync(pidFile);
      } catch (e) {}
    }
  }

  console.log('[PG Runner] Starting server...');
  await pg.start();

  try {
    await pg.createDatabase('school_saas_db');
    console.log('[PG Runner] Database school_saas_db verified.');
  } catch (e) {
    // Already created
  }

  console.log(`[PG Runner] PostgreSQL 18.6 successfully started on port ${port}!`);

  // Keep process alive so exit hooks don't stop it prematurely
  setInterval(() => {}, 1000 * 60 * 60);
}

main().catch((err) => {
  console.error('[PG Runner] Error:', err);
  process.exit(1);
});
