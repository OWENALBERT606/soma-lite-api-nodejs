// import { db } from "@/db/db";
// import { Request, Response } from "express";

// /**
//  * ROLES CONTROLLER
//  * Uganda Multi-School Management System
//  */
// export class RolesController {
//   /**
//    * CREATE ROLE
//    */
//   static async create(req: Request, res: Response) {
//     try {
//       const {
//         name,
//         slug,
//         description,
//         permissions = [],
//         schoolId,
//         isSystem = false,
//       } = req.body;

//       if (!name || !slug) {
//         return res.status(400).json({
//           success: false,
//           message: "Role name and slug are required",
//         });
//       }

//       const existingRole = await db.role.findFirst({
//         where: {
//           slug,
//           schoolId: schoolId ?? null,
//         },
//       });

//       if (existingRole) {
//         return res.status(409).json({
//           success: false,
//           message: "Role with this slug already exists",
//         });
//       }

//       const role = await db.role.create({
//         data: {
//           name,
//           slug,
//           description,
//           permissions,
//           isSystem,
//           schoolId: schoolId ?? null,
//         },
//       });

//       return res.status(201).json({
//         success: true,
//         message: "Role created successfully",
//         data: role,
//       });
//     } catch (error: any) {
//       return res.status(500).json({
//         success: false,
//         message: error.message,
//       });
//     }
//   }

//   /**
//    * GET ALL ROLES
//    */
//   static async findAll(req: Request, res: Response) {
//     try {
//       const { schoolId } = req.query;

//       const roles = await db.role.findMany({
//         where: {
//           schoolId: schoolId ? (schoolId as string) : null,
//         },
//         include: {
//           userRoles: {
//             include: {
//               user: {
//                 select: {
//                   id: true,
//                   firstName: true,
//                   lastName: true,
//                   email: true,
//                 },
//               },
//             },
//           },
//         },
//         orderBy: {
//           createdAt: "asc",
//         },
//       });

//       return res.json({
//         success: true,
//         data: roles,
//       });
//     } catch (error: any) {
//       return res.status(500).json({
//         success: false,
//         message: error.message,
//       });
//     }
//   }

//   /**
//    * GET SINGLE ROLE
//    */
//   static async findOne(req: Request, res: Response) {
//     try {
//       const { id } = req.params;

//       const role = await db.role.findUnique({
//         where: { id },
//         include: {
//           userRoles: {
//             include: {
//               user: {
//                 select: {
//                   id: true,
//                   firstName: true,
//                   lastName: true,
//                   email: true,
//                 },
//               },
//               school: true,
//             },
//           },
//         },
//       });

//       if (!role) {
//         return res.status(404).json({
//           success: false,
//           message: "Role not found",
//         });
//       }

//       return res.json({
//         success: true,
//         data: role,
//       });
//     } catch (error: any) {
//       return res.status(500).json({
//         success: false,
//         message: error.message,
//       });
//     }
//   }

//   /**
//    * UPDATE ROLE
//    */
//   static async update(req: Request, res: Response) {
//     try {
//       const { id } = req.params;
//       const { name, description, permissions } = req.body;

//       const role = await db.role.findUnique({
//         where: { id },
//       });

//       if (!role) {
//         return res.status(404).json({
//           success: false,
//           message: "Role not found",
//         });
//       }

//       if (role.isSystem) {
//         return res.status(403).json({
//           success: false,
//           message: "System roles cannot be modified",
//         });
//       }

//       const updatedRole = await db.role.update({
//         where: { id },
//         data: {
//           name,
//           description,
//           permissions,
//         },
//       });

//       return res.json({
//         success: true,
//         message: "Role updated successfully",
//         data: updatedRole,
//       });
//     } catch (error: any) {
//       return res.status(400).json({
//         success: false,
//         message: error.message,
//       });
//     }
//   }

//   /**
//    * DELETE ROLE
//    */
//   static async delete(req: Request, res: Response) {
//     try {
//       const { id } = req.params;

//       const role = await db.role.findUnique({
//         where: { id },
//       });

//       if (!role) {
//         return res.status(404).json({
//           success: false,
//           message: "Role not found",
//         });
//       }

//       if (role.isSystem) {
//         return res.status(403).json({
//           success: false,
//           message: "System roles cannot be deleted",
//         });
//       }

//       const assignedUsers = await db.userRole.count({
//         where: { roleId: id },
//       });

//       if (assignedUsers > 0) {
//         return res.status(400).json({
//           success: false,
//           message: "Role is assigned to users and cannot be deleted",
//         });
//       }

//       await db.role.delete({
//         where: { id },
//       });

//       return res.json({
//         success: true,
//         message: "Role deleted successfully",
//       });
//     } catch (error: any) {
//       return res.status(400).json({
//         success: false,
//         message: error.message,
//       });
//     }
//   }
// }


import { Request, Response } from "express"
import { db } from "@/db/db"

/**
 * Simple slug generator (backend-owned)
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
}

/**
 * ROLES CONTROLLER
 * Uganda Multi-School Management System
 */
export class RolesController {
  /**
   * CREATE ROLE
   * Slug is auto-generated from name
   */
  static async create(req: Request, res: Response) {
    try {
      const {
        name,
        description,
        permissions = [],
        schoolId,
        isSystem = false,
      } = req.body

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Role name is required",
        })
      }

      // 🔐 Generate slug server-side
      let slug = slugify(name)
      let counter = 1

      // 🔐 Ensure uniqueness per school
      while (
        await db.role.findFirst({
          where: {
            slug,
            schoolId: schoolId ?? null,
          },
        })
      ) {
        slug = `${slugify(name)}_${counter++}`
      }

      const role = await db.role.create({
        data: {
          name,
          slug,
          description,
          permissions,
          isSystem,
          schoolId: schoolId ?? null,
        },
      })

      return res.status(201).json({
        success: true,
        message: "Role created successfully",
        data: role,
      })
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * GET ALL ROLES
   */
  static async findAll(req: Request, res: Response) {
    try {
      const { schoolId } = req.query

      const roles = await db.role.findMany({
        where: {
          schoolId: schoolId ? (schoolId as string) : null,
        },
        include: {
          userRoles: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      })

      return res.json({
        success: true,
        data: roles,
      })
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * GET SINGLE ROLE
   */
  static async findOne(req: Request, res: Response) {
    try {
      const { id } = req.params

      const role = await db.role.findUnique({
        where: { id },
        include: {
          userRoles: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              school: true,
            },
          },
        },
      })

      if (!role) {
        return res.status(404).json({
          success: false,
          message: "Role not found",
        })
      }

      return res.json({
        success: true,
        data: role,
      })
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * UPDATE ROLE
   * Slug is IMMUTABLE and cannot be changed
   */
  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { name, description, permissions } = req.body

      const role = await db.role.findUnique({
        where: { id },
      })

      if (!role) {
        return res.status(404).json({
          success: false,
          message: "Role not found",
        })
      }

      if (role.isSystem) {
        return res.status(403).json({
          success: false,
          message: "System roles cannot be modified",
        })
      }

      const updatedRole = await db.role.update({
        where: { id },
        data: {
          name,
          description,
          permissions,
        },
      })

      return res.json({
        success: true,
        message: "Role updated successfully",
        data: updatedRole,
      })
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * DELETE ROLE
   */
  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params

      const role = await db.role.findUnique({
        where: { id },
      })

      if (!role) {
        return res.status(404).json({
          success: false,
          message: "Role not found",
        })
      }

      if (role.isSystem) {
        return res.status(403).json({
          success: false,
          message: "System roles cannot be deleted",
        })
      }

      const assignedUsers = await db.userRole.count({
        where: { roleId: id },
      })

      if (assignedUsers > 0) {
        return res.status(400).json({
          success: false,
          message: "Role is assigned to users and cannot be deleted",
        })
      }

      await db.role.delete({
        where: { id },
      })

      return res.json({
        success: true,
        message: "Role deleted successfully",
      })
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  }
}
