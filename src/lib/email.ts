import nodemailer from "nodemailer";

const {
  EMAIL_SERVER_HOST,
  EMAIL_SERVER_PORT,
  EMAIL_SERVER_USER,
  EMAIL_SERVER_PASSWORD,
  EMAIL_FROM,
  NEXTAUTH_URL,
} = process.env;

type AuthLinkPayload = {
  selector: string;
  secret: string;
  expires: string;
  signature: string;
};

function hasEmailConfig() {
  return Boolean(
    EMAIL_SERVER_HOST &&
    EMAIL_SERVER_PORT &&
    EMAIL_SERVER_USER &&
    EMAIL_SERVER_PASSWORD &&
    EMAIL_FROM &&
    NEXTAUTH_URL
  );
}

const transporter = hasEmailConfig()
  ? nodemailer.createTransport({
      host: EMAIL_SERVER_HOST,
      port: parseInt(EMAIL_SERVER_PORT!, 10),
      secure: parseInt(EMAIL_SERVER_PORT!, 10) === 465,
      auth: {
        user: EMAIL_SERVER_USER,
        pass: EMAIL_SERVER_PASSWORD,
      },
    })
  : null;

export async function sendVerificationEmail(
  email: string,
  link: AuthLinkPayload,
  userType: "user" | "vendor"
) {
  if (!hasEmailConfig() || !transporter || !NEXTAUTH_URL) {
    console.warn("[email] Email config missing. Skipping verification email send.");
    return { success: false };
  }

  const verificationUrl = `${NEXTAUTH_URL}/auth/verify-email?s=${encodeURIComponent(link.selector)}&t=${encodeURIComponent(link.secret)}&e=${encodeURIComponent(link.expires)}&sig=${encodeURIComponent(link.signature)}&type=${encodeURIComponent(userType)}`;

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: "Verify your email address",
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h1 style="color: #7c3aed;">Welcome to MultiVendor Marketplace!</h1>
          <p>Thank you for creating your ${userType} account. Please click the button below to verify your email address:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}"
              style="background-color: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #7c3aed;">${verificationUrl}</p>
          <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error("Error sending verification email:", error);
    return { success: false };
  }
}

export async function sendPasswordResetEmail(
  email: string,
  link: AuthLinkPayload,
  userType: "user" | "vendor"
) {
  if (!hasEmailConfig() || !transporter || !NEXTAUTH_URL) {
    console.warn("[email] Email config missing. Skipping password reset email send.");
    return { success: false };
  }

  const resetUrl = `${NEXTAUTH_URL}/auth/reset-password?s=${encodeURIComponent(link.selector)}&t=${encodeURIComponent(link.secret)}&e=${encodeURIComponent(link.expires)}&sig=${encodeURIComponent(link.signature)}&type=${encodeURIComponent(userType)}`;

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: "Reset your password",
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h1 style="color: #7c3aed;">Password Reset Request</h1>
          <p>You requested to reset your password for your ${userType} account. Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
              style="background-color: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #7c3aed;">${resetUrl}</p>
          <p style="color: #666; font-size: 14px;">This link will expire in 15 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this password reset, please ignore this email.</p>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return { success: false };
  }
}

export async function sendOtpEmail(email: string, code: string) {
  if (!hasEmailConfig() || !transporter) {
    return { success: false };
  }

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: "Your login code",
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h1 style="color: #7c3aed;">Your one-time login code</h1>
          <p>Use this code to complete sign-in. The code expires in 10 minutes.</p>
          <div style="text-align: center; margin: 24px 0;">
            <div style="display: inline-block; letter-spacing: 8px; font-size: 32px; font-weight: bold; padding: 12px 20px; border: 1px solid #ddd; border-radius: 8px;">${code}</div>
          </div>
          <p style="color: #666; font-size: 14px;">If you did not request this code, ignore this email.</p>
        </div>
      `,
    });

    return { success: true };
  } catch {
    return { success: false };
  }
}
