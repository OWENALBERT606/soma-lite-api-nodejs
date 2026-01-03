

// // utils/mailer.ts
// import * as React from "react";
// import { Resend } from "resend";
// import ResetPasswordEmail from "@/emails/reset-password-email";
// import VerificationCodeEmail from "@/emails/VerificationCodeEmail";

// const API_KEY = process.env.RESEND_API_KEY;
// if (!API_KEY) {
//   // Fail fast on boot if key is missing
//   // Prefer throwing here so you don't have silent runtime failures later
//   throw new Error("RESEND_API_KEY is not set");
// }

// const resend = new Resend(API_KEY);

// // must be a verified domain in Resend
// const FROM = process.env.MAIL_FROM || "Goldkach <info@goldkach.co.ug>";
// const REPLY_TO = process.env.MAIL_REPLY_TO || undefined;

// /** Common send helper */
// async function sendEmail(opts: {
//   to: string | string[];
//   subject: string;
//   react: React.ReactElement;
//   // Optional extras
//   tags?: { name: string; value: string }[];
// }) {
//   const { to, subject, react, tags } = opts;

//   // Optional plain-text fallback (helps deliverability)
//   // You can generate a simple text from your inputs when useful
//   const { data, error } = await resend.emails.send({
//     from: FROM,
//     to,
//     subject,
//     react,
//     replyTo: REPLY_TO,
//     // turn off tracking for security/transactional emails if you want
//     // headers: { "X-Entity-Ref-ID": crypto.randomUUID() },
//     // unsubscribe or marketing fields omitted (this is transactional)
//     tags, // shows up in Resend UI for filtering
//   });

//   if (error) {
//     // Log once on server; don't leak details to clients
//     console.error("[mailer] send failed:", error);
//     throw new Error("Email send failed");
//   }

//   console.log("[mailer] sent", { id: data?.id, to });
//   return { ok: true as const, id: data?.id };
// }

// /** Password reset link email */
// export async function sendResetEmailResend(args: {
//   to: string;
//   name?: string;
//   resetUrl: string;
// }) {
//   const { to, name = "there", resetUrl } = args;

//   return sendEmail({
//     to,
//     subject: "Reset your password",
//     react: React.createElement(ResetPasswordEmail, { name, resetUrl }),
//     tags: [{ name: "category", value: "password-reset" }],
//   });
// }

// /** 6-digit verification code email */
// export async function sendVerificationCodeResend(args: {
//   to: string;
//   name?: string;
//   code: string; // "123456"
// }) {
//   const { to, name = "there", code } = args;

//   return sendEmail({
//     to,
//     subject: "Your verification code",
//     react: React.createElement(VerificationCodeEmail, { name, code }),
//     tags: [{ name: "category", value: "email-verify" }],
//   });
// }




// utils/mailer.ts

import { Resend } from "resend";
import ResetPasswordEmail from "@/emails/reset-password-email";
import WelcomeEmail from "@/emails/welcome-email";
import AccountApprovedEmail from "@/emails/account-approved-email";
import VerificationCodeEmail from "@/emails/VerificationCodeEmail";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.MAIL_FROM || "Soma-Lite <no-reply@soma-lite.com>";

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
    subject: "Welcome to Soma-Lite!",
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