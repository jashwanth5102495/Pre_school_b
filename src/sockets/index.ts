import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { env } from '../config/env';

let io: SocketIOServer | null = null;

export function initializeSockets(server: HttpServer) {
  const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());

  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      credentials: true,
    },
  });

  // Socket Authentication Middleware
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication token required for Socket connection'));
    }

    try {
      const decoded = verifyAccessToken(token);
      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid or expired socket authentication token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`[Socket] Client connected: ${user.email} (${user.role})`);

    // Role-based room authorization
    if (user.userType === 'PLATFORM') {
      // Super Admin joins global platform room
      socket.join('room:platform_super_admin');
      console.log(`[Socket] User ${user.email} joined room:platform_super_admin`);
    } else if (user.userType === 'SCHOOL' && user.schoolId) {
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

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO is not initialized yet');
  }
  return io;
}

// Broadcast helpers
export function broadcastToSuperAdmins(event: string, payload: any) {
  if (io) {
    io.to('room:platform_super_admin').emit(event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }
}

export function broadcastToTenant(schoolId: string, event: string, payload: any) {
  if (io) {
    io.to(`room:tenant:${schoolId}`).emit(event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }
}

export function broadcastToAll(event: string, payload: any) {
  if (io) {
    io.emit(event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }
}
