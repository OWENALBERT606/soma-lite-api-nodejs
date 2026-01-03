import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@/db/db";

// ==================== TYPES ====================

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  schoolId?: string | null;
}

export interface AuthRequest extends Request {
  user?: TokenPayload;
  schoolId?: string;
}

// ==================== AUTHENTICATE TOKEN ====================

/**
 * Middleware to authenticate JWT token
 * Extracts user info and attaches to request
 */
export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "No token provided",
      code: "NO_TOKEN",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (err, decoded) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          error: "Token expired",
          code: "TOKEN_EXPIRED",
        });
      }
      return res.status(403).json({
        success: false,
        error: "Invalid token",
        code: "INVALID_TOKEN",
      });
    }

    if (!decoded) {
      return res.status(403).json({
        success: false,
        error: "Invalid token",
        code: "INVALID_TOKEN",
      });
    }

    req.user = decoded as TokenPayload;

    // Check for school context header
    const schoolId = req.headers["x-school-id"] as string;
    if (schoolId) {
      req.schoolId = schoolId;
    }

    next();
  });
}

// ==================== OPTIONAL AUTH ====================

/**
 * Optional authentication - doesn't fail if no token
 * Useful for routes that work with or without auth
 */
export function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET as string, (err, decoded) => {
      if (!err && decoded) {
        req.user = decoded as TokenPayload;
      }
    });
  }

  next();
}

// ==================== ROLE-BASED AUTHORIZATION ====================

/**
 * Middleware to check if user has any of the specified roles
 * @param allowedRoles - Array of role slugs that are allowed
 */
export function authorize(...allowedRoles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
        code: "NOT_AUTHENTICATED",
      });
    }

    const { userId } = req.user;
    const schoolId = req.schoolId || (req.headers["x-school-id"] as string);

    try {
      // Fetch user's roles
      const userRoles = await db.userRole.findMany({
        where: {
          userId,
          ...(schoolId ? { OR: [{ schoolId }, { schoolId: null }] } : {}),
        },
        include: {
          role: {
            select: {
              slug: true,
              permissions: true,
            },
          },
        },
      });

      // Check if user has platform_admin role (has access to everything)
      const isPlatformAdmin = userRoles.some(
        (ur) => ur.role.slug === "platform_admin"
      );

      if (isPlatformAdmin) {
        req.user.roles = userRoles.map((ur) => ur.role.slug);
        return next();
      }

      // Check if user has any of the allowed roles
      const hasAllowedRole = userRoles.some((ur) =>
        allowedRoles.includes(ur.role.slug)
      );

      if (!hasAllowedRole) {
        return res.status(403).json({
          success: false,
          error: "You don't have permission to access this resource",
          code: "FORBIDDEN",
        });
      }

      // Update request with user roles
      req.user.roles = userRoles.map((ur) => ur.role.slug);

      next();
    } catch (error) {
      console.error("Authorization error:", error);
      return res.status(500).json({
        success: false,
        error: "Authorization failed",
      });
    }
  };
}

// ==================== PERMISSION-BASED AUTHORIZATION ====================

/**
 * Middleware to check if user has specific permission
 * @param requiredPermission - The permission required to access the route
 */
export function requirePermission(requiredPermission: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
        code: "NOT_AUTHENTICATED",
      });
    }

    const { userId } = req.user;
    const schoolId = req.schoolId || (req.headers["x-school-id"] as string);

    try {
      // Fetch user's roles with permissions
      const userRoles = await db.userRole.findMany({
        where: {
          userId,
          ...(schoolId ? { OR: [{ schoolId }, { schoolId: null }] } : {}),
        },
        include: {
          role: {
            select: {
              slug: true,
              permissions: true,
            },
          },
        },
      });

      // Collect all permissions
      const allPermissions = new Set<string>();
      userRoles.forEach((ur) => {
        ur.role.permissions.forEach((p) => allPermissions.add(p));
      });

      // Check for wildcard or specific permission
      if (allPermissions.has("*") || allPermissions.has(requiredPermission)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: "You don't have the required permission",
        code: "PERMISSION_DENIED",
        required: requiredPermission,
      });
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({
        success: false,
        error: "Permission check failed",
      });
    }
  };
}

// ==================== PLATFORM ADMIN CHECK ====================

/**
 * Middleware to ensure user is a platform admin
 */
export async function requirePlatformAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Not authenticated",
    });
  }

  try {
    const platformRole = await db.userRole.findFirst({
      where: {
        userId: req.user.userId,
        schoolId: null, // Platform-level role
        role: {
          slug: "platform_admin",
        },
      },
    });

    if (!platformRole) {
      return res.status(403).json({
        success: false,
        error: "Platform admin access required",
        code: "PLATFORM_ADMIN_REQUIRED",
      });
    }

    next();
  } catch (error) {
    console.error("Platform admin check error:", error);
    return res.status(500).json({
      success: false,
      error: "Authorization failed",
    });
  }
}

// ==================== SCHOOL ACCESS CHECK ====================

/**
 * Middleware to ensure user has access to the specified school
 * Must be used after authenticateToken
 */
export function requireSchoolAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  return async () => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const schoolId =
      req.schoolId || req.params.schoolId || req.body.schoolId;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: "School ID required",
        code: "SCHOOL_ID_REQUIRED",
      });
    }

    try {
      // Check if user has any role in this school or is platform admin
      const userRole = await db.userRole.findFirst({
        where: {
          userId: req.user.userId,
          OR: [{ schoolId }, { schoolId: null }], // null = platform-level role
        },
        include: {
          role: {
            select: { slug: true },
          },
        },
      });

      if (!userRole) {
        return res.status(403).json({
          success: false,
          error: "You don't have access to this school",
          code: "NO_SCHOOL_ACCESS",
        });
      }

      req.schoolId = schoolId;
      next();
    } catch (error) {
      console.error("School access check error:", error);
      return res.status(500).json({
        success: false,
        error: "School access check failed",
      });
    }
  };
}