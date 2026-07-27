# Hướng dẫn FE: thêm dịch vụ vào booking đang vận hành

## Phạm vi nghiệp vụ

FE chỉ hiển thị chức năng cho Staff/Admin khi booking thỏa cả hai điều kiện:

- `status === "CHECKED_IN"` và `operationPhase === "WAITING_FOR_INTAKE"`;
- hoặc `status === "IN_PROGRESS"` và `operationPhase === "AUTOMATED_WASH"`.

Không hiển thị thao tác này cho Customer. Customer trao đổi nhu cầu với nhân viên, Staff/Admin kiểm tra và xác nhận trên hệ thống. Không cho thêm dịch vụ từ `WAITING_FOR_CARE` trở đi vì công đoạn rửa đã kết thúc.

Mỗi lần xác nhận sẽ cập nhật booking hiện tại. FE không tạo booking mới và không tạo payment transaction mới.

## API

`POST /bookings/{bookingId}/add-ons`

Quyền gọi: `ROLE_STAFF` hoặc `ROLE_ADMIN`. Staff phải thuộc cùng garage với booking.

Request:

```json
{
  "servicePackageIds": [12, 15]
}
```

Giới hạn tối đa 10 add-on trong một request. Không gửi ID trùng nhau, ID của gói chính, ID đã nằm trong combo hoặc add-on đã có trong booking.

Response thành công:

```json
{
  "success": true,
  "message": "Add-on service packages added successfully",
  "data": {
    "id": 101,
    "status": "IN_PROGRESS",
    "operationPhase": "AUTOMATED_WASH",
    "addOnServicePackageIds": [12, 15],
    "originalPrice": 350000,
    "discountAmount": 50000,
    "finalPrice": 300000,
    "depositAmount": 90000,
    "depositStatus": "PAID",
    "endTime": "2026-07-27T15:30:00",
    "plannedWashEndAt": "2026-07-27T14:45:00",
    "plannedCareStartAt": "2026-07-27T14:45:00",
    "plannedCareEndAt": "2026-07-27T15:30:00",
    "assignedCareStaffIds": [8]
  }
}
```

`originalPrice` và `finalPrice` tăng theo giá add-on. `discountAmount`, số điểm đã dùng và tiền cọc đã thu không thay đổi. Khi booking hoàn thành, luồng thanh toán cuối hiện tại tự tính phần còn lại từ `finalPrice - depositAmount đã thanh toán`.

## Thay đổi tại API client

Thêm vào `frontend/src/api/bookingApi.js`:

```js
async addBookingAddOns(bookingId, servicePackageIds) {
  const response = await api.post(`/bookings/${bookingId}/add-ons`, {
    servicePackageIds: servicePackageIds.map(Number),
  })
  return unwrap(response)
},
```

Project hiện dùng `frontend/src/services/api.js`, nên lỗi Axios đọc từ `error.response?.data?.message`.

## Luồng giao diện đề xuất

Tại `frontend/src/pages/booking/BookingDetailPage.jsx`:

1. Tạo biến `canAddServices` từ `role`, `booking.status` và `booking.operationPhase`.
2. Khi người dùng bấm “Thêm dịch vụ”, tải các package đang hoạt động bằng API package hiện có.
3. Chỉ giữ package có `serviceType` là `ADD_ON`, phù hợp loại xe, thuộc garage của booking và chưa có trong `booking.addOnServicePackageIds`.
4. Hiển thị modal có tên dịch vụ, thời lượng, giá và tổng tiền dự kiến.
5. Yêu cầu Staff/Admin xác nhận lại với khách trước khi gửi.
6. Khi submit, khóa nút để tránh double-click và gọi `bookingApi.addBookingAddOns`.
7. Dùng booking trả về để cập nhật ngay phần tổng tiền và thời gian dự kiến.
8. Gọi lại `bookingApi.getBookingServiceSteps(bookingId)` nếu booking đang `IN_PROGRESS`, vì BE vừa sinh thêm các step `PENDING`.
9. Nếu response có `careStaffShortage === true`, tải lại trạng thái phân công và điều hướng nhân viên sang phần phân công care staff.

Không cộng giá thủ công rồi coi đó là dữ liệu chính thức. Preview trên modal chỉ để người dùng xem; sau khi submit phải dùng `originalPrice`, `finalPrice` và các mốc thời gian từ response BE.

## Hiển thị giá

Modal nên hiển thị:

- Tổng hiện tại: `booking.finalPrice`;
- Dịch vụ thêm: tổng `basePrice` của các package đã chọn;
- Tổng dự kiến: tổng hiện tại cộng giá dịch vụ thêm;
- Ghi chú: khuyến mãi/điểm đã áp dụng được giữ nguyên, tiền cọc không thu thêm;
- Tổng chính thức sau xác nhận: lấy từ `response.finalPrice`.

Không gọi tạo PayOS FINAL tại bước thêm dịch vụ. Payment FINAL chỉ được tạo sau khi booking đã `COMPLETED`, đúng luồng hiện tại.

## Xử lý lỗi

| HTTP | Trường hợp | Cách xử lý FE |
|---|---|---|
| 400 | Request rỗng, ID trùng, package inactive/sai loại xe/sai loại `ADD_ON` | Giữ modal mở và hiển thị `message` |
| 403 | Không phải CSS/Admin hoặc Staff khác garage | Đóng modal, báo không có quyền và tải lại booking |
| 404 | Booking/package không còn tồn tại | Tải lại booking và danh sách package |
| 409 | Trạng thái đã đổi, add-on đã tồn tại, đã thanh toán, hết bay rửa/nhân sự | Không retry tự động; hiển thị `message` và tải lại booking |

Các message năng lực cần ưu tiên dịch thân thiện:

- `WASH_BAY_CAPACITY_FULL`: không còn đủ thời gian/bay rửa cho dịch vụ thêm;
- `CARE_STAFF_CAPACITY_FULL`: không đủ nhân viên chăm sóc trong khung giờ mới;
- `Service package is already included...`: dịch vụ đã được nhân viên khác thêm hoặc đã nằm trong combo;
- `Add-ons can only be added...`: booking đã chuyển sang công đoạn không còn được phép thêm.

## Kiểm thử FE tối thiểu

- Staff cùng garage thấy nút ở `CHECKED_IN/WAITING_FOR_INTAKE`.
- Staff cùng garage thấy nút ở `IN_PROGRESS/AUTOMATED_WASH`.
- Customer, Staff khác garage và các phase sau rửa không thấy nút.
- Double-click chỉ gửi một request; request thứ hai nếu xảy ra nhận `409` và không cộng giá lần hai.
- Sau thành công, tổng tiền, danh sách add-on, thời gian dự kiến và service steps được cập nhật.
- Lỗi `409` giữ nguyên dữ liệu cũ và buộc refetch booking.
- Không xuất hiện lời gọi tạo payment transaction ở thao tác thêm dịch vụ.
