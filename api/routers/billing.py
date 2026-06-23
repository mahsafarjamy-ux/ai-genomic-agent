"""Stripe payment + device licensing router."""
from __future__ import annotations

import os
import secrets
from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel
from core.flow.db import SessionLocal, User, DeviceActivation

try:
    import stripe as _stripe
    _stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
    STRIPE_OK = bool(os.environ.get("STRIPE_SECRET_KEY", "").startswith("sk_"))
except ImportError:
    _stripe = None  # type: ignore
    STRIPE_OK = False

WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

PRICE_TO_PLAN: dict[str, str] = {
    os.environ.get("STRIPE_PRICE_ESSENTIAL", "__none_e__"): "essential",
    os.environ.get("STRIPE_PRICE_COMPLETE",  "__none_c__"): "complete",
    os.environ.get("STRIPE_PRICE_LIFETIME",  "__none_l__"): "lifetime",
}

PLAN_LIMITS: dict[str, dict] = {
    "free":       {"max_devices": 0,  "can_analyze": False, "label": "Free",       "price_usd": None},
    "trial":      {"max_devices": 1,  "can_analyze": True,  "label": "Trial",      "price_usd": None},
    "essential":  {"max_devices": 1,  "can_analyze": True,  "label": "Essential",  "price_usd": 29},
    "complete":   {"max_devices": 2,  "can_analyze": True,  "label": "Complete",   "price_usd": 79},
    "lifetime":   {"max_devices": 3,  "can_analyze": True,  "label": "Lifetime",   "price_usd": 199},
    "enterprise": {"max_devices": 10, "can_analyze": True,  "label": "Enterprise", "price_usd": None},
}

router = APIRouter()


def _require_user(authorization: str, db) -> User:
    token = authorization.removeprefix("Bearer ").strip()
    user = db.query(User).filter_by(token=token).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    return user


@router.post("/checkout")
def create_checkout(plan: str, authorization: str = Header(...)):
    """Create a Stripe Checkout session and return the redirect URL."""
    if not STRIPE_OK:
        raise HTTPException(status_code=503, detail="Stripe is not configured. Add STRIPE_SECRET_KEY to api/.env")
    price_map = {
        "essential": os.environ.get("STRIPE_PRICE_ESSENTIAL"),
        "complete":  os.environ.get("STRIPE_PRICE_COMPLETE"),
        "lifetime":  os.environ.get("STRIPE_PRICE_LIFETIME"),
    }
    price_id = price_map.get(plan)
    if not price_id or price_id.startswith("price_REPLACE"):
        raise HTTPException(status_code=400, detail=f"Price ID for '{plan}' not configured in api/.env")

    db = SessionLocal()
    try:
        user = _require_user(authorization, db)
        if not user.stripe_customer_id:
            customer = _stripe.Customer.create(email=user.email, name=user.name)
            user.stripe_customer_id = customer.id
            db.commit()

        session = _stripe.checkout.Session.create(
            customer=user.stripe_customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="payment",
            success_url=(
                f"{os.environ.get('FRONTEND_URL', 'http://localhost:3002')}"
                "/account?tab=subscription&success=1"
            ),
            cancel_url=(
                f"{os.environ.get('FRONTEND_URL', 'http://localhost:3002')}"
                "/personal#pricing"
            ),
            metadata={"user_id": user.id, "plan": plan},
        )
        return {"checkout_url": session.url}
    finally:
        db.close()


@router.post("/portal")
def billing_portal(authorization: str = Header(...)):
    """Open the Stripe customer portal (manage subscription/receipts)."""
    if not STRIPE_OK:
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    db = SessionLocal()
    try:
        user = _require_user(authorization, db)
        if not user.stripe_customer_id:
            raise HTTPException(status_code=400, detail="No billing account linked yet")
        session = _stripe.billing_portal.Session.create(
            customer=user.stripe_customer_id,
            return_url=(
                f"{os.environ.get('FRONTEND_URL', 'http://localhost:3002')}"
                "/account?tab=subscription"
            ),
        )
        return {"portal_url": session.url}
    finally:
        db.close()


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Stripe webhook — activates plan after successful payment."""
    if not STRIPE_OK or not _stripe:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = _stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        sess = event["data"]["object"]
        meta = sess.get("metadata") or {}
        uid, plan = meta.get("user_id"), meta.get("plan")
        if uid and plan:
            db = SessionLocal()
            try:
                u = db.query(User).filter_by(id=uid).first()
                if u:
                    u.plan = plan
                    if not u.license_key:
                        u.license_key = secrets.token_hex(16)
                    db.commit()
            finally:
                db.close()
    return {"ok": True}


@router.get("/status")
def billing_status(authorization: str = Header(...)):
    """Return current plan, device limit, and activated devices."""
    db = SessionLocal()
    try:
        user = _require_user(authorization, db)
        plan = getattr(user, "plan", None) or "free"
        limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
        devices = db.query(DeviceActivation).filter_by(user_id=user.id).all()
        return {
            "plan": plan,
            "plan_label": limits["label"],
            "license_key": getattr(user, "license_key", None),
            "can_analyze": limits["can_analyze"],
            "max_devices": limits["max_devices"],
            "devices_used": len(devices),
            "devices": [
                {
                    "id": d.id,
                    "device_id": d.device_id,
                    "label": d.device_label,
                    "activated_at": d.activated_at.isoformat(),
                }
                for d in devices
            ],
        }
    finally:
        db.close()


class ActivateBody(BaseModel):
    device_id: str
    device_label: str = ""


@router.post("/activate")
def activate_device(body: ActivateBody, authorization: str = Header(...)):
    """Register this browser/device as an activated device for the user's license."""
    db = SessionLocal()
    try:
        user = _require_user(authorization, db)
        plan = getattr(user, "plan", None) or "free"
        limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

        if not limits["can_analyze"]:
            raise HTTPException(
                status_code=403,
                detail="Your current plan does not include analysis. Please upgrade.",
            )

        existing = db.query(DeviceActivation).filter_by(
            user_id=user.id, device_id=body.device_id
        ).first()
        if existing:
            return {"ok": True, "already_active": True}

        count = db.query(DeviceActivation).filter_by(user_id=user.id).count()
        if count >= limits["max_devices"]:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Device limit reached ({limits['max_devices']} device"
                    f"{'s' if limits['max_devices'] != 1 else ''}). "
                    "Deactivate another device or upgrade your plan."
                ),
            )

        db.add(DeviceActivation(
            user_id=user.id,
            device_id=body.device_id,
            device_label=body.device_label or "Unknown device",
        ))
        db.commit()
        return {"ok": True, "already_active": False}
    finally:
        db.close()


@router.delete("/device/{activation_id}")
def deactivate_device(activation_id: str, authorization: str = Header(...)):
    """Remove a device activation."""
    db = SessionLocal()
    try:
        user = _require_user(authorization, db)
        d = db.query(DeviceActivation).filter_by(id=activation_id, user_id=user.id).first()
        if not d:
            raise HTTPException(status_code=404, detail="Device not found")
        db.delete(d)
        db.commit()
        return {"ok": True}
    finally:
        db.close()
