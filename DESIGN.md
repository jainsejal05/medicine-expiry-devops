# Application Design

## Pages / Screens

1. **Dashboard (index.html)**
   - Shows total medicines, total quantity
   - Shows count of: Safe, Expiring Soon, Urgent, Expired
   - Link to "Add Medicine" and "View All Medicines"

2. **Medicine List Page**
   - Table of all medicines with columns:
     Name, Batch No, Category, Quantity, Mfg Date, Expiry Date, Supplier, Status
   - Search box (search by name)
   - Edit / Delete buttons per row
   - "Add New Medicine" button

3. **Add/Edit Medicine Form**
   - Fields: Medicine Name, Batch Number, Category, Quantity,
     Manufacturing Date, Expiry Date, Supplier
   - Submit button (Add or Update depending on mode)

## API Endpoints (Backend - Flask)

| Method | Endpoint              | Purpose                          |
|--------|----------------------|-----------------------------------|
| GET    | /api/medicines        | Get all medicines (with status)  |
| GET    | /api/medicines/<id>   | Get one medicine by ID           |
| POST   | /api/medicines        | Add a new medicine               |
| PUT    | /api/medicines/<id>   | Update an existing medicine      |
| DELETE | /api/medicines/<id>   | Delete a medicine                |
| GET    | /api/dashboard         | Get dashboard stats (counts)     |
| GET    | /api/medicines?search=x | Search medicines by name        |

## Expiry Status Logic (calculated on the backend, not stored in DB)

- days_remaining = expiry_date - today

- If days_remaining > 30      → Status = "Safe"
- If 7 <= days_remaining <= 30 → Status = "Expiring Soon"
- If 0 <= days_remaining < 7   → Status = "Urgent"
- If days_remaining < 0        → Status = "Expired"

Status is calculated fresh every time data is fetched — it is NOT stored
as a column in the database, since it changes daily automatically.