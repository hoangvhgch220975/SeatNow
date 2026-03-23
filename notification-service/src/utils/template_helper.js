/**
 * template_helper.js - helpers to generate professional HTML emails
 */

function baseTemplate(title, preheader, contentHtml) {
  const currentYear = new Date().getFullYear();
  return `
    <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 20px auto; padding: 0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #f0f0f0; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, #6610f2 0%, #6f42c1 100%); padding: 40px 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">SeatNow</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0; font-size: 16px;">${preheader}</p>
      </div>
      <div style="padding: 40px; background-color: #ffffff;">
        <h2 style="color: #1a1a1a; font-size: 22px; font-weight: 700; margin-bottom: 24px; text-align: center;">${title}</h2>
        
        ${contentHtml}

        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #edf2f7; text-align: center;">
          <p style="color: #2d3748; font-size: 16px; font-weight: 600; margin: 0;">Warm regards,</p>
          <p style="color: #6f42c1; font-size: 16px; font-weight: 700; margin: 4px 0 20px;">The SeatNow Team</p>
        </div>
      </div>
      <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #a0aec0; font-size: 12px;">
        <p style="margin: 0;">© ${currentYear} SeatNow. Premium Dining Experience.</p>
        <p style="margin: 4px 0 0;">This is an automated message, please do not reply.</p>
      </div>
    </div>
  `;
}

function getBookingConfirmedTemplate(data) {
  const { guestName, restaurantName, bookingCode, bookingDate, bookingTime, numGuests, address } = data;
  const content = `
    <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">Hello <strong>${guestName}</strong>,</p>
    <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">Your booking at <strong>${restaurantName}</strong> has been successfully confirmed. We look forward to serving you.</p>
    
    <div style="margin: 32px 0; padding: 24px; background-color: #f3f0ff; border-radius: 12px; border: 1px solid #e9d8fd;">
      <h3 style="color: #6f42c1; font-size: 14px; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 1px;">Booking Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #718096; font-size: 14px;">Booking Code:</td>
          <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 700; text-align: right;">${bookingCode}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #718096; font-size: 14px;">Time:</td>
          <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 700; text-align: right;">${bookingTime}, ${bookingDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #718096; font-size: 14px;">Guests:</td>
          <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 700; text-align: right;">${numGuests} person(s)</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #718096; font-size: 14px;">Address:</td>
          <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 700; text-align: right;">${address}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #f0fff4; border-left: 4px solid #38a169; padding: 16px; margin-bottom: 24px;">
      <p style="color: #276749; font-size: 14px; margin: 0; line-height: 1.5;">Please arrive on time for the best experience. If you need to make changes, please let us know via Hotline or the app.</p>
    </div>
  `;
  return baseTemplate('Booking Confirmed', 'Booking Confirmation', content);
}

function getBookingCancelledTemplate(data) {
  const { guestName, restaurantName, bookingCode, reason } = data;
  const content = `
    <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">Hello <strong>${guestName}</strong>,</p>
    <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">We regret to inform you that your booking <strong>${bookingCode}</strong> at <strong>${restaurantName}</strong> has been cancelled.</p>
    
    <div style="margin: 32px 0; padding: 24px; background-color: #fff5f5; border-radius: 12px; border: 1px solid #fed7d7;">
      <h3 style="color: #e53e3e; font-size: 14px; margin: 0 0 12px 0; text-transform: uppercase;">Reason for Cancellation</h3>
      <p style="color: #c53030; font-size: 16px; margin: 0; font-weight: 600;">${reason || 'Restaurant or system adjustment'}</p>
    </div>

    <p style="color: #718096; font-size: 14px; line-height: 1.6; text-align: center;">If you have any questions, please contact SeatNow support. We hope to serve you next time.</p>
  `;
  return baseTemplate('Booking Cancelled', 'Booking Cancellation', content);
}

function getPromotionTemplate(data) {
  const { guestName, restaurantName, promotionName, description, discountValue, expiryDate } = data;
  const content = `
    <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">Hello <strong>${guestName}</strong>,</p>
    <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">Check out this special offer exclusively for you from <strong>${restaurantName}</strong>.</p>
    
    <div style="margin: 32px 0; padding: 32px; background: linear-gradient(135deg, #f3f0ff 0%, #e9d8fd 100%); border-radius: 16px; text-align: center; border: 2px dashed #6f42c1;">
      <h3 style="color: #6f42c1; font-size: 20px; margin: 0 0 8px 0;">${promotionName}</h3>
      <div style="font-size: 36px; font-weight: 800; color: #5227cc; margin: 16px 0;">${discountValue}</div>
      <p style="color: #553c9a; font-size: 14px; margin: 0;">${description || ''}</p>
    </div>

    <div style="text-align: center; margin-bottom: 32px;">
      <p style="color: #e53e3e; font-size: 14px; font-weight: 600;">Expiry Date: ${expiryDate || 'Unlimited'}</p>
      <a href="#" style="display: inline-block; background-color: #6f42c1; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; margin-top: 20px; box-shadow: 0 4px 12px rgba(111, 66, 193, 0.3);">Book Now</a>
    </div>
  `;
  return baseTemplate('Exclusive Offer', 'Special Offer', content);
}

module.exports = {
  getBookingConfirmedTemplate,
  getBookingCancelledTemplate,
  getPromotionTemplate
};
