import { Router, Response } from "express";
import { authenticateToken, authorize } from "@/lib/middleware";
import { AuthenticatedRequest } from "@/types/authenticated-request";
import { db } from "@/db/db";
import { UsersController } from "@/controllers/users";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/v1/users
 * Get all users with optional pagination, search, and filters
 * Access: Platform Admin, School Admin
 */
router.get(
  "/",
  authorize("platform_admin", "school_admin"),
  async (req: AuthenticatedRequest, res: Response) => {
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

      // Filter by school
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
          include: {
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
    } catch (error: any) {
      console.error("Get users error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch users",
      });
    }
  }
);

/**
 * GET /api/v1/users/:id
 * Get a single user by ID
 * Access: Platform Admin, School Admin
 */
router.get(
  "/:id",
  authorize("platform_admin", "school_admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    return UsersController.findOne(req, res);
  }
);

/**
 * POST /api/v1/users
 * Create a new user
 * Access: Platform Admin, School Admin
 */
router.post(
  "/",
  authorize("platform_admin", "school_admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    return UsersController.create(req, res);
  }
);

/**
 * PUT /api/v1/users/:id
 * Update a user
 * Access: Platform Admin, School Admin
 */
router.put(
  "/:id",
  authorize("platform_admin", "school_admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    return UsersController.update(req, res);
  }
);

/**
 * PATCH /api/v1/users/:id/deactivate
 * Soft-delete / deactivate a user
 * Access: Platform Admin, School Admin
 */
router.patch(
  "/:id/deactivate",
  authorize("platform_admin", "school_admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    return UsersController.deactivate(req, res);
  }
);

/**
 * POST /api/v1/users/:id/assign-role
 * Assign role to a user
 * Access: Platform Admin, School Admin
 */
router.post(
  "/:id/assign-role",
  authorize("platform_admin", "school_admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    return UsersController.assignRole(req, res);
  }
);

/**
 * DELETE /api/v1/users/:id/remove-role/:userRoleId
 * Remove role from a user
 * Access: Platform Admin, School Admin
 */
router.delete(
  "/:id/remove-role/:userRoleId",
  authorize("platform_admin", "school_admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    return UsersController.removeRole(req, res);
  }
);

export default router;
