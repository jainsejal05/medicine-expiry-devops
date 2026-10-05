# What's New — Roles, Approval Workflow, Reports & Requests

## Summary of Changes

- **Two roles:** Admin (1) and Pharmacist (many)
- Pharmacist registration now goes to `Pending` status — Admin must approve before they can log in
- On approval, a unique **Pharmacist ID** (e.g. `PH-0001`) is auto-generated
- Dashboard: category cards removed, replaced with **Report / Request / View Medicines** action buttons
- Stat cards (Safe/Expiring Soon/Urgent/Expired) are now clickable → shows a category-sectioned medicine list for that status
- **View Medicines** page: category cards → click a category → see medicines in it, with status filter pills, and Add/Edit/Delete
- **Report** page: pie charts (status + category), bar chart, and a "Download as PDF" button
- **Request** page: pick a city → see approved pharmacists there (by Pharmacist ID) → send a stock request → recipient responds Available/Not Available
- **Admin Approvals** page: list of pending pharmacist registrations, Approve/Reject buttons
- Every new page has a **Back** and **Logout** button in the nav
- Medicines are now scoped **per pharmacist** (`owner_id`) — each pharmacist only sees their own stock; **Admin sees everyone's**

## New/Changed Files

**Backend:** `app.py` (fully rewritten), `database/schema.sql` (new columns + new `stock_requests` table)

**Frontend — new pages:** `view-medicines.html/js`, `category-medicines.html/js`, `status-medicines.html/js`, `report.html/js`, `request.html/js`, `admin-approvals.html/js`

**Frontend — updated:** `index.html`, `script.js`, `auth.js`, `login.js`, `register.html`, `style.css`

**Removed:** `medicines.html`, `medicines.js` (replaced by `category-medicines.*`)

---

## ⚠️ REQUIRED One-Time Setup Steps

### 1. Update your database schema

Run this on whichever MySQL you're using (local, or `docker exec -it medicine_mysql mysql -u root -p` on EC2):

```sql
USE medicine_db;

ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'pharmacist';
ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE users ADD COLUMN pharmacist_id VARCHAR(20) UNIQUE DEFAULT NULL;
ALTER TABLE users ADD COLUMN city VARCHAR(50) DEFAULT NULL;

ALTER TABLE medicine ADD COLUMN owner_id INT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS stock_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_user_id INT NOT NULL,
    to_user_id INT NOT NULL,
    medicine_name VARCHAR(100) NOT NULL,
    quantity INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**If you get "Duplicate column name" errors** — that just means this column was already added in a previous attempt; skip that line and continue with the rest.

### 2. Any medicines added BEFORE this update have `owner_id = NULL`

They won't show up for any pharmacist (since each pharmacist only sees their own `owner_id`). Either:
- Delete old test data and re-add it while logged in (recommended, cleanest), **or**
- Manually assign them: `UPDATE medicine SET owner_id = <your_user_id> WHERE owner_id IS NULL;` (find your `id` via `SELECT id, username FROM users;`)

### 3. Create your Admin account

Registration always creates a `pharmacist` (pending). To get an Admin:

1. Register a new account normally through `register.html` (e.g. username `admin`)
2. Then run this SQL to promote it and approve it:
```sql
UPDATE users
SET role = 'admin', status = 'approved', pharmacist_id = 'ADMIN-01'
WHERE username = 'admin';
```
3. Now log in with that account — you'll land on the dashboard with admin privileges (see all medicines, see the Pending Approvals banner/page)

### 4. Create a couple of test Pharmacist accounts to demo Requests

Register 2 more accounts (different usernames, pick Pune/Mumbai as city) → log in as Admin → go to **Pending Approvals** → Approve both → each gets a Pharmacist ID (`PH-0001`, `PH-0002`...) → now you can demo the Request flow between them.

### 5. Redeploy

**Local:** just restart Flask (`python app.py`) and hard-refresh the browser.

**AWS EC2:**
```bash
cd /path/to/medicine-expiry-devops
scp -i ~/medicine-keys/medicine-key backend/app.py ubuntu@65.1.56.149:/home/ubuntu/medicine-expiry-devops/backend/
ssh -i ~/medicine-keys/medicine-key ubuntu@65.1.56.149
cd medicine-expiry-devops
docker compose up -d --build backend
```
Then run the schema SQL (Step 1) on the EC2 MySQL container too, if not already done.
