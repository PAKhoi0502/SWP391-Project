import axiosClient from './axiosClient'

export const bookingApi = {
  getAvailableSlots: ({ garageId, servicePackageId, vehicleType, date }) => {
    return axiosClient.get("http://localhost:8080/bookings/available-slots", {
      params: {
        garage_id: garageId,
        service_package_id: servicePackageId,
        vehicle_type: vehicleType,
        date,
      },
    })
  },
}