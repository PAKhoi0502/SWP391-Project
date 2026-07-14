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
                setError(err.message || "Could not load garage details");
            } finally {
                setLoading(false);
            }
        }

        fetchDetail();
    }, [id]);

    if (loading) {
        return <div className="garage-page">Loading garage details...</div>;
    }

    if (error) {
        return <div className="garage-page garage-error">{error}</div>;
    }

    if (!garage) {
        return <div className="garage-page">Garage not found.</div>;
    }

    return (
        <div className="garage-page">
            <Link to={backPath} className="garage-back">
                ← Back to garage list
            </Link>

            <div className="garage-detail-card">
                <p className="garage-eyebrow">Garage Detail</p>
                <h1>{garage.name}</h1>

                <div className="garage-detail-info">
                    <p><strong>Garage code:</strong> {garage.garageCode}</p>
                    <p><strong>Address:</strong> {garage.address}, {garage.city}</p>
                    <p><strong>Phone number:</strong> {garage.phone}</p>
                    <p><strong>Opening hours:</strong> {garage.openingTime} - {garage.closingTime}</p>
                    <p><strong>Slot interval:</strong> {garage.slotIntervalMinutes} min</p>
                    <p>
                        <strong>Status:</strong>{" "}
                        {garage.isActive ? "Active" : "Suspended"}
                    </p>
                </div>
            </div>

            <div className="garage-section">
                <h2>Service Capabilities</h2>

                {capabilities.length === 0 ? (
                    <p className="garage-muted">This garage has no wash bays or supported vehicle types yet.</p>
                ) : (
                    <div className="capability-grid">
                        {capabilities.map((type) => (
                            <div className="capability-card" key={type}>
                                <h3>{type}</h3>
                                <p>This garage supports servicing this vehicle type.</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}