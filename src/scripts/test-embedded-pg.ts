import embeddedPostgres from 'embedded-postgres';
import path from 'path';

async function main() {
  console.log('Testing embedded-postgres initialization...');
  const dataDir = path.resolve(__dirname, '../../.embedded-pg-data');
  const pg = new embeddedPostgres({
    databaseDir: dataDir,
    port: 5433,
    user: 'postgres',
    password: 'postgrespassword',
    persistent: true,
  });

  try {
    console.log('Starting postgres on port 5433...');
    await pg.initialise();
    await pg.start();
    console.log('Postgres started successfully on port 5433!');
    await pg.createDatabase('school_saas_db');
    console.log('Database school_saas_db created!');
    // Keep it running or test query
  } catch (err) {
    console.error('Error starting embedded postgres:', err);
  }
}

main();
