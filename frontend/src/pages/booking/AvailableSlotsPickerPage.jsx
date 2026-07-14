import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { bookingApi } from "../../api/bookingApi";
import { getGarages } from "../../api/GarageApi";
import {
  extractList,
  getPackageId,
  getPackageName,
  getPackageActive,
  getServicePackages,
} from "../../services/servicePackageApi";
import {
  Button,
  EmptyState,
  ErrorState,
  FilterBar,
  Input,
  LoadingSpinner,
  Select,
} from "../../components/common/ui";

import "./AvailableSlotsPickerPage.css";

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(dateTime) {
  if (!dateTime) return "";

  return new Date(dateTime).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}


function extractSlots(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.slots)) return payload.slots;
  if (Array.isArray(payload?.availableSlots)) return payload.availableSlots;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.slots)) return payload.data.slots;
  if (Array.isArray(payload?.data?.availableSlots)) return payload.data.availableSlots;
  if (Array.isArray(payload?.data?.content)) return payload.data.content;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
}

function extractGarages(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.content)) return payload.data.content;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
}

function getGarageId(garage) {
  return garage?.id ?? garage?.garageId;
}

function getGarageName(garage) {
  return (
    garage?.name ||
    garage?.garageName ||
    garage?.branchName ||
    garage?.address ||
    `Garage #${getGarageId(garage)}`
  );
}

function getPackageVehicleType(pkg) {
  return (
    pkg?.vehicleType ||
    pkg?.vehicle_type ||
    pkg?.supportedVehicleType ||
    pkg?.vehicleCategory ||
    ""
  );
}

function normalizeVehicleType(type) {
  const value = String(type || "").trim().toUpperCase();

  if (
    value === "BIKE" ||
    value === "MOTORBIKE" ||
    value === "MOTORCYCLE" ||
    value === "XE_MAY"
  ) {
    return "MOTORBIKE";
  }

  if (value === "CAR" || value === "AUTO" || value === "Ô TÔ") {
    return "CAR";
  }

  return value;
}

function getVehicleTypeLabel(type) {
  const value = normalizeVehicleType(type);

  if (value === "CAR") {
    return "Car";
  }

  if (value === "MOTORBIKE") {
    return "Motorbike";
  }

  return type || "Vehicle type";
}

function buildVehicleTypeOptions(packages) {
  const optionsByType = new Map();

  packages.forEach((pkg) => {
    if (!getPackageActive(pkg)) return;

    const rawType = getPackageVehicleType(pkg);
    const normalizedType = normalizeVehicleType(rawType);

    if (!rawType || !normalizedType || optionsByType.has(normalizedType)) {
      return;
    }

    optionsByType.set(normalizedType, {
      value: rawType,
      label: getVehicleTypeLabel(rawType),
    });
  });

  const options = Array.from(optionsByType.values());

  if (options.length > 0) {
    return options;
  }

  return [
    { value: "CAR", label: "Car" },
    { value: "MOTORBIKE", label: "Motorbike" },
  ];
}

export default function AvailableSlotsPickerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const latestRequestId = useRef(0);

  const [garageId, setGarageId] = useState(searchParams.get("garageId") || "");
  const [servicePackageId, setServicePackageId] = useState(
    searchParams.get("servicePackageId") || ""
  );
  const [vehicleType, setVehicleType] = useState(searchParams.get("vehicleType") || "");
  const [date, setDate] = useState(searchParams.get("date") || getToday());

  const [garages, setGarages] = useState([]);
  const [servicePackages, setServicePackages] = useState([]);

  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [initialLoading, setInitialLoading] = useState(false);
  const [initialError, setInitialError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const garageOptions = useMemo(() => {
    return garages
      .map((garage) => ({
        value: getGarageId(garage),
        label: getGarageName(garage),
      }))
      .filter((option) => option.value !== undefined && option.value !== null);
  }, [garages]);

  const vehicleTypeOptions = useMemo(() => {
    return buildVehicleTypeOptions(servicePackages);
  }, [servicePackages]);

  const filteredServicePackages = useMemo(() => {
    return servicePackages.filter((pkg) => {
      if (!getPackageActive(pkg)) return false;
      if (!vehicleType) return true;

      const packageVehicleType = normalizeVehicleType(getPackageVehicleType(pkg));
      const selectedVehicleType = normalizeVehicleType(vehicleType);

      return !packageVehicleType || packageVehicleType === selectedVehicleType;
    });
  }, [servicePackages, vehicleType]);

  const servicePackageOptions = useMemo(() => {
    return filteredServicePackages
      .map((pkg) => ({
        value: getPackageId(pkg),
        label: getPackageName(pkg),
      }))
      .filter((option) => option.value !== undefined && option.value !== null);
  }, [filteredServicePackages]);

  const selectedPackage = useMemo(() => {
    return servicePackages.find(
      (pkg) => String(getPackageId(pkg)) === String(servicePackageId)
    );
  }, [servicePackages, servicePackageId]);

  const selectedPackageMatchesVehicleType = useMemo(() => {
    if (!selectedPackage || !vehicleType) return false;

    const packageVehicleType = normalizeVehicleType(getPackageVehicleType(selectedPackage));
    const selectedVehicleType = normalizeVehicleType(vehicleType);

    return !packageVehicleType || packageVehicleType === selectedVehicleType;
  }, [selectedPackage, vehicleType]);

  const canLoadSlots = useMemo(() => {
    return (
      garageId &&
      servicePackageId &&
      vehicleType &&
      date &&
      selectedPackageMatchesVehicleType
    );
  }, [garageId, servicePackageId, vehicleType, date, selectedPackageMatchesVehicleType]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setInitialLoading(true);
        setInitialError("");

        const [garageResult, packageResult] = await Promise.all([
          getGarages({ page: 1, limit: 100, isActive: true }),
          getServicePackages({ isActive: true }),
        ]);

        const garageList = extractGarages(garageResult);
        const packageList = extractList(packageResult);
        const firstActivePackage =
          packageList.find((pkg) => getPackageActive(pkg)) || packageList[0];

        setGarages(garageList);
        setServicePackages(packageList);

        const garageFromUrl = searchParams.get("garageId");
        const packageFromUrl = searchParams.get("servicePackageId");
        const vehicleTypeFromUrl = searchParams.get("vehicleType");

        if (garageFromUrl) {
          setGarageId(garageFromUrl);
        } else if (garageList.length > 0) {
          setGarageId(String(getGarageId(garageList[0])));
        }

        if (firstActivePackage) {
          const firstPackageId = getPackageId(firstActivePackage);
          const firstVehicleType = getPackageVehicleType(firstActivePackage);

          if (vehicleTypeFromUrl) {
            setVehicleType(vehicleTypeFromUrl);
          } else if (firstVehicleType) {
            setVehicleType(firstVehicleType);
          }

          if (packageFromUrl) {
            setServicePackageId(packageFromUrl);
          } else if (firstPackageId !== undefined && firstPackageId !== null) {
            setServicePackageId(String(firstPackageId));
          }
        }
      } catch (err) {
        setInitialError(err?.message || "Failed to load garages or service packages.");
      } finally {
        setInitialLoading(false);
      }
    };

    fetchInitialData();
  }, [searchParams]);

  useEffect(() => {
    if (!vehicleType) return;

    const currentPackageStillValid = servicePackageOptions.some(
      (option) => String(option.value) === String(servicePackageId)
    );

    if (currentPackageStillValid) return;

    const firstOption = servicePackageOptions[0];

    if (firstOption?.value !== undefined && firstOption?.value !== null) {
      setServicePackageId(String(firstOption.value));
    } else {
      setServicePackageId("");
    }
  }, [vehicleType, servicePackageOptions, servicePackageId]);

  const fetchAvailableSlots = async () => {
    if (!canLoadSlots) return;

    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    try {
      setLoading(true);
      setError("");
      setSelectedSlot(null);

      const result = await bookingApi.getAvailableSlots({
        garageId,
        servicePackageId,
        vehicleType,
        date,
      });

      if (requestId === latestRequestId.current) {
        setSlots(extractSlots(result));
      }
    } catch (err) {
      if (requestId === latestRequestId.current) {
        setSlots([]);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load available time slots."
        );
      }
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!canLoadSlots) {
      latestRequestId.current += 1;
      setSlots([]);
      setSelectedSlot(null);
      return;
    }

    fetchAvailableSlots();
  }, [garageId, servicePackageId, vehicleType, date, canLoadSlots]);

  const availableCount = slots.filter((slot) => slot.available).length;

  const handleJoinWaitlist = (slot = null) => {
    const selectedGarageName =
      garageOptions.find((option) => String(option.value) === String(garageId))
        ?.label || "";

    const selectedServicePackageName =
      servicePackageOptions.find(
        (option) => String(option.value) === String(servicePackageId)
      )?.label || "";

    const params = new URLSearchParams({
      garageId: String(garageId),
      garageName: selectedGarageName,
      servicePackageId: String(servicePackageId),
      servicePackageName: selectedServicePackageName,
      vehicleType: String(vehicleType),
      date: String(date),
      startTime: slot?.startTime || "",
      endTime: slot?.endTime || "",
    });

    navigate(`/waitlist?${params.toString()}`);
  };

  const handleContinue = () => {
    if (!selectedSlot) return;

    const bookingDraft = {
      garageId: Number(garageId),
      servicePackageId: Number(servicePackageId),
      vehicleType,
      date,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
    };

    localStorage.setItem("bookingSlotDraft", JSON.stringify(bookingDraft));
    console.log("BOOKING DRAFT:", bookingDraft);

    alert("Selected slot saved. Booking creation happens in the next step.");
  };

  return (
    <div className="available-slots-page">
      <section className="slots-hero">
        <p className="slots-eyebrow">Booking</p>
        <h1>Select an Available Time Slot</h1>
        <p>
          Choose a garage, service package, vehicle type, and date to load
          the list of available slots.
        </p>
      </section>

      <section className="slots-card">
        {initialLoading && (
          <LoadingSpinner text="Loading garages and service packages..." />
        )}

        {initialError && (
          <ErrorState
            title="Failed to load initial data"
            description={initialError}
          />
        )}

        {!initialLoading && !initialError && (
          <>
            <div className="slots-filter-grid">
              <Select
                label="Garage"
                value={garageId}
                options={garageOptions}
                placeholder="Select a garage"
                onChange={(e) => setGarageId(e.target.value)}
              />

              <Select
                label="Service package"
                value={servicePackageId}
                options={servicePackageOptions}
                placeholder="Select a service package"
                onChange={(e) => setServicePackageId(e.target.value)}
              />

              <Input
                label="Date"
                type="date"
                value={date}
                min={getToday()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="vehicle-filter">
              <label>Vehicle type</label>
              <FilterBar
                options={vehicleTypeOptions}
                value={vehicleType}
                onChange={setVehicleType}
              />
            </div>

            <div className="slots-panel">
              <div className="slots-panel-header">
                <div>
                  <h2>Available Time Slots</h2>
                  <p>Bright slots are available; dimmed slots are full or unavailable.</p>
                </div>

                {slots.length > 0 && (
                  <span className="slots-count">{availableCount} slot(s) available</span>
                )}
              </div>

              {!canLoadSlots && (
                <EmptyState
                  icon="🫧"
                  title="Missing information"
                  description="Please select a garage, service package, vehicle type, and date."
                />
              )}

              {canLoadSlots && loading && (
                <LoadingSpinner text="Loading available time slots..." />
              )}

              {canLoadSlots && !loading && error && (
                <ErrorState
                  title="Failed to load slots"
                  description={error}
                  onRetry={fetchAvailableSlots}
                />
              )}

              {canLoadSlots && !loading && !error && slots.length === 0 && (
                <div className="waitlist-box">
                  <div>
                    <strong>No available slots</strong>
                    <p>You can choose a different date or join the waitlist.</p>
                  </div>

                  <Button variant="secondary" onClick={() => handleJoinWaitlist(null)}>
                    Join waitlist
                  </Button>
                </div>
              )}

              {canLoadSlots && !loading && !error && slots.length > 0 && (
                <>
                  <div className="slots-grid">
                    {slots.map((slot) => {
                      const isSelected = selectedSlot?.startTime === slot.startTime;

                      return (
                        <button
                          key={slot.startTime}
                          type="button"
                          onClick={() => {
                            if (slot.available) {
                              setSelectedSlot(slot);
                            } else {
                              handleJoinWaitlist(slot);
                            }
                          }}
                          className={[
                            "slot-card",
                            slot.available ? "slot-card-available" : "slot-card-unavailable",
                            isSelected ? "slot-card-selected" : "",
                          ].join(" ")}
                        >
                          <strong>
                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </strong>
                          <span>
                            {slot.available ? "Available" : "Full - Join waitlist"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {availableCount === 0 && (
                    <div className="waitlist-box">
                      <div>
                        <strong>All slots for this day are full</strong>
                        <p>You can join the waitlist to be notified.</p>
                      </div>

                      <Button variant="secondary" onClick={() => handleJoinWaitlist(slots[0] || null)}>
                        Join waitlist
                      </Button>
                    </div>
                  )}

                  {selectedSlot && (
                    <div className="selected-slot-box">
                      <div>
                        <span>Selected slot</span>
                        <strong>
                          {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                        </strong>
                      </div>

                      <Button onClick={handleContinue}>Continue booking</Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
