export const VEHICLE_TYPES = ['CAR', 'BIKE']

export const ENGINE_TYPES = ['GASOLINE', 'ELECTRIC', 'HYBRID', 'DIESEL']

// Phải khớp chính xác với các giá trị motorbike_group đang lưu ở bảng
// service_packages (xem database/migration_v41_normalize_service_package_vehicle_type.sql).
// Đây là danh sách cố định (mã code), không phải text tự do, để tránh sai lệch
// giữa xe của khách hàng và gói dịch vụ khi so khớp ở BookingServiceImpl.
export const MOTORBIKE_GROUPS = [
  { value: 'UNDER_175', label: 'Dưới 175cc (xe số, xe tay ga phổ thông)' },
  { value: 'OVER_175', label: 'Trên 175cc (phân khối lớn)' },
  { value: 'ELECTRIC', label: 'Xe máy điện' },
]
