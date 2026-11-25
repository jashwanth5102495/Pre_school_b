"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensurePostgresRunning = ensurePostgresRunning;
const path_1 = __importDefault(require("path"));
const net_1 = __importDefault(require("net"));
const fs_1 = __importDefault(require("fs"));
function checkConnection(port, host = '127.0.0.1') {
    return new Promise((resolve) => {
        const socket = new net_1.default.Socket();
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
async function ensurePostgresRunning() {
    const port = parseInt(process.env.EMBEDDED_POSTGRES_PORT || '5433', 10);
    const isOnline = await checkConnection(port);
    if (isOnline) {
        console.log(`[Database] PostgreSQL is active and accepting connections on port ${port}.`);
        return;
    }
    console.log(`[Database] Starting embedded PostgreSQL on port ${port}...`);
    try {
        const dataDir = path_1.default.resolve(__dirname, '../../.embedded-pg-data');
        const pidFile = path_1.default.join(dataDir, 'postmaster.pid');
        if (fs_1.default.existsSync(pidFile)) {
            console.log(`[Database] Removing stale postmaster.pid from previous shutdown...`);
            try {
                fs_1.default.unlinkSync(pidFile);
            }
            catch (e) { }
        }
        const embeddedPostgresModule = await eval('import("embedded-postgres")');
        const EmbeddedPostgres = embeddedPostgresModule.default || embeddedPostgresModule;
        const isInit = fs_1.default.existsSync(path_1.default.join(dataDir, 'PG_VERSION'));
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
        }
        catch (e) { }
        console.log(`[Database] Embedded PostgreSQL running and ready on port ${port}.`);
    }
    catch (error) {
        console.warn(`[Database] Note: Could not auto-launch embedded postgres:`, error);
    }
}
