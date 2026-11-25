"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUniqueSchoolId = generateUniqueSchoolId;
const database_1 = require("../config/database");
async function generateUniqueSchoolId() {
    const currentYear = new Date().getFullYear();
    const prefix = `SCH-${currentYear}-`;
    const lastSchool = await database_1.prisma.school.findFirst({
        where: {
            schoolId: {
                startsWith: prefix,
            },
        },
        orderBy: {
            schoolId: 'desc',
        },
        select: {
            schoolId: true,
        },
    });
    if (!lastSchool) {
        return `${prefix}0001`;
    }
    const parts = lastSchool.schoolId.split('-');
    const lastNumber = parseInt(parts[2], 10);
    const nextNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}
