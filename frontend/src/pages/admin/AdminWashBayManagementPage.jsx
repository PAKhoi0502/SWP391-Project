import { useEffect, useMemo, useState } from "react";
import {
  createWashBay,
  getSupportedVehicleTypesByGarage,
  getWashBayCapacityByGarage,
  getWashBays,
  updateWashBay,
  updateWashBayStatus,
} from "../../services/washBayApi";
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
  { value: "", label: "Tất cả loại xe" },
  { value: "CAR", label: "Ô tô" },
  { value: "BIKE", label: "Xe máy" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "AVAILABLE", label: "Sẵn sàng" },
  { value: "IN_USE", label: "Đang sử dụng" },
  { value: "MAINTENANCE", label: "Bảo trì" },
  { value: "INACTIVE", label: "Tạm ngưng" },
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

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isEditing = Boolean(editingId);

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

      if (Array.isArray(data)) {
        setWashBays(data);
      } else if (Array.isArray(data?.content)) {
        setWashBays(data.content);
      } else if (Array.isArray(data?.data)) {
        setWashBays(data.data);
      } else {
        setWashBays([]);
      }
    } catch (err) {
      setError(err.message || "Không tải được danh sách wash bay");
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

  async function handleCheckGarageInfo() {
    if (!filters.garageId && !form.garageId) {
      setError("Nhập garageId trước khi xem thông tin garage");
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
      setSuccess("Đã tải thông tin garage");
    } catch (err) {
      setError(err.message || "Không tải được thông tin garage");
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
    setError("");
    setSuccess("");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.garageId) {
      setError("Vui lòng nhập garageId");
      return;
    }

    if (!form.name.trim()) {
      setError("Vui lòng nhập tên wash bay");
      return;
    }

    if (!form.bayCode.trim()) {
      setError("Vui lòng nhập mã wash bay");
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
        setSuccess("Cập nhật wash bay thành công");
      } else {
        const created = await createWashBay(payload);
        const createdId = created?.id || created?.washBayId || created?.data?.id || created?.data?.washBayId;
        writeWashBayName(createdId, form.name.trim());
        setWashBayNames(readWashBayNames());
        setSuccess("Tạo wash bay thành công");
      }

      setEditingId(null);
      setForm(DEFAULT_FORM);
      await loadWashBays();
    } catch (err) {
      setError(err.message || "Lưu wash bay thất bại");
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
      setSuccess("Cập nhật trạng thái wash bay thành công");
      await loadWashBays();
    } catch (err) {
      setError(err.message || "Cập nhật trạng thái thất bại");
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

    return bay.garageName || bay.garage?.name || bay.garage?.garageName || garage?.name || garage?.garageName || "-";
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
      <div className="wash-bay-hero">
        <div>
          <p className="wash-bay-kicker">Admin Management</p>
          <h1>Wash Bay Management</h1>
          <p>
            Quản lý khoang rửa theo garage, loại xe, trạng thái và sức chứa.
          </p>
        </div>

        <div className="wash-bay-hero-stats">
          <div className="wash-bay-stat-card">
            <span>Total</span>
            <strong>{washBays.length}</strong>
          </div>
          <div className="wash-bay-stat-card active">
            <span>Available</span>
            <strong>{totalAvailable}</strong>
          </div>
          <div className="wash-bay-stat-card maintenance">
            <span>Maintenance</span>
            <strong>{totalMaintenance}</strong>
          </div>
          <div className="wash-bay-stat-card in-use">
  <span>In Use</span>
  <strong>{totalInUse}</strong>
</div>
          <div className="wash-bay-stat-card inactive">
            <span>Inactive</span>
            <strong>{totalInactive}</strong>
          </div>
        </div>
      </div>

      {error && <div className="wash-bay-alert error">{error}</div>}
      {success && <div className="wash-bay-alert success">{success}</div>}

      <div className="wash-bay-grid">
        <section className="wash-bay-panel">
          <div className="wash-bay-panel-header">
            <div>
              <h2>{isEditing ? "Cập nhật wash bay" : "Tạo wash bay mới"}</h2>
              <p>
                Admin có thể tạo mới, chỉnh sửa thông tin và trạng thái wash bay.
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
                  placeholder="VD: 1"
                  type="number"
                  min="1"
                />
              </label>

              <label>
                Mã bay
                <input
                  name="bayCode"
                  value={form.bayCode}
                  onChange={handleChangeForm}
                  placeholder="VD: BAY-01"
                />
              </label>
            </div>

            <label>
              Tên wash bay
              <input
                name="name"
                value={form.name}
                onChange={handleChangeForm}
                placeholder="VD: Khoang rửa số 1"
              />
            </label>

            <div className="wash-bay-form-row">
              <label>
                Loại xe hỗ trợ
                <select
                  name="vehicleType"
                  value={form.vehicleType}
                  onChange={handleChangeForm}
                >
                  <option value="CAR">Ô tô</option>
                  <option value="BIKE">Xe máy</option>
                </select>
              </label>

              <label>
                Trạng thái
                <select
  name="status"
  value={form.status}
  onChange={handleChangeForm}
>
  <option value="AVAILABLE">Sẵn sàng</option>
  <option value="IN_USE">Đang sử dụng</option>
  <option value="MAINTENANCE">Bảo trì</option>
  <option value="INACTIVE">Tạm ngưng</option>
</select>
              </label>
            </div>

            <label>
              Sức chứa
              <input
                name="capacity"
                value={form.capacity}
                onChange={handleChangeForm}
                type="number"
                min="1"
                disabled={isEditing}
              />
              {isEditing && (
                <small>
                  Sức chứa garage được tính bằng số wash bay. Muốn tăng sức chứa, hãy tạo thêm wash bay mới.
                </small>
              )}
            </label>

            <label>
              Mô tả
              <textarea
                name="description"
                value={form.description}
                onChange={handleChangeForm}
                placeholder="Ghi chú thêm về khoang rửa..."
                rows="4"
              />
            </label>

            <div className="wash-bay-actions">
              <button className="wash-bay-primary-btn" type="submit">
                {saving
                  ? "Đang lưu..."
                  : isEditing
                  ? "Lưu cập nhật"
                  : "Tạo wash bay"}
              </button>

              {isEditing && (
                <button
                  className="wash-bay-ghost-btn"
                  type="button"
                  onClick={handleCancelEdit}
                >
                  Hủy sửa
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="wash-bay-panel">
          <div className="wash-bay-panel-header">
            <div>
              <h2>Bộ lọc</h2>
              <p>Lọc wash bay theo garage, loại xe và trạng thái.</p>
            </div>
          </div>

          <div className="wash-bay-filter-box">
            <label>
              Garage ID
              <input
                value={filters.garageId}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    garageId: e.target.value,
                  }))
                }
                placeholder="VD: 1"
                type="number"
                min="1"
              />
            </label>

            <label>
              Loại xe
              <select
                value={filters.vehicleType}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    vehicleType: e.target.value,
                  }))
                }
              >
                {VEHICLE_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Trạng thái
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: e.target.value,
                  }))
                }
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="wash-bay-actions">
              <button
                className="wash-bay-primary-btn"
                type="button"
                onClick={handleApplyFilter}
              >
                Áp dụng lọc
              </button>

              <button
                className="wash-bay-ghost-btn"
                type="button"
                onClick={handleResetFilter}
              >
                Xóa lọc
              </button>
            </div>

            <button
              className="wash-bay-info-btn"
              type="button"
              onClick={handleCheckGarageInfo}
            >
              Xem loại xe hỗ trợ & sức chứa garage
            </button>
          </div>

          {(supportedTypes.length > 0 || capacityInfo) && (
            <div className="wash-bay-garage-info">
              <h3>Thông tin garage</h3>

              <div>
                <span>Loại xe hỗ trợ:</span>
                <strong>
                  {supportedTypes.length > 0
                    ? supportedTypes.join(", ")
                    : "Chưa có dữ liệu"}
                </strong>
              </div>

              <div>
                <span>Sức chứa:</span>
                <strong>
                  {typeof capacityInfo === "object"
                    ? JSON.stringify(capacityInfo)
                    : capacityInfo || "Chưa có dữ liệu"}
                </strong>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="wash-bay-panel wash-bay-table-panel">
        <div className="wash-bay-panel-header">
          <div>
            <h2>Danh sách wash bay</h2>
            <p>Admin/staff có thể xem, lọc, sửa và đổi trạng thái.</p>
          </div>

          <button
            className="wash-bay-ghost-btn"
            type="button"
            onClick={loadWashBays}
          >
            Refresh
          </button>
        </div>

        <div className="wash-bay-table-wrap">
          <table className="wash-bay-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Garage</th>
                <th>Mã bay</th>
                <th>Tên bay</th>
                <th>Loại xe</th>
                <th>Sức chứa</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="wash-bay-empty">
                    Đang tải danh sách wash bay...
                  </td>
                </tr>
              ) : sortedWashBays.length === 0 ? (
                <tr>
                  <td colSpan="8" className="wash-bay-empty">
                    Chưa có wash bay nào.
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
                        {bay.vehicleType === "BIKE" || bay.vehicleType === "MOTORBIKE" ? "Xe máy" : "Ô tô"}
                      </span>
                    </td>
                    <td>1 bay</td>
                    <td>
                      <span
                        className={`wash-bay-status ${
                          bay.status || "UNKNOWN"
                        }`}
                      >
                        {bay.status || "UNKNOWN"}
                      </span>
                    </td>
                    <td>
                      <div className="wash-bay-table-actions">
                        <button type="button" onClick={() => handleEdit(bay)}>
                          Sửa
                        </button>

                        <select
  value={bay.status || "AVAILABLE"}
  onChange={(e) =>
    handleChangeStatus(bay, e.target.value)
  }
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
      </section>
    </div>
  );
}
