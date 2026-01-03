import { Router } from "express";

import { Response } from "express";
import { db } from "@/db/db";
import { authenticateToken, authorize } from "@/lib/middleware";


const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users (with pagination and filters)
 * @access  Private (Admin)
 */
router.get(
  "/",
  authorize("platform_admin", "school_admin"),
  async (req: any, res: Response) => {
    try {
      const { page = 1, limit = 20, status, search, schoolId } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (search) {
        where.OR = [
          { firstName: { contains: search as string, mode: "insensitive" } },
          { lastName: { contains: search as string, mode: "insensitive" } },
          { email: { contains: search as string, mode: "insensitive" } },
          { phone: { contains: search as string } },
        ];
      }

      // Filter by school if provided
      if (schoolId) {
        where.userRoles = {
          some: { schoolId: schoolId as string },
        };
      }

      const [users, total] = await Promise.all([
        db.user.findMany({
          where,
          skip,
          take: Number(limit),
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            imageUrl: true,
            status: true,
            isVerified: true,
            createdAt: true,
            userRoles: {
              include: {
                role: { select: { name: true, slug: true } },
                school: { select: { name: true, code: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        db.user.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          users,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      console.error("Get users error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch users",
      });
    }
  }
);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin)
 */
router.get(
  "/:id",
  authorize("platform_admin", "school_admin"),
  async (req: any, res: Response) => {
    try {
      const { id } = req.params;

      const user = await db.user.findUnique({
        where: { id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          imageUrl: true,
          status: true,
          isVerified: true,
          createdAt: true,
          lastLoginAt: true,
          userRoles: {
            include: {
              role: { select: { id: true, name: true, slug: true, permissions: true } },
              school: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error("Get user error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch user",
      });
    }
  }
);

/**
 * @route   POST /api/v1/users/:id/assign-role
 * @desc    Assign role to user
 * @access  Private (Platform Admin, School Admin)
 */
router.post(
  "/:id/assign-role",
  authorize("platform_admin", "school_admin"),
  async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { roleId, schoolId } = req.body;

      if (!roleId) {
        return res.status(400).json({
          success: false,
          error: "Role ID is required",
        });
      }

      // Check if user exists
      const user = await db.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Check if role exists
      const role = await db.role.findUnique({ where: { id: roleId } });
      if (!role) {
        return res.status(404).json({
          success: false,
          error: "Role not found",
        });
      }

      // Check if assignment already exists
      const existing = await db.userRole.findFirst({
        where: { userId: id, roleId, schoolId: schoolId || null },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: "User already has this role",
        });
      }

      // Create assignment
      const userRole = await db.userRole.create({
        data: {
          userId: id,
          roleId,
          schoolId: schoolId || null,
          assignedBy: req.user?.userId,
        },
        include: {
          role: { select: { name: true, slug: true } },
          school: { select: { name: true } },
        },
      });

      await db.activityLog.create({
        data: {
          userId: req.user?.userId,
          action: "ROLE_ASSIGNED",
          module: "users",
          entityType: "UserRole",
          entityId: userRole.id,
          description: `Assigned ${role.name} to ${user.email}`,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Role assigned successfully",
        data: userRole,
      });
    } catch (error) {
      console.error("Assign role error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to assign role",
      });
    }
  }
);

/**
 * @route   DELETE /api/v1/users/:id/remove-role/:userRoleId
 * @desc    Remove role from user
 * @access  Private (Platform Admin, School Admin)
 */
router.delete(
  "/:id/remove-role/:userRoleId",
  authorize("platform_admin", "school_admin"),
  async (req: any, res: Response) => {
    try {
      const { id, userRoleId } = req.params;

      const userRole = await db.userRole.findFirst({
        where: { id: userRoleId, userId: id },
        include: {
          role: { select: { name: true } },
          user: { select: { email: true } },
        },
      });

      if (!userRole) {
        return res.status(404).json({
          success: false,
          error: "User role not found",
        });
      }

      await db.userRole.delete({ where: { id: userRoleId } });

      await db.activityLog.create({
        data: {
          userId: req.user?.userId,
          action: "ROLE_REMOVED",
          module: "users",
          entityType: "UserRole",
          entityId: userRoleId,
          description: `Removed ${userRole.role.name} from ${userRole.user.email}`,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Role removed successfully",
      });
    } catch (error) {
      console.error("Remove role error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to remove role",
      });
    }
  }
);

export default router;