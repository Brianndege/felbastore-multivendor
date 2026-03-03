export const GENERIC_ACCOUNT_MESSAGE = "If an account exists, we'll send further instructions.";
export const GENERIC_OTP_MESSAGE = "If an account exists, we'll send a one-time code.";

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const OTP_TTL_MS = 10 * 60 * 1000;

export const PASSWORD_RESET_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 5,
  captchaAfter: 3,
};

export const OTP_REQUEST_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 5,
  captchaAfter: 3,
};

export const OTP_VERIFY_RATE_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 20,
};

export const VERIFY_RESEND_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 5,
  captchaAfter: 3,
};

export const OTP_MAX_ATTEMPTS = 5;