import path from 'path';
import net from 'net';
import fs from 'fs';

function checkConnection(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

export async function ensurePostgresRunning() {
  const port = parseInt(process.env.EMBEDDED_POSTGRES_PORT || '5433', 10);
  const isOnline = await checkConnection(port);
  if (isOnline) {
    console.log(`[Database] PostgreSQL is active and accepting connections on port ${port}.`);
    return;
  }

  console.log(`[Database] Starting embedded PostgreSQL on port ${port}...`);
  try {
    const dataDir = path.resolve(__dirname, '../../.embedded-pg-data');
    const pidFile = path.join(dataDir, 'postmaster.pid');
    if (fs.existsSync(pidFile)) {
      console.log(`[Database] Removing stale postmaster.pid from previous shutdown...`);
      try {
        fs.unlinkSync(pidFile);
      } catch (e) {}
    }

    const embeddedPostgresModule = await (eval('import("embedded-postgres")') as Promise<any>);
    const EmbeddedPostgres = (embeddedPostgresModule as any).default || embeddedPostgresModule;

    const isInit = fs.existsSync(path.join(dataDir, 'PG_VERSION'));

    const pg = new EmbeddedPostgres({
      databaseDir: dataDir,
      port,
      user: 'postgres',
      password: 'postgrespassword',
      persistent: true,
    });

    if (!isInit) {
      await pg.initialise();
    }
    await pg.start();

    try {
      await pg.createDatabase('school_saas_db');
    } catch (e) {}

    console.log(`[Database] Embedded PostgreSQL running and ready on port ${port}.`);
  } catch (error) {
    console.warn(`[Database] Note: Could not auto-launch embedded postgres:`, error);
  }
}
