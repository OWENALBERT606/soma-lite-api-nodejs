import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  logout,
  logoutAll,
  getMe,
  updateMe,
  changePassword,
  approveUser,
  suspendUser,
  reactivateUser,
  switchSchool,
} from "@/controllers/auth";
import { authenticateToken, authorize } from "@/lib/middleware";



const router = Router();

// ==================== RATE LIMITERS ====================

/**
 * Login rate limiter
 * 5 attempts per 15 minutes per IP
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    error: "Too many login attempts. Please try again after 15 minutes.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
  },
});

/**
 * Register rate limiter
 * 10 attempts per hour per IP
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    error: "Too many registration attempts. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Password reset rate limiter
 * 3 attempts per 15 minutes per IP
 */
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  message: {
    success: false,
    error: "Too many password reset attempts. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Verification code rate limiter
 * 5 attempts per 15 minutes per IP
 */
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    error: "Too many verification attempts. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==================== PUBLIC ROUTES ====================

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login with email/phone and password
 * @access  Public
 * @body    { email?, phone?, password }
 */
router.post("/login", loginLimiter, login);

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { firstName, lastName, email, phone, password }
 */
router.post("/register", registerLimiter, register);



/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email with 6-digit code
 * @access  Public
 * @body    { email, code }
 */
router.post("/verify-email", verificationLimiter, verifyEmail);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend verification code to email
 * @access  Public
 * @body    { email }
 */
router.post("/resend-verification", verificationLimiter, resendVerification);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 * @body    { email }
 */
router.post("/forgot-password", passwordResetLimiter, forgotPassword);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 * @body    { uid, token, newPassword }
 */
router.post("/reset-password", resetPassword);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 * @body    { refreshToken }
 */
router.post("/refresh", refreshAccessToken);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (invalidate refresh token)
 * @access  Public (works with or without auth)
 * @body    { refreshToken? }
 */
router.post("/logout", logout);

// ==================== PROTECTED ROUTES ====================
// All routes below require authentication

// router.use(authenticateToken);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/me", getMe);

/**
 * @route   PATCH /api/v1/auth/me
 * @desc    Update current user profile
 * @access  Private
 * @body    { firstName?, lastName?, phone?, imageUrl? }
 */
router.patch("/me", updateMe);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change password (authenticated user)
 * @access  Private
 * @body    { currentPassword, newPassword }
 */
router.post("/change-password", changePassword);

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post("/logout-all", logoutAll);

/**
 * @route   POST /api/v1/auth/switch-school
 * @desc    Switch school context (for multi-school access)
 * @access  Private
 * @body    { schoolId }
 */
router.post("/switch-school", switchSchool);

// ==================== ADMIN ROUTES ====================
// Routes for platform/school admins

/**
 * @route   POST /api/v1/auth/approve/:userId
 * @desc    Approve a pending user
 * @access  Private (Platform Admin, School Admin)
 */
router.post(
  "/approve/:userId",
  authorize("platform_admin", "school_admin"),
  approveUser
);

/**
 * @route   POST /api/v1/auth/suspend/:userId
 * @desc    Suspend a user
 * @access  Private (Platform Admin, School Admin)
 * @body    { reason? }
 */
router.post(
  "/suspend/:userId",
  authorize("platform_admin", "school_admin"),
  suspendUser
);

/**
 * @route   POST /api/v1/auth/reactivate/:userId
 * @desc    Reactivate a suspended user
 * @access  Private (Platform Admin, School Admin)
 */
router.post(
  "/reactivate/:userId",
  authorize("platform_admin", "school_admin"),
  reactivateUser
);

export default router;