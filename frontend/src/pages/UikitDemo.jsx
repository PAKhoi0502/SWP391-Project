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
        { title: "ID", key: "id" },
        { title: "Customer", key: "customer" },
        {
            title: "Status",
            key: "status",
            render: (row) => <StatusBadge status={row.status} />,
        },
    ];

    const data = [
        { id: "B001", customer: "John Smith", status: "pending" },
        { id: "B002", customer: "Jane Doe", status: "paid" },
        { id: "B003", customer: "Michael Lee", status: "completed" },
    ];

    return (
        <div style={{ padding: "40px", minHeight: "100vh" }}>
            <h1>AutoWash Pro UI Kit</h1>
            <p>Demo reusable frontend components for issue #2.</p>

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

                <Input label="Customer name" placeholder="Enter customer name" />

                <div style={{ marginTop: 16 }}>
                    <Select
                        label="Vehicle type"
                        options={[
                            { label: "Car", value: "car" },
                            { label: "Motorbike", value: "motorbike" },
                        ]}
                    />
                </div>

                <div style={{ marginTop: 16 }}>
                    <Textarea label="Note" placeholder="Enter booking note" />
                </div>
            </section>

            <section style={{ marginTop: 30 }}>
                <h2>Search & Filter</h2>

                <SearchBox
                    value={search}
                    onChange={setSearch}
                    placeholder="Search bookings..."
                />

                <div style={{ marginTop: 16 }}>
                    <FilterBar
                        value={filter}
                        onChange={setFilter}
                        options={[
                            { label: "All", value: "all" },
                            { label: "Pending", value: "pending" },
                            { label: "Paid", value: "paid" },
                            { label: "Completed", value: "completed" },
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
                    <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
                    <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                        Open Confirm
                    </Button>
                    <Button variant="secondary" onClick={() => setToastOpen(true)}>
                        Show Toast
                    </Button>
                </div>
            </section>

            <section style={{ marginTop: 30 }}>
                <h2>States</h2>

                <div style={{ display: "grid", gap: 18 }}>
                    <LoadingSpinner text="Loading booking list..." />

                    <EmptyState
                        title="No bookings yet"
                        description="When customers make a booking, it will appear here."
                    />

                    <ErrorState
                        title="Unable to load data"
                        description="Please check the server connection and try again."
                        onRetry={() => alert("Retry")}
                    />
                </div>
            </section>

            <Modal
                open={modalOpen}
                title="Add new vehicle"
                onClose={() => setModalOpen(false)}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => setModalOpen(false)}>Save vehicle</Button>
                    </>
                }
            >
                <Input label="License plate" placeholder="Enter license plate" />
            </Modal>

            <ConfirmDialog
                open={confirmOpen}
                title="Confirm cancellation"
                message="Are you sure you want to cancel this wash booking?"
                danger
                confirmText="Cancel booking"
                cancelText="Close"
                onCancel={() => setConfirmOpen(false)}
                onConfirm={() => setConfirmOpen(false)}
            />

            <Toast
                open={toastOpen}
                type="success"
                title="Success"
                message="UI Kit is working normally."
                onClose={() => setToastOpen(false)}
            />
        </div>
    );
}

export default UiKitDemo;