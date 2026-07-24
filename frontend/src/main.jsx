import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import AppRoutes from "./routes/AppRoutes.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { GuestBookingProvider } from "./contexts/GuestBookingContext.jsx";
import GuestBookingModal from "./components/Booking/GuestBookingModal.jsx";
import { useGuestBooking } from "./contexts/GuestBookingContext.jsx";
import "./index.css";

function GuestBookingBridge() {
  const { open, preselection, closeGuestModal } = useGuestBooking()
  return (
    <GuestBookingModal
      open={open}
      onClose={closeGuestModal}
      preselectedGarageId={preselection.garageId}
      preselectedServicePackageId={preselection.servicePackageId}
    />
  )
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <GuestBookingProvider>
          <AppRoutes />
          <GuestBookingBridge />
        </GuestBookingProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
