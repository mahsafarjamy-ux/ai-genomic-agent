"""
Authentication router — register, login, me, logout.
Uses bcrypt-hashed passwords and random session tokens stored in SQLite.
No JWT library needed; tokens are validated by DB lookup.
"""
import secrets

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr

from core.flow.db import SessionLocal, User, init_db

import hashlib, hmac, os

def _hash(pw: str) -> str:
    salt = os.urandom(16).hex()
    h = hashlib.sha256(f"{salt}:{pw}".encode()).hexdigest()
    return f"{salt}:{h}"

def _verify(pw: str, stored: str) -> bool:
    try:
        if stored.startswith("scrypt:"):
            _, salt, expected = stored.split(":", 2)
            actual = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
            return hmac.compare_digest(actual, expected)
        salt, h = stored.split(":", 1)
        return hmac.compare_digest(hashlib.sha256(f"{salt}:{pw}".encode()).hexdigest(), h)
    except Exception:
        return False


router = APIRouter()


class RegisterIn(BaseModel):
    email: str
    name: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(body: RegisterIn):
    init_db()
    db = SessionLocal()
    try:
        if db.query(User).filter_by(email=body.email.lower()).first():
            raise HTTPException(409, "Email already registered")
        token = secrets.token_hex(32)
        user = User(
            email=body.email.lower(),
            name=body.name,
            password_hash=_hash(body.password),
            token=token,
        )
        db.add(user)
        db.commit()
        return {"token": token, "email": user.email, "name": user.name}
    finally:
        db.close()


@router.post("/login")
def login(body: LoginIn):
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(email=body.email.lower()).first()
        if not user or not _verify(body.password, user.password_hash):
            raise HTTPException(401, "Invalid email or password")
        token = secrets.token_hex(32)
        user.token = token
        db.commit()
        return {"token": token, "email": user.email, "name": user.name}
    finally:
        db.close()


@router.get("/me")
def me(authorization: str = Header(...)):
    token = authorization.removeprefix("Bearer ").strip()
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(token=token).first()
        if not user:
            raise HTTPException(401, "Invalid or expired session")
        return {"email": user.email, "name": user.name}
    finally:
        db.close()


@router.post("/logout")
def logout(authorization: str = Header(...)):
    token = authorization.removeprefix("Bearer ").strip()
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(token=token).first()
        if user:
            user.token = None
            db.commit()
        return {"ok": True}
    finally:
        db.close()
