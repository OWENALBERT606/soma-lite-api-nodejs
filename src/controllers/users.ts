import { Request, Response } from "express"
import bcrypt from "bcryptjs"
import { db } from "@/db/db"

/**
 * USERS CONTROLLER
 * Uganda Multi-School Management System
 */
export class UsersController {
  /**
   * CREATE USER
   */
  static async create(req: Request, res: Response) {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        password,
        staffId,
        imageUrl,
        roles = [],
      } = req.body

      if (!firstName || !lastName || !email || !phone || !password) {
        return res.status(400).json({
          success: false,
          message: "Required fields are missing",
        })
      }

      const existingUser = await db.user.findFirst({
        where: {
          OR: [{ email }, { phone }],
        },
      })

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "User with provided credentials already exists",
        })
      }

      const hashedPassword = await bcrypt.hash(password, 10)

      const user = await db.user.create({
        data: {
          firstName,
          lastName,
          email,
          phone,
          staffId,
          imageUrl,
          password: hashedPassword,
          userRoles: {
            create: roles.map((roleId: string) => ({
              roleId,
            })),
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          isVerified: true,
          createdAt: true,
        },
      })

      return res.status(201).json({
        success: true,
        message: "User created successfully",
        data: user,
      })
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * GET ALL USERS
   */
  static async findAll(req: Request, res: Response) {
    try {
      const { status } = req.query

      const users = await db.user.findMany({
        where: {
          status: status ? (status as any) : undefined,
        },
        include: {
          userRoles: {
            include: {
              role: true,
              school: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      return res.json({
        success: true,
        data: users,
      })
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * GET SINGLE USER
   */
  static async findOne(req: Request, res: Response) {
    try {
      const { id } = req.params

      const user = await db.user.findUnique({
        where: { id },
        include: {
          userRoles: {
            include: {
              role: true,
              school: true,
            },
          },
          teacherProfile: true,
          studentProfile: true,
          parentProfile: true,
          employeeProfile: true,
        },
      })

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        })
      }

      const { password, resetToken, ...safeUser } = user

      return res.json({
        success: true,
        data: safeUser,
      })
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * UPDATE USER
   */
  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const {
        firstName,
        lastName,
        phone,
        imageUrl,
        status,
      } = req.body

      const user = await db.user.findUnique({
        where: { id },
      })

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        })
      }

      const updatedUser = await db.user.update({
        where: { id },
        data: {
          firstName,
          lastName,
          phone,
          imageUrl,
          status,
        },
      })

      return res.json({
        success: true,
        message: "User updated successfully",
        data: updatedUser,
      })
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * VERIFY USER
   */
  static async verify(req: Request, res: Response) {
    try {
      const { id } = req.params

      const user = await db.user.findUnique({
        where: { id },
      })

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        })
      }

      await db.user.update({
        where: { id },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
          status: "ACTIVE",
        },
      })

      return res.json({
        success: true,
        message: "User verified successfully",
      })
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * DELETE USER
   */
  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params

      const user = await db.user.findUnique({
        where: { id },
      })

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        })
      }

      await db.user.delete({
        where: { id },
      })

      return res.json({
        success: true,
        message: "User deleted successfully",
      })
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }
}
