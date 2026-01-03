// utils/mailer.ts

import { Resend } from "resend";
import ResetPasswordEmail from "@/emails/reset-password-email";
import VerificationCodeEmail from "@/emails/VerificationCodeEmail";
import WelcomeEmail from "@/emails/welcome-email";
import AccountApprovedEmail from "@/emails/account-approved-email";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.MAIL_FROM || "School MS <no-reply@schoolms.com>";

// ==================== VERIFICATION CODE EMAIL ====================

export async function sendVerificationCode(args: {
  to: string;
  name?: string;
  code: string;
}) {
  const { to, name, code } = args;
  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `${code} - Verify your email`,
    react: VerificationCodeEmail({ name, code }),
  });
  if (error) throw error;
  console.log("Verification email id:", data?.id, "to:", to);
  return { ok: true as const, id: data?.id };
}

// ==================== PASSWORD RESET EMAIL ====================

export async function sendPasswordResetEmail(args: {
  to: string;
  name?: string;
  resetUrl: string;
}) {
  const { to, name, resetUrl } = args;
  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your password",
    react: ResetPasswordEmail({ name, resetUrl }),
  });
  if (error) throw error;
  console.log("Password reset email id:", data?.id, "to:", to);
  return { ok: true as const, id: data?.id };
}

// ==================== WELCOME EMAIL ====================

export async function sendWelcomeEmail(args: {
  to: string;
  name?: string;
  schoolName?: string;
  loginUrl: string;
}) {
  const { to, name, schoolName, loginUrl } = args;
  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Welcome to School Management System",
    react: WelcomeEmail({ name, schoolName, loginUrl }),
  });
  if (error) throw error;
  console.log("Welcome email id:", data?.id, "to:", to);
  return { ok: true as const, id: data?.id };
}

// ==================== ACCOUNT APPROVED EMAIL ====================

export async function sendAccountApprovedEmail(args: {
  to: string;
  name?: string;
  loginUrl: string;
}) {
  const { to, name, loginUrl } = args;
  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Your account has been approved!",
    react: AccountApprovedEmail({ name, loginUrl }),
  });
  if (error) throw error;
  console.log("Account approved email id:", data?.id, "to:", to);
  return { ok: true as const, id: data?.id };
}