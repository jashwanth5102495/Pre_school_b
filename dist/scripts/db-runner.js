"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensurePostgresRunning = ensurePostgresRunning;
const embedded_postgres_1 = __importDefault(require("embedded-postgres"));
const path_1 = __importDefault(require("path"));
const net_1 = __importDefault(require("net"));
function isPortInUse(port) {
    return new Promise((resolve) => {
        const server = net_1.default.createServer();
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(true);
            }
            else {
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
async function ensurePostgresRunning() {
    const port = parseInt(process.env.EMBEDDED_POSTGRES_PORT || '5433', 10);
    const inUse = await isPortInUse(port);
    if (inUse) {
        console.log(`[Database] PostgreSQL is already active on port ${port}.`);
        return;
    }
    console.log(`[Database] Starting embedded PostgreSQL on port ${port}...`);
    const dataDir = path_1.default.resolve(__dirname, '../../.embedded-pg-data');
    const pg = new embedded_postgres_1.default({
        databaseDir: dataDir,
        port,
        user: 'postgres',
        password: 'postgrespassword',
        persistent: true,
    });
    await pg.initialise();
    await pg.start();
    try {
        await pg.createDatabase('school_saas_db');
    }
    catch (e) {
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
