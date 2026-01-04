import { Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@/db/db";
import { AuthenticatedRequest } from "@/types/authenticated-request";
import { UserStatus } from "@prisma/client";

export class UsersController {
  /**
   * CREATE USER
   */
  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const { firstName, lastName, email, phone, password, roleSlug, schoolId } =
        req.body;

      if (!firstName || !lastName || !email || !phone || !password || !roleSlug) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      const existingUser = await db.user.findFirst({
        where: { OR: [{ email }, { phone }] },
      });

      if (existingUser) {
        return res.status(409).json({ success: false, message: "User with email or phone already exists" });
      }

      const role = await db.role.findFirst({
        where: { slug: roleSlug, schoolId: schoolId ?? null },
      });

      if (!role) {
        return res.status(404).json({ success: false, message: "Role not found" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await db.user.create({
        data: {
          firstName,
          lastName,
          email,
          phone,
          password: hashedPassword,
          userRoles: {
            create: {
              roleId: role.id,
              schoolId: schoolId ?? null,
              assignedBy: req.user?.userId,
            },
          },
        },
        include: {
          userRoles: { include: { role: true, school: true } },
        },
      });

      return res.status(201).json({ success: true, message: "User created successfully", data: user });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET ALL USERS
   */
  static async findAll(req: AuthenticatedRequest, res: Response) {
    try {
      const { schoolId, role, status } = req.query;

      const users = await db.user.findMany({
        where: {
          status: status ? (status as UserStatus) : undefined,
          userRoles: schoolId
            ? {
                some: {
                  schoolId: schoolId as string,
                  role: role ? { slug: role as string } : undefined,
                },
              }
            : undefined,
        },
        include: {
          userRoles: { include: { role: true, school: true } },
          managedSchools: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return res.json({ success: true, data: users });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET SINGLE USER
   */
  static async findOne(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const user = await db.user.findUnique({
        where: { id },
        include: {
          userRoles: { include: { role: true, school: true } },
          teacherProfile: true,
          studentProfile: true,
          parentProfile: true,
          employeeProfile: true,
          managedSchools: true,
        },
      });

      if (!user) return res.status(404).json({ success: false, message: "User not found" });

      return res.json({ success: true, data: user });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * UPDATE USER
   */
  static async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { firstName, lastName, phone, imageUrl, status } = req.body;

      const user = await db.user.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ success: false, message: "User not found" });

      const updatedUser = await db.user.update({
        where: { id },
        data: { firstName, lastName, phone, imageUrl, status },
      });

      return res.json({ success: true, message: "User updated successfully", data: updatedUser });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * DEACTIVATE USER
   */
  static async deactivate(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const user = await db.user.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ success: false, message: "User not found" });

      await db.user.update({ where: { id }, data: { status: UserStatus.DEACTIVATED } });

      return res.json({ success: true, message: "User deactivated successfully" });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * ASSIGN ROLE
   */
  static async assignRole(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId, roleSlug, schoolId } = req.body;

      const role = await db.role.findFirst({ where: { slug: roleSlug, schoolId: schoolId ?? null } });
      if (!role) return res.status(404).json({ success: false, message: "Role not found" });

      const assignment = await db.userRole.create({
        data: { userId, roleId: role.id, schoolId: schoolId ?? null, assignedBy: req.user?.userId },
      });

      return res.json({ success: true, message: "Role assigned successfully", data: assignment });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * REMOVE ROLE
   */
  static async removeRole(req: AuthenticatedRequest, res: Response) {
    try {
      const { userRoleId } = req.params;

      await db.userRole.delete({ where: { id: userRoleId } });

      return res.json({ success: true, message: "Role removed successfully" });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
