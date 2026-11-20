# Báo cáo QA song ngữ FocusPulse

**Kết luận ngày 20/11/2026.** Các luồng web quan trọng đạt trên bản build production của nhánh `feature/i18n-vi-en`. Kiểm thử dùng tài khoản mẫu và hồ sơ trình duyệt riêng. Phần xác thực và AI có kết nối đến dịch vụ thật, bộ cài Windows và thiết bị Android thật chưa được nghiệm thu.

| Module | Tiếng Anh | Tiếng Việt | Chức năng gốc | Trạng thái kiểm thử |
|---|---|---|---|---|
| Dashboard | Đạt | Đạt | Thẻ việc và thói quen tiếp theo, đổi thẻ, trích dẫn, ngày đến hạn, trạng thái trống | Đạt trên web |
| Pomodoro | Đạt | Đạt | Chạy, tạm dừng, đổi tiếng giữa phiên, nghỉ ngắn/dài, hết giờ, kiểm tra giới hạn nhập và nhắc một lần | Đạt trên web |
| Tasks | Đạt | Đạt | Tạo, xem, sửa, đánh dấu, xóa, tìm kiếm, danh mục tự đặt, lưu trữ và giữ bản nháp | Đạt trên web |
| Habits | Đạt | Đạt | Thêm, đánh dấu theo ngày, đổi tiếng khi đã đánh dấu, xóa; thêm lại bộ mẫu giữ nguyên nhật ký | Đạt trên web |
| Study Plans | Đạt | Đạt | Tạo, sửa, hiển thị ngày trong tuần, bảo toàn kế hoạch cũ và tên tự nhập | Đạt trên web |
| Hydration | Đạt | Đạt | Ghi một ly, đặt lại, thay mục tiêu/dung tích, hiển thị đơn vị và phát lời nhắc đúng một lần | Đạt trên web |
| Zenith AI | Đạt | Đạt | 13 nút gợi ý, chọn nhiều mục, xác nhận/hủy, trạng thái chờ, đổi tiếng giữa yêu cầu, trả lời ngoại tuyến | Đạt trên web với API mô phỏng |
| Account | Đạt | Đạt | Đăng ký cục bộ, sai mật khẩu, đăng nhập, đăng xuất, khôi phục công việc đã lưu; biểu mẫu và lỗi xác thực | Đạt cục bộ; Firebase thật chưa kiểm tra |
| Statistics | Đạt | Đạt | Ngày, nhãn biểu đồ tuần, bảng xếp hạng, trạng thái trống, giữ tuần đang xem | Đạt trên web |
| Settings | Đạt | Đạt | Đổi tiếng, bảy thẻ cài đặt, sáng/tối, tìm kiếm, giữ tiêu điểm và bản nháp | Đạt trên web |

## Chuyển ngôn ngữ và lưu trữ

- Đổi English → Tiếng Việt → English qua bộ chọn trên trang. Đối tượng của trang và thời điểm khởi tạo tài liệu còn nguyên. Các thử nghiệm theo module kiểm tra cả bộ đếm, tuần đang xem, dữ liệu biểu mẫu, trạng thái công việc và nhật ký thói quen.
- Đã đóng tab và mở tab mới ở cùng địa chỉ, cùng hồ sơ trình duyệt. Lựa chọn tiếng Việt được khôi phục. Khi chưa chọn hoặc khi giá trị lưu là chuỗi rỗng, ngôn ngữ lạ, JSON lỗi hay `__proto__`, ứng dụng dùng tiếng Anh.
- Khi chặn quyền đọc/ghi bộ nhớ trong bài test riêng của Language Manager, vẫn đổi được tiếng trong phiên. Khi xóa một bản dịch tiếng Việt trong bộ nhớ thử nghiệm, hàm dịch trả về tiếng Anh và giữ nguyên tham số tên người dùng.

## Kiểm tra kỹ thuật và giao diện

- `npm run build` thành công. `node --test` đạt 14/14. Bốn bộ hồi quy bằng Chrome cũng đạt, gồm onboarding, xác thực, bảng điều khiển, các bộ theo dõi và Zenith AI.
- 224 tổ hợp giao diện gồm 7 màn hình chính × 2 ngôn ngữ × 2 chế độ sáng/tối × 4 độ rộng (320, 390, 768, 1280 px) × 2 trình duyệt (Chrome, Edge trên Windows). Mỗi màn hình có thể chứa nhiều module. Trong ma trận này không có nhãn đã gắn khóa sai nội dung, trang tràn ngang hay cặp điều khiển liền kề bị chồng trong phép đo. Đã kiểm tra thêm ảnh giao diện và nhãn tiếng Việt ở Cài đặt.
- Hai catalog có 1.444 khóa mỗi bên, cùng tên tham số, thiếu 0 khóa. Đối chiếu nguyên khóa với mã ứng dụng tìm thấy 9 khóa được ghép động cho loại đối tượng và ví dụ trong Zenith AI. Sau đối chiếu không còn ứng viên khóa thừa. Kiểm tra văn bản trong DOM và kiểm tra catalog là hai phép kiểm riêng.
- Không ghi nhận ngoại lệ JavaScript chưa bắt trong ma trận. Trình duyệt dùng Outfit và Inter để hiển thị nhãn “Ngôn ngữ”. CDN của Museo Sans trả HTTP 500 trong lúc chạy. Lỗi tải thông tin bản phát hành từ GitHub do bộ kiểm thử chặn truy cập mạng ngoài phạm vi. Vite còn cảnh báo về script cổ điển, CJS, vị trí CSS import và import Firebase chưa dùng.

## Lỗi và kết quả kiểm tra lại

| Mức | Phát hiện | Xử lý và bằng chứng |
|---|---|---|
| Critical | Chưa ghi nhận trong phạm vi đã chạy | Đã theo dõi dữ liệu mẫu qua đổi tiếng và đăng nhập lại |
| High | Chưa ghi nhận trong phạm vi đã chạy | Các luồng chính và build đều đạt |
| Medium | Bấm thông báo PWA gây `ReferenceError` vì service worker dùng `True` | Sửa thành `true`. Test đã chạy cả hai nhánh lấy lại cửa sổ hiện có và mở cửa sổ mới |
| Medium | Thẻ Cài đặt trên điện thoại có thể xuống dòng từng từ sau khi đổi thẻ | Giữ các class bố cục và cho phép cuộn ngang. Đã kiểm tra lại kích thước nút và ảnh ở 390 px |
| Low | Thanh bên desktop rút gọn một số nhãn tiếng Việt | Cho phép xuống dòng với nhãn điều hướng cố định. Đã kiểm tra lại ở 1280 px |
| Low | Nút đóng toast chỉ có biểu tượng, thiếu tên cho trình đọc màn hình | Gắn nhãn trợ năng từ catalog theo ngôn ngữ hiện tại |
| Low | Language Manager nhận nhầm mảng chứa mã ngôn ngữ hợp lệ | Kiểm tra kiểu chuỗi. Bài hồi quy thất bại trước sửa và đạt sau sửa |
| Low | Hai lỗi 404 khi thiếu CSS Tailwind cục bộ và cấu hình riêng tùy chọn | Vite chỉ đưa thẻ tài nguyên tùy chọn vào HTML khi có file. Đã kiểm tra cả bốn tổ hợp có/thiếu trên HTML dev và production, cùng thứ tự tải cấu hình |
| Low | CDN Museo Sans trả HTTP 500 | Còn phụ thuộc nhà cung cấp. Các font dự phòng đã hiển thị trong lượt kiểm thử |

## Giới hạn xác minh

Chế độ giao diện Tauri Windows và Capacitor Android đã được gọi qua mô phỏng nhận diện nền tảng. Chrome và Edge cùng dùng Chromium. Chưa chạy bộ cài native, Safari, Firefox, trình đọc màn hình thật, hộp quyền hệ điều hành hoặc chu trình nhận thông báo đẩy từ dịch vụ thật. Menu khay hệ thống Windows và metadata cài PWA vẫn có tiếng Anh. Lịch sử chat và dữ liệu tự nhập giữ nguyên ngôn ngữ gốc. Các kết quả trên áp dụng cho những luồng và môi trường đã nêu.
