import nodemailer from "nodemailer";
import { env } from "../config/env";

const DEFAULT_LOGO =
  "https://res.cloudinary.com/dsrkyrgpn/image/upload/v1729079643/dailyquill-logo.png";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.email.user, pass: env.email.pass },
    });
  }
  return transporter;
}

function otpTemplate(otp: string, email: string, heading: string) {
  const digits = otp
    .split("")
    .map(
      (digit) =>
        `<td style="font-size:20px; font-weight:600; border-bottom:2px solid #333; padding:0 6px;">${digit}</td>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>DailyQuill Verification</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Segoe UI, Tahoma, Geneva, Verdana, sans-serif;">
    <div style="width:100%; padding:40px 0;">
      <table align="center" cellpadding="0" cellspacing="0" width="100%" style="max-width:440px; background-color:#ffffff; border-radius:12px; padding:40px; margin:0 auto;">
        <tr>
          <td style="font-size:22px; font-weight:bold; color:#111; padding-bottom:10px; text-align:center;">
            <img src="${DEFAULT_LOGO}" alt="DailyQuill" width="60" style="vertical-align:middle;" />
            <span style="font-size:22px; font-weight:bold;">DailyQuill</span>
          </td>
        </tr>
        <tr><td style="font-size:20px; font-weight:600; text-align:center; padding-bottom:10px;">${heading}</td></tr>
        <tr>
          <td style="font-size:13px; color:#555; text-align:center; padding-bottom:15px;">
            Here's your DailyQuill verification code.<br />It expires in 5 minutes, so be sure to use it soon.
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:15px; text-align:center;">
            <table align="center" cellpadding="0" cellspacing="10"><tr>${digits}</tr></table>
          </td>
        </tr>
        <tr><td style="font-size:13px; color:#444; text-align:center; padding-bottom:5px;">This code is tied to</td></tr>
        <tr><td style="font-size:13px; font-weight:600; color:#637eff; text-align:center; padding-bottom:10px;">${email}</td></tr>
        <tr><td style="font-size:11px; color:#999; text-align:center;">If you didn't request this email, you can safely ignore it.</td></tr>
      </table>
    </div>
  </body>
</html>`;
}

export async function sendOtpEmail(
  email: string,
  otp: string,
  heading = "Let's verify it's you"
) {
  if (!env.email.user || !env.email.pass) {
    // In local development without SMTP credentials, log the code instead of
    // failing the request so the OTP flows stay testable.
    console.warn(`[mailer] SMTP not configured — OTP for ${email} is ${otp}`);
    return;
  }

  await getTransporter().sendMail({
    from: env.email.user,
    to: email,
    subject: "🛡️ Your DailyQuill Verification Code",
    html: otpTemplate(otp, email, heading),
  });
}
