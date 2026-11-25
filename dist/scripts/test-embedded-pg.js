"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const embedded_postgres_1 = __importDefault(require("embedded-postgres"));
const path_1 = __importDefault(require("path"));
async function main() {
    console.log('Testing embedded-postgres initialization...');
    const dataDir = path_1.default.resolve(__dirname, '../../.embedded-pg-data');
    const pg = new embedded_postgres_1.default({
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
    }
    catch (err) {
        console.error('Error starting embedded postgres:', err);
    }
}
main();
