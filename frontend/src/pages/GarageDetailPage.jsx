import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getGarageById, getGarageCapabilities } from "../api/GarageApi";
import "./GaragePage.css";

export default function GarageDetailPage() {
    const { id } = useParams();
    const location = useLocation();

    const backPath = location.pathname.startsWith("/admin")
        ? "/admin/garages"
        : "/customer/garages";


    const [garage, setGarage] = useState(null);
    const [capabilities, setCapabilities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchDetail() {
            try {
                setLoading(true);
                setError("");

                const [garageData, capabilityData] = await Promise.all([
                    getGarageById(id),
                    getGarageCapabilities(id),
                ]);

                setGarage(garageData);
                setCapabilities(capabilityData.supportedVehicleTypes || []);
            } catch (err) {
                setError(err.message || "Không thể tải chi tiết garage");
            } finally {
                setLoading(false);
            }
        }

        fetchDetail();
    }, [id]);

    if (loading) {
        return <div className="garage-page">Đang tải chi tiết garage...</div>;
    }

    if (error) {
        return <div className="garage-page garage-error">{error}</div>;
    }

    if (!garage) {
        return <div className="garage-page">Không tìm thấy garage.</div>;
    }

    return (
        <div className="garage-page">
            <Link to={backPath} className="garage-back">
                ← Quay lại danh sách garage
            </Link>

            <div className="garage-detail-card">
                <p className="garage-eyebrow">Garage Detail</p>
                <h1>{garage.name}</h1>

                <div className="garage-detail-info">
                    <p><strong>Mã garage:</strong> {garage.garageCode}</p>
                    <p><strong>Địa chỉ:</strong> {garage.address}, {garage.city}</p>
                    <p><strong>Số điện thoại:</strong> {garage.phone}</p>
                    <p><strong>Giờ hoạt động:</strong> {garage.openingTime} - {garage.closingTime}</p>
                    <p><strong>Khoảng cách slot:</strong> {garage.slotIntervalMinutes} phút</p>
                    <p>
                        <strong>Trạng thái:</strong>{" "}
                        {garage.isActive ? "Đang hoạt động" : "Tạm ngưng"}
                    </p>
                </div>
            </div>

            <div className="garage-section">
                <h2>Khả năng phục vụ</h2>

                {capabilities.length === 0 ? (
                    <p className="garage-muted">Garage này chưa có wash bay hoặc chưa có loại xe hỗ trợ.</p>
                ) : (
                    <div className="capability-grid">
                        {capabilities.map((type) => (
                            <div className="capability-card" key={type}>
                                <h3>{type}</h3>
                                <p>Garage này hỗ trợ phục vụ loại phương tiện này.</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}