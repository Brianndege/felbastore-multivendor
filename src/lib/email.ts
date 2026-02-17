import nodemailer from "nodemailer";

const {
  EMAIL_SERVER_HOST,
  EMAIL_SERVER_PORT,
  EMAIL_SERVER_USER,
  EMAIL_SERVER_PASSWORD,
  EMAIL_FROM,
  NEXTAUTH_URL,
} = process.env;

// Basic env validation (prevents silent crashes)
if (
  !EMAIL_SERVER_HOST ||
  !EMAIL_SERVER_PORT ||
  !EMAIL_SERVER_USER ||
  !EMAIL_SERVER_PASSWORD ||
  !EMAIL_FROM ||
  !NEXTAUTH_URL
) {
  throw new Error("Missing required email environment variables.");
}

const transporter = nodemailer.createTransport({
  host: EMAIL_SERVER_HOST,
  port: parseInt(EMAIL_SERVER_PORT, 10),
  secure: parseInt(EMAIL_SERVER_PORT, 10) === 465, // true for 465, false otherwise
  auth: {
    user: EMAIL_SERVER_USER,
    pass: EMAIL_SERVER_PASSWORD,
  },
});

export async function sendVerificationEmail(
  email: string,
  token: string,
  userType: "user" | "vendor"
) {
  const verificationUrl = `${NEXTAUTH_URL}/auth/verify-email?token=${token}&type=${userType}`;

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
  token: string,
  userType: "user" | "vendor"
) {
  const resetUrl = `${NEXTAUTH_URL}/auth/reset-password?token=${token}&type=${userType}`;

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
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
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
