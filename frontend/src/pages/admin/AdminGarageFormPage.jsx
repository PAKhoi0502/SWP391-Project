import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createGarage, getGarageById, updateGarage } from "../../api/GarageApi";
import "../GaragePage.css";

export default function AdminGarageFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = Boolean(id);

    const [form, setForm] = useState({
        name: "",
        garageCode: "",
        address: "",
        city: "",
        phone: "",
        openingTime: "08:00",
        closingTime: "20:00",
        slotIntervalMinutes: 30,
    });

    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchGarage() {
            if (!isEdit) return;

            try {
                setLoading(true);
                const data = await getGarageById(id);

                setForm({
                    name: data.name || "",
                    garageCode: data.garageCode || "",
                    address: data.address || "",
                    city: data.city || "",
                    phone: data.phone || "",
                    openingTime: data.openingTime ? data.openingTime.slice(0, 5) : "08:00",
                    closingTime: data.closingTime ? data.closingTime.slice(0, 5) : "20:00",
                    slotIntervalMinutes: data.slotIntervalMinutes || 30,
                });
            } catch (err) {
                setError(err.message || "Không thể tải garage");
            } finally {
                setLoading(false);
            }
        }

        fetchGarage();
    }, [id, isEdit]);

    function handleChange(e) {
        const { name, value } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]: name === "slotIntervalMinutes" ? Number(value) : value,
        }));
    }

    async function handleSubmit(e) {
        e.preventDefault();

        if (!form.name.trim()) return alert("Vui lòng nhập tên garage");
        if (!form.garageCode.trim() && !isEdit) return alert("Vui lòng nhập mã garage");
        if (!form.address.trim()) return alert("Vui lòng nhập địa chỉ");
        if (!form.city.trim()) return alert("Vui lòng nhập thành phố");
        if (!form.phone.trim()) return alert("Vui lòng nhập số điện thoại");

        try {
            setSaving(true);
            setError("");

            const payload = {
                name: form.name,
                address: form.address,
                city: form.city,
                phone: form.phone,
                openingTime: `${form.openingTime}:00`,
                closingTime: `${form.closingTime}:00`,
                slotIntervalMinutes: Number(form.slotIntervalMinutes),
            };

            if (!isEdit) {
                payload.garageCode = form.garageCode;
                await createGarage(payload);
            } else {
                await updateGarage(id, payload);
            }

            navigate("/admin/garages");
        } catch (err) {
            setError(err.message || "Lưu garage thất bại");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="garage-page">Đang tải form...</div>;
    }

    return (
        <div className="garage-page">
            <Link to="/admin/garages" className="garage-back">
                ← Quay lại quản lý garage
            </Link>

            <div className="garage-form-card">
                <p className="garage-eyebrow">Admin</p>
                <h1>{isEdit ? "Cập nhật garage" : "Tạo garage mới"}</h1>

                {error && <div className="garage-error">{error}</div>}

                <form className="garage-form" onSubmit={handleSubmit}>
                    <label>
                        Tên garage
                        <input name="name" value={form.name} onChange={handleChange} />
                    </label>

                    <label>
                        Mã garage
                        <input
                            name="garageCode"
                            value={form.garageCode}
                            onChange={handleChange}
                            disabled={isEdit}
                            placeholder="VD: GARAGE_Q1"
                        />
                    </label>

                    <label>
                        Địa chỉ
                        <input name="address" value={form.address} onChange={handleChange} />
                    </label>

                    <label>
                        Thành phố
                        <input name="city" value={form.city} onChange={handleChange} />
                    </label>

                    <label>
                        Số điện thoại
                        <input name="phone" value={form.phone} onChange={handleChange} />
                    </label>

                    <div className="garage-form-row">
                        <label>
                            Giờ mở cửa
                            <input
                                type="time"
                                name="openingTime"
                                value={form.openingTime}
                                onChange={handleChange}
                            />
                        </label>

                        <label>
                            Giờ đóng cửa
                            <input
                                type="time"
                                name="closingTime"
                                value={form.closingTime}
                                onChange={handleChange}
                            />
                        </label>
                    </div>

                    <label>
                        Khoảng cách slot phút
                        <input
                            type="number"
                            name="slotIntervalMinutes"
                            value={form.slotIntervalMinutes}
                            onChange={handleChange}
                            min="5"
                        />
                    </label>

                    <button className="garage-submit-btn" disabled={saving}>
                        {saving ? "Đang lưu..." : isEdit ? "Cập nhật garage" : "Tạo garage"}
                    </button>
                </form>
            </div>
        </div>
    );
}