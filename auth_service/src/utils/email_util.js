const nodemailer = require('nodemailer');

// Sử dụng tài khoản Gmail thật
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'hoangvhgch220975@fpt.edu.vn',
    // Mật khẩu ứng dụng (App Password) - Cần thiết lập trong file .env
    pass: process.env.EMAIL_APP_PASSWORD, 
  },
});

async function sendNewPasswordEmail(email, newPassword) {
  if (!process.env.EMAIL_APP_PASSWORD) {
    console.error("Vui lòng thiết lập biến môi trường EMAIL_APP_PASSWORD trong file .env của auth_service");
  }
  
  try {
    const info = await transporter.sendMail({
      from: '"SeatNow Admin" <hoangvhgch220975@fpt.edu.vn>',
      to: email,
      subject: "SeatNow - Password Reset Notification",
      text: `Your new password is: ${newPassword}`,
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 20px auto; padding: 0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #f0f0f0; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #6610f2 0%, #6f42c1 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">SeatNow</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0; font-size: 16px;">Security Notification</p>
          </div>
          <div style="padding: 40px; background-color: #ffffff;">
            <p style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin-bottom: 16px;">Hello,</p>
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Your request to reset your SeatNow password has been processed. Please find your temporary password below.</p>
            
            <div style="text-align: center; margin: 32px 0; padding: 24px; background-color: #f3f0ff; border-radius: 12px; border: 1px dashed #6f42c1;">
              <p style="color: #6f42c1; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px 0;">Temporary Password</p>
              <div style="font-size: 36px; font-weight: 800; color: #5227cc; font-family: 'Courier New', Courier, monospace; letter-spacing: 4px;">${newPassword}</div>
            </div>

            <div style="background-color: #fff9db; border-left: 4px solid #fcc419; padding: 16px; margin-bottom: 32px;">
              <p style="color: #856404; font-size: 14px; margin: 0; line-height: 1.5;"><strong>Security Tip:</strong> For your protection, please log in and update this password immediately in your account settings.</p>
            </div>

            <div style="text-align: center;">
              <p style="color: #718096; font-size: 14px; line-height: 1.6;">If you didn't request this change, you can safely ignore this email or contact support if you have concerns.</p>
            </div>
            
            <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #edf2f7; text-align: center;">
              <p style="color: #2d3748; font-size: 16px; font-weight: 600; margin: 0;">Best regards,</p>
              <p style="color: #6f42c1; font-size: 16px; font-weight: 700; margin: 4px 0 20px;">The SeatNow Team</p>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #a0aec0; font-size: 12px;">
            <p style="margin: 0;">© ${new Date().getFullYear()} SeatNow. Premium Dining Experience.</p>
            <p style="margin: 4px 0 0;">This is an automated message, please do not reply.</p>
          </div>
        </div>
      `,
    });
    console.log("Password email sent directly to: %s", email);
  } catch(err) {
    console.error('Lỗi khi gửi mail:', err);
  }
}

module.exports = {
  sendNewPasswordEmail
};
