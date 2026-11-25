"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSockets = initializeSockets;
exports.getIO = getIO;
exports.broadcastToSuperAdmins = broadcastToSuperAdmins;
exports.broadcastToTenant = broadcastToTenant;
exports.broadcastToAll = broadcastToAll;
const socket_io_1 = require("socket.io");
const jwt_1 = require("../utils/jwt");
const env_1 = require("../config/env");
let io = null;
function initializeSockets(server) {
    const allowedOrigins = env_1.env.CORS_ORIGINS.split(',').map((o) => o.trim());
    io = new socket_io_1.Server(server, {
        cors: {
            origin: allowedOrigins,
            credentials: true,
        },
    });
    // Socket Authentication Middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.split(' ')[1];
        if (!token) {
            return next(new Error('Authentication token required for Socket connection'));
        }
        try {
            const decoded = (0, jwt_1.verifyAccessToken)(token);
            socket.user = decoded;
            next();
        }
        catch (err) {
            next(new Error('Invalid or expired socket authentication token'));
        }
    });
    io.on('connection', (socket) => {
        const user = socket.user;
        console.log(`[Socket] Client connected: ${user.email} (${user.role})`);
        // Role-based room authorization
        if (user.userType === 'PLATFORM') {
            // Super Admin joins global platform room
            socket.join('room:platform_super_admin');
            console.log(`[Socket] User ${user.email} joined room:platform_super_admin`);
        }
        else if (user.userType === 'SCHOOL' && user.schoolId) {
            // School user joins strictly their tenant room
            const tenantRoom = `room:tenant:${user.schoolId}`;
            const roleRoom = `room:tenant:${user.schoolId}:${user.role}`;
            socket.join(tenantRoom);
            socket.join(roleRoom);
            console.log(`[Socket] User ${user.email} joined ${tenantRoom}`);
        }
        socket.on('disconnect', () => {
            console.log(`[Socket] Client disconnected: ${user.email}`);
        });
    });
    return io;
}
function getIO() {
    if (!io) {
        throw new Error('Socket.IO is not initialized yet');
    }
    return io;
}
// Broadcast helpers
function broadcastToSuperAdmins(event, payload) {
    if (io) {
        io.to('room:platform_super_admin').emit(event, {
            ...payload,
            timestamp: new Date().toISOString(),
        });
    }
}
function broadcastToTenant(schoolId, event, payload) {
    if (io) {
        io.to(`room:tenant:${schoolId}`).emit(event, {
            ...payload,
            timestamp: new Date().toISOString(),
        });
    }
}
function broadcastToAll(event, payload) {
    if (io) {
        io.emit(event, {
            ...payload,
            timestamp: new Date().toISOString(),
        });
    }
}
