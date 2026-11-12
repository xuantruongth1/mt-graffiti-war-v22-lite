# MT Graffiti War V3 · Chạy local trên Windows

- Bản web: chạy **start.bat** bằng Node.js 22 trở lên rồi mở **http://127.0.0.1:3197/**. Trong OBS hoặc TikTok LIVE Studio, dùng link từ nút **Sao chép link LIVE**, nguồn trình duyệt 1080 × 1920.
- Bản Windows: mở **MT Graffiti War V3.2.exe** trong thư mục **MT-Graffiti-V3.2-Portable**. Giữ nguyên các tệp và thư mục đi cùng EXE. Launcher mở bảng điều khiển trong trình duyệt mặc định. Giữ cửa sổ launcher mở khi dùng Phòng thử hoặc LIVE. Launcher mặc định dùng http://127.0.0.1:3197/. Nếu đã mở Studio từ bản cũ, hãy mở lại bằng nút trong launcher V3 để chuyển sang địa chỉ này.
• Adapter LIVE là tùy chọn. Đặt GRAFFITI_CONNECTOR trỏ tới DirectLive module, GRAFFITI_CATALOG trỏ đến catalog.json nếu có. Studio và DEMO chạy khi chưa cấu hình adapter.
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

Tài nguyên runtime nằm trong **v2**. **assets_manifest.json** cung cấp tọa độ avatar/tên và danh mục. Nền gốc 941 × 1672 được đưa lên toàn canvas dọc. PNG súng là artwork từ hai dáng gốc. Tay cầm bình và tay ném dùng sprite WebP. Bom sơn dùng sprite vật phẩm. Âm thanh được tổng hợp trong game.

Để build lại bản Windows local, chạy **build-windows.ps1**. Có thể truyền **-NodePath** để chọn node.exe dùng trong gói portable.


## Tường và thư viện V3

- Tường bình luận mặc định **6 ô**, theo thứ tự **3 cột × 2 hàng**. Bình luận mới hợp lệ tạo một phát sơn lớn. Một UID chỉ giữ một ô trên trang, với cooldown 25 giây.
- Khi đủ 6 ô, game giữ nguyên hình cho tới khi có người thứ 7. Tường đầy hiện ít nhất 2,5 giây sau khi hiện avatar thứ 6. Sau đó quét lớp sơn, để tường trống một nhịp và vẽ ô đầu trang mới.
- Quà ở mọi bậc chạy riêng theo UID. Hết lượt, game quay về đúng trang và ô bình luận trước đó. Tường người tặng được lưu trong phiên và giữ bậc đã đạt cao nhất.
- **Thư viện tường** giữ 20 trang bình luận cũ và tường người tặng. Xem, phát lại hoặc tải PNG từ preview. Máy chủ ảnh đại diện cần hỗ trợ CORS để trình duyệt xuất ảnh. Tường lưu dưới dạng dữ liệu khung, tọa độ và ảnh tham chiếu.
- **Hiệu ứng & bố cục** cho đổi 4/5/6 ô, tọa độ, thời gian giữ trang đầy, thời gian quét, tốc độ 0,5×–2× và độ rộng splash. Giới hạn 6 ô vẫn áp dụng.
- **Phòng thử** có nút 1–7 bình luận, spam cùng UID, quà khi đang 3/6, hai người tặng cùng lúc và nâng cấp cùng người.

Chạy kiểm tra dữ liệu bằng **node test-v22.mjs** và **node test-v2.mjs** trong thư mục mã nguồn.


## Chế độ nhẹ

Preview luôn vẽ ở 360 × 640, tối đa 30 FPS. Màn LIVE mặc định vẽ ở 540 × 960, 30 FPS. Chọn 60 FPS ở **Hiệu ứng & bố cục** để dùng 1080 × 1920 trên màn LIVE. Kích thước nguồn trong OBS vẫn có thể đặt 1080 × 1920.

Tường và khung WebP tải theo cảnh đang dùng. Khi cảnh đứng yên, game chỉ vẽ lại khi hình thay đổi hoặc giọt sơn đang mờ đi. Thiết lập mặc định của bản nhẹ giảm hạt sơn và tắt rung. Có thể chỉnh lại trong bảng điều khiển.

Nếu Windows chặn mở trình duyệt tự động, sao chép địa chỉ từ ô trong launcher và dán vào trình duyệt. Nút **Mở màn LIVE** điền địa chỉ overlay vào cùng ô.


## Kiểm thử local

Chạy `node test-v2.mjs`, `node test-v22.mjs` và `node test-v3.mjs` từ thư mục mã nguồn. Bản thử 30 FPS giữ canvas LIVE 1080 × 1920. Canvas trong dashboard dùng 540 × 960 để giảm tải. Nếu mở ảnh ở thư viện, chọn tường rồi đợi preview lên hình trước khi tải PNG.

Dữ liệu phiên V2.2 được sao lưu vào `studio.pre-v3.*.json` lần đầu chạy bản V3 trên dữ liệu cũ. Dùng nút **Sao lưu JSON** nếu muốn giữ riêng thiết lập hiệu ứng. Với quà chưa xác nhận giá, nhập giá theo ID trong tab Quà & vật phẩm rồi chọn **Thử lại quà chờ** trong Nhật ký.

## Sprite tay

- `v2/hands/spray.webp` và `v2/hands/toss.webp` là hai sprite bổ sung được tạo bằng ImageGen rồi cắt, thu nhỏ và xuất WebP alpha.
- Yêu cầu hình: hai vật thể độc lập trên nền trong suốt, phong cách graffiti góc nhìn thứ nhất. Bên trái là bàn tay đeo găng đen cầm bình sơn kim loại cyan/magenta. Bên phải là bàn tay đeo găng hở ngón đang mở theo tư thế vừa ném. Thân găng có vệt màu sơn, các vật thể đủ khoảng cách để cắt riêng.
- `v2/weapon-anchors.json` lưu điểm nòng và tâm xoay ước lượng riêng theo 10 PNG góc nhìn thứ nhất. Những sprite này là ảnh tĩnh có biến đổi trong Canvas.

## V3.1 và chẩn đoán

Chọn độ phân giải LIVE và FPS riêng trong Hiệu ứng & bố cục. Mặc định LIVE 1080 × 1920 ở 30 FPS. Preview giữ nhịp 30 FPS và có độ phân giải riêng. Studio hiển thị mẫu LIVE từ overlay đang vẽ; khi nguồn LIVE đóng hoặc đứng yên, mục này báo chưa có mẫu hoạt động. Nút tải 100 lượt trong 10 giây chỉ dùng dữ liệu DEMO.

Có thể thêm `?clean=1` vào link overlay để ẩn nút âm thanh. `?clean=1&audio=1` yêu cầu bật AudioContext khi tải trang. Âm thanh tự phát phụ thuộc chính sách trình duyệt/OBS; hãy xác minh bằng cảnh thử trước khi dùng.

Để đo nhanh bằng Chrome, cài Playwright trong thư mục làm việc rồi chạy `node benchmark-v31.mjs performance-v31.json`. Có thể đặt `GRAFFITI_CHROME` nếu muốn dùng Chrome có sẵn và `GRAFFITI_PLAYWRIGHT` nếu Playwright nằm ngoài repo. Bài đo dùng thư mục dữ liệu tạm, giữ Studio và overlay mở, đưa tab DEMO lên trước và ghi JSON ở 1080p/30 và 720p/60. Số liệu này dùng để kiểm tra nhanh trên Chromium; OBS cần bài đo riêng.

## V3.2

Studio tách bản nháp, DEMO và cấu hình LIVE. Nút Thử trong DEMO chỉ gửi cấu hình cho phòng thử. Áp dụng lên LIVE kiểm tra phiên bản để tránh ghi đè từ tab khác. Hoàn tác đưa cấu hình trước đó trở lại bản nháp để bạn xem và áp dụng.

Trong Hiệu ứng & bố cục có nền gốc và 7 bối cảnh mới. Bảy nền mới được tạo bằng ImageGen theo yêu cầu ảnh dọc 9:16, tường trống chiếm khoảng 24–68% chiều cao, camera chính diện, không chữ, chừa mặt sân. Các chủ đề là neon xanh, thành cổ, xưởng thép, sân Tết, băng, thiên hà và biển. Ảnh được xuất WebP vào v2/walls.

Skin & bom sơn cho chọn skin theo bậc, chọn một skin cố định hoặc đánh dấu nhóm tối đa 10 skin để đổi tuần tự mỗi lượt vẽ. Tường và skin của lượt được ghi vào dữ liệu phát lại.

Link LIVE sao chép từ Studio có tham số renderer=obs để nhận diện nguồn OBS do người dùng chọn. Ảnh QR được lấy từ bộ Tiệc Cưới Mai Trường đang có trên máy và chỉ hiện trong Studio/Hướng dẫn. Trước khi chuyển khoản, hãy đối chiếu người nhận trong ứng dụng ngân hàng.

Để kiểm logic V3.2 chạy node test-v32.mjs cùng các bài V2 và V3. Để rollback dùng lại thư mục portable trước. Sao lưu studio.json và studio.json.bak khi cả hai launcher đã tắt.

Kiểm tra giao diện với Playwright bằng node test-ui-v32.mjs <thư_mục_ảnh>. Dùng các biến GRAFFITI_CHROME và GRAFFITI_PLAYWRIGHT như bài benchmark.
