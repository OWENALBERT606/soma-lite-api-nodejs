import { Router, Request, Response } from "express";
import { authenticateToken, authorize } from "@/lib/middleware";
import { RolesController } from "@/controllers/roles";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/v1/roles
 * @desc    Create a new role
 * @access  Private (Platform Admin, School Admin)
 */
router.post(
  "/",
  authorize("platform_admin", "school_admin"),
  async (req: Request, res: Response) => {
    await RolesController.create(req, res);
  }
);

/**
 * @route   GET /api/v1/roles
 * @desc    Get all roles (optionally by school)
 * @access  Private (Platform Admin, School Admin)
 */
router.get(
  "/",
  authorize("platform_admin", "school_admin"),
  async (req: Request, res: Response) => {
    await RolesController.findAll(req, res);
  }
);

/**
 * @route   GET /api/v1/roles/:id
 * @desc    Get a single role by ID
 * @access  Private (Platform Admin, School Admin)
 */
router.get(
  "/:id",
  authorize("platform_admin", "school_admin"),
  async (req: Request, res: Response) => {
    await RolesController.findOne(req, res);
  }
);

/**
 * @route   PUT /api/v1/roles/:id
 * @desc    Update a role (name, description, permissions)
 * @access  Private (Platform Admin, School Admin)
 */
router.put(
  "/:id",
  authorize("platform_admin", "school_admin"),
  async (req: Request, res: Response) => {
    await RolesController.update(req, res);
  }
);

/**
 * @route   DELETE /api/v1/roles/:id
 * @desc    Delete a role (cannot delete system roles or roles assigned to users)
 * @access  Private (Platform Admin, School Admin)
 */
router.delete(
  "/:id",
  authorize("platform_admin", "school_admin"),
  async (req: Request, res: Response) => {
    await RolesController.delete(req, res);
  }
);

export default router;
