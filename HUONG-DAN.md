# MT Graffiti War V2.2 · Chạy local trên Windows

- Bản web: chạy **start.bat** bằng Node.js 22 trở lên rồi mở **http://127.0.0.1:3197/**. Trong OBS hoặc TikTok LIVE Studio, dùng link từ nút **Sao chép link LIVE**, nguồn trình duyệt 1080 × 1920.
- Bản Windows: mở **MT Graffiti War V2.2 Lite.exe** trong thư mục **MT-Graffiti-V2.2.1-Lite-Portable**. Giữ nguyên các tệp và thư mục đi cùng EXE. Launcher mở bảng điều khiển trong trình duyệt mặc định. Giữ cửa sổ launcher mở trong khi dùng LIVE.
- Kết nối thực tế dùng adapter **E:\ChatGPT\Tiktok\shared\tiktok-live** đang có trên máy. Khi chuyển máy, có thể dùng **GRAFFITI_CONNECTOR** và **GRAFFITI_CATALOG** để trỏ tới adapter và danh mục quà phù hợp.
- Cấu hình tự lưu trong thư mục dữ liệu cục bộ. **Hiệu ứng & bố cục** có nút sao lưu và khôi phục JSON.

## Bảy bậc mặc định

| Bậc | Số phát | Cách hai phát cùng loạt | Bom sơn |
|---|---:|---:|---:|
| Bình luận | 1 | — | 0 |
| 1 xu | 3 | 200 ms | 0 |
| 5 xu | 5 | 165 ms | 0 |
| 20 xu | 8 | 150 ms | 1 |
| 100 xu | 12 | 120 ms | 1 |
| 500 xu | 14 | 105 ms | 2 |
| 1.000+ xu | 18 | 90 ms | 3 |

**Quà & vật phẩm** cho chỉnh số phát, khoảng cách, số bom, bảng màu, thời gian vẽ và thời gian giữ. Nếu chuỗi tùy chỉnh dài hơn thời gian vẽ đã nhập, game phát đủ chuỗi rồi mới hiện kết quả. **Skin & bom sơn** có 10 lựa chọn mỗi loại, cùng tùy chỉnh điểm phun, kích cỡ và bật/tắt tiền cảnh. **Phòng thử** có bảy bậc, combo ×5/×10 và tải 100 lượt. Dữ liệu thử tách khỏi LIVE.

Tài nguyên runtime nằm trong **v2**. **assets_manifest.json** cung cấp tọa độ avatar/tên và danh mục. Nền gốc 941 × 1672 được đưa lên toàn canvas dọc. PNG súng là artwork từ hai dáng gốc. Bình xịt dùng hình Canvas và bom sơn dùng sprite icon. Âm thanh được tổng hợp trong game.

Để build lại bản Windows local, chạy **build-windows.ps1**. Có thể truyền **-NodePath** để chọn node.exe dùng trong gói portable.


## Tường V2.2

- Tường bình luận mặc định **6 ô**, theo thứ tự **3 cột × 2 hàng**. Bình luận mới hợp lệ tạo một phát sơn lớn. Một UID chỉ giữ một ô trên trang, với cooldown 25 giây.
- Khi đủ 6 ô, game giữ nguyên hình cho tới khi có người thứ 7. Tường đầy hiện ít nhất 2,5 giây sau khi hiện avatar thứ 6. Sau đó quét lớp sơn, để tường trống một nhịp và vẽ ô đầu trang mới.
- Quà ở mọi bậc chạy riêng theo UID. Hết lượt, game quay về đúng trang và ô bình luận trước đó. Tường người tặng được lưu trong phiên và giữ bậc đã đạt cao nhất.
- **Thư viện tường** giữ 20 trang bình luận cũ và tường người tặng. Xem hoặc phát lại qua preview. Tường lưu dưới dạng dữ liệu khung, tọa độ và ảnh tham chiếu.
- **Hiệu ứng & bố cục** cho đổi 4/5/6 ô, tọa độ, thời gian giữ trang đầy, thời gian quét, tốc độ 0,5×–2× và độ rộng splash. Giới hạn 6 ô vẫn áp dụng.
- **Phòng thử** có nút 1–7 bình luận, spam cùng UID, quà khi đang 3/6, hai người tặng cùng lúc và nâng cấp cùng người.

Chạy kiểm tra dữ liệu bằng **node test-v22.mjs** và **node test-v2.mjs** trong thư mục mã nguồn.


## Chế độ nhẹ

Preview luôn vẽ ở 360 × 640, tối đa 30 FPS. Màn LIVE mặc định vẽ ở 540 × 960, 30 FPS. Chọn 60 FPS ở **Hiệu ứng & bố cục** để dùng 1080 × 1920 trên màn LIVE. Kích thước nguồn trong OBS vẫn có thể đặt 1080 × 1920.

Tường và khung WebP tải theo cảnh đang dùng. Khi cảnh đứng yên, game chỉ vẽ lại khi hình thay đổi hoặc giọt sơn đang mờ đi. Thiết lập mặc định của bản nhẹ giảm hạt sơn và tắt rung. Có thể chỉnh lại trong bảng điều khiển.

Nếu Windows chặn mở trình duyệt tự động, sao chép địa chỉ từ ô trong launcher và dán vào trình duyệt. Nút **Mở màn LIVE** điền địa chỉ overlay vào cùng ô.
