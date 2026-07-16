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
                setError(err.message || "Unable to load garage");
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

        if (!form.name.trim()) return alert("Please enter the garage name");
        if (!form.garageCode.trim() && !isEdit) return alert("Please enter the garage code");
        if (!form.address.trim()) return alert("Please enter the address");
        if (!form.city.trim()) return alert("Please enter the city");
        if (!form.phone.trim()) return alert("Please enter the phone number");

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
            setError(err.message || "Failed to save garage");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="garage-page">Loading form...</div>;
    }

    return (
        <div className="garage-page">
            <Link to="/admin/garages" className="garage-back">
                ← Back to garage management
            </Link>

            <div className="garage-form-card">
                <p className="garage-eyebrow">Admin</p>
                <h1>{isEdit ? "Update Garage" : "Create New Garage"}</h1>

                {error && <div className="garage-error">{error}</div>}

                <form className="garage-form" onSubmit={handleSubmit}>
                    <label>
                        Garage name
                        <input name="name" value={form.name} onChange={handleChange} />
                    </label>

                    <label>
                        Garage code
                        <input
                            name="garageCode"
                            value={form.garageCode}
                            onChange={handleChange}
                            disabled={isEdit}
                            placeholder="e.g. GARAGE_Q1"
                        />
                    </label>

                    <label>
                        Address
                        <input name="address" value={form.address} onChange={handleChange} />
                    </label>

                    <label>
                        City
                        <input name="city" value={form.city} onChange={handleChange} />
                    </label>

                    <label>
                        Phone number
                        <input name="phone" value={form.phone} onChange={handleChange} />
                    </label>

                    <div className="garage-form-row">
                        <label>
                            Opening time
                            <input
                                type="time"
                                name="openingTime"
                                value={form.openingTime}
                                onChange={handleChange}
                            />
                        </label>

                        <label>
                            Closing time
                            <input
                                type="time"
                                name="closingTime"
                                value={form.closingTime}
                                onChange={handleChange}
                            />
                        </label>
                    </div>

                    <label>
                        Slot interval (minutes)
                        <input
                            type="number"
                            name="slotIntervalMinutes"
                            value={form.slotIntervalMinutes}
                            onChange={handleChange}
                            min="5"
                        />
                    </label>

                    <button className="garage-submit-btn" disabled={saving}>
                        {saving ? "Saving..." : isEdit ? "Update garage" : "Create garage"}
                    </button>
                </form>
            </div>
        </div>
    );
}