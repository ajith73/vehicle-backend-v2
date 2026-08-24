import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const sendOtpEmail = async (email: string, code: string) => {
  if (!resend) {
    console.warn(`Resend API Key is missing. Skipping email send for OTP: ${code} to ${email}`);
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "RoadResQ <support@roadresq.in>", // resend.dev is the default sandbox domain
      to: [email],
      subject: 'Your Verification Code',
      html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; padding: 40px 20px; text-align: center;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <h1 style="color: #111827; margin-bottom: 20px; font-size: 24px; font-weight: 800;">Verify Your Email</h1>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
              Please use the following 6-digit verification code to complete your sign-in process:
            </p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 30px;">
              <h2 style="color: #2563eb; font-size: 36px; font-weight: 900; letter-spacing: 12px; margin: 0;">${code}</h2>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 40px;">
              This code will expire in 1 hour. Do not share this code with anyone.
            </p>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin-bottom: 20px;" />
            
            <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin-bottom: 10px;">
              If you did not request this email, please safely ignore it.
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Need help? Contact us at <a href="mailto:support@roadresq.in" style="color: #2563eb; text-decoration: none;">support@roadresq.in</a>
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend Error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email: string, resetUrl: string) => {
  if (!resend) {
    console.warn(`Resend API Key is missing. Skipping password reset email to ${email}. Reset link: ${resetUrl}`);
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: "RoadResQ <support@roadresq.in>",
      to: [email],
      subject: 'Reset Your RoadResQ Password',
      html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; padding: 40px 20px; text-align: center;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <h1 style="color: #111827; margin-bottom: 20px; font-size: 24px; font-weight: 800;">Reset your password</h1>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
              Click the button below to create a new password for your RoadResQ account.
            </p>
            <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; padding: 14px 24px; border-radius: 12px; margin-bottom: 24px;">
              Reset password
            </a>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">
              This link will expire in 1 hour.
            </p>
            <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; word-break: break-all;">
              If the button does not work, use this link:<br />${resetUrl}
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend Error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
};
