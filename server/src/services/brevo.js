async function sendLoginOtpEmail({ email, name, otp }) {
  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is not configured");
  }

  if (!process.env.BREVO_SENDER_EMAIL) {
    throw new Error("BREVO_SENDER_EMAIL is not configured");
  }

  const senderName =
    process.env.BREVO_SENDER_NAME || "Nastro Blu";

  const htmlContent = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f7f3ec;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;padding:36px;color:#2d2a25;">
    
    <h2 style="margin:0 0 12px;color:#2D431F;">
      Nastro Blu
    </h2>

    <p style="font-size:16px;">
      Hi ${escapeHtml(name || "there")},
    </p>

    <p style="font-size:15px;line-height:1.6;">
      We received a request to sign in to your Nastro Blu account.
    </p>

    <p style="font-size:14px;margin-bottom:8px;">
      Your login verification code is:
    </p>

    <div style="
      display:inline-block;
      padding:14px 24px;
      background:#f1eadf;
      border-radius:10px;
      font-size:30px;
      font-weight:700;
      letter-spacing:8px;
      color:#6b351f;
    ">
      ${otp}
    </div>

    <p style="font-size:14px;line-height:1.6;margin-top:24px;">
      This code expires in <strong>5 minutes</strong>.
    </p>

    <p style="font-size:13px;color:#777;line-height:1.6;">
      If you did not try to sign in, you can safely ignore this email.
    </p>

    <hr style="border:0;border-top:1px solid #eee;margin:28px 0;">

    <p style="font-size:12px;color:#888;">
      Nastro Blu · Eat Better
    </p>
  </div>
</body>
</html>
`;

  const textContent =
`Nastro Blu login verification

Hi ${name || "there"},

Your login verification code is: ${otp}

This code expires in 5 minutes.

If you did not try to sign in, you can safely ignore this email.

Nastro Blu · Eat Better`;

  const response = await fetch(
    "https://api.brevo.com/v3/smtp/email",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: process.env.BREVO_SENDER_EMAIL,
        },
        to: [
          {
            email,
            name: name || "Nastro Blu customer",
          },
        ],
        subject: "Your Nastro Blu login code",
        htmlContent,
        textContent,
        tags: ["customer-login-otp"],
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Brevo error:", response.status, data);
    throw new Error("Could not send login verification email");
  }

  return data;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  sendLoginOtpEmail,
};