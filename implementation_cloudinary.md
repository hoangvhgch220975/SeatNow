# Giải pháp tối ưu hóa việc Upload hình ảnh cho SeatNow

Hệ thống SeatNow hiện đang sử dụng kiến trúc Microservices. Để tối ưu hóa hiệu năng, bảo mật và khả năng mở rộng cho việc xử lý hình ảnh, tôi đề xuất giải pháp **Cloudinary CDN (Free Tier)**. Giải pháp này giúp tự động tối ưu hóa dung lượng ảnh, hỗ trợ CDN toàn cầu và cho phép thay đổi kích thước ảnh linh hoạt qua URL.

## Vấn đề của phương pháp truyền thống (Proxy qua Backend)
- **Tiêu tốn tài nguyên**: Nếu upload qua Backend, server sẽ tốn băng thông và CPU để xử lý binary.
- **Tốc độ hiển thị chậm**: Nếu không có CDN, ảnh sẽ tải chậm nếu server đặt tại vị trí địa lý xa người dùng.
- **Không có Dynamic Resizing**: Phải tự tạo nhiều phiên bản ảnh (thumbnail, mobile, v.v.) thủ công.

## Giải pháp đề xuất: Direct Upload (FE ➔ Cloud Storage)

Đây là quy trình tối ưu nhất cho Cloudinary (Free Tier):

### Quy trình thực hiện:
1. **Thiết lập Upload Preset**: Cấu hình "Unsigned Upload Preset" trong dashboard Cloudinary để cho phép FE upload trực tiếp mà không cần signature từ Backend.
2. **FE Upload trực tiếp**: Frontend dùng `fetch` hoặc `axios` gửi dữ liệu file lên endpoint của Cloudinary.
3. **Lưu trữ Image ID/URL**: Sau khi upload thành công, Cloudinary trả về `secure_url`. FE gửi URL này về cho Backend (`user_service`, `restaurant-service`, v.v.) để lưu vào DB.

### Ưu điểm vượt trội:
- **Zero-Load on Backend**: Backend không bao giờ phải "chạm" vào dữ liệu file thật sự.
- **Bảo mật**: Chỉ những user hợp lệ mới có thể yêu cầu Presigned URL để upload.
- **Tốc độ**: Tận dụng hạ tầng băng thông cực lớn của các nhà cung cấp Cloud.

---

## Chi tiết triển khai với Cloudinary

### 1. Chuẩn bị (Dashboard Cloudinary)
1. Đăng ký tài khoản Cloudinary (Free).
2. Vào **Settings** > **Upload** > **Upload presets**.
3. Create a new **Unsigned** upload preset (ví dụ đặt tên là `seatnow_preset`).

### 2. Triển khai Frontend (Upload trực tiếp)

Frontend không cần gọi qua Backend để upload, giúp giảm tải tối đa cho Microservices.

```javascript
async function uploadToCloudinary(file) {
  const cloudName = 'YOUR_CLOUD_NAME';
  const uploadPreset = 'seatnow_preset';
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  return data.secure_url; // Đây là URL ảnh dùng để gửi về Backend lưu vào DB
}
```

### 3. Lưu trữ và Hiển thị (Tối ưu CDN)

Backend (Node.js) nhận URL từ FE và lưu vào SQL/MongoDB như bình thường. Khi hiển thị, bạn có thể thêm các tham số vào URL để Cloudinary tự động tối ưu:

- **Ảnh nguyên bản**: `https://res.cloudinary.com/.../image/upload/v123/avatar.jpg`
- **Ảnh Thumbnail (300x300, tự động crop)**: 
  `https://res.cloudinary.com/.../image/upload/w_300,h_300,c_fill/v123/avatar.jpg`
- **Tự động tối ưu định dạng (Auto Format)**: 
  `https://res.cloudinary.com/.../image/upload/f_auto,q_auto/v123/avatar.jpg`

## Ưu điểm khi dùng Cloudinary Free Tier
- **10 - 25 GB Storage free**.
- **Tự động chuyển sang WebP/Avif** để tiết kiệm băng thông.
- **Global CDN**: Ảnh tải cực nhanh cho người dùng ở bất kỳ đâu.
