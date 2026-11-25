"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const sockets_1 = require("./sockets");
const db_starter_1 = require("./config/db-starter");
const database_1 = require("./config/database");
async function bootstrap() {
    try {
        // 1. Ensure database is running
        await (0, db_starter_1.ensurePostgresRunning)();
        // 2. Test database connection
        await database_1.prisma.$connect();
        console.log('[Server] Successfully connected to PostgreSQL database.');
        // 3. Create HTTP Server & initialize Sockets
        const server = http_1.default.createServer(app_1.default);
        (0, sockets_1.initializeSockets)(server);
        const PORT = env_1.env.PORT || 5000;
        server.listen(PORT, () => {
            console.log(`=======================================================`);
            console.log(`🚀 Multi-Tenant School SaaS Backend running on port ${PORT}`);
            console.log(`📡 Health Check: http://localhost:${PORT}/api/v1/health`);
            console.log(`📖 API Docs:     http://localhost:${PORT}/api-docs`);
            console.log(`⚡ Environment:  ${env_1.env.NODE_ENV}`);
            console.log(`=======================================================`);
        });
        // Graceful Shutdown
        const shutdown = async (signal) => {
            console.log(`[Server] Received ${signal}. Gracefully terminating server...`);
            server.close(async () => {
                console.log('[Server] HTTP connections closed.');
                await database_1.prisma.$disconnect();
                console.log('[Server] Database pool disconnected.');
                process.exit(0);
            });
            setTimeout(() => {
                console.error('[Server] Forced shutdown after timeout.');
                process.exit(1);
            }, 10000);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
    catch (error) {
        console.error('[Server] Critical failure during bootstrap:', error);
        process.exit(1);
    }
}
bootstrap();
