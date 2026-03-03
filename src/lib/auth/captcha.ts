export async function verifyCaptchaToken(captchaToken: string | undefined, ipAddress: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY || process.env.CAPTCHA_SECRET_KEY;

  if (!secret) {
    return { success: true, bypassed: true };
  }

  if (!captchaToken) {
    return { success: false, bypassed: false };
  }

  try {
    const payload = new URLSearchParams();
    payload.set("secret", secret);
    payload.set("response", captchaToken);
    payload.set("remoteip", ipAddress);

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload,
    });

    if (!response.ok) {
      return { success: false, bypassed: false };
    }

    const data = (await response.json()) as { success?: boolean };
    return { success: Boolean(data.success), bypassed: false };
  } catch {
    return { success: false, bypassed: false };
  }
}