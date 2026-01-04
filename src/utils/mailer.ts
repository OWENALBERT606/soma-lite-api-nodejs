// // utils/mailer.ts

// import { Resend } from "resend";
// import ResetPasswordEmail from "@/emails/reset-password-email";
// import VerificationCodeEmail from "@/emails/VerificationCodeEmail";
// import WelcomeEmail from "@/emails/welcome-email";
// import AccountApprovedEmail from "@/emails/account-approved-email";

// const resend = new Resend(process.env.RESEND_API_KEY!);
// const FROM = process.env.MAIL_FROM || "School MS <no-reply@schoolms.com>";

// // ==================== VERIFICATION CODE EMAIL ====================

// export async function sendVerificationCode(args: {
//   to: string;
//   name?: string;
//   code: string;
// }) {
//   const { to, name, code } = args;
//   const { data, error } = await resend.emails.send({
//     from: FROM,
//     to,
//     subject: `${code} - Verify your email`,
//     react: VerificationCodeEmail({ name, code }),
//   });
//   if (error) throw error;
//   console.log("Verification email id:", data?.id, "to:", to);
//   return { ok: true as const, id: data?.id };
// }

// // ==================== PASSWORD RESET EMAIL ====================

// export async function sendPasswordResetEmail(args: {
//   to: string;
//   name?: string;
//   resetUrl: string;
// }) {
//   const { to, name, resetUrl } = args;
//   const { data, error } = await resend.emails.send({
//     from: FROM,
//     to,
//     subject: "Reset your password",
//     react: ResetPasswordEmail({ name, resetUrl }),
//   });
//   if (error) throw error;
//   console.log("Password reset email id:", data?.id, "to:", to);
//   return { ok: true as const, id: data?.id };
// }

// // ==================== WELCOME EMAIL ====================

// export async function sendWelcomeEmail(args: {
//   to: string;
//   name?: string;
//   schoolName?: string;
//   loginUrl: string;
// }) {
//   const { to, name, schoolName, loginUrl } = args;
//   const { data, error } = await resend.emails.send({
//     from: FROM,
//     to,
//     subject: "Welcome to School Management System",
//     react: WelcomeEmail({ name, schoolName, loginUrl }),
//   });
//   if (error) throw error;
//   console.log("Welcome email id:", data?.id, "to:", to);
//   return { ok: true as const, id: data?.id };
// }

// // ==================== ACCOUNT APPROVED EMAIL ====================

// export async function sendAccountApprovedEmail(args: {
//   to: string;
//   name?: string;
//   loginUrl: string;
// }) {
//   const { to, name, loginUrl } = args;
//   const { data, error } = await resend.emails.send({
//     from: FROM,
//     to,
//     subject: "Your account has been approved!",
//     react: AccountApprovedEmail({ name, loginUrl }),
//   });
//   if (error) throw error;
//   console.log("Account approved email id:", data?.id, "to:", to);
//   return { ok: true as const, id: data?.id };
// }



// src/utils/mailer.ts
// Email utility functions - Replace with real implementation (Resend, Nodemailer, etc.)

interface VerificationEmailParams {
  to: string;
  name: string;
  code: string;
}

interface PasswordResetEmailParams {
  to: string;
  name: string;
  resetUrl: string;
}

interface WelcomeEmailParams {
  to: string;
  name: string;
  tempPassword?: string;
  loginUrl?: string;
}

interface AccountApprovedEmailParams {
  to: string;
  name: string;
  loginUrl: string;
}

interface SchoolOnboardingEmailParams {
  to: string;
  name: string;
  schoolName: string;
  schoolCode: string;
  tempPassword: string;
  loginUrl: string;
}

/**
 * Send verification code email
 */
export async function sendVerificationCode(params: VerificationEmailParams): Promise<void> {
  console.log(`📧 [MAILER] Verification code to ${params.to}`);
  console.log(`   Name: ${params.name}`);
  console.log(`   Code: ${params.code}`);
  
  // TODO: Implement with Resend or your preferred email service
  // Example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: process.env.MAIL_FROM || 'Soma-Lite <no-reply@soma-lite.com>',
  //   to: params.to,
  //   subject: 'Verify Your Email - Soma-Lite',
  //   html: `
  //     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  //       <div style="background: linear-gradient(135deg, #5B9BD5, #4A8BC2); padding: 30px; text-align: center;">
  //         <h1 style="color: white; margin: 0;">Soma-Lite</h1>
  //         <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0;">Smart School Management</p>
  //       </div>
  //       <div style="padding: 30px; background: #f9f9f9;">
  //         <h2>Hi ${params.name},</h2>
  //         <p>Your verification code is:</p>
  //         <div style="background: #5B9BD5; color: white; font-size: 32px; letter-spacing: 8px; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
  //           ${params.code}
  //         </div>
  //         <p>This code expires in 30 minutes.</p>
  //       </div>
  //     </div>
  //   `
  // });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<void> {
  console.log(`📧 [MAILER] Password reset to ${params.to}`);
  console.log(`   Name: ${params.name}`);
  console.log(`   Reset URL: ${params.resetUrl}`);
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
  console.log(`📧 [MAILER] Welcome email to ${params.to}`);
  console.log(`   Name: ${params.name}`);
  if (params.tempPassword) {
    console.log(`   Temp Password: ${params.tempPassword}`);
  }
  if (params.loginUrl) {
    console.log(`   Login URL: ${params.loginUrl}`);
  }
}

/**
 * Send account approved email
 */
export async function sendAccountApprovedEmail(params: AccountApprovedEmailParams): Promise<void> {
  console.log(`📧 [MAILER] Account approved email to ${params.to}`);
  console.log(`   Name: ${params.name}`);
  console.log(`   Login URL: ${params.loginUrl}`);
}

/**
 * Send school onboarding email to new school admin
 */
export async function sendSchoolOnboardingEmail(params: SchoolOnboardingEmailParams): Promise<void> {
  console.log(`📧 [MAILER] School onboarding email to ${params.to}`);
  console.log(`   Name: ${params.name}`);
  console.log(`   School: ${params.schoolName} (${params.schoolCode})`);
  console.log(`   Temp Password: ${params.tempPassword}`);
  console.log(`   Login URL: ${params.loginUrl}`);

  // TODO: Implement with your email service
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: process.env.MAIL_FROM || 'Soma-Lite <no-reply@soma-lite.com>',
  //   to: params.to,
  //   subject: `Welcome to Soma-Lite - ${params.schoolName}`,
  //   html: `
  //     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  //       <div style="background: linear-gradient(135deg, #5B9BD5, #4A8BC2); padding: 30px; text-align: center;">
  //         <h1 style="color: white; margin: 0;">Soma-Lite</h1>
  //         <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0;">Smart School Management</p>
  //       </div>
  //       <div style="padding: 30px; background: #f9f9f9;">
  //         <h2>Welcome, ${params.name}!</h2>
  //         <p>You have been assigned as the administrator for <strong>${params.schoolName}</strong>.</p>
  //         <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
  //           <p><strong>School Code:</strong> ${params.schoolCode}</p>
  //           <p><strong>Your temporary password:</strong></p>
  //           <code style="background: #f0f0f0; padding: 10px 20px; display: block; text-align: center; font-size: 18px; border-radius: 4px;">
  //             ${params.tempPassword}
  //           </code>
  //         </div>
  //         <p>Please login and change your password immediately.</p>
  //         <a href="${params.loginUrl}" style="display: inline-block; background: #5B9BD5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin-top: 20px;">
  //           Login Now
  //         </a>
  //       </div>
  //     </div>
  //   `
  // });
}