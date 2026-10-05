from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from datetime import date, datetime
from functools import wraps
import os
import secrets
from db import get_connection

app = Flask(__name__)
bcrypt = Bcrypt(app)

CORS(app)

# ===== In-memory token store: { token: {"user_id", "username", "role", "status", "pharmacist_id"} } =====
active_tokens = {}

CATEGORY_LIST = ["Tablet", "Syrup", "Capsule", "Injection", "Cream", "Drops", "Ointment", "Other"]
CITY_LIST = ["Pune", "Mumbai", "Nashik", "Nagpur", "Other"]


# =========================================================
# ===== HELPERS =====
# =========================================================

def calculate_status(expiry_date):
    if isinstance(expiry_date, str):
        expiry_date = datetime.strptime(expiry_date, "%Y-%m-%d").date()
    today = date.today()
    days_remaining = (expiry_date - today).days
    if days_remaining < 0:
        return "Expired"
    elif days_remaining < 7:
        return "Urgent"
    elif days_remaining <= 30:
        return "Expiring Soon"
    else:
        return "Safe"


def format_medicine(row):
    return {
        "id": row["id"],
        "medicine_name": row["medicine_name"],
        "batch_number": row["batch_number"],
        "category": row["category"],
        "quantity": row["quantity"],
        "manufacturing_date": str(row["manufacturing_date"]),
        "expiry_date": str(row["expiry_date"]),
        "supplier": row["supplier"],
        "owner_id": row.get("owner_id"),
        "owner_name": row.get("owner_name"),
        "owner_pharmacist_id": row.get("owner_pharmacist_id"),
        "status": calculate_status(row["expiry_date"])
    }


def get_current_user():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[len("Bearer "):].strip()
    return active_tokens.get(token)


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        request.current_user = user
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        if user.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403
        request.current_user = user
        return f(*args, **kwargs)
    return decorated


def generate_pharmacist_id(cursor):
    cursor.execute("SELECT COUNT(*) AS cnt FROM users WHERE pharmacist_id IS NOT NULL")
    count = cursor.fetchone()["cnt"]
    return f"PH-{count + 1:04d}"


# =========================================================
# ===== AUTH ROUTES =====
# =========================================================

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()
    city = (data.get("city") or "").strip()

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    if len(password) < 4:
        return jsonify({"error": "Password must be at least 4 characters"}), 400
    if not city:
        return jsonify({"error": "City is required"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        return jsonify({"error": "Username already exists"}), 409

    password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    cursor.execute(
        "INSERT INTO users (username, password_hash, full_name, city, role, status) "
        "VALUES (%s, %s, %s, %s, 'pharmacist', 'pending')",
        (username, password_hash, full_name, city)
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()

    return jsonify({
        "message": "Registration submitted. Your account is pending admin approval.",
        "id": new_id
    }), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user or not bcrypt.check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid username or password"}), 401

    if user["status"] == "pending":
        return jsonify({"error": "Your account is still pending admin approval."}), 403
    if user["status"] == "rejected":
        return jsonify({"error": "Your registration request was rejected. Contact the admin."}), 403

    token = secrets.token_hex(32)
    user_info = {
        "user_id": user["id"],
        "username": user["username"],
        "full_name": user["full_name"],
        "role": user["role"],
        "status": user["status"],
        "pharmacist_id": user["pharmacist_id"],
        "city": user["city"]
    }
    active_tokens[token] = user_info

    return jsonify({"message": "Login successful", "token": token, "user": user_info}), 200


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer "):].strip()
        active_tokens.pop(token, None)
    return jsonify({"message": "Logged out successfully"}), 200


@app.route("/api/auth/me", methods=["GET"])
def me():
    user = get_current_user()
    if not user:
        return jsonify({"authenticated": False}), 200
    return jsonify({"authenticated": True, "user": user}), 200


# =========================================================
# ===== HEALTH CHECK =====
# =========================================================

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "message": "Backend is running"}), 200


# =========================================================
# ===== ADMIN: APPROVE / REJECT PHARMACISTS =====
# =========================================================

@app.route("/api/admin/pending-users", methods=["GET"])
@admin_required
def pending_users():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT id, username, full_name, city, created_at FROM users "
        "WHERE status = 'pending' AND role = 'pharmacist' ORDER BY created_at ASC"
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return jsonify(rows), 200


@app.route("/api/admin/users/<int:user_id>/approve", methods=["POST"])
@admin_required
def approve_user(user_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        conn.close()
        return jsonify({"error": "User not found"}), 404

    pharmacist_id = generate_pharmacist_id(cursor)

    cursor.execute(
        "UPDATE users SET status = 'approved', pharmacist_id = %s WHERE id = %s",
        (pharmacist_id, user_id)
    )
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "User approved", "pharmacist_id": pharmacist_id}), 200


@app.route("/api/admin/users/<int:user_id>/reject", methods=["POST"])
@admin_required
def reject_user(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET status = 'rejected' WHERE id = %s", (user_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": "User rejected"}), 200


@app.route("/api/admin/stock-by-user", methods=["GET"])
@admin_required
def stock_by_user():
    """Returns every approved pharmacist with a summary of their stock,
    so the Admin can see everyone's inventory broken down user-by-user."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT id, username, full_name, pharmacist_id, city
        FROM users
        WHERE role = 'pharmacist' AND status = 'approved'
        ORDER BY pharmacist_id ASC
    """)
    pharmacists = cursor.fetchall()

    result = []
    for p in pharmacists:
        cursor.execute("SELECT * FROM medicine WHERE owner_id = %s", (p["id"],))
        meds = cursor.fetchall()

        total_quantity = sum(m["quantity"] for m in meds)
        counts = {"Safe": 0, "Expiring Soon": 0, "Urgent": 0, "Expired": 0}
        for m in meds:
            counts[calculate_status(m["expiry_date"])] += 1

        result.append({
            "user_id": p["id"],
            "username": p["username"],
            "full_name": p["full_name"],
            "pharmacist_id": p["pharmacist_id"],
            "city": p["city"],
            "total_medicines": len(meds),
            "total_quantity": total_quantity,
            "safe": counts["Safe"],
            "expiring_soon": counts["Expiring Soon"],
            "urgent": counts["Urgent"],
            "expired": counts["Expired"]
        })

    cursor.close()
    conn.close()
    return jsonify(result), 200


# =========================================================
# ===== MEDICINE ROUTES =====
# Pharmacists see only their own stock. Admin sees all.
# =========================================================

@app.route("/api/medicines", methods=["GET"])
@login_required
def get_medicines():
    user = request.current_user
    search = request.args.get("search", "")
    category = request.args.get("category", "")
    status_filter = request.args.get("status", "")
    owner_id_filter = request.args.get("owner_id", "")  # admin-only: view a specific pharmacist's stock

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT m.*, u.full_name AS owner_name, u.pharmacist_id AS owner_pharmacist_id
        FROM medicine m
        LEFT JOIN users u ON m.owner_id = u.id
        WHERE 1=1
    """
    params = []

    if user["role"] != "admin":
        query += " AND m.owner_id = %s"
        params.append(user["user_id"])
    elif owner_id_filter:
        query += " AND m.owner_id = %s"
        params.append(owner_id_filter)

    if search:
        query += " AND m.medicine_name LIKE %s"
        params.append(f"%{search}%")

    if category:
        query += " AND m.category = %s"
        params.append(category)

    query += " ORDER BY m.id DESC"

    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    medicines = [format_medicine(row) for row in rows]

    if status_filter:
        medicines = [m for m in medicines if m["status"] == status_filter]

    return jsonify(medicines), 200


@app.route("/api/medicines/<int:med_id>", methods=["GET"])
@login_required
def get_medicine(med_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM medicine WHERE id = %s", (med_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        return jsonify({"error": "Medicine not found"}), 404
    return jsonify(format_medicine(row)), 200


@app.route("/api/medicines", methods=["POST"])
@login_required
def add_medicine():
    user = request.current_user
    data = request.get_json()

    required_fields = ["medicine_name", "batch_number", "category", "quantity",
                        "manufacturing_date", "expiry_date"]
    for field in required_fields:
        if field not in data or data[field] in (None, ""):
            return jsonify({"error": f"Missing required field: {field}"}), 400

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO medicine
        (medicine_name, batch_number, category, quantity, manufacturing_date, expiry_date, supplier, owner_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        data["medicine_name"], data["batch_number"], data["category"], data["quantity"],
        data["manufacturing_date"], data["expiry_date"], data.get("supplier", ""), user["user_id"]
    ))
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()

    return jsonify({"message": "Medicine added successfully", "id": new_id}), 201


@app.route("/api/medicines/<int:med_id>", methods=["PUT"])
@login_required
def update_medicine(med_id):
    data = request.get_json()
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM medicine WHERE id = %s", (med_id,))
    if not cursor.fetchone():
        cursor.close()
        conn.close()
        return jsonify({"error": "Medicine not found"}), 404

    cursor.execute("""
        UPDATE medicine
        SET medicine_name = %s, batch_number = %s, category = %s,
            quantity = %s, manufacturing_date = %s, expiry_date = %s, supplier = %s
        WHERE id = %s
    """, (
        data["medicine_name"], data["batch_number"], data["category"], data["quantity"],
        data["manufacturing_date"], data["expiry_date"], data.get("supplier", ""), med_id
    ))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": "Medicine updated successfully"}), 200


@app.route("/api/medicines/<int:med_id>", methods=["DELETE"])
@login_required
def delete_medicine(med_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM medicine WHERE id = %s", (med_id,))
    if not cursor.fetchone():
        cursor.close()
        conn.close()
        return jsonify({"error": "Medicine not found"}), 404
    cursor.execute("DELETE FROM medicine WHERE id = %s", (med_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": "Medicine deleted successfully"}), 200


# =========================================================
# ===== DASHBOARD =====
# =========================================================

@app.route("/api/dashboard", methods=["GET"])
@login_required
def get_dashboard():
    user = request.current_user
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    if user["role"] == "admin":
        cursor.execute("SELECT * FROM medicine")
    else:
        cursor.execute("SELECT * FROM medicine WHERE owner_id = %s", (user["user_id"],))

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    total_medicines = len(rows)
    total_quantity = sum(row["quantity"] for row in rows)
    counts = {"Safe": 0, "Expiring Soon": 0, "Urgent": 0, "Expired": 0}
    category_counts = {}
    expired_medicines = []

    for row in rows:
        status = calculate_status(row["expiry_date"])
        counts[status] += 1
        cat = row["category"] or "Other"
        category_counts[cat] = category_counts.get(cat, 0) + 1

        if status == "Expired":
            expired_medicines.append({
                "medicine_name": row["medicine_name"],
                "category": row["category"],
                "quantity": row["quantity"],
                "expiry_date": str(row["expiry_date"])
            })

    return jsonify({
        "total_medicines": total_medicines,
        "total_quantity": total_quantity,
        "safe": counts["Safe"],
        "expiring_soon": counts["Expiring Soon"],
        "urgent": counts["Urgent"],
        "expired": counts["Expired"],
        "by_category": category_counts,
        "expired_medicines": expired_medicines
    }), 200


@app.route("/api/categories", methods=["GET"])
@login_required
def get_categories():
    icons = {"Tablet": "💊", "Syrup": "🍯", "Capsule": "💊", "Injection": "💉",
             "Cream": "🧴", "Drops": "💧", "Ointment": "🧪", "Other": "📦"}
    return jsonify([{"name": c, "icon": icons.get(c, "📦")} for c in CATEGORY_LIST]), 200


# =========================================================
# ===== REQUESTS (stock requests between pharmacists) =====
# =========================================================

@app.route("/api/cities", methods=["GET"])
@login_required
def get_cities():
    return jsonify(CITY_LIST), 200


@app.route("/api/pharmacists", methods=["GET"])
@login_required
def get_pharmacists_by_city():
    city = request.args.get("city", "")
    current = request.current_user

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    if city:
        cursor.execute(
            "SELECT id, pharmacist_id, full_name, username, city FROM users "
            "WHERE status = 'approved' AND role = 'pharmacist' AND city = %s AND id != %s",
            (city, current["user_id"])
        )
    else:
        cursor.execute(
            "SELECT id, pharmacist_id, full_name, username, city FROM users "
            "WHERE status = 'approved' AND role = 'pharmacist' AND id != %s",
            (current["user_id"],)
        )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(rows), 200


@app.route("/api/requests", methods=["POST"])
@login_required
def create_request():
    user = request.current_user
    data = request.get_json()

    to_pharmacist_id = (data.get("to_pharmacist_id") or "").strip()
    medicine_name = (data.get("medicine_name") or "").strip()
    quantity = data.get("quantity")

    if not to_pharmacist_id or not medicine_name or not quantity:
        return jsonify({"error": "to_pharmacist_id, medicine_name and quantity are required"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id FROM users WHERE pharmacist_id = %s", (to_pharmacist_id,))
    target = cursor.fetchone()
    if not target:
        cursor.close()
        conn.close()
        return jsonify({"error": "No pharmacist found with that ID"}), 404

    cursor.execute("""
        INSERT INTO stock_requests (from_user_id, to_user_id, medicine_name, quantity, status)
        VALUES (%s, %s, %s, %s, 'pending')
    """, (user["user_id"], target["id"], medicine_name, quantity))
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()

    return jsonify({"message": "Request sent", "id": new_id}), 201


def format_request(row):
    return {
        "id": row["id"],
        "from_user_id": row["from_user_id"],
        "from_name": row.get("from_name"),
        "from_pharmacist_id": row.get("from_pharmacist_id"),
        "to_user_id": row["to_user_id"],
        "to_name": row.get("to_name"),
        "to_pharmacist_id": row.get("to_pharmacist_id"),
        "medicine_name": row["medicine_name"],
        "quantity": row["quantity"],
        "status": row["status"],
        "created_at": str(row["created_at"])
    }


@app.route("/api/requests/sent", methods=["GET"])
@login_required
def get_sent_requests():
    user = request.current_user
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT r.*, u2.full_name AS to_name, u2.pharmacist_id AS to_pharmacist_id
        FROM stock_requests r
        JOIN users u2 ON r.to_user_id = u2.id
        WHERE r.from_user_id = %s
        ORDER BY r.created_at DESC
    """, (user["user_id"],))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify([format_request(r) for r in rows]), 200


@app.route("/api/requests/received", methods=["GET"])
@login_required
def get_received_requests():
    user = request.current_user
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT r.*, u1.full_name AS from_name, u1.pharmacist_id AS from_pharmacist_id
        FROM stock_requests r
        JOIN users u1 ON r.from_user_id = u1.id
        WHERE r.to_user_id = %s
        ORDER BY r.created_at DESC
    """, (user["user_id"],))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify([format_request(r) for r in rows]), 200


@app.route("/api/requests/<int:req_id>/respond", methods=["POST"])
@login_required
def respond_request(req_id):
    user = request.current_user
    data = request.get_json()
    new_status = data.get("status")

    if new_status not in ("available", "not_available"):
        return jsonify({"error": "status must be 'available' or 'not_available'"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM stock_requests WHERE id = %s", (req_id,))
    req = cursor.fetchone()
    if not req:
        cursor.close()
        conn.close()
        return jsonify({"error": "Request not found"}), 404
    if req["to_user_id"] != user["user_id"]:
        cursor.close()
        conn.close()
        return jsonify({"error": "You are not the recipient of this request"}), 403

    cursor.execute("UPDATE stock_requests SET status = %s WHERE id = %s", (new_status, req_id))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": "Response recorded"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
