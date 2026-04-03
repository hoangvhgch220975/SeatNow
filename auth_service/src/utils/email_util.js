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
    console.error("Please set EMAIL_APP_PASSWORD in the .env file of auth_service");
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

async function sendWelcomeOwnerEmail(email, name, phone, newPassword) {
  if (!process.env.EMAIL_APP_PASSWORD) {
    console.error("Please set EMAIL_APP_PASSWORD in the .env file of auth_service");
  }
  
  try {
    const info = await transporter.sendMail({
      from: '"SeatNow Admin" <hoangvhgch220975@fpt.edu.vn>',
      to: email,
      subject: "Welcome to SeatNow - Your Partner Account",
      text: `Hello ${name}, welcome to SeatNow. Your account has been created. Password: ${newPassword}`,
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 20px auto; padding: 0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #f0f0f0; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">SeatNow</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0; font-size: 16px;">Welcome Partner!</p>
          </div>
          <div style="padding: 40px; background-color: #ffffff;">
            <p style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin-bottom: 16px;">Hello ${name},</p>
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Congratulations! Your request to join SeatNow as a Partner has been approved by our Admin. Your Restaurant Owner account has been successfully created.</p>
            
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin-bottom: 12px;">Here are your initial login credentials:</p>
 
             <div style="text-align: center; margin: 24px 0; padding: 24px; background-color: #e6fffa; border-radius: 12px; border: 1px dashed #059669;">
               <p style="color: #059669; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px 0;">Phone Number</p>
               <div style="font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 16px;">${phone}</div>
               
               <p style="color: #059669; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px 0;">Temporary Password</p>
               <div style="font-size: 36px; font-weight: 800; color: #047857; font-family: 'Courier New', Courier, monospace; letter-spacing: 4px;">${newPassword}</div>
             </div>
 
             <div style="background-color: #fff9db; border-left: 4px solid #fcc419; padding: 16px; margin-bottom: 32px;">
               <p style="color: #856404; font-size: 14px; margin: 0; line-height: 1.5;"><strong>Security Tip:</strong> Please log in to the Partner Portal and change this temporary password immediately.</p>
             </div>
 
             <div style="text-align: center;">
               <p style="color: #718096; font-size: 14px; line-height: 1.6;">We are excited to have you on board! If you have any questions, feel free to reach out to our partner support team.</p>
             </div>
             
             <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #edf2f7; text-align: center;">
               <p style="color: #2d3748; font-size: 16px; font-weight: 600; margin: 0;">Best regards,</p>
               <p style="color: #059669; font-size: 16px; font-weight: 700; margin: 4px 0 20px;">The SeatNow Team</p>
             </div>
           </div>
           <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #a0aec0; font-size: 12px;">
             <p style="margin: 0;">© ${new Date().getFullYear()} SeatNow. Premium Dining Experience.</p>
             <p style="margin: 4px 0 0;">This is an automated message, please do not reply.</p>
           </div>
         </div>
       `,
     });
     console.log("Welcome Owner email sent to: %s", email);
   } catch(err) {
     console.error('Lỗi khi gửi mail welcome:', err);
   }
 }
 
 async function sendOtpEmail(email, otp) {
  if (!process.env.EMAIL_APP_PASSWORD) {
    console.error("Please set EMAIL_APP_PASSWORD in the .env file of auth_service");
  }
  
  try {
    const info = await transporter.sendMail({
      from: '"SeatNow Security" <hoangvhgch220975@fpt.edu.vn>',
      to: email,
      subject: `SeatNow - Your Verification Code [${otp}]`,
      text: `Your SeatNow verification code is: ${otp}. This code will expire in 2 minutes.`,
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 20px auto; padding: 0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #f0f0f0; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">SeatNow</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0; font-size: 16px;">Identity Verification</p>
          </div>
          <div style="padding: 40px; background-color: #ffffff;">
            <p style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin-bottom: 16px;">Almost there,</p>
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Please use the following verification code to secure your SeatNow account action. For your safety, do not share this code with anyone.</p>
            
            <div style="text-align: center; margin: 32px 0; padding: 32px; background-color: #f5f3ff; border-radius: 12px; border: 2px solid #ddd6fe;">
              <p style="color: #7c3aed; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 16px 0;">Your Verification Code</p>
              <div style="font-size: 48px; font-weight: 800; color: #4338ca; font-family: 'Courier New', Courier, monospace; letter-spacing: 12px; margin-left: 12px;">${otp}</div>
              <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0 0;">Expires in 2 minutes</p>
            </div>
 
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 32px;">
              <p style="color: #991b1b; font-size: 14px; margin: 0; line-height: 1.5;"><strong>Warning:</strong> If you didn't request this code, your account might be at risk. Please change your password immediately.</p>
            </div>
 
            <div style="text-align: center;">
              <p style="color: #64748b; font-size: 14px;">This code was sent to <span style="color: #4f46e5; font-weight: 500;">${email}</span></p>
            </div>
            
            <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #edf2f7; text-align: center;">
              <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">Best regards,</p>
              <p style="color: #4f46e5; font-size: 16px; font-weight: 700; margin: 4px 0 20px;">The SeatNow Team</p>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
            <p style="margin: 0;">© ${new Date().getFullYear()} SeatNow. Secure Authentication Service.</p>
            <p style="margin: 4px 0 0;">This is an automated message, please do not reply.</p>
          </div>
        </div>
      `,
    });
    console.log("OTP email sent to: %s", email);
  } catch(err) {
    console.error('Lỗi khi gửi mail OTP:', err);
  }
}

module.exports = {
  sendNewPasswordEmail,
  sendWelcomeOwnerEmail,
  sendOtpEmail
};
