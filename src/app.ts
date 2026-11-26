import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import fs from 'fs';
import { env } from './config/env';
import { errorHandler } from './middlewares/error-handler';

// Route imports
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import schoolRoutes from './routes/school.routes';
import planRoutes from './routes/plan.routes';
import paymentRoutes from './routes/payment.routes';
import operationsRoutes from './routes/operations.routes';
import schoolAdminRoutes from './routes/school-admin.routes';
import headMasterRoutes from './routes/head-master.routes';
import officeAdminRoutes from './routes/office-admin.routes';
import teacherPortalRoutes from './routes/teacher-portal.routes';
import hierarchyRoutes from './routes/hierarchy.routes';

const app = express();

// Trust reverse proxy (Cloudflare, Railway, Render, Vercel, Docker, Nginx)
// Essential for rate-limiting, secure cookies, and accurate client IP logging
app.set('trust proxy', 1);

// Security Middlewares
app.use(helmet());
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all origins dynamically in deployment or development
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  })
);

// High-capacity Rate Limiter (5,000 requests per 15 minutes) to prevent accidental throttling during testing
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  skip: (req) => {
    // Never throttle health check or authentication endpoints
    return req.path.includes('/health') || req.path.includes('/auth/login') || req.path.includes('/auth/refresh');
  },
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again after 15 minutes',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Core Middlewares
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads fallback
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Frontend production static build resolution (supports Railway/Render single-service deployment)
const candidateDistPaths = [
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../../../frontend/dist'),
];
const resolvedFrontendDist = candidateDistPaths.find((p) => fs.existsSync(path.join(p, 'index.html')));

if (resolvedFrontendDist) {
  console.log(`[Static] Serving frontend production build from ${resolvedFrontendDist}`);
  app.use(express.static(resolvedFrontendDist));
}

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health Check
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  });
});

// Swagger / OpenAPI Specification
const swaggerDoc = {
  openapi: '3.0.0',
  info: {
    title: 'School Management Multi-Tenant SaaS API',
    version: '1.0.0',
    description: 'Enterprise REST APIs for Super Admin and School Management Portals',
  },
  servers: [{ url: '/api/v1' }],
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Mount Versioned API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/super-admin/dashboard', dashboardRoutes);
app.use('/api/v1/super-admin/schools', schoolRoutes);
app.use('/api/v1/super-admin', planRoutes);
app.use('/api/v1/super-admin/payments', paymentRoutes);
app.use('/api/v1/super-admin', operationsRoutes);

// Mount School Portals API Routes
app.use('/api/v1/school/admin', schoolAdminRoutes);
app.use('/api/v1/school/head-master', headMasterRoutes);
app.use('/api/v1/school/office', officeAdminRoutes);
app.use('/api/v1/school/teacher', teacherPortalRoutes);

// Mount Hierarchy Tree API Routes (Synchronized across all roles)
app.use('/api/v1/hierarchy', hierarchyRoutes);

// Centralized Error Handler
app.use(errorHandler);

// SPA catch-all fallback: Serve frontend index.html for any client-side route
if (resolvedFrontendDist) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/api-docs')) {
      return next();
    }
    res.sendFile(path.join(resolvedFrontendDist, 'index.html'));
  });
}

export default app;
