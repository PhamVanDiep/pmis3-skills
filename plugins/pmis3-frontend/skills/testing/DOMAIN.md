# Kịch bản bắt buộc theo nghiệp vụ

Tham chiếu của skill [`testing`](SKILL.md). Khi lập **bảng kịch bản** cho một chức năng, đưa đủ các dòng
của phần *Dùng chung* đang áp dụng và của module chứa chức năng. Cột "Tầng" là tầng tối thiểu phải phủ.

Giá trị ngưỡng, hệ số, chu kỳ, mức độ lấy từ SPEC/quy trình nghiệp vụ của chức năng và ghi nguồn trong
comment bảng `it.each` — các ví dụ dưới đây chỉ minh họa dạng kịch bản.

## Dùng chung

### Vòng đời / trạng thái (phiếu, sự cố, khiếm khuyết, kế hoạch, đánh giá…)

| Kịch bản | Tầng |
|---|---|
| Bảng chuyển trạng thái: MỌI cặp (trạng thái hiện tại, hành động) hợp lệ → trạng thái mới; cặp không hợp lệ → bị chặn | logic (`it.each` cả bảng) |
| Nút hành động hiện theo trạng thái × quyền × vai trò (người lập, người duyệt, người xử lý) | component |
| Hành trình trọn vòng đời chính, mỗi bước kiểm tra body gửi đi | e2e (backend có trạng thái) |
| Trả lại / từ chối kèm lý do bắt buộc | e2e |
| Backend từ chối chuyển trạng thái (xung đột, người khác vừa sửa) → màn giữ trạng thái cũ, toast lỗi | e2e |

### Cây phân cấp (đơn vị, trạm, ngăn lộ, thiết bị, danh mục)

| Kịch bản | Tầng |
|---|---|
| Dựng cây từ danh sách phẳng: gốc, nhiều cấp, nút mồ côi, vòng lặp cha–con | logic |
| Lọc cây giữ lại tổ tiên của nút khớp | logic |
| Chọn nút → tải con/lazy-load đúng param | e2e |
| Dữ liệu theo đơn vị đang chọn: đổi đơn vị → tải lại, header `orgid` mới | e2e |

### Ngày giờ & số liệu

| Kịch bản | Tầng |
|---|---|
| Chuỗi LOCAL `yyyy-MM-dd HH:mm:ss` đọc/ghi không lệch múi giờ (nhất là quanh 00:00, 07:00) | logic |
| Hiển thị `dd/MM/yyyy`, số phân tách hàng nghìn, làm tròn đúng số chữ số của đại lượng | component |
| Đơn vị đo quy đổi (kV/V, MVA/kVA, °C…) và giữ đơn vị khi lưu | logic |
| Ô trống / giá trị 0 / âm được phân biệt, không hiện "NaN", "Invalid Date" | logic + component |

### Ký số, đính kèm, báo cáo, lịch sử

| Kịch bản | Tầng |
|---|---|
| Ký số: phương thức không khả dụng bị khóa kèm lý do; ký thành công/thất bại | component + e2e |
| Đính kèm: loại/kích thước file bị chặn, upload gửi đúng `objTypeId`/`objId`/`attachType`, xóa file | e2e |
| Xuất Excel/Word/PDF: gọi đúng endpoint + bộ lọc hiện tại, nhận file đúng tên | e2e |
| Lịch sử thay đổi hiện đúng trường, giá trị cũ → mới | component |

## Quản lý thiết bị

| Kịch bản | Tầng |
|---|---|
| Cây vị trí → thiết bị: chọn vị trí hiện đúng thiết bị, thiết bị không có vị trí | logic + e2e |
| Thông số kỹ thuật động (thuộc tính mở rộng) theo loại thiết bị: đổi loại → bộ thông số đổi, giá trị cũ không lẫn sang | component |
| Kiểu dữ liệu thông số (số, ngày, danh mục) validate đúng; bắt buộc theo loại | component |
| Tìm kiếm/lọc nâng cao: mỗi điều kiện ra đúng param, kết hợp nhiều điều kiện, xóa bộ lọc | e2e |
| Trạng thái vận hành (vận hành, dự phòng, hỏng, thanh lý) và thiết bị đã thanh lý không cho sửa | logic + component |
| Lắp đặt / tháo / thay thế / điều chuyển: lịch sử vị trí liền mạch, không trùng thời gian | logic |
| Trùng mã thiết bị trong đơn vị → lỗi backend hiện đúng | e2e |

## Thí nghiệm điện

| Kịch bản | Tầng |
|---|---|
| Đánh giá kết quả từng hạng mục: **dưới / đúng bằng / trên** ngưỡng tiêu chuẩn → Đạt/Không đạt | logic (`it.each` mọi hạng mục) |
| Dung sai, so sánh với lần đo trước hoặc giá trị xuất xưởng (% thay đổi) | logic |
| Hiệu chỉnh/quy đổi theo điều kiện đo (nhiệt độ, độ ẩm) nếu quy trình yêu cầu | logic |
| Kết luận chung của biên bản từ các hạng mục (một hạng mục không đạt → không đạt) | logic |
| Chu kỳ thí nghiệm định kỳ → ngày đến hạn kế tiếp; đến hạn / quá hạn | logic (`useFixedTime`) |
| Mẫu biên bản theo loại thiết bị: đúng bộ hạng mục, đúng đơn vị đo | component |
| Nhập kết quả → lưu → xuất biên bản → ký | e2e |

## Sự cố & khiếm khuyết

| Kịch bản | Tầng |
|---|---|
| Phân loại mức độ từ các tiêu chí đầu vào | logic |
| Hạn xử lý theo mức độ; quá hạn tính đúng tại mốc hạn | logic (`useFixedTime`) |
| Vòng đời: phát hiện → đánh giá → giao xử lý → xử lý → nghiệm thu → đóng; trả lại; hủy | logic + e2e |
| Khiếm khuyết gắn đúng thiết bị/vị trí; từ thiết bị xem được danh sách khiếm khuyết của nó | e2e |
| Tạo phiếu sửa chữa từ khiếm khuyết mang sang đúng dữ liệu; đóng phiếu cập nhật khiếm khuyết | e2e |
| Thời gian mất điện/ảnh hưởng: tính khoảng thời gian qua nửa đêm, qua tháng | logic |

## Sửa chữa bảo dưỡng

| Kịch bản | Tầng |
|---|---|
| Chu kỳ theo thời gian / giờ vận hành / số lần thao tác → lần kế tiếp (lấy mốc nào đến trước) | logic |
| Sinh lịch kế hoạch năm/tháng từ chu kỳ; không sinh trùng; thiết bị ngừng vận hành bị bỏ qua | logic |
| Hoàn thành công việc cập nhật "lần bảo dưỡng cuối" → hạn kế tiếp dời đúng | logic + e2e |
| Phiếu công tác: vật tư, nhân lực, thời gian; tổng hợp chi phí | logic |
| Kế hoạch → duyệt → thực hiện → nghiệm thu (vòng đời chung) | e2e |

## RCM

| Kịch bản | Tầng |
|---|---|
| FMEA: chức năng → hư hỏng chức năng → dạng hỏng → nguyên nhân → hậu quả, nhập/sửa không mất liên kết | component + e2e |
| Ma trận rủi ro khả năng × hậu quả: **mọi ô** ra đúng mức rủi ro | logic (`it.each` cả ma trận) |
| Chỉ số ưu tiên (vd RPN = S × O × D): tính đúng, biên phân loại dưới/đúng/trên | logic |
| Cây quyết định chọn chiến lược bảo dưỡng: mỗi đường đi của cây ra đúng chiến lược | logic (`it.each` mọi nhánh) |
| Thay đổi đánh giá → mức rủi ro và chiến lược tính lại ngay trên màn | component |

## CBM

| Kịch bản | Tầng |
|---|---|
| Ngưỡng cảnh báo / nguy hiểm theo thông số: dưới/đúng/trên mỗi ngưỡng | logic |
| Chống nhấp nháy (trễ/hysteresis, số lần vượt liên tiếp) nếu quy trình có | logic |
| Chỉ số sức khỏe: chuẩn hóa từng thông số, trọng số, thiếu dữ liệu một thông số, dữ liệu quá cũ | logic |
| Xu hướng/dự báo: dữ liệu rỗng, một điểm, điểm bất thường; thời điểm dự báo vượt ngưỡng | logic |
| Dữ liệu chuỗi thời gian lớn: lấy theo khoảng thời gian/lấy mẫu qua param, không tải toàn bộ | e2e |
| Biểu đồ: series, trục thời gian, đường ngưỡng truyền vào chart đúng | component |
| Cảnh báo sinh ra → tạo khiếm khuyết/công việc bảo dưỡng liên quan | e2e |
