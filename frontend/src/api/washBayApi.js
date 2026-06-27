const API_BASE_URL = "http://localhost:8080/api";

function getAuthHeaders() {
  const token = localStorage.getItem("accessToken");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse(res) {
  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || "Request failed");
  }

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function getWashBays(params = {}) {
  const query = new URLSearchParams();

  if (params.garageId) query.append("garageId", params.garageId);
  if (params.vehicleType) query.append("vehicleType", params.vehicleType);
  if (params.status) query.append("status", params.status);

  const res = await fetch(
    `${API_BASE_URL}/wash-bays${query.toString() ? `?${query.toString()}` : ""}`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    }
  );

  return handleResponse(res);
}

export async function createWashBay(payload) {
  const res = await fetch(`${API_BASE_URL}/wash-bays`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res);
}

export async function updateWashBayStatus(id, status) {
  const res = await fetch(`${API_BASE_URL}/wash-bays/${id}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(status),
  });

  return handleResponse(res);
}

export async function updateWashBayStatus(id, status) {
  const res = await fetch(`${API_BASE_URL}/wash-bays/${id}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });

  return handleResponse(res);
}

export async function getSupportedVehicleTypesByGarage(garageId) {
  const res = await fetch(
    `${API_BASE_URL}/wash-bays/garages/${garageId}/supported-vehicle-types`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    }
  );

  return handleResponse(res);
}

export async function getWashBayCapacityByGarage(garageId) {
  const res = await fetch(
    `${API_BASE_URL}/wash-bays/garages/${garageId}/capacity`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    }
  );

  return handleResponse(res);
}