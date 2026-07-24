import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  createWashBay,
  getSupportedVehicleTypesByGarage,
  getWashBayCapacityByGarage,
  getWashBays,
  updateWashBay,
  updateWashBayStatus,
} from "../../services/washBayApi";
import { garageService } from "../../services/garageService";
import { getGarages } from "../../api/GarageApi";
import "./AdminWashBayManagementPage.css";

const DEFAULT_FORM = {
  garageId: "",
  name: "",
  bayCode: "",
  vehicleType: "CAR",
  status: "AVAILABLE",
  capacity: 1,
  description: "",
};

const VEHICLE_TYPES = [
  { value: "", label: "All types" },
  { value: "CAR", label: "Car" },
  { value: "BIKE", label: "Motorcycle" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "AVAILABLE", label: "Available" },
  { value: "IN_USE", label: "In use" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "INACTIVE", label: "Inactive" },
];

const WASH_BAY_NAMES_KEY = "washBayNamesById";

function normalizeWashBayVehicleType(vehicleType) {
  return vehicleType === "MOTORBIKE" ? "BIKE" : vehicleType;
}

function looksLikeBayCode(value) {
  return /^BAY[\w-]*$/i.test(String(value || "").trim());
}

function readWashBayNames() {
  try {
    return JSON.parse(localStorage.getItem(WASH_BAY_NAMES_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeWashBayName(id, name) {
  if (!id) return;
  const names = readWashBayNames();
  names[id] = name;
  localStorage.setItem(WASH_BAY_NAMES_KEY, JSON.stringify(names));
}

export default function AdminWashBayManagementPage() {
  const [washBays, setWashBays] = useState([]);
  const [garages, setGarages] = useState([]);
  const [washBayNames, setWashBayNames] = useState(() => readWashBayNames());
  const [filters, setFilters] = useState({
    garageId: "",
    vehicleType: "",
    status: "",
  });

  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState(null);

  const [supportedTypes, setSupportedTypes] = useState([]);
  const [capacityInfo, setCapacityInfo] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [garageMap, setGarageMap] = useState({});
  const [garageNameInfo, setGarageNameInfo] = useState(null);
  const garageDebounce = useRef(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isEditing = Boolean(editingId);

  // Match the "Wash bays" panel's height to "Create new wash bay" so its own
  // list can scroll internally instead of growing the page.
  const createPanelRef = useRef(null);
  const [matchedPanelHeight, setMatchedPanelHeight] = useState(null);

  useLayoutEffect(() => {
    const el = createPanelRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setMatchedPanelHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const totalAvailable = useMemo(() => {
    return washBays.filter((bay) => bay.status === "AVAILABLE").length;
  }, [washBays]);

  const totalMaintenance = useMemo(() => {
    return washBays.filter((bay) => bay.status === "MAINTENANCE").length;
  }, [washBays]);

  const totalInactive = useMemo(() => {
    return washBays.filter((bay) => bay.status === "INACTIVE").length;
  }, [washBays]);
  const totalInUse = useMemo(() => {
    return washBays.filter((bay) => bay.status === "IN_USE").length;
  }, [washBays]);

  async function loadWashBays() {
    try {
      setLoading(true);
      setError("");

      const data = await getWashBays(filters);
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.content)
        ? data.content
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setWashBays(list);

      const uniqueGarageIds = [...new Set(list.map((b) => b.garageId).filter(Boolean))];
      const entries = await Promise.all(
        uniqueGarageIds.map(async (id) => {
          try {
            const res = await garageService.getById(id);
            const g = res?.data || res;
            return [id, g?.name || g?.garageName || `Garage #${id}`];
          } catch {
            return [id, `Garage #${id}`];
          }
        })
      );
      setGarageMap(Object.fromEntries(entries));
    } catch (err) {
      setError(err.message || "Failed to load wash bays");
    } finally {
      setLoading(false);
    }
  }

  async function loadGarages() {
    try {
      const data = await getGarages({ page: 1, limit: 100 });
      const list = Array.isArray(data) ? data : data?.content || data?.data || data?.data?.content || [];
      setGarages(list);
    } catch {
      setGarages([]);
    }
  }

  useEffect(() => {
    loadWashBays();
    loadGarages();
  }, []);

  async function handleApplyFilter() {
    await loadWashBays();
  }

  function handleResetFilter() {
    setFilters({
      garageId: "",
      vehicleType: "",
      status: "",
    });
  }

  useEffect(() => {
    if (
      filters.garageId === "" &&
      filters.vehicleType === "" &&
      filters.status === ""
    ) {
      loadWashBays();
    }
  }, [filters.garageId, filters.vehicleType, filters.status]);

  useEffect(() => {
    const id = form.garageId;
    if (!id) { setGarageNameInfo(null); return; }
    clearTimeout(garageDebounce.current);
    garageDebounce.current = setTimeout(async () => {
      try {
        const res = await garageService.getById(id);
        const garage = res?.data || res;
        setGarageNameInfo(garage ? { name: garage.name || garage.garageName || `Garage #${id}`, id } : null);
      } catch { setGarageNameInfo(null); }
    }, 400);
    return () => clearTimeout(garageDebounce.current);
  }, [form.garageId]);

  async function handleCheckGarageInfo() {
    if (!filters.garageId && !form.garageId) {
      setError("Enter a garage ID before viewing garage info");
      return;
    }

    const garageId = filters.garageId || form.garageId;

    try {
      setError("");
      setSuccess("");

      const [types, capacity] = await Promise.all([
        getSupportedVehicleTypesByGarage(garageId),
        getWashBayCapacityByGarage(garageId),
      ]);

      setSupportedTypes(Array.isArray(types) ? types : types?.data || []);
      setCapacityInfo(capacity);
      setSuccess("Garage info loaded");
    } catch (err) {
      setError(err.message || "Failed to load garage info");
    }
  }

  function handleChangeForm(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: name === "capacity" ? Number(value) : value,
    }));
  }

  function handleEdit(bay) {
    setEditingId(bay.washBayId || bay.id);
    const rawBayCode = bay.bayCode || bay.code || "";
    const savedName = bay.name || bay.bayName || washBayNames[bay.washBayId || bay.id] || "";

    setForm({
      garageId: bay.garageId || bay.garage?.garageId || "",
      name: savedName || (looksLikeBayCode(rawBayCode) ? "" : rawBayCode),
      bayCode: looksLikeBayCode(rawBayCode) ? rawBayCode : "",
      vehicleType: normalizeWashBayVehicleType(bay.vehicleType || "CAR"),
      status: bay.status || "AVAILABLE",
      capacity: bay.capacity || 1,
      description: bay.description || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setGarageNameInfo(null);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.garageId) {
      setError("Please enter a garage ID");
      return;
    }

    if (!form.name.trim()) {
      setError("Please enter a wash bay name");
      return;
    }

    if (!form.bayCode.trim()) {
      setError("Please enter a bay code");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        garageId: Number(form.garageId),
        name: form.bayCode.trim(),
        bayCode: form.bayCode.trim(),
        vehicleType: normalizeWashBayVehicleType(form.vehicleType),
        status: form.status,
        description: form.description.trim(),
      };

      if (isEditing) {
        await updateWashBay(editingId, payload);
        writeWashBayName(editingId, form.name.trim());
        setWashBayNames(readWashBayNames());
        setSuccess("Wash bay updated successfully");
      } else {
        const created = await createWashBay(payload);
        const createdId = created?.id || created?.washBayId || created?.data?.id || created?.data?.washBayId;
        writeWashBayName(createdId, form.name.trim());
        setWashBayNames(readWashBayNames());
        setSuccess("Wash bay created successfully");
      }

      setEditingId(null);
      setForm(DEFAULT_FORM);
      await loadWashBays();
    } catch (err) {
      setError(err.message || "Failed to save wash bay");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeStatus(bay, nextStatus) {
    const id = bay.washBayId || bay.id;

    try {
      setError("");
      setSuccess("");

      await updateWashBayStatus(id, nextStatus);
      setSuccess("Wash bay status updated");
      await loadWashBays();
    } catch (err) {
      setError(err.message || "Failed to update status");
    }
  }

  function getBayId(bay) {
    return bay.washBayId || bay.id;
  }

  function getBayName(bay) {
    const id = getBayId(bay);
    const rawBayCode = bay.bayCode || bay.code || "";
    return bay.name || bay.bayName || washBayNames[id] || (looksLikeBayCode(rawBayCode) ? "-" : rawBayCode);
  }

  function getBayCode(bay) {
    const rawBayCode = bay.bayCode || bay.code || "";
    return looksLikeBayCode(rawBayCode) ? rawBayCode : "-";
  }

  function getGarageName(bay) {
    const garageId = bay.garageId || bay.garage?.garageId || bay.garage?.id;
    const garage = garages.find((item) => String(item.id || item.garageId) === String(garageId));

    return garageMap[garageId] || bay.garageName || bay.garage?.name || bay.garage?.garageName || garage?.name || garage?.garageName || "-";
  }

  function getGarageId(bay) {
    return bay.garageId || bay.garage?.garageId || "-";
  }

  const sortedWashBays = useMemo(() => {
    return [...washBays].sort((a, b) => {
      const garageA = Number(a.garageId || a.garage?.garageId || 0);
      const garageB = Number(b.garageId || b.garage?.garageId || 0);

      if (garageA !== garageB) return garageA - garageB;

      return Number(getBayId(a) || 0) - Number(getBayId(b) || 0);
    });
  }, [washBays]);

  return (
    <div className="wash-bay-page">
      <div className="wash-bay-header">
        <div>
          <p className="wash-bay-eyebrow">Admin</p>
          <h1>Wash Bay Management</h1>
          <p>Manage wash bays by garage, vehicle type, status and capacity.</p>
        </div>

        <div className="wash-bay-stats">
          <div className="wash-bay-stat"><span>Total</span><strong>{washBays.length}</strong></div>
          <div className="wash-bay-stat"><span>Available</span><strong>{totalAvailable}</strong></div>
          <div className="wash-bay-stat"><span>In Use</span><strong>{totalInUse}</strong></div>
          <div className="wash-bay-stat"><span>Maintenance</span><strong>{totalMaintenance}</strong></div>
          <div className="wash-bay-stat"><span>Inactive</span><strong>{totalInactive}</strong></div>
        </div>
      </div>

      {error && <div className="wash-bay-alert error">{error}</div>}
      {success && <div className="wash-bay-alert success">{success}</div>}

      <div className="wash-bay-grid">
        <section className="wash-bay-panel" ref={createPanelRef}>
          <div className="wash-bay-panel-header">
            <div>
              <h2>{isEditing ? "Update wash bay" : "Create new wash bay"}</h2>
              <p>
                Admins can create, edit information and status for wash bays.
              </p>
            </div>
          </div>

          <form className="wash-bay-form" onSubmit={handleSubmit}>
            <div className="wash-bay-form-row">
              <label>
                Garage ID
                <input
                  name="garageId"
                  value={form.garageId}
                  onChange={handleChangeForm}
                  placeholder="e.g. 1"
                  type="number"
                  min="1"
                />
                {garageNameInfo && (
                  <span style={{ fontSize: 12, color: "#2563eb", marginTop: 4, display: "block" }}>
                    {garageNameInfo.name}{" "}
                    <span style={{ fontSize: 10, opacity: 0.6 }}>#{garageNameInfo.id}</span>
                  </span>
                )}
              </label>

              <label>
                Bay code
                <input
                  name="bayCode"
                  value={form.bayCode}
                  onChange={handleChangeForm}
                  placeholder="e.g. BAY-01"
                />
              </label>
            </div>

            <label>
              Wash bay name
              <input
                name="name"
                value={form.name}
                onChange={handleChangeForm}
                placeholder="e.g. Wash bay 1"
              />
            </label>

            <div className="wash-bay-form-row">
              <label>
                Vehicle type
                <select
                  name="vehicleType"
                  value={form.vehicleType}
                  onChange={handleChangeForm}
                >
                  <option value="CAR">Car</option>
                  <option value="BIKE">Motorbike</option>
                </select>
              </label>

              <label>
                Status
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChangeForm}
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="IN_USE">In Use</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
            </div>

            <div>
              <label className="wash-bay-field-narrow">
                Capacity
                <input
                  name="capacity"
                  value={1}
                  readOnly
                  type="number"
                  min="1"
                  disabled={isEditing}
                  style={{ opacity: 0.6, cursor: "not-allowed" }}
                />
              </label>
              {isEditing && (
                <small>
                  Garage capacity equals the number of wash bays. To increase capacity, create more wash bays.
                </small>
              )}
            </div>

            <label>
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={handleChangeForm}
                placeholder="Additional notes about this wash bay..."
                rows="4"
              />
            </label>

            <div className="wash-bay-actions">
              <button className="wash-bay-primary-btn" type="submit">
                {saving
                  ? "Saving..."
                  : isEditing
                    ? "Save changes"
                    : "Create wash bay"}
              </button>

              {isEditing && (
                <button
                  className="wash-bay-ghost-btn"
                  type="button"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section
          className="wash-bay-panel wash-bay-panel--list"
          style={matchedPanelHeight ? { height: matchedPanelHeight } : undefined}
        >
          <div className="wash-bay-panel-header">
            <div>
              <h2>Wash bays</h2>
              <p>View, filter, edit and update wash bay status.</p>
            </div>

            <button className="wash-bay-ghost-btn" type="button" onClick={loadWashBays}>
              Refresh
            </button>
          </div>

          <div className="wash-bay-filters">
            <div className="wash-bay-filter-field">
              <label>Garage ID</label>
              <input
                value={filters.garageId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, garageId: e.target.value }))
                }
                placeholder="e.g. 1"
                type="number"
                min="1"
              />
            </div>

            <div className="wash-bay-filter-field">
              <label>Vehicle type</label>
              <select
                value={filters.vehicleType}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, vehicleType: e.target.value }))
                }
              >
                {VEHICLE_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            <div className="wash-bay-filter-field">
              <label>Status</label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            <button className="wash-bay-primary-btn" type="button" onClick={handleApplyFilter}>
              Apply
            </button>
            <button className="wash-bay-ghost-btn" type="button" onClick={handleResetFilter}>
              Clear
            </button>
            <button className="wash-bay-info-btn" type="button" onClick={handleCheckGarageInfo}>
              View capacity &amp; types
            </button>
          </div>

          {(supportedTypes.length > 0 || capacityInfo) && (
            <div className="wash-bay-garage-info">
              <h3>Garage info</h3>

              <div>
                <span>Supported types:</span>
                <strong>
                  {supportedTypes.length > 0 ? supportedTypes.join(", ") : "No data"}
                </strong>
              </div>

              <div>
                <span>Capacity:</span>
                <strong>
                  {typeof capacityInfo === "object"
                    ? JSON.stringify(capacityInfo)
                    : capacityInfo || "No data"}
                </strong>
              </div>
            </div>
          )}

          <div className="wash-bay-scroll">
            <div className="wash-bay-table-wrap">
              <table className="wash-bay-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Garage</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Capacity</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="wash-bay-empty">
                        Loading wash bays...
                      </td>
                    </tr>
                  ) : sortedWashBays.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="wash-bay-empty">
                        No wash bays found.
                      </td>
                    </tr>
                  ) : (
                    sortedWashBays.map((bay) => (
                      <tr key={getBayId(bay)}>
                        <td>#{getBayId(bay)}</td>
                        <td>
                          <div className="wash-bay-garage-cell">
                            <strong>{getGarageName(bay)}</strong>
                            <span>Garage ID: {getGarageId(bay)}</span>
                          </div>
                        </td>
                        <td>{getBayCode(bay)}</td>
                        <td>{getBayName(bay)}</td>
                        <td>
                          <span className="wash-bay-type-pill">
                            {bay.vehicleType === "BIKE" || bay.vehicleType === "MOTORBIKE" ? "Motorcycle" : "Car"}
                          </span>
                        </td>
                        <td>1 slot</td>
                        <td>
                          <span className={`wash-bay-status ${bay.status || "UNKNOWN"}`}>
                            {bay.status || "UNKNOWN"}
                          </span>
                        </td>
                        <td>
                          <div className="wash-bay-table-actions">
                            <button type="button" onClick={() => handleEdit(bay)}>
                              Edit
                            </button>

                            <select
                              value={bay.status || "AVAILABLE"}
                              onChange={(e) => handleChangeStatus(bay, e.target.value)}
                            >
                              <option value="AVAILABLE">Available</option>
                              <option value="IN_USE">In Use</option>
                              <option value="MAINTENANCE">Maintenance</option>
                              <option value="INACTIVE">Inactive</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
