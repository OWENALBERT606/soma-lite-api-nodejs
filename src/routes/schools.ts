import { Router } from "express";
import { Response } from "express";
import { db } from "@/db/db";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@/utils/mailer";
import { authenticateToken, authorize, requirePlatformAdmin } from "@/lib/middleware";
import { AuthenticatedRequest } from "@/types/authenticated-request";

const router = Router();



// All routes require authentication
router.use(authenticateToken);

/**
 * Generate a unique school code
 */
function generateSchoolCode(): string {
  const prefix = "SCH";
  const random = crypto.randomInt(1000, 9999);
  return `${prefix}${random}`;
}

/**
 * Generate URL-friendly slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

/**
 * @route   GET /api/v1/schools
 * @desc    Get all schools (Platform Admin) or user's schools
 * @access  Private
 */
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const roles = req.user?.roles || [];

    // Check if platform admin
    const isPlatformAdmin = roles.includes("platform_admin");

    let schools;

    if (isPlatformAdmin) {
      // Platform admin sees all schools
      const { page = 1, limit = 20, search, isActive } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: "insensitive" } },
          { code: { contains: search as string, mode: "insensitive" } },
        ];
      }

      if (isActive !== undefined) {
        where.isActive = isActive === "true";
      }

      const [data, total] = await Promise.all([
        db.school.findMany({
          where,
          skip,
          take: Number(limit),
          select: {
            id: true,
            code: true,
            slug: true,
            name: true,
            logo: true,
            schoolType: true,
            schoolLevel: true,
            district: true,
            phone: true,
            email: true,
            isActive: true,
            isVerified: true,
            createdAt: true,
            _count: {
              select: {
                students: true,
                teachers: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        db.school.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          schools: data,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } else {
      // Regular user sees only their schools
      const userSchools = await db.userRole.findMany({
        where: { userId },
        include: {
          school: {
            select: {
              id: true,
              code: true,
              slug: true,
              name: true,
              logo: true,
              schoolType: true,
              schoolLevel: true,
              primaryColor: true,
              secondaryColor: true,
            },
          },
          role: { select: { name: true, slug: true } },
        },
      });

      // Group by school
      const schoolMap = new Map();
      for (const ur of userSchools) {
        if (ur.school) {
          const existing = schoolMap.get(ur.school.id);
          if (existing) {
            existing.roles.push(ur.role.slug);
          } else {
            schoolMap.set(ur.school.id, {
              ...ur.school,
              roles: [ur.role.slug],
            });
          }
        }
      }

      schools = Array.from(schoolMap.values());

      return res.status(200).json({
        success: true,
        data: { schools },
      });
    }
  } catch (error) {
    console.error("Get schools error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch schools",
    });
  }
});

/**
 * @route   POST /api/v1/schools
 * @desc    Create a new school (Platform Admin only)
 * @access  Private (Platform Admin)
 */
router.post(
  "/",
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        name,
        motto,
        email,
        phone,
        address,
        district,
        schoolType,
        schoolLevel,
        curriculum,
        ownership,
        // Admin user details
        adminEmail,
        adminFirstName,
        adminLastName,
        adminPhone,
      } = req.body;

      // Validation
      if (!name) {
        return res.status(400).json({
          success: false,
          error: "School name is required",
        });
      }

      // Generate unique code and slug
      let code = generateSchoolCode();
      let slug = generateSlug(name);

      // Ensure code is unique
      let existingCode = await db.school.findUnique({ where: { code } });
      while (existingCode) {
        code = generateSchoolCode();
        existingCode = await db.school.findUnique({ where: { code } });
      }

      // Ensure slug is unique
      let existingSlug = await db.school.findUnique({ where: { slug } });
      let slugSuffix = 1;
      while (existingSlug) {
        slug = `${generateSlug(name)}-${slugSuffix}`;
        existingSlug = await db.school.findUnique({ where: { slug } });
        slugSuffix++;
      }

      // Check if we need to create a new admin user
      let adminId = req.user?.userId; // Default to current user

      if (adminEmail && adminFirstName && adminLastName) {
        // Check if admin user already exists
        let adminUser = await db.user.findUnique({
          where: { email: adminEmail.trim().toLowerCase() },
        });

        if (adminUser) {
          adminId = adminUser.id;
        } else {
          // Create new admin user
          const tempPassword = crypto.randomBytes(8).toString("hex");
          const hashedPassword = await bcrypt.hash(tempPassword, 12);

          adminUser = await db.user.create({
            data: {
              firstName: adminFirstName.trim(),
              lastName: adminLastName.trim(),
              email: adminEmail.trim().toLowerCase(),
              phone: adminPhone?.trim().replace(/\s+/g, "") || null,
              password: hashedPassword,
              status: "ACTIVE",
              isVerified: true, // Pre-verified since created by admin
            },
          });

          adminId = adminUser.id;

          // Send welcome email with temp password
          // In production, you'd want to send a "set password" link instead
          try {
            await sendWelcomeEmail({
              to: adminUser.email,
              name: adminUser.firstName,
              schoolName: name,
              loginUrl: `${process.env.FRONTEND_URL}/login`,
            });
          } catch (emailError) {
            console.error("Failed to send welcome email:", emailError);
          }
        }
      }

      // Create school
      const school = await db.school.create({
        data: {
          code,
          slug,
          name: name.trim(),
          motto,
          email: email?.trim().toLowerCase(),
          phone: phone?.trim(),
          address,
          district,
          schoolType: schoolType || "DAY",
          schoolLevel: schoolLevel || "PRIMARY",
          curriculum: curriculum || "UGANDA_NATIONAL",
          ownership: ownership || "PRIVATE",
          adminId: adminId!,
          isActive: true,
        },
      });

      // Get or create the school_admin role
      let schoolAdminRole = await db.role.findFirst({
        where: { slug: "school_admin", schoolId: null },
      });

      if (!schoolAdminRole) {
        // Create system school_admin role if it doesn't exist
        schoolAdminRole = await db.role.create({
          data: {
            name: "School Administrator",
            slug: "school_admin",
            description: "Full administrative access to a school",
            isSystem: true,
            permissions: ["*"], // Full access within school
          },
        });
      }

      // Assign school_admin role to the admin user for this school
      await db.userRole.create({
        data: {
          userId: adminId!,
          roleId: schoolAdminRole.id,
          schoolId: school.id,
          assignedBy: req.user?.userId,
        },
      });

      // Log activity
      await db.activityLog.create({
        data: {
          userId: req.user?.userId,
          action: "SCHOOL_CREATED",
          module: "schools",
          entityType: "School",
          entityId: school.id,
          description: `Created school: ${school.name} (${school.code})`,
        },
      });

      return res.status(201).json({
        success: true,
        message: "School created successfully",
        data: school,
      });
    } catch (error) {
      console.error("Create school error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create school",
      });
    }
  }
);

/**
 * @route   GET /api/v1/schools/:id
 * @desc    Get school by ID
 * @access  Private (must have access to school)
 */
router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const roles = req.user?.roles || [];

    // Check if platform admin
    const isPlatformAdmin = roles.includes("platform_admin");

    // Verify access
    if (!isPlatformAdmin) {
      const hasAccess = await db.userRole.findFirst({
        where: { userId, schoolId: id },
      });

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: "You don't have access to this school",
        });
      }
    }

    const school = await db.school.findUnique({
      where: { id },
      include: {
        admin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        _count: {
          select: {
            students: true,
            teachers: true,
            classes: true,
            subjects: true,
          },
        },
      },
    });

    if (!school) {
      return res.status(404).json({
        success: false,
        error: "School not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: school,
    });
  } catch (error) {
    console.error("Get school error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch school",
    });
  }
});

/**
 * @route   PATCH /api/v1/schools/:id
 * @desc    Update school details
 * @access  Private (School Admin or Platform Admin)
 */
router.patch(
  "/:id",
  authorize("platform_admin", "school_admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const roles = req.user?.roles || [];

      // Verify access
      const isPlatformAdmin = roles.includes("platform_admin");
      if (!isPlatformAdmin) {
        const hasAccess = await db.userRole.findFirst({
          where: { userId, schoolId: id, role: { slug: "school_admin" } },
        });

        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            error: "You don't have permission to update this school",
          });
        }
      }

      const {
        name,
        motto,
        vision,
        mission,
        email,
        email2,
        phone,
        phone2,
        phone3,
        website,
        poBox,
        address,
        district,
        county,
        subCounty,
        parish,
        village,
        logo,
        badge,
        primaryColor,
        secondaryColor,
        accentColor,
        headerImage,
        reportCardLogo,
        schoolType,
        schoolLevel,
        curriculum,
        ownership,
        registrationNo,
        licenseNo,
        establishedYear,
        gradingSystem,
        attendanceType,
        termStructure,
        academicYearStart,
      } = req.body;

      const updateData: any = {};

      // Only include fields that are provided
      if (name !== undefined) updateData.name = name.trim();
      if (motto !== undefined) updateData.motto = motto;
      if (vision !== undefined) updateData.vision = vision;
      if (mission !== undefined) updateData.mission = mission;
      if (email !== undefined) updateData.email = email?.trim().toLowerCase();
      if (email2 !== undefined) updateData.email2 = email2?.trim().toLowerCase();
      if (phone !== undefined) updateData.phone = phone?.trim();
      if (phone2 !== undefined) updateData.phone2 = phone2?.trim();
      if (phone3 !== undefined) updateData.phone3 = phone3?.trim();
      if (website !== undefined) updateData.website = website;
      if (poBox !== undefined) updateData.poBox = poBox;
      if (address !== undefined) updateData.address = address;
      if (district !== undefined) updateData.district = district;
      if (county !== undefined) updateData.county = county;
      if (subCounty !== undefined) updateData.subCounty = subCounty;
      if (parish !== undefined) updateData.parish = parish;
      if (village !== undefined) updateData.village = village;
      if (logo !== undefined) updateData.logo = logo;
      if (badge !== undefined) updateData.badge = badge;
      if (primaryColor !== undefined) updateData.primaryColor = primaryColor;
      if (secondaryColor !== undefined) updateData.secondaryColor = secondaryColor;
      if (accentColor !== undefined) updateData.accentColor = accentColor;
      if (headerImage !== undefined) updateData.headerImage = headerImage;
      if (reportCardLogo !== undefined) updateData.reportCardLogo = reportCardLogo;
      if (schoolType !== undefined) updateData.schoolType = schoolType;
      if (schoolLevel !== undefined) updateData.schoolLevel = schoolLevel;
      if (curriculum !== undefined) updateData.curriculum = curriculum;
      if (ownership !== undefined) updateData.ownership = ownership;
      if (registrationNo !== undefined) updateData.registrationNo = registrationNo;
      if (licenseNo !== undefined) updateData.licenseNo = licenseNo;
      if (establishedYear !== undefined) updateData.establishedYear = establishedYear;
      if (gradingSystem !== undefined) updateData.gradingSystem = gradingSystem;
      if (attendanceType !== undefined) updateData.attendanceType = attendanceType;
      if (termStructure !== undefined) updateData.termStructure = termStructure;
      if (academicYearStart !== undefined) updateData.academicYearStart = academicYearStart;

      const school = await db.school.update({
        where: { id },
        data: updateData,
      });

      await db.activityLog.create({
        data: {
          userId: req.user?.userId,
          action: "SCHOOL_UPDATED",
          module: "schools",
          entityType: "School",
          entityId: school.id,
          description: `Updated school: ${school.name}`,
        },
      });

      return res.status(200).json({
        success: true,
        message: "School updated successfully",
        data: school,
      });
    } catch (error) {
      console.error("Update school error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to update school",
      });
    }
  }
);

/**
 * @route   POST /api/v1/schools/:id/activate
 * @desc    Activate a school
 * @access  Private (Platform Admin)
 */
router.post(
  "/:id/activate",
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const school = await db.school.update({
        where: { id },
        data: { isActive: true },
      });

      await db.activityLog.create({
        data: {
          userId: req.user?.userId,
          action: "SCHOOL_ACTIVATED",
          module: "schools",
          entityType: "School",
          entityId: school.id,
          description: `Activated school: ${school.name}`,
        },
      });

      return res.status(200).json({
        success: true,
        message: "School activated",
      });
    } catch (error) {
      console.error("Activate school error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to activate school",
      });
    }
  }
);

/**
 * @route   POST /api/v1/schools/:id/deactivate
 * @desc    Deactivate a school
 * @access  Private (Platform Admin)
 */
router.post(
  "/:id/deactivate",
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const school = await db.school.update({
        where: { id },
        data: { isActive: false },
      });

      await db.activityLog.create({
        data: {
          userId: req.user?.userId,
          action: "SCHOOL_DEACTIVATED",
          module: "schools",
          entityType: "School",
          entityId: school.id,
          description: `Deactivated school: ${school.name}`,
        },
      });

      return res.status(200).json({
        success: true,
        message: "School deactivated",
      });
    } catch (error) {
      console.error("Deactivate school error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to deactivate school",
      });
    }
  }
);

export default router;