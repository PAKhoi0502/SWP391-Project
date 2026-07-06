# Testing

## Command

Run the backend test suite from the repository root:

```powershell
.\mvnw.cmd clean test
```

The test profile uses an in-memory H2 database and disables mail and scheduler side effects.

## Business Rule Coverage

| Area | Covered Rules |
| --- | --- |
| Auth | Register/login success and duplicate or invalid credential failures; refresh, logout, password reset token effects. |
| Security | Public endpoints, authenticated user endpoints, admin-only user and service-package endpoints. |
| Users | Current user lookup/update, duplicate email/phone protection, role/status updates. |
| Garages | Create/update/status, duplicate code/phone, supported vehicle capabilities. |
| Wash bays | Create/status, duplicate bay codes, supported types, capacity grouped by vehicle type. |
| Vehicles | Ownership, normalized license plates, duplicate plates, default vehicle behavior, inactive vehicle constraints. |
| Service packages | MAIN, ADD_ON, COMBO includes, service steps, active filtering, vehicle compatibility. |
| Booking create | Happy path, date/window validation, garage/vehicle/package validation, vehicle overlap, customer-garage overlap, wash bay capacity, care staff capacity. |
| Booking options | Add-ons, combo package booking, loyalty point redemption, promotion application, walk-in booking. |
| Booking operations | Check-in, start service, wash bay assignment/release, care staff assignment/release, service-step completion, complete, cancel, no-show. |
| Payments | Cash payment only after COMPLETED booking; PayOS create-payment request; PayOS webhook success/failure/idempotency. |
| Rewards | Booking statistics, point earning, idempotency, unpaid/non-completed/guest/zero-point skip cases. |
| Promotions | Create/update validation, active/time/usage limits, per-user limits, loyalty tier eligibility, discount calculation, max discount, voucher usage idempotency, voucher release on booking cancellation. |
| Notifications | Booking/payment/reward notification creation, reward notification idempotency, notification ownership, mark-as-read, mark-all-read, delete. |
| Wash history | Created after paid completed booking, earned points copied, idempotency, invalid-state skip cases. |
