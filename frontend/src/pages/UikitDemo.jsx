import { useState } from "react";
import {
    Button,
    Input,
    Select,
    Textarea,
    Modal,
    ConfirmDialog,
    Table,
    Pagination,
    SearchBox,
    FilterBar,
    StatusBadge,
    RoleBadge,
    LoadingSpinner,
    EmptyState,
    ErrorState,
    Toast,
} from "../components/common/ui";

function UiKitDemo() {
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    const columns = [
        { title: "Mã", key: "id" },
        { title: "Khách hàng", key: "customer" },
        {
            title: "Trạng thái",
            key: "status",
            render: (row) => <StatusBadge status={row.status} />,
        },
    ];

    const data = [
        { id: "B001", customer: "Nguyễn Văn A", status: "pending" },
        { id: "B002", customer: "Trần Văn B", status: "paid" },
        { id: "B003", customer: "Lê Văn C", status: "completed" },
    ];

    return (
        <div style={{ padding: "40px", minHeight: "100vh" }}>
            <h1>AutoWash Pro UI Kit</h1>
            <p>Demo reusable frontend components cho issue #2.</p>

            <section style={{ marginTop: 30 }}>
                <h2>Button</h2>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <Button>Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="danger">Danger</Button>
                    <Button loading>Loading</Button>
                </div>
            </section>

            <section style={{ marginTop: 30, maxWidth: 520 }}>
                <h2>Form</h2>

                <Input label="Tên khách hàng" placeholder="Nhập tên khách hàng" />

                <div style={{ marginTop: 16 }}>
                    <Select
                        label="Loại phương tiện"
                        options={[
                            { label: "Ô tô", value: "car" },
                            { label: "Xe máy", value: "motorbike" },
                        ]}
                    />
                </div>

                <div style={{ marginTop: 16 }}>
                    <Textarea label="Ghi chú" placeholder="Nhập ghi chú đặt lịch" />
                </div>
            </section>

            <section style={{ marginTop: 30 }}>
                <h2>Search & Filter</h2>

                <SearchBox
                    value={search}
                    onChange={setSearch}
                    placeholder="Tìm booking..."
                />

                <div style={{ marginTop: 16 }}>
                    <FilterBar
                        value={filter}
                        onChange={setFilter}
                        options={[
                            { label: "Tất cả", value: "all" },
                            { label: "Chờ xử lý", value: "pending" },
                            { label: "Đã thanh toán", value: "paid" },
                            { label: "Hoàn thành", value: "completed" },
                        ]}
                    />
                </div>
            </section>

            <section style={{ marginTop: 30 }}>
                <h2>Badges</h2>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <StatusBadge status="pending" />
                    <StatusBadge status="paid" />
                    <StatusBadge status="completed" />
                    <StatusBadge status="cancelled" />

                    <RoleBadge role="customer" />
                    <RoleBadge role="staff" />
                    <RoleBadge role="manager" />
                    <RoleBadge role="admin" />
                </div>
            </section>

            <section style={{ marginTop: 30 }}>
                <h2>Table & Pagination</h2>

                <Table columns={columns} data={data} />

                <Pagination page={page} totalPages={3} onPageChange={setPage} />
            </section>

            <section style={{ marginTop: 30 }}>
                <h2>Modal / Confirm / Toast</h2>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <Button onClick={() => setModalOpen(true)}>Mở Modal</Button>
                    <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                        Mở Confirm
                    </Button>
                    <Button variant="secondary" onClick={() => setToastOpen(true)}>
                        Hiện Toast
                    </Button>
                </div>
            </section>

            <section style={{ marginTop: 30 }}>
                <h2>States</h2>

                <div style={{ display: "grid", gap: 18 }}>
                    <LoadingSpinner text="Đang tải danh sách booking..." />

                    <EmptyState
                        title="Chưa có booking"
                        description="Khi khách hàng đặt lịch, booking sẽ hiển thị tại đây."
                    />

                    <ErrorState
                        title="Không thể tải dữ liệu"
                        description="Vui lòng kiểm tra kết nối máy chủ và thử lại."
                        onRetry={() => alert("Retry")}
                    />
                </div>
            </section>

            <Modal
                open={modalOpen}
                title="Thêm xe mới"
                onClose={() => setModalOpen(false)}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setModalOpen(false)}>
                            Hủy
                        </Button>
                        <Button onClick={() => setModalOpen(false)}>Lưu xe</Button>
                    </>
                }
            >
                <Input label="Biển số xe" placeholder="Nhập biển số xe" />
            </Modal>

            <ConfirmDialog
                open={confirmOpen}
                title="Xác nhận hủy lịch"
                message="Bạn có chắc chắn muốn hủy lịch rửa xe này không?"
                danger
                confirmText="Hủy lịch"
                cancelText="Đóng"
                onCancel={() => setConfirmOpen(false)}
                onConfirm={() => setConfirmOpen(false)}
            />

            <Toast
                open={toastOpen}
                type="success"
                title="Thành công"
                message="UI Kit hoạt động bình thường."
                onClose={() => setToastOpen(false)}
            />
        </div>
    );
}

export default UiKitDemo;