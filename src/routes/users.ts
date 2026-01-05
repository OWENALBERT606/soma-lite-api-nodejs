import { Router } from "express"
import rateLimit from "express-rate-limit"
import { UsersController } from "@/controllers/users"
import { authenticateToken, authorize } from "@/lib/middleware"

const router = Router()

// ==================== RATE LIMITERS ====================

/**
 * User creation limiter
 * Prevent mass account creation by admins
 */
const createUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: {
    success: false,
    error: "Too many user creation attempts. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// ==================== PROTECTED ROUTES ====================
// All routes require authentication
router.use(authenticateToken)

// ==================== USER MANAGEMENT ====================

/**
 * @route   POST /api/v1/users
 * @desc    Create a new user
 * @access  Private (Platform Admin, School Admin)
 * @body    {
 *   firstName,
 *   lastName,
 *   email,
 *   phone,
 *   password,
 *   staffId?,
 *   imageUrl?,
 *   roles?: string[]
 * }
 */
router.post(
  "/",
  createUserLimiter,
  authorize("platform_admin", "school_admin"),
  UsersController.create
)

/**
 * @route   GET /api/v1/users
 * @desc    Get all users
 * @access  Private (Platform Admin, School Admin)
 * @query   { status? }
 */
router.get(
  "/",
  authorize("platform_admin", "school_admin"),
  UsersController.findAll
)

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get a single user by ID
 * @access  Private (Platform Admin, School Admin)
 */
router.get(
  "/:id",
  authorize("platform_admin", "school_admin"),
  UsersController.findOne
)

/**
 * @route   PATCH /api/v1/users/:id
 * @desc    Update a user
 * @access  Private (Platform Admin, School Admin)
 * @body    {
 *   firstName?,
 *   lastName?,
 *   phone?,
 *   imageUrl?,
 *   status?
 * }
 */
router.patch(
  "/:id",
  authorize("platform_admin", "school_admin"),
  UsersController.update
)

/**
 * @route   POST /api/v1/users/:id/verify
 * @desc    Verify a user account
 * @access  Private (Platform Admin, School Admin)
 */
router.post(
  "/:id/verify",
  authorize("platform_admin", "school_admin"),
  UsersController.verify
)

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete a user
 * @access  Private (Platform Admin only)
 */
router.delete(
  "/:id",
  authorize("platform_admin"),
  UsersController.delete
)

export default router
