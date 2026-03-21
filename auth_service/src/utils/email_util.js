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
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #eaebed; border-radius: 10px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a1a; margin: 0; font-size: 28px; letter-spacing: 1px;">SeatNow</h1>
            <div style="height: 3px; background-color: #d9534f; width: 60px; margin: 15px auto 0;"></div>
          </div>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">Hello,</p>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">We have received a request to reset the password for your SeatNow account. Your temporary password has been successfully generated.</p>
          <div style="text-align: center; margin: 35px 0;">
            <p style="color: #888888; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;"><strong>Your New Password</strong></p>
            <div style="display: inline-block; padding: 18px 40px; background-color: #f8f9fa; border: 2px dashed #e2e8f0; border-radius: 8px;">
              <span style="font-size: 28px; font-weight: bold; color: #d9534f; font-family: 'Courier New', Courier, monospace; letter-spacing: 3px;">${newPassword}</span>
            </div>
          </div>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">For your security, we strongly advise you to log in to your account and change this temporary password immediately.</p>
          <br/>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-top: 20px;">Best regards,<br><strong style="color: #1a1a1a;">The SeatNow Team</strong></p>
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eaebed; text-align: center; font-size: 12px; color: #9e9e9e; line-height: 1.5;">
            <p style="margin: 0 0 5px 0;">If you did not request a password reset, please contact our support team immediately.</p>
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} SeatNow. All rights reserved.</p>
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
