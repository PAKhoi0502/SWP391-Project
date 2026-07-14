const API_BASE_URL = "http://localhost:8080/api";

function getToken() {
  return (
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("accessToken") ||
    sessionStorage.getItem("token")
  );
}

function authHeaders() {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse(res, defaultMessage) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || defaultMessage);
  }

  return res.json();
}

export async function getGarages({ page = 1, limit = 10, isActive, keyword } = {}) {
  const params = new URLSearchParams();

  params.append("page", page);
  params.append("limit", limit);

  if (isActive !== undefined && isActive !== null) {
    params.append("isActive", isActive);
  }

  if (keyword && keyword.trim()) {
    params.append("keyword", keyword.trim());
  }

  const res = await fetch(`${API_BASE_URL}/garages?${params.toString()}`, {
    method: "GET",
    headers: authHeaders(),
  });

  return handleResponse(res, "Could not load the garage list");
}

export async function getGarageById(id) {
  const res = await fetch(`${API_BASE_URL}/garages/${id}`, {
    method: "GET",
    headers: authHeaders(),
  });

  return handleResponse(res, "Could not load garage details");
}

export async function getGarageCapabilities(id) {
  const res = await fetch(`${API_BASE_URL}/garages/${id}/capabilities`, {
    method: "GET",
    headers: authHeaders(),
  });

  return handleResponse(res, "Could not load the garage's service capabilities");
}

export async function createGarage(data) {
  const res = await fetch(`${API_BASE_URL}/garages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse(res, "Failed to create garage");
}

export async function updateGarage(id, data) {
  const res = await fetch(`${API_BASE_URL}/garages/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse(res, "Failed to update garage");
}

export async function updateGarageStatus(id, isActive) {
  const res = await fetch(`${API_BASE_URL}/garages/${id}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ isActive }),
  });

  return handleResponse(res, "Failed to update garage status");
}