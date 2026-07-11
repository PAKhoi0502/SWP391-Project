import { useState } from "react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { getGarages, updateGarageStatus } from "../../api/GarageApi";
import "./AdminGarageListPage.css";

export default function AdminGarageListPage() {
  const [garages, setGarages] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function fetchGarages(searchValue = "") {
    try {
      setLoading(true);
      setError("");
      const result = await getGarages({ page: 1, limit: 50, keyword: searchValue });
      setGarages(result.data || []);
    } catch (err) {
      setError(err.message || "Failed to load garages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchGarages(); }, []);

  function handleSearch(e) {
    e.preventDefault();
    fetchGarages(keyword);
  }

  function handleToggleStatus(garage) {
    setConfirmDialog({ garage, nextStatus: !garage.isActive });
  }

  async function handleConfirmToggle() {
    if (!confirmDialog) return;
    setActionLoading(true);
    try {
      await updateGarageStatus(confirmDialog.garage.id, confirmDialog.nextStatus);
      await fetchGarages(keyword);
      setConfirmDialog(null);
    } catch (err) {
      setError(err.message || "Failed to update status.");
      setConfirmDialog(null);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="agl-page">
      <div className="agl-header">
        <div>
          <p className="agl-eyebrow">ADMIN</p>
          <h1>Garages</h1>
          <p>Manage garage locations, info and operating hours.</p>
        </div>
        <Link className="agl-add-btn" to="/admin/garages/create">+ Add garage</Link>
      </div>

      <form className="agl-search" onSubmit={handleSearch}>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search garages..."
        />
        <button type="submit">Search</button>
      </form>

      {error && <div className="agl-error">{error}</div>}

      {loading ? (
        <div className="agl-loading">Loading garages...</div>
      ) : (
        <div className="agl-table-wrap">
          <table className="agl-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Address</th>
                <th>City</th>
                <th>Phone</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {garages.length === 0 ? (
                <tr>
                  <td colSpan="8" className="agl-empty">No garages found.</td>
                </tr>
              ) : garages.map((garage) => (
                <tr key={garage.id}>
                  <td><span className="agl-garage-name">{garage.name}</span></td>
                  <td><span className="agl-garage-code">{garage.garageCode}</span></td>
                  <td>{garage.address}</td>
                  <td>{garage.city}</td>
                  <td>{garage.phone}</td>
                  <td className="agl-hours">{garage.openingTime} – {garage.closingTime}</td>
                  <td>
                    <span className={`agl-status${garage.isActive ? ' agl-status--active' : ' agl-status--inactive'}`}>
                      {garage.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="agl-actions">
                      <Link to={`/admin/garages/${garage.id}/edit`} className="agl-btn">Edit</Link>
                      <button
                        className={`agl-btn${garage.isActive ? ' agl-btn--danger' : ''}`}
                        onClick={() => handleToggleStatus(garage)}
                      >
                        {garage.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <Link to={`/admin/garages/${garage.id}`} className="agl-btn">View</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDialog && (
        <div className="agl-overlay" onClick={() => !actionLoading && setConfirmDialog(null)}>
          <div className="agl-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmDialog.nextStatus ? 'Activate garage?' : 'Deactivate garage?'}</h3>
            <p>
              {confirmDialog.nextStatus ? 'Activate' : 'Deactivate'}{' '}
              <strong>{confirmDialog.garage.name}</strong>?
            </p>
            <div className="agl-dialog-actions">
              <button
                className="agl-dialog-cancel"
                onClick={() => setConfirmDialog(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className={`agl-dialog-confirm${confirmDialog.nextStatus ? '' : ' danger'}`}
                onClick={handleConfirmToggle}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
