from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from Database import engine
from dotenv import load_dotenv
import bcrypt
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import os

load_dotenv(override=True)

router = APIRouter(prefix="/auth", tags=["auth"])

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ── SMTP Config ──
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# ── Ensure users table exists ──
def init_users_table():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                google_id VARCHAR(255),
                email_verified BOOLEAN DEFAULT FALSE,
                verification_token VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        # Add columns if table already exists (safe migration)
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255)"))
        except Exception:
            pass
        conn.commit()

def init_preferences_table():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_preferences (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                cuisines JSONB,
                vibe JSONB,
                budget VARCHAR(255),
                group_type VARCHAR(255),
                outing_time JSONB,
                dislikes JSONB,
                onboarding_completed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.commit()

init_users_table()
init_preferences_table()

import random

# ── Send verification email ──
def send_verification_email(to_email: str, name: str, otp: str):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"[DEV MODE] Email verification OTP for {to_email}: {otp}")
        return True

    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Verify your email – Activity Finder</title>
      <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 15px; background-color: #f5f7fa; padding: 32px 16px; }}
        .wrapper {{ max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e0e0e0; }}
        .header {{ background: #3b5930; padding: 28px 32px; }}
        .header-row {{ display: flex; align-items: center; gap: 12px; }}
        .logo-circle {{ width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; }}
        .brand {{ font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px; }}
        .body {{ padding: 32px; text-align: center; }}
        .title {{ font-size: 20px; font-weight: 700; color: #111111; margin-bottom: 10px; }}
        .subtitle {{ font-size: 14px; color: #555555; line-height: 1.65; margin-bottom: 24px; }}
        .otp-box {{ background: #f0f4f0; border: 2px dashed #3b5930; border-radius: 12px; padding: 24px; font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #3b5930; margin-bottom: 24px; }}
        .divider {{ border: none; border-top: 1px solid #eeeeee; margin: 28px 0; }}
        .footer {{ background: #f9f9fb; border-top: 1px solid #eeeeee; padding: 20px 32px; text-align: center; }}
        .footer p {{ font-size: 12px; color: #aaaaaa; margin-bottom: 4px; }}
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="header-row">
            <div class="logo-circle">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
              </svg>
            </div>
            <div>
              <div class="brand">Activity Finder</div>
            </div>
          </div>
        </div>

        <div class="body">
          <p class="title">Verify your email</p>
          <p class="subtitle">Please enter this 6-digit code to activate your checking account.</p>
          <div class="otp-box">{otp}</div>
          <p class="subtitle" style="font-size: 12px; margin-bottom: 0;">This code will expire in 10 minutes.</p>
        </div>

        <div class="footer">
          <p>Sent to <strong>{to_email}</strong>.</p>
        </div>
      </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{otp} is your Activity Finder code"
    msg["From"] = SMTP_EMAIL
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        print(f"Attempting to send OTP email to {to_email} via {SMTP_HOST}:{SMTP_PORT}...")
        
        if SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=8)
        else:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=8)
            server.starttls()
            
        with server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
            
        print(f"Successfully sent OTP to {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send email: {e}")
        return False


# ── Models ──
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class VerifyRequest(BaseModel):
    email: str
    otp: str


from typing import List, Optional

class UserPreferencesRequest(BaseModel):
    user_id: int
    cuisines: List[str]
    vibe: List[str]
    budget: str
    group_type: str
    outing_time: List[str]
    dislikes: List[str]


# ── Register ──
@router.post("/register")
def register(req: RegisterRequest):
    hashed = bcrypt.hashpw(req.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    otp = str(random.randint(100000, 999999))

    with engine.connect() as conn:
        existing = conn.execute(
            text("SELECT id, email_verified FROM users WHERE email = :email"),
            {"email": req.email}
        ).fetchone()

        if existing:
            row = dict(existing._mapping)
            if row.get("email_verified"):
                raise HTTPException(status_code=400, detail="Email already registered")
            else:
                # Re-send OTP for unverified account
                conn.execute(
                    text("UPDATE users SET name = :name, password_hash = :hash, verification_token = :otp WHERE email = :email"),
                    {"name": req.name, "hash": hashed, "otp": otp, "email": req.email}
                )
                conn.commit()
                send_verification_email(req.email, req.name, otp)
                return {"message": "Verification OTP re-sent. Please check your inbox.", "requires_verification": True}

        conn.execute(
            text("""INSERT INTO users (name, email, password_hash, email_verified, verification_token) 
                     VALUES (:name, :email, :hash, FALSE, :otp)"""),
            {"name": req.name, "email": req.email, "hash": hashed, "otp": otp}
        )
        conn.commit()

    send_verification_email(req.email, req.name, otp)
    return {"message": "Account created! Please enter the OTP to verify.", "requires_verification": True}


# ── Verify OTP ──
@router.post("/verify")
def verify_email(req: VerifyRequest):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT id, name, email FROM users WHERE email = :email AND verification_token = :otp"),
            {"email": req.email, "otp": req.otp}
        ).fetchone()

        if not result:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")

        user = dict(result._mapping)

        conn.execute(
            text("UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE id = :id"),
            {"id": user["id"]}
        )
        conn.commit()

    return {"user": user, "message": "Email verified successfully!"}


# ── Login ──
@router.post("/login")
def login(req: LoginRequest):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT id, name, email, password_hash, email_verified FROM users WHERE email = :email"),
            {"email": req.email}
        ).fetchone()

    if not result:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = dict(result._mapping)

    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="This account uses Google sign-in. Please use the Google button.")

    if not bcrypt.checkpw(req.password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.get("email_verified"):
        raise HTTPException(status_code=403, detail="Please verify your email before logging in. Check your inbox.")

    with engine.connect() as conn:
        pref = conn.execute(
            text("SELECT onboarding_completed FROM user_preferences WHERE user_id = :id"),
            {"id": user["id"]}
        ).fetchone()
        onboarded = bool(pref and pref[0])

    return {"user": {"id": user["id"], "name": user["name"], "email": user["email"], "onboarded": onboarded}}


# ── Resend Verification ──
@router.post("/resend-verification")
def resend_verification(req: LoginRequest):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT id, name, email, email_verified FROM users WHERE email = :email"),
            {"email": req.email}
        ).fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="No account found with this email")

    user = dict(result._mapping)

    if user.get("email_verified"):
        return {"message": "Email is already verified. You can log in."}

    otp = str(random.randint(100000, 999999))
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE users SET verification_token = :otp WHERE id = :id"),
            {"otp": otp, "id": user["id"]}
        )
        conn.commit()

    send_verification_email(user["email"], user["name"], otp)
    return {"message": "Verification OTP sent. Please check your inbox."}


import requests

class GoogleVerifyRequest(BaseModel):
    token: str

# ── Google OAuth ──
@router.post("/google/verify")
def google_verify(req: GoogleVerifyRequest):
    try:
        # Fetch user info using the access token
        user_info_resp = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {req.token}"}
        )
        user_info_resp.raise_for_status()
        idinfo = user_info_resp.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid Google token")

    email = idinfo.get("email")
    name = idinfo.get("name", "Google User")

    if not email:
        raise HTTPException(status_code=400, detail="Google response missing email")

    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT id, name, email FROM users WHERE email = :email"),
            {"email": email}
        ).fetchone()

        if result:
            user = dict(result._mapping)
        else:
            # Create new user, auto-verify email, no password needed
            new_user = conn.execute(
                text("INSERT INTO users (name, email, email_verified) VALUES (:name, :email, TRUE) RETURNING id, name, email"),
                {"name": name, "email": email}
            ).fetchone()
            user = dict(new_user._mapping)
            conn.commit()

        # Check onboarding
        pref = conn.execute(
            text("SELECT onboarding_completed FROM user_preferences WHERE user_id = :id"),
            {"id": user["id"]}
        ).fetchone()
        onboarded = bool(pref and pref[0])

    return {"user": {"id": user["id"], "name": user["name"], "email": user["email"], "onboarded": onboarded}}


# ── Preferences ──
import json

@router.post("/preferences")
def save_preferences(req: UserPreferencesRequest):
    with engine.connect() as conn:
        # Check if user exists
        user = conn.execute(text("SELECT id FROM users WHERE id = :id"), {"id": req.user_id}).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Insert or update
        existing = conn.execute(
            text("SELECT user_id FROM user_preferences WHERE user_id = :id"),
            {"id": req.user_id}
        ).fetchone()

        if existing:
            conn.execute(text("""
                UPDATE user_preferences 
                SET cuisines = :cuisines, vibe = :vibe, budget = :budget, group_type = :group_type,
                    outing_time = :outing_time, dislikes = :dislikes, onboarding_completed = TRUE,
                    updated_at = NOW()
                WHERE user_id = :id
            """), {
                "id": req.user_id,
                "cuisines": json.dumps(req.cuisines),
                "vibe": json.dumps(req.vibe),
                "budget": req.budget,
                "group_type": req.group_type,
                "outing_time": json.dumps(req.outing_time),
                "dislikes": json.dumps(req.dislikes)
            })
        else:
            conn.execute(text("""
                INSERT INTO user_preferences (
                    user_id, cuisines, vibe, budget, group_type, outing_time, dislikes, onboarding_completed
                ) VALUES (
                    :id, :cuisines, :vibe, :budget, :group_type, :outing_time, :dislikes, TRUE
                )
            """), {
                "id": req.user_id,
                "cuisines": json.dumps(req.cuisines),
                "vibe": json.dumps(req.vibe),
                "budget": req.budget,
                "group_type": req.group_type,
                "outing_time": json.dumps(req.outing_time),
                "dislikes": json.dumps(req.dislikes)
            })
        conn.commit()

    return {"message": "Preferences saved successfully"}

@router.get("/preferences/status/{user_id}")
def preferences_status(user_id: int):
    prefs = get_preferences(user_id)
    if not prefs:
        return {"onboarding_completed": False}
    return {"onboarding_completed": prefs.get("onboarding_completed", False)}

@router.get("/preferences/{user_id}")
def get_preferences(user_id: int):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT * FROM user_preferences WHERE user_id = :id"),
            {"id": user_id}
        ).fetchone()

        if not result:
            return None

        pref = dict(result._mapping)
        return {
            "user_id": pref["user_id"],
            "cuisines": pref["cuisines"],
            "vibe": pref["vibe"],
            "budget": pref["budget"],
            "group_type": pref["group_type"],
            "outing_time": pref["outing_time"],
            "dislikes": pref["dislikes"],
            "onboarding_completed": pref["onboarding_completed"]
        }
