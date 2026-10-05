# What's New — Login + Category Cards Update

## New Features Added

1. **Login & Registration** — `login.html` / `register.html`. Real backend authentication using:
   - Passwords hashed with `Flask-Bcrypt` (never stored in plain text)
   - Server-side sessions via `Flask-Session` (cookie-based, `credentials: "include"` on every fetch)
   - All `/api/medicines*` and `/api/dashboard` routes now require login (`@login_required` decorator, returns `401` if not authenticated)
   - Frontend auto-redirects to `login.html` if session is missing/expired (see `auth.js` → `requireAuth()`)

2. **Category Cards (click-to-select, no typing)**
   - Dashboard shows a "By Category" breakdown — click any card to jump to the Medicines page pre-filtered to that category
   - Medicines page has filter cards at the top — click a category to filter the table, click again to clear
   - The Add/Edit form now has a **category picker grid** (Tablet, Syrup, Capsule, Injection, Cream, Drops, Ointment, Other) — you click one, you never type a category by hand

3. **Low stock indicator** — any medicine with quantity < 10 is highlighted in red with a ⚠️ in the table

4. **Logout button** — top-right of every page, clears the session and returns to login

## Files Changed / Added

| File | Status |
|---|---|
| `frontend/login.html`, `frontend/register.html` | NEW |
| `frontend/login.js` | NEW |
| `frontend/auth.js` | NEW — shared auth guard + logout, included on every protected page |
| `frontend/index.html`, `script.js` | Updated — auth guard, category breakdown |
| `frontend/medicines.html`, `medicines.js` | Updated — category filter cards, category picker in form, low-stock highlight |
| `frontend/style.css` | Updated — login page styling, category cards, category picker |
| `backend/app.py` | Updated — auth routes (`/api/auth/register`, `/login`, `/logout`, `/me`), `@login_required` on all medicine/dashboard routes, `/api/categories` endpoint, dashboard now returns `by_category` breakdown |
| `backend/requirements.txt` | Updated — added `Flask-Bcrypt`, `Flask-Session` |
| `database/schema.sql` | Updated — added `users` table, `category` is now `NOT NULL DEFAULT 'Other'` |
| `docker-compose.yml` | Updated — passes `SECRET_KEY` through to the backend container |
| `.env` / `backend/.env` | Updated — added `SECRET_KEY` (change this to a random string before any real deployment) |

## IMPORTANT — One-time setup steps before running

### 1. Install new Python packages
```powershell
cd backend
.\venv\Scripts\activate
pip install -r requirements.txt
```
(If you deleted `venv` or it's missing after unzip, recreate it first: `python -m venv venv`)

### 2. Update your MySQL database (adds the `users` table)
Run this in MySQL Command Line Client (or `mysql -u root -p medicine_db`):
```sql
USE medicine_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE medicine MODIFY category VARCHAR(50) NOT NULL DEFAULT 'Other';
```
(This is safe to run even if some parts already exist — `CREATE TABLE IF NOT EXISTS` won't error.)

If you're using **Docker**, just recreate the containers fresh so `schema.sql` re-runs automatically:
```powershell
docker compose down -v
docker compose up -d --build
```
(`-v` wipes old data — only do this if you're OK losing existing test data. Otherwise run the SQL above manually on the running container instead.)

### 3. First run — create your login account
Open `frontend/login.html` (not `index.html` directly anymore) → click **"Create one"** → register a username/password → you'll be logged in automatically and redirected to the dashboard.

### 4. If deploying to AWS EC2 (Phase 6)
Re-run the Ansible playbook to redeploy the updated code:
```bash
ansible-playbook -i inventory.ini playbook.yml
```
Then also run the DB migration SQL (Step 2 above) directly on the EC2 server's MySQL container:
```bash
docker exec -it medicine_mysql mysql -u root -p medicine_db
```
