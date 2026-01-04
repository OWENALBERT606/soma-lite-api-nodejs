import { Response } from "express";
import { db } from "@/db/db";
import { AuthenticatedRequest } from "@/types/authenticated-request";
import { generateSlug } from "@/utils/generateSlug";

/**
 * SCHOOLS CONTROLLER
 * Uganda Multi-School Management System
 */
export class SchoolsController {
  /**
   * CREATE SCHOOL
   * Platform Admin creates a school and becomes its admin
   */
  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        name,
        code,
        motto,
        vision,
        mission,
        email,
        phone,
        website,
        address,
        district,
        schoolType,
        schoolLevel,
        curriculum,
        ownership,
        establishedYear,
      } = req.body;

      if (!name || !code) {
        return res.status(400).json({
          success: false,
          message: "School name and code are required",
        });
      }

      if (!req.user?.userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const existingSchool = await db.school.findFirst({
        where: {
          OR: [{ name }, { code }],
        },
      });

      if (existingSchool) {
        return res.status(409).json({
          success: false,
          message: "School with same name or code already exists",
        });
      }
     
      const slug = generateSlug(name)

      const school = await db.school.create({
        data: {
          name,
          code,
          slug,
          motto,
          vision,
          mission,
          email,
          phone,
          website,
          address,
          district,
          schoolType,
          schoolLevel,
          curriculum,
          ownership,
          establishedYear,
          adminId: req.user.userId,
        },
      });

      return res.status(201).json({
        success: true,
        message: "School created successfully",
        data: school,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET ALL SCHOOLS
   * Platform Admin only
   */
  static async findAll(req: AuthenticatedRequest, res: Response) {
    try {
      const { isActive, isVerified } = req.query;

      const schools = await db.school.findMany({
        where: {
          isActive:
            isActive !== undefined ? isActive === "true" : undefined,
          isVerified:
            isVerified !== undefined ? isVerified === "true" : undefined,
        },
        include: {
          admin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return res.json({
        success: true,
        data: schools,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET SINGLE SCHOOL
   */
  static async findOne(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const school = await db.school.findUnique({
        where: { id },
        include: {
          admin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          roles: true,
        },
      });

      if (!school) {
        return res.status(404).json({
          success: false,
          message: "School not found",
        });
      }

      return res.json({
        success: true,
        data: school,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * UPDATE SCHOOL
   * Only Platform Admin or School Admin
   */
  static async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const school = await db.school.findUnique({ where: { id } });

      if (!school) {
        return res.status(404).json({
          success: false,
          message: "School not found",
        });
      }

      if (
        req.user?.userId !== school.adminId &&
        !req.user?.roles.includes("platform_admin")
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden",
        });
      }

      const updatedSchool = await db.school.update({
        where: { id },
        data: {
          ...req.body,
        },
      });

      return res.json({
        success: true,
        message: "School updated successfully",
        data: updatedSchool,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * DEACTIVATE SCHOOL (Soft Delete)
   */
  static async deactivate(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      await db.school.update({
        where: { id },
        data: {
          isActive: false,
        },
      });

      return res.json({
        success: true,
        message: "School deactivated successfully",
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * VERIFY SCHOOL
   */
  static async verify(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      await db.school.update({
        where: { id },
        data: {
          isVerified: true,
        },
      });

      return res.json({
        success: true,
        message: "School verified successfully",
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}
