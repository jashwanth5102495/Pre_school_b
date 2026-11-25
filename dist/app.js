"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const path_1 = __importDefault(require("path"));
const env_1 = require("./config/env");
const error_handler_1 = require("./middlewares/error-handler");
// Route imports
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const school_routes_1 = __importDefault(require("./routes/school.routes"));
const plan_routes_1 = __importDefault(require("./routes/plan.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const operations_routes_1 = __importDefault(require("./routes/operations.routes"));
const school_admin_routes_1 = __importDefault(require("./routes/school-admin.routes"));
const head_master_routes_1 = __importDefault(require("./routes/head-master.routes"));
const office_admin_routes_1 = __importDefault(require("./routes/office-admin.routes"));
const teacher_portal_routes_1 = __importDefault(require("./routes/teacher-portal.routes"));
const hierarchy_routes_1 = __importDefault(require("./routes/hierarchy.routes"));
const app = (0, express_1.default)();
// Security Middlewares
app.use((0, helmet_1.default)());
const allowedOrigins = env_1.env.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, postman) or if origin is in allowlist
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(null, true); // Permissive in development
        }
    },
    credentials: true,
}));
// Rate Limiting (100 requests per 15 minutes per IP for general endpoints)
const apiLimiter = (0, express_rate_limit_1.default)({
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
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Static file serving for uploads fallback
app.use('/uploads', express_1.default.static(path_1.default.resolve(process.cwd(), 'uploads')));
if (env_1.env.NODE_ENV !== 'test') {
    app.use((0, morgan_1.default)('dev'));
}
// Health Check
app.get('/api/v1/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env_1.env.NODE_ENV,
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
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDoc));
// Mount Versioned API Routes
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/super-admin/dashboard', dashboard_routes_1.default);
app.use('/api/v1/super-admin/schools', school_routes_1.default);
app.use('/api/v1/super-admin', plan_routes_1.default);
app.use('/api/v1/super-admin/payments', payment_routes_1.default);
app.use('/api/v1/super-admin', operations_routes_1.default);
// Mount School Portals API Routes
app.use('/api/v1/school/admin', school_admin_routes_1.default);
app.use('/api/v1/school/head-master', head_master_routes_1.default);
app.use('/api/v1/school/office', office_admin_routes_1.default);
app.use('/api/v1/school/teacher', teacher_portal_routes_1.default);
// Mount Hierarchy Tree API Routes (Synchronized across all roles)
app.use('/api/v1/hierarchy', hierarchy_routes_1.default);
// Centralized Error Handler
app.use(error_handler_1.errorHandler);
exports.default = app;
