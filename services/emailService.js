// services/emailService.js
const sgMail = require("@sendgrid/mail");

// Set SendGrid API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Generate OTP
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Email templates
const emailTemplates = {
  userRegistrationOTP: (userName, otp, website, company, expiration) => ({
    subject: `Welcome to ${company} - Verify Your Email`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4a90e2; padding: 20px; text-align: center; color: white; }
          .content { background-color: #fff; padding: 30px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .otp { font-size: 32px; font-weight: bold; text-align: center; margin: 30px 0; color: #4a90e2; letter-spacing: 5px; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6c757d; }
          .button { background-color: #4a90e2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${company}</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>Thank you for registering with <strong>${website}</strong>! We're excited to help you master your typing skills.</p>
            <p>To complete your registration and verify your email address, please use the following verification code:</p>
            <div class="otp">${otp}</div>
            <p>This verification code will expire in <strong>${expiration} minutes</strong>.</p>
            <p style="color: #dc2626;">⚠️ For your security, please do not share this code with anyone.</p>
            <p>If you didn't create an account with ${website}, please ignore this email.</p>
            <hr>
            <p style="font-size: 14px;">Start your typing journey today! Complete tests, earn XP, unlock badges, and climb the leaderboards.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${company}. All rights reserved.</p>
            <p>${website} - Master Your Typing Speed</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  otpVerification: (
    userName,
    otp,
    website,
    company,
    expiration,
    purpose = "verification",
  ) => ({
    subject:
      purpose === "password_reset"
        ? `Password Reset Request - ${company}`
        : `Your Verification Code - ${company}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4a90e2; padding: 20px; text-align: center; color: white; }
          .content { background-color: #fff; padding: 30px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .otp { font-size: 32px; font-weight: bold; text-align: center; margin: 30px 0; color: #4a90e2; letter-spacing: 5px; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${company}</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>Your ${purpose} code for <strong>${website}</strong> is:</p>
            <div class="otp">${otp}</div>
            <p>This code will expire in <strong>${expiration} minutes</strong>.</p>
            <p style="color: #dc2626;">⚠️ Please do not share this code with anyone.</p>
            <p>If you didn't request this ${purpose}, please ignore this email or contact support.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${company}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  welcome: (userName, website, company) => ({
    subject: `Welcome to ${company}! Your Account is Ready`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4a90e2; padding: 20px; text-align: center; color: white; }
          .content { background-color: #fff; padding: 30px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .button { background-color: #4a90e2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${company}!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>Your account with <strong>${website}</strong> has been successfully created and verified.</p>
            <p>You're now ready to begin your typing journey!</p>
            <p>🎯 <strong>What's waiting for you:</strong></p>
            <ul>
              <li>Interactive typing tests for SSC, Banking, Railway exams</li>
              <li>Daily challenges to keep you motivated</li>
              <li>Earn XP, level up, and unlock badges</li>
              <li>Compete on leaderboards with thousands of aspirants</li>
              <li>Track your progress with detailed analytics</li>
            </ul>
            <p style="text-align: center; margin-top: 30px;">
              <a href="${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard" class="button">Start Typing Now →</a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${company}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),
};

// Send email using SendGrid
const sendEmail = async (to, subject, html) => {
  try {
    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject,
      html,
    };

    const result = await sgMail.send(msg);
    console.log("Email sent via SendGrid:", result[0].statusCode);
    return true;
  } catch (error) {
    console.error(
      "Error sending email via SendGrid:",
      error.response?.body || error.message,
    );
    return false;
  }
};

// Send user registration OTP
const sendUserRegistrationOTP = async (email, context) => {
  const { name, otp, website, company, expiration } = context;
  const template = emailTemplates.userRegistrationOTP(
    name,
    otp,
    website.websiteName,
    company.name,
    expiration,
  );
  return await sendEmail(email, template.subject, template.html);
};

// Send OTP email (for password reset, verification)
const sendOTPEmail = async (email, context) => {
  const { name, otp, website, company, expiration, purpose } = context;
  const template = emailTemplates.otpVerification(
    name,
    otp,
    website,
    company,
    expiration,
    purpose,
  );
  return await sendEmail(email, template.subject, template.html);
};

// Send welcome email
const sendWelcomeEmail = async (email, context) => {
  const { name, website, company } = context;
  const template = emailTemplates.welcome(name, website, company);
  return await sendEmail(email, template.subject, template.html);
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendWelcomeEmail,
  sendUserRegistrationOTP,
  sendEmail,
};
