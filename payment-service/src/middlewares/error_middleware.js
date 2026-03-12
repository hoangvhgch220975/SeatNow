// error.middleware.js
// Mục đích: Middleware xử lý lỗi tập trung cho express app của payment-service
// Chức năng:
// - Chuẩn hóa các loại lỗi đã biết thành HTTP responses
// - Log các lỗi không mong đợi và trả về 500

function errorMiddleware(err, req, res, next) {
  // Log lỗi ra console
  console.error(err);
  // Lấy status code từ lỗi, mặc định là 400
  const status = err.status || 400;
  // Trả về response lỗi dưới dạng JSON
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error'
  });
}

// Xuất middleware
module.exports = { errorMiddleware };
