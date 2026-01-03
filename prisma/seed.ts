import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Soma-Lite database seed...");

  // ==================== SYSTEM ROLES ====================
  console.log("Creating system roles...");

  const systemRoles = [
    {
      name: "Platform Administrator",
      slug: "platform_admin",
      description: "Full access to the entire platform. Can manage all schools.",
      isSystem: true,
      permissions: ["*"],
    },
    {
      name: "School Administrator",
      slug: "school_admin",
      description: "Full administrative access to a specific school.",
      isSystem: true,
      permissions: [
        "students:*",
        "teachers:*",
        "parents:*",
        "classes:*",
        "subjects:*",
        "exams:*",
        "marks:*",
        "reports:*",
        "fees:*",
        "attendance:*",
        "library:*",
        "inventory:*",
        "settings:*",
        "users:read",
        "users:create",
        "users:update",
      ],
    },
    {
      name: "Head Teacher",
      slug: "head_teacher",
      description: "Senior academic authority. Can approve reports and manage staff.",
      isSystem: true,
      permissions: [
        "students:read",
        "teachers:read",
        "teachers:update",
        "classes:*",
        "subjects:*",
        "exams:*",
        "marks:read",
        "reports:*",
        "attendance:read",
        "settings:read",
      ],
    },
    {
      name: "Deputy Head Teacher",
      slug: "deputy_head",
      description: "Assists the head teacher in administrative duties.",
      isSystem: true,
      permissions: [
        "students:read",
        "teachers:read",
        "classes:read",
        "subjects:read",
        "exams:read",
        "marks:read",
        "reports:read",
        "attendance:read",
      ],
    },
    {
      name: "Director of Studies",
      slug: "dos",
      description: "Manages academic programs, timetables, and examinations.",
      isSystem: true,
      permissions: [
        "students:read",
        "teachers:read",
        "classes:*",
        "subjects:*",
        "exams:*",
        "marks:*",
        "reports:generate",
        "attendance:read",
      ],
    },
    {
      name: "Bursar",
      slug: "bursar",
      description: "Manages school finances, fees, and payments.",
      isSystem: true,
      permissions: [
        "students:read",
        "fees:*",
        "inventory:*",
        "reports:read",
      ],
    },
    {
      name: "Teacher",
      slug: "teacher",
      description: "Can manage assigned classes, enter marks, and take attendance.",
      isSystem: true,
      permissions: [
        "students:read",
        "classes:read",
        "subjects:read",
        "exams:read",
        "marks:create",
        "marks:update",
        "attendance:create",
        "attendance:update",
        "reports:read",
      ],
    },
    {
      name: "Class Teacher",
      slug: "class_teacher",
      description: "Teacher with additional responsibilities for a specific class.",
      isSystem: true,
      permissions: [
        "students:read",
        "students:update",
        "classes:read",
        "subjects:read",
        "exams:read",
        "marks:create",
        "marks:update",
        "reports:generate",
        "attendance:*",
      ],
    },
    {
      name: "Librarian",
      slug: "librarian",
      description: "Manages library books and student loans.",
      isSystem: true,
      permissions: [
        "students:read",
        "library:*",
      ],
    },
    {
      name: "Store Keeper",
      slug: "store_keeper",
      description: "Manages inventory and school supplies.",
      isSystem: true,
      permissions: [
        "inventory:*",
      ],
    },
    {
      name: "Secretary",
      slug: "secretary",
      description: "Handles administrative tasks and communications.",
      isSystem: true,
      permissions: [
        "students:read",
        "teachers:read",
        "parents:read",
        "attendance:read",
      ],
    },
    {
      name: "Parent",
      slug: "parent",
      description: "Can view their children's academic information.",
      isSystem: true,
      permissions: [
        "students:read",
        "reports:read",
        "fees:read",
        "attendance:read",
      ],
    },
    {
      name: "Student",
      slug: "student",
      description: "Can view their own academic information.",
      isSystem: true,
      permissions: [
        "reports:read",
        "attendance:read",
        "library:read",
      ],
    },
  ];

  for (const role of systemRoles) {
    // Check if role already exists (using findFirst instead of upsert for null handling)
    const existingRole = await prisma.role.findFirst({
      where: {
        slug: role.slug,
        schoolId: null,
      },
    });

    if (existingRole) {
      // Update existing role
      await prisma.role.update({
        where: { id: existingRole.id },
        data: {
          name: role.name,
          description: role.description,
          permissions: role.permissions,
        },
      });
    } else {
      // Create new role
      await prisma.role.create({
        data: {
          name: role.name,
          slug: role.slug,
          description: role.description,
          isSystem: role.isSystem,
          permissions: role.permissions,
          schoolId: null,
        },
      });
    }
  }

  console.log(`✅ Created ${systemRoles.length} system roles`);

  // ==================== PLATFORM ADMIN USER ====================
  console.log("Creating platform admin user...");

  const adminEmail = process.env.ADMIN_EMAIL || "admin@soma-lite.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123456";

  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  // Check if admin user exists
  let adminUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        firstName: "Platform",
        lastName: "Admin",
        email: adminEmail,
        phone: "+256700000000",
        password: hashedPassword,
        status: "ACTIVE",
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
  }

  // Assign platform_admin role
  const platformAdminRole = await prisma.role.findFirst({
    where: {
      slug: "platform_admin",
      schoolId: null,
    },
  });

  if (platformAdminRole) {
    // Check if role assignment already exists
    const existingUserRole = await prisma.userRole.findFirst({
      where: {
        userId: adminUser.id,
        roleId: platformAdminRole.id,
        schoolId: null,
      },
    });

    if (!existingUserRole) {
      await prisma.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: platformAdminRole.id,
          schoolId: null,
        },
      });
    }
  }

  console.log(`✅ Platform admin created: ${adminEmail}`);

  // ==================== SYSTEM SETTINGS ====================
  console.log("Creating system settings...");

  const settings = [
    {
      key: "app_name",
      value: "Soma-Lite",
      description: "Application name",
      category: "general",
      isPublic: true,
    },
    {
      key: "app_tagline",
      value: "Smart School Management",
      description: "Application tagline",
      category: "general",
      isPublic: true,
    },
    {
      key: "support_email",
      value: "support@soma-lite.com",
      description: "Support email address",
      category: "general",
      isPublic: true,
    },
    {
      key: "default_currency",
      value: "UGX",
      description: "Default currency",
      category: "finance",
      isPublic: true,
    },
    {
      key: "sms_enabled",
      value: "false",
      description: "Enable SMS notifications",
      category: "notifications",
      isPublic: false,
    },
    {
      key: "email_enabled",
      value: "true",
      description: "Enable email notifications",
      category: "notifications",
      isPublic: false,
    },
    {
      key: "schoolpay_enabled",
      value: "false",
      description: "Enable SchoolPay integration",
      category: "payments",
      isPublic: false,
    },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {
        value: setting.value,
        description: setting.description,
        category: setting.category,
        isPublic: setting.isPublic,
      },
      create: setting,
    });
  }

  console.log(`✅ Created ${settings.length} system settings`);

  console.log("\n🎉 Database seed completed!");
  console.log("\n📝 Login credentials:");
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log("\n⚠️  Please change the admin password after first login!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
