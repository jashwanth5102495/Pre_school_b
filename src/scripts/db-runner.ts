import embeddedPostgres from 'embedded-postgres';
import path from 'path';
import net from 'net';
import fs from 'fs';

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

export async function ensurePostgresRunning() {
  const port = parseInt(process.env.EMBEDDED_POSTGRES_PORT || '5433', 10);
  const inUse = await isPortInUse(port);
  if (inUse) {
    console.log(`[Database] PostgreSQL is already active on port ${port}.`);
    return;
  }

  console.log(`[Database] Starting embedded PostgreSQL on port ${port}...`);
  const dataDir = path.resolve(__dirname, '../../.embedded-pg-data');
  const pg = new embeddedPostgres({
    databaseDir: dataDir,
    port,
    user: 'postgres',
    password: 'postgrespassword',
    persistent: true,
  });

  const isInit = fs.existsSync(path.join(dataDir, 'PG_VERSION'));
  const pidFile = path.join(dataDir, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
    } catch (e) {}
  }

  if (!isInit) {
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase('school_saas_db');
  } catch (e) {
    // Database may already exist in persistent directory
  }
  console.log(`[Database] Embedded PostgreSQL running and ready on port ${port}.`);
}

if (require.main === module) {
  ensurePostgresRunning().catch((err) => {
    console.error('[Database] Failed to start PostgreSQL:', err);
    process.exit(1);
  });
}
