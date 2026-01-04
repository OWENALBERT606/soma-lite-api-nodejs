import { Router } from "express";
import { SchoolsController } from "@/controllers/schools";
import { authenticateToken, authorize } from "@/lib/middleware";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/v1/schools
 * @desc    Create a new school
 * @access  Private (Platform Admin)
 */
router.post("/", authorize("platform_admin"), SchoolsController.create);

/**
 * @route   GET /api/v1/schools
 * @desc    Get all schools
 * @access  Private (Platform Admin, School Admin)
 */
router.get("/", authorize("platform_admin", "school_admin"), SchoolsController.findAll);

/**
 * @route   GET /api/v1/schools/:id
 * @desc    Get a single school
 * @access  Private (Platform Admin, School Admin)
 */
router.get("/:id", authorize("platform_admin", "school_admin"), SchoolsController.findOne);

/**
 * @route   PATCH /api/v1/schools/:id
 * @desc    Update a school
 * @access  Private (Platform Admin, School Admin)
 */
router.patch("/:id", authorize("platform_admin", "school_admin"), SchoolsController.update);

/**
 * @route   PATCH /api/v1/schools/:id/deactivate
 * @desc    Deactivate a school
 * @access  Private (Platform Admin)
 */
router.patch("/:id/deactivate", authorize("platform_admin"), SchoolsController.deactivate);

export default router;
