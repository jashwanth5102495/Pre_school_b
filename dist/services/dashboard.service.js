"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardService = exports.DashboardService = void 0;
const database_1 = require("../config/database");
const client_1 = require("@prisma/client");
class DashboardService {
    async getMetrics() {
        const [totalSchools, activeSchools, inactiveSchools, suspendedSchools, totalStudents, totalTeachers, activeSubscriptions, expiredSubscriptions, completedPayments, activeSubsWithPlans,] = await Promise.all([
            database_1.prisma.school.count(),
            database_1.prisma.school.count({ where: { status: client_1.SchoolStatus.ACTIVE } }),
            database_1.prisma.school.count({ where: { status: client_1.SchoolStatus.INACTIVE } }),
            database_1.prisma.school.count({ where: { status: client_1.SchoolStatus.SUSPENDED } }),
            database_1.prisma.student.count(),
            database_1.prisma.teacher.count(),
            database_1.prisma.subscription.count({ where: { status: client_1.SubscriptionStatus.ACTIVE } }),
            database_1.prisma.subscription.count({ where: { status: client_1.SubscriptionStatus.EXPIRED } }),
            database_1.prisma.payment.aggregate({
                where: { status: client_1.PaymentStatus.COMPLETED },
                _sum: { amount: true },
            }),
            database_1.prisma.subscription.findMany({
                where: { status: client_1.SubscriptionStatus.ACTIVE },
                include: { plan: true },
            }),
        ]);
        // Calculate MRR accurately:
        // Monthly plan: monthlyPrice
        // Quarterly plan: quarterlyPrice / 3
        // Annual plan: annualPrice / 12
        let mrr = 0;
        for (const sub of activeSubsWithPlans) {
            if (sub.billingCycle === 'MONTHLY') {
                mrr += sub.plan.monthlyPrice;
            }
            else if (sub.billingCycle === 'QUARTERLY') {
                mrr += sub.plan.quarterlyPrice / 3;
            }
            else if (sub.billingCycle === 'ANNUAL') {
                mrr += sub.plan.annualPrice / 12;
            }
        }
        const totalRevenue = completedPayments._sum.amount || 0;
        // Recent Schools
        const recentSchools = await database_1.prisma.school.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                profile: true,
                subscription: {
                    include: { plan: true },
                },
            },
        });
        // Recent Payments
        const recentPayments = await database_1.prisma.payment.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                school: { select: { id: true, name: true, schoolId: true } },
            },
        });
        // Upcoming Expirations (Next 30 days)
        const thirtyDaysAhead = new Date();
        thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
        const upcomingExpirations = await database_1.prisma.subscription.findMany({
            where: {
                status: client_1.SubscriptionStatus.ACTIVE,
                endDate: {
                    lte: thirtyDaysAhead,
                    gte: new Date(),
                },
            },
            take: 5,
            orderBy: { endDate: 'asc' },
            include: {
                school: { select: { id: true, name: true, schoolId: true } },
                plan: true,
            },
        });
        // Recent Audit Activities
        const recentActivities = await database_1.prisma.auditLog.findMany({
            take: 8,
            orderBy: { createdAt: 'desc' },
        });
        // Plan Distribution
        const planCounts = await database_1.prisma.subscription.groupBy({
            by: ['planId'],
            _count: { id: true },
        });
        const plans = await database_1.prisma.subscriptionPlan.findMany({
            where: { id: { in: planCounts.map((pc) => pc.planId) } },
            select: { id: true, name: true },
        });
        const planDistribution = planCounts.map((pc) => {
            const match = plans.find((p) => p.id === pc.planId);
            return {
                planName: match?.name || 'Unknown Plan',
                count: pc._count.id,
            };
        });
        return {
            kpis: {
                totalSchools,
                activeSchools,
                inactiveSchools,
                suspendedSchools,
                totalStudents,
                totalTeachers,
                activeSubscriptions,
                expiredSubscriptions,
                monthlyRecurringRevenue: Math.round(mrr),
                totalRevenue: Math.round(totalRevenue),
            },
            recentSchools,
            recentPayments,
            upcomingExpirations,
            recentActivities,
            planDistribution,
        };
    }
    async getRevenueGrowthChart() {
        // Group completed payments by Month for the past 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        const payments = await database_1.prisma.payment.findMany({
            where: {
                status: client_1.PaymentStatus.COMPLETED,
                createdAt: { gte: sixMonthsAgo },
            },
            select: {
                amount: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        });
        const monthMap = new Map();
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
            monthMap.set(key, 0);
        }
        payments.forEach((p) => {
            const key = p.createdAt.toLocaleString('default', { month: 'short', year: 'numeric' });
            if (monthMap.has(key)) {
                monthMap.set(key, (monthMap.get(key) || 0) + p.amount);
            }
        });
        return Array.from(monthMap.entries()).map(([month, revenue]) => ({
            month,
            revenue: Math.round(revenue),
        }));
    }
    async getSchoolGrowthChart() {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        const schools = await database_1.prisma.school.findMany({
            where: { createdAt: { gte: sixMonthsAgo } },
            select: { createdAt: true, status: true },
            orderBy: { createdAt: 'asc' },
        });
        const monthMap = new Map();
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.toLocaleString('default', { month: 'short' });
            monthMap.set(key, { total: 0, active: 0 });
        }
        schools.forEach((s) => {
            const key = s.createdAt.toLocaleString('default', { month: 'short' });
            if (monthMap.has(key)) {
                const item = monthMap.get(key);
                item.total += 1;
                if (s.status === client_1.SchoolStatus.ACTIVE) {
                    item.active += 1;
                }
            }
        });
        return Array.from(monthMap.entries()).map(([month, stats]) => ({
            month,
            total: stats.total,
            active: stats.active,
        }));
    }
}
exports.DashboardService = DashboardService;
exports.dashboardService = new DashboardService();
