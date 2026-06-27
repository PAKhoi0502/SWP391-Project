import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getGarages, updateGarageStatus } from "../../api/GarageApi";
import "../GaragePage.css";

export default function AdminGarageListPage() {
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
                limit: 50,
                keyword: searchValue,
            });

            setGarages(result.data || []);
        } catch (err) {
            setError(err.message || "Không thể tải danh sách garage");
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

    async function handleToggleStatus(garage) {
        const nextStatus = !garage.isActive;

        const ok = window.confirm(
            nextStatus
                ? "Bạn muốn kích hoạt garage này?"
                : "Bạn muốn tạm ngưng garage này?"
        );

        if (!ok) return;

        try {
            await updateGarageStatus(garage.id, nextStatus);
            await fetchGarages(keyword);
        } catch (err) {
            alert(err.message || "Cập nhật trạng thái thất bại");
        }
    }

    return (
        <div className="garage-page">
            <div className="admin-garage-header">
                <div>
                    <p className="garage-eyebrow">Admin</p>
                    <h1>Quản lý garage</h1>
                </div>

                <Link className="garage-btn" to="/admin/garages/create">
                    + Thêm garage
                </Link>
            </div>

            <form className="garage-search" onSubmit={handleSearch}>
                <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Tìm garage..."
                />
                <button type="submit">Tìm</button>
            </form>

            {loading && <p>Đang tải garage...</p>}
            {error && <div className="garage-error">{error}</div>}

            {!loading && !error && (
                <div className="admin-table-wrap">
                    <table className="admin-garage-table">
                        <thead>
                            <tr>
                                <th>Tên</th>
                                <th>Mã</th>
                                <th>Địa chỉ</th>
                                <th>Thành phố</th>
                                <th>SĐT</th>
                                <th>Giờ</th>
                                <th>Trạng thái</th>
                                <th>Thao tác</th>
                            </tr>
                        </thead>

                        <tbody>
                            {garages.map((garage) => (
                                <tr key={garage.id}>
                                    <td>{garage.name}</td>
                                    <td>{garage.garageCode}</td>
                                    <td>{garage.address}</td>
                                    <td>{garage.city}</td>
                                    <td>{garage.phone}</td>
                                    <td>{garage.openingTime} - {garage.closingTime}</td>
                                    <td>
                                        <span className={garage.isActive ? "garage-status on" : "garage-status off"}>
                                            {garage.isActive ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="admin-actions">
                                            <Link to={`/admin/garages/${garage.id}/edit`}>Sửa</Link>
                                            <button onClick={() => handleToggleStatus(garage)}>
                                                {garage.isActive ? "Deactivate" : "Active"}
                                            </button>
                                            <Link to={`/admin/garages/${garage.id}`}>Xem</Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}