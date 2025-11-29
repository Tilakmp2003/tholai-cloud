import uuid
import bcrypt
import re
from flask import Flask, request, jsonify

app = Flask(__name__)

# --- Configuration for Password Strength (can be moved to a config file) ---
PASSWORD_MIN_LENGTH = 8
PASSWORD_REQUIRES_UPPER = True
PASSWORD_REQUIRES_LOWER = True
PASSWORD_REQUIRES_DIGIT = True
PASSWORD_REQUIRES_SPECIAL = True

# --- Mock Database ---
# In a real application, this would be an actual database connection and ORM (e.g., SQLAlchemy, Peewee)
# For this task, we use an in-memory list to simulate user storage.
users_db = []  # Stores dicts: {'id': 'uuid', 'username': 'user', 'password_hash': 'hashed_pass'}

# --- Helper Functions for Validation ---
def is_valid_email(email):
    """
    Basic email format validation.
    A more robust regex might be needed for production environments.
    """
    email_regex = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(email_regex, email) is not None

def validate_password_strength(password):
    """
    Validates password against configured strength requirements.
    Returns a list of error messages if validation fails, empty list otherwise.
    """
    errors = []
    if len(password) < PASSWORD_MIN_LENGTH:
        errors.append(f"Password must be at least {PASSWORD_MIN_LENGTH} characters long.")
    if PASSWORD_REQUIRES_UPPER and not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter.")
    if PASSWORD_REQUIRES_LOWER and not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter.")
    if PASSWORD_REQUIRES_DIGIT and not re.search(r"\d", password):
        errors.append("Password must contain at least one digit.")
    if PASSWORD_REQUIRES_SPECIAL and not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        errors.append("Password must contain at least one special character (!@#$%^&* etc.).")
    return errors

# --- API Endpoint: POST /api/v1/register ---
@app.route('/api/v1/register', methods=['POST'])
def register_user():
    """
    Handles user registration by accepting username/email and password.
    Performs validation, hashes password, stores user, and returns appropriate response.
    """
    data = request.get_json()

    if not data:
        return jsonify({"message": "Invalid JSON payload. Request body is missing or malformed."}), 400

    username = data.get('username')
    password = data.get('password')

    # 1. Input Presence Validation
    if not username:
        return jsonify({"message": "Username is required."}), 400
    if not password:
        return jsonify({"message": "Password is required."}), 400

    # 2. Username/Email Format Validation (if it looks like an email)
    if '@' in username and not is_valid_email(username):
        return jsonify({"message": "Invalid email format for username."}), 400

    # 3. Unique Username Check
    # In a real database, this would typically be a unique constraint check.
    for user in users_db:
        if user['username'].lower() == username.lower():
            return jsonify({"message": "Username already exists. Please choose a different one."}), 409 # 409 Conflict

    # 4. Password Strength Validation
    password_validation_errors = validate_password_strength(password)
    if password_validation_errors:
        return jsonify({
            "message": "Password does not meet strength requirements.",
            "errors": password_validation_errors
        }), 400

    try:
        # 5. Securely Hash Password using bcrypt
        # bcrypt requires byte strings for hashing
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # 6. Generate Unique User ID
        user_id = str(uuid.uuid4())

        # 7. Store User Credentials in Mock Database
        new_user = {
            "id": user_id,
            "username": username,
            "password_hash": hashed_password  # Store the hashed password, not the plain one
        }
        users_db.append(new_user)

        # 8. Return Success Response
        return jsonify({
            "message": "User registered successfully.",
            "userId": user_id,
            "username": username
        }), 201 # 201 Created status code

    except Exception as e:
        # Log the detailed error in a real application for debugging
        print(f"Error during user registration: {e}")
        return jsonify({"message": "An unexpected server error occurred during registration."}), 500