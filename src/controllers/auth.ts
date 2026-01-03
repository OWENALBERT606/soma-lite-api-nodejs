import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@/db/db";

import {
  AuthenticatedRequest,
  JWTPayload,
  SanitizedUser,
  TokenPair,
  SchoolAccessInfo,
} from "@/types/auth.types";
import { sendAccountApprovedEmail, sendPasswordResetEmail, sendVerificationCode } from "@/utils/mailer";


const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "1d";
const REFRESH_TOKEN_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || "30");
const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * REFRESH_TOKEN_DAYS;
const RESET_TTL_MIN = 30;
const VERIFICATION_CODE_LENGTH = 6;
const BCRYPT_ROUNDS = 12;

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate a 6-digit verification code
 */
function generateVerificationCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(
    VERIFICATION_CODE_LENGTH,
    "0"
  );
}

/**
 * Generate access and refresh tokens
 */
function generateTokens(user: {
  id: string;
  email: string;
  schoolId?: string | null;
  roles: string[];
}): TokenPair {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    schoolId: user.schoolId,
    roles: user.roles,
  };

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }

  const accessToken = jwt.sign(payload, secret, {
    expiresIn: 86400, // 24 hours in seconds
  });

  const refreshToken = crypto.randomUUID();

  return { accessToken, refreshToken };
}

/**
 * Sanitize user object (remove sensitive fields)
 */
function sanitizeUser(user: any): SanitizedUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
    status: user.status,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
}

/**
 * Get user's school access info
 */
async function getUserSchoolAccess(userId: string): Promise<SchoolAccessInfo[]> {
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: {
      role: { select: { slug: true, name: true } },
      school: { select: { id: true, name: true, code: true } },
    },
  });

  // Group by school
  const schoolMap = new Map<string, SchoolAccessInfo>();

  for (const ur of userRoles) {
    if (ur.school) {
      const existing = schoolMap.get(ur.school.id);
      if (existing) {
        existing.roles.push(ur.role.slug);
      } else {
        schoolMap.set(ur.school.id, {
          schoolId: ur.school.id,
          schoolName: ur.school.name,
          schoolCode: ur.school.code,
          roles: [ur.role.slug],
        });
      }
    }
  }

  return Array.from(schoolMap.values());
}

/**
 * Get user's role slugs
 */
async function getUserRoles(userId: string): Promise<string[]> {
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: { role: { select: { slug: true } } },
  });
  return userRoles.map((ur) => ur.role.slug);
}

// ==================== REGISTER ====================

/**
 * Register a new user
 * POST /api/v1/auth/register
 */
export async function register(req: Request, res: Response) {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: "All fields are required: firstName, lastName, email, phone, password",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format",
      });
    }

    // Password validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters",
      });
    }

    // Normalize inputs
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim().replace(/\s+/g, "");

    // Check existing user
    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { phone: normalizedPhone }],
      },
    });

    if (existingUser) {
      const field = existingUser.email === normalizedEmail ? "email" : "phone";
      return res.status(409).json({
        success: false,
        error: `User with this ${field} already exists`,
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Generate verification code
    const verificationCode = generateVerificationCode();

    // Create user
    const user = await db.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        password: hashedPassword,
        status: "PENDING",
        isVerified: false,
        resetToken: verificationCode,
        resetTokenExp: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      },
    });

    // Send verification email
    try {
      await sendVerificationCode({
        to: user.email,
        name: user.firstName,
        code: verificationCode,
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail registration if email fails
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "USER_REGISTERED",
        module: "auth",
        entityType: "User",
        entityId: user.id,
        description: `New user registered: ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful. Please check your email for verification code.",
      data: {
        userId: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      error: "Registration failed. Please try again.",
    });
  }
}

// ==================== LOGIN ====================

/**
 * Login with email/phone and password
 * POST /api/v1/auth/login
 */
export async function login(req: Request, res: Response) {
  try {
    const { email, phone, password } = req.body;

    // Validation
    if ((!email && !phone) || !password) {
      return res.status(400).json({
        success: false,
        error: "Email/phone and password are required",
      });
    }

    // Build query
    const whereConditions = [];
    if (email) whereConditions.push({ email: email.trim().toLowerCase() });
    if (phone) whereConditions.push({ phone: phone.trim().replace(/\s+/g, "") });

    // Find user
    const user = await db.user.findFirst({
      where: { OR: whereConditions },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // Check password exists
    if (!user.password) {
      return res.status(401).json({
        success: false,
        error: "Please set a password for your account",
        code: "NO_PASSWORD",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // Check email verification
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        error: "Please verify your email first",
        code: "EMAIL_NOT_VERIFIED",
        data: { email: user.email },
      });
    }

    // Check user status
    const statusErrors: Record<string, { error: string; code: string }> = {
      SUSPENDED: {
        error: "Your account has been suspended. Contact support.",
        code: "ACCOUNT_SUSPENDED",
      },
      INACTIVE: {
        error: "Your account is inactive.",
        code: "ACCOUNT_INACTIVE",
      },
      DEACTIVATED: {
        error: "Your account has been deactivated.",
        code: "ACCOUNT_DEACTIVATED",
      },
    };

    if (statusErrors[user.status]) {
      return res.status(403).json({
        success: false,
        ...statusErrors[user.status],
      });
    }

    // Get user roles
    const roles = await getUserRoles(user.id);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      roles,
    });

    // Store refresh token
    await db.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    // Update user status and last login
    if (user.status === "PENDING") {
      await db.user.update({
        where: { id: user.id },
        data: {
          status: "ACTIVE",
          lastLoginAt: new Date(),
        },
      });
    } else {
      await db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    // Get school access
    const schoolAccess = await getUserSchoolAccess(user.id);

    // Log activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "USER_LOGIN",
        module: "auth",
        entityType: "User",
        entityId: user.id,
        description: `User logged in: ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          ...sanitizeUser({ ...user, status: "ACTIVE" }),
          roles,
          schoolAccess,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      error: "Login failed. Please try again.",
    });
  }
}

// ==================== EMAIL VERIFICATION ====================

/**
 * Verify email with code
 * POST /api/v1/auth/verify-email
 */
export async function verifyEmail(req: Request, res: Response) {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: "Email and verification code are required",
      });
    }

    const user = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        error: "Email already verified",
      });
    }

    // Check code
    if (!user.resetToken || user.resetToken !== code) {
      return res.status(400).json({
        success: false,
        error: "Invalid verification code",
      });
    }

    // Check expiry
    if (user.resetTokenExp && user.resetTokenExp < new Date()) {
      return res.status(400).json({
        success: false,
        error: "Verification code has expired. Please request a new one.",
        code: "CODE_EXPIRED",
      });
    }

    // Update user
    await db.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        status: "ACTIVE",
        resetToken: null,
        resetTokenExp: null,
      },
    });

    // Get user roles
    const roles = await getUserRoles(user.id);

    // Generate tokens (auto-login after verification)
    const { accessToken, refreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      roles,
    });

    await db.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    // Get school access
    const schoolAccess = await getUserSchoolAccess(user.id);

    // Log activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "EMAIL_VERIFIED",
        module: "auth",
        entityType: "User",
        entityId: user.id,
        description: `Email verified: ${user.email}`,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: {
        user: {
          ...sanitizeUser({ ...user, isVerified: true, status: "ACTIVE" }),
          roles,
          schoolAccess,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return res.status(500).json({
      success: false,
      error: "Verification failed",
    });
  }
}

/**
 * Resend verification code
 * POST /api/v1/auth/resend-verification
 */
export async function resendVerification(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const user = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // Don't reveal if user exists
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If the email exists, a verification code has been sent",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        error: "Email already verified",
      });
    }

    const newCode = generateVerificationCode();

    await db.user.update({
      where: { id: user.id },
      data: {
        resetToken: newCode,
        resetTokenExp: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      },
    });

    await sendVerificationCode({
      to: user.email,
      name: user.firstName,
      code: newCode,
    });

    return res.status(200).json({
      success: true,
      message: "Verification code sent",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to resend verification code",
    });
  }
}

// ==================== PASSWORD RESET ====================

/**
 * Request password reset
 * POST /api/v1/auth/forgot-password
 */
export async function forgotPassword(req: Request, res: Response) {
  // Always return same response to prevent email enumeration
  const genericResponse = {
    success: true,
    message: "If that email exists, a reset link has been sent",
  };

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(200).json(genericResponse);
    }

    const user = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    // Generate reset token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Update user with reset token
    await db.user.update({
      where: { id: user.id },
      data: {
        resetToken: tokenHash,
        resetTokenExp: new Date(Date.now() + RESET_TTL_MIN * 60_000),
      },
    });

    // Send reset email
    const appUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}&uid=${user.id}`;

    await sendPasswordResetEmail({
      to: user.email,
      name: user.firstName,
      resetUrl,
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        module: "auth",
        entityType: "User",
        entityId: user.id,
      },
    });

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(200).json(genericResponse);
  }
}

/**
 * Reset password with token
 * POST /api/v1/auth/reset-password
 */
export async function resetPassword(req: Request, res: Response) {
  try {
    const { uid, token, newPassword } = req.body;

    if (!uid || !token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters",
      });
    }

    // Hash the provided token to compare
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await db.user.findFirst({
      where: {
        id: uid,
        resetToken: tokenHash,
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired reset token",
      });
    }

    // Check expiry
    if (user.resetTokenExp && user.resetTokenExp < new Date()) {
      return res.status(400).json({
        success: false,
        error: "Reset token has expired",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password and clear reset token
    await db.$transaction([
      db.user.update({
        where: { id: uid },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExp: null,
        },
      }),
      // Invalidate all refresh tokens (logout from all devices)
      db.refreshToken.deleteMany({ where: { userId: uid } }),
    ]);

    // Log activity
    await db.activityLog.create({
      data: {
        userId: uid,
        action: "PASSWORD_RESET_COMPLETED",
        module: "auth",
        entityType: "User",
        entityId: uid,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Password updated successfully. Please login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to reset password",
    });
  }
}

// ==================== TOKEN MANAGEMENT ====================

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
export async function refreshAccessToken(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: "Refresh token is required",
      });
    }

    const tokenRecord = await db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      return res.status(401).json({
        success: false,
        error: "Invalid refresh token",
        code: "INVALID_REFRESH_TOKEN",
      });
    }

    // Check if revoked or expired
    if (tokenRecord.revoked || tokenRecord.expiresAt < new Date()) {
      await db.refreshToken.delete({ where: { id: tokenRecord.id } });
      return res.status(401).json({
        success: false,
        error: "Refresh token expired or revoked",
        code: "REFRESH_TOKEN_EXPIRED",
      });
    }

    const user = tokenRecord.user;

    // Check user status
    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error: "Account is not active",
        code: "ACCOUNT_INACTIVE",
      });
    }

    // Get user roles
    const roles = await getUserRoles(user.id);

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      roles,
    });

    // Rotate refresh token
    await db.$transaction([
      db.refreshToken.delete({ where: { id: tokenRecord.id } }),
      db.refreshToken.create({
        data: {
          userId: user.id,
          token: newRefreshToken,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to refresh token",
    });
  }
}

// ==================== LOGOUT ====================

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
export async function logout(req: AuthenticatedRequest, res: Response) {
  try {
    const { refreshToken } = req.body;
    const userId = req.user?.userId;

    if (refreshToken) {
      await db.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    } else if (userId) {
      // If no refresh token provided, delete current user's tokens
      await db.refreshToken.deleteMany({
        where: { userId },
      });
    }

    if (userId) {
      await db.activityLog.create({
        data: {
          userId,
          action: "USER_LOGOUT",
          module: "auth",
          entityType: "User",
          entityId: userId,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      error: "Logout failed",
    });
  }
}

/**
 * Logout from all devices
 * POST /api/v1/auth/logout-all
 */
export async function logoutAll(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    await db.refreshToken.deleteMany({
      where: { userId },
    });

    await db.activityLog.create({
      data: {
        userId,
        action: "USER_LOGOUT_ALL",
        module: "auth",
        entityType: "User",
        entityId: userId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Logged out from all devices",
    });
  } catch (error) {
    console.error("Logout all error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to logout from all devices",
    });
  }
}

// ==================== USER PROFILE ====================

/**
 * Get current user profile
 * GET /api/v1/auth/me
 */
export async function getMe(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: { select: { id: true, name: true, slug: true } },
            school: { select: { id: true, name: true, code: true, logo: true } },
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

    // Format roles
    const roles = user.userRoles.map((ur) => ({
      roleId: ur.role.id,
      roleName: ur.role.name,
      roleSlug: ur.role.slug,
      schoolId: ur.school?.id || null,
      schoolName: ur.school?.name,
      schoolCode: ur.school?.code,
      schoolLogo: ur.school?.logo,
    }));

    // Get school access
    const schoolAccess = await getUserSchoolAccess(user.id);

    return res.status(200).json({
      success: true,
      data: {
        ...sanitizeUser(user),
        roles,
        schoolAccess,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get profile",
    });
  }
}

/**
 * Update current user profile
 * PATCH /api/v1/auth/me
 */
export async function updateMe(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { firstName, lastName, phone, imageUrl } = req.body;

    const updateData: any = {};

    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

    // Handle phone update (check uniqueness)
    if (phone) {
      const normalizedPhone = phone.trim().replace(/\s+/g, "");
      const existingPhone = await db.user.findFirst({
        where: { phone: normalizedPhone, NOT: { id: userId } },
      });
      if (existingPhone) {
        return res.status(409).json({
          success: false,
          error: "Phone number already in use",
        });
      }
      updateData.phone = normalizedPhone;
    }

    const user = await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    await db.activityLog.create({
      data: {
        userId,
        action: "PROFILE_UPDATED",
        module: "auth",
        entityType: "User",
        entityId: userId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated",
      data: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Update me error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update profile",
    });
  }
}

// ==================== PASSWORD MANAGEMENT ====================

/**
 * Change password (authenticated user)
 * POST /api/v1/auth/change-password
 */
export async function changePassword(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 8 characters",
      });
    }

    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user || !user.password) {
      return res.status(400).json({
        success: false,
        error: "Cannot change password. No password set.",
      });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: "Current password is incorrect",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await db.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await db.activityLog.create({
      data: {
        userId,
        action: "PASSWORD_CHANGED",
        module: "auth",
        entityType: "User",
        entityId: userId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to change password",
    });
  }
}

// ==================== ADMIN: USER MANAGEMENT ====================

/**
 * Approve a user (Admin only)
 * POST /api/v1/auth/approve/:userId
 */
export async function approveUser(req: AuthenticatedRequest, res: Response) {
  try {
    const adminId = req.user?.userId;
    const { userId } = req.params;

    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    await db.user.update({
      where: { id: userId },
      data: {
        status: user.isVerified ? "ACTIVE" : "PENDING",
      },
    });

    // Send notification
    await db.notification.create({
      data: {
        userId: userId,
        type: "SYSTEM",
        title: "Account Approved",
        message: "Your account has been approved. You can now log in.",
      },
    });

    // Send email
    try {
      await sendAccountApprovedEmail({
        to: user.email,
        name: user.firstName,
        loginUrl: `${process.env.FRONTEND_URL}/login`,
      });
    } catch (emailError) {
      console.error("Failed to send approval email:", emailError);
    }

    await db.activityLog.create({
      data: {
        userId: adminId,
        action: "USER_APPROVED",
        module: "auth",
        entityType: "User",
        entityId: userId,
        description: `Admin approved user: ${user.email}`,
      },
    });

    return res.status(200).json({
      success: true,
      message: "User approved successfully",
    });
  } catch (error) {
    console.error("Approve user error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to approve user",
    });
  }
}

/**
 * Suspend a user (Admin only)
 * POST /api/v1/auth/suspend/:userId
 */
export async function suspendUser(req: AuthenticatedRequest, res: Response) {
  try {
    const adminId = req.user?.userId;
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { status: "SUSPENDED" },
      }),
      db.refreshToken.deleteMany({ where: { userId } }),
    ]);

    await db.notification.create({
      data: {
        userId: userId,
        type: "SYSTEM",
        title: "Account Suspended",
        message: reason || "Your account has been suspended. Contact support for more information.",
      },
    });

    await db.activityLog.create({
      data: {
        userId: adminId,
        action: "USER_SUSPENDED",
        module: "auth",
        entityType: "User",
        entityId: userId,
        description: `Admin suspended user: ${user.email}. Reason: ${reason || "Not specified"}`,
      },
    });

    return res.status(200).json({
      success: true,
      message: "User suspended",
    });
  } catch (error) {
    console.error("Suspend user error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to suspend user",
    });
  }
}

/**
 * Reactivate a suspended user (Admin only)
 * POST /api/v1/auth/reactivate/:userId
 */
export async function reactivateUser(req: AuthenticatedRequest, res: Response) {
  try {
    const adminId = req.user?.userId;
    const { userId } = req.params;

    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (user.status !== "SUSPENDED") {
      return res.status(400).json({
        success: false,
        error: "User is not suspended",
      });
    }

    await db.user.update({
      where: { id: userId },
      data: { status: "ACTIVE" },
    });

    await db.notification.create({
      data: {
        userId: userId,
        type: "SYSTEM",
        title: "Account Reactivated",
        message: "Your account has been reactivated. You can now log in.",
      },
    });

    await db.activityLog.create({
      data: {
        userId: adminId,
        action: "USER_REACTIVATED",
        module: "auth",
        entityType: "User",
        entityId: userId,
        description: `Admin reactivated user: ${user.email}`,
      },
    });

    return res.status(200).json({
      success: true,
      message: "User reactivated",
    });
  } catch (error) {
    console.error("Reactivate user error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to reactivate user",
    });
  }
}

// ==================== SCHOOL CONTEXT ====================

/**
 * Switch school context (for users with multiple school access)
 * POST /api/v1/auth/switch-school
 */
export async function switchSchool(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { schoolId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: "School ID is required",
      });
    }

    // Verify user has access to this school
    const userRole = await db.userRole.findFirst({
      where: {
        userId,
        schoolId,
      },
      include: {
        school: { select: { id: true, name: true, code: true } },
        role: { select: { slug: true } },
      },
    });

    if (!userRole) {
      return res.status(403).json({
        success: false,
        error: "You don't have access to this school",
      });
    }

    // Get all roles for this school
    const schoolRoles = await db.userRole.findMany({
      where: { userId, schoolId },
      include: { role: { select: { slug: true } } },
    });

    const roles = schoolRoles.map((r) => r.role.slug);

    // Generate new token with school context
    const user = await db.user.findUnique({ where: { id: userId } });

    const { accessToken, refreshToken } = generateTokens({
      id: userId,
      email: user!.email,
      schoolId,
      roles,
    });

    // Store new refresh token
    await db.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return res.status(200).json({
      success: true,
      message: "School context switched",
      data: {
        school: userRole.school,
        roles,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Switch school error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to switch school",
    });
  }
}