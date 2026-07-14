import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getGarages } from "../api/GarageApi";
import "./GaragePage.css";

export default function GarageListPage() {
    const [garages, setGarages] = useState([]);
    const [keyword, setKeyword] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function fetchGarages(searchValue = "") {
        try {
            setLoading(true);
            setError("");

            const result = await getGarages({
                page: 1,
                limit: 20,
                isActive: true,
                keyword: searchValue,
            });

            setGarages(result.data || []);
        } catch (err) {
            setError(err.message || "Could not load the garage list");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchGarages();
    }, []);

    function handleSearch(e) {
        e.preventDefault();
        fetchGarages(keyword);
    }

    return (
        <div className="garage-page">
            <div className="garage-header">
                <p className="garage-eyebrow">AutoWash Pro</p>
                <h1>Garage List</h1>
                <p>Choose the right garage to view its address, opening hours, and service capabilities.</p>
            </div>

            <form className="garage-search" onSubmit={handleSearch}>
                <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Search by name, address, city..."
                />
                <button type="submit">Search</button>
            </form>

            {loading && <p>Loading garages...</p>}
            {error && <div className="garage-error">{error}</div>}

            {!loading && !error && (
                <div className="garage-grid">
                    {garages.map((garage) => (
                        <div className="garage-card" key={garage.id}>
                            <div className="garage-card-top">
                                <h3>{garage.name}</h3>
                                <span className={garage.isActive ? "garage-status on" : "garage-status off"}>
                                    {garage.isActive ? "Active" : "Suspended"}
                                </span>
                            </div>

                            <p className="garage-code">{garage.garageCode}</p>
                            <p className="garage-address">
                                {garage.address}, {garage.city}
                            </p>
                            <p className="garage-info">Phone: {garage.phone}</p>
                            <p className="garage-info">
                                Opening hours: {garage.openingTime} - {garage.closingTime}
                            </p>

                            <Link className="garage-btn" to={`/customer/garages/${garage.id}`}>
                                View Details
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}