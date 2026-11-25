import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
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

// Security Middlewares
app.use(helmet());
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or if origin is in allowlist
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in development
      }
    },
    credentials: true,
  })
);

// Rate Limiting (100 requests per 15 minutes per IP for general endpoints)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
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

export default app;
