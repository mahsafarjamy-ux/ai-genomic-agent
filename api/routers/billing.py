"""Stripe payment + device licensing router."""
from __future__ import annotations

import os
import secrets
from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel
from core.flow.db import SessionLocal, User, DeviceActivation

try:
    import stripe as _stripe
except ImportError:
    _stripe = None


def _configured_stripe():
    key = os.getenv("STRIPE_SECRET_KEY", "")
    if _stripe is None or not key:
        raise HTTPException(503, "Payments are not configured yet. Please contact BioVerse support.")
    _stripe.api_key = key
    return _stripe


def _price_id(plan):
    if plan not in ("essential", "complete", "lifetime"):
        raise HTTPException(400, "Unknown plan.")
    value = os.getenv("STRIPE_PRICE_" + plan.upper(), "")
    if not value.startswith("price_") or "REPLACE" in value:
        raise HTTPException(503, "This plan is not configured for purchase yet. Please contact BioVerse support.")
    return value


def _price(plan):
    try:
        value = _configured_stripe().Price.retrieve(_price_id(plan))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, "We could not verify the plan price. Please try again later.") from exc
    if not value.get("active") or value.get("type") != "one_time" or not isinstance(value.get("unit_amount"), int) or value["unit_amount"] <= 0:
        raise HTTPException(503, "This plan is not available for one-time purchase.")
    return value


def _frontend_url():
    from urllib.parse import urlparse
    value = os.getenv("FRONTEND_URL", "").rstrip("/")
    parsed = urlparse(value)
    if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path or not parsed.netloc or (parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1"))):
        raise HTTPException(503, "The payment return address is not configured. Please contact BioVerse support.")
    return value


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


@router.get("/plans")
def available_plans():
    _configured_stripe()
    plans = []
    for plan in ("essential", "complete", "lifetime"):
        if not os.getenv("STRIPE_PRICE_" + plan.upper()):
            continue
        price = _price(plan)
        plans.append({"id": plan, "amount": price["unit_amount"], "currency": price["currency"]})
    if not plans:
        raise HTTPException(503, "Plan prices are not configured yet. Please contact BioVerse support.")
    return {"plans": plans}


@router.post("/checkout")
def create_checkout(plan: str, authorization: str = Header(...), expected_amount: int | None = None, expected_currency: str | None = None):
    """Create hosted Checkout with a server-verified price and signed fulfilment."""
    stripe = _configured_stripe()
    if not os.getenv("STRIPE_WEBHOOK_SECRET"):
        raise HTTPException(503, "Payment confirmation is not configured yet. Please contact BioVerse support.")
    db = SessionLocal()
    try:
        user = _require_user(authorization, db)
        front = _frontend_url()
        price = _price(plan)
        if (expected_amount is not None and expected_amount != price["unit_amount"]) or (expected_currency is not None and expected_currency != price["currency"]):
            raise HTTPException(409, "The price has changed. Refresh the page before purchasing.")
        if not user.stripe_customer_id:
            customer = stripe.Customer.create(email=user.email, name=user.name, idempotency_key="bioverse-customer-" + user.id)
            user.stripe_customer_id = customer.id
            db.commit()
        session = stripe.checkout.Session.create(
            customer=user.stripe_customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price["id"], "quantity": 1}], mode="payment",
            client_reference_id=user.id,
            success_url=front + "/account?tab=subscription&success=1",
            cancel_url=front + "/personal#pricing",
            metadata={"user_id": user.id, "plan": plan},
        )
        return {"checkout_url": session.url}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, "Checkout is temporarily unavailable. Please try again later.") from exc
    finally:
        db.close()


@router.post("/portal")
def billing_portal(authorization: str = Header(...)):
    """Open the Stripe customer portal (manage subscription/receipts)."""
    _configured_stripe()
    db = SessionLocal()
    try:
        user = _require_user(authorization, db)
        if not user.stripe_customer_id:
            raise HTTPException(status_code=400, detail="No billing account linked yet")
        session = _stripe.billing_portal.Session.create(
            customer=user.stripe_customer_id,
            return_url=(
                f"{_frontend_url()}"
                "/account?tab=subscription"
            ),
        )
        return {"portal_url": session.url}
    finally:
        db.close()


@router.post("/webhook")
async def stripe_webhook(request: Request):
    stripe = _configured_stripe()
    secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(503, "Payment confirmation is not configured.")
    try:
        event = stripe.Webhook.construct_event(await request.body(), request.headers.get("stripe-signature", ""), secret)
    except Exception:
        raise HTTPException(400, "Invalid webhook signature")
    if event["type"] not in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        return {"ok": True}
    incoming = event["data"]["object"]
    if not incoming.get("metadata", {}).get("plan"):
        return {"ok": True}  # Counselling has its own fulfilment endpoint.
    try:
        session = stripe.checkout.Session.retrieve(incoming["id"], expand=["line_items"])
        if session.get("mode") != "payment" or session.get("status") != "complete" or session.get("payment_status") != "paid":
            return {"ok": True}
        meta = session.get("metadata") or {}
        uid, plan = meta.get("user_id"), meta.get("plan")
        price_id = _price_id(plan)
        items = session.get("line_items", {}).get("data", [])
        if len(items) != 1 or items[0].get("quantity") != 1 or items[0].get("price", {}).get("id") != price_id:
            raise HTTPException(400, "Payment does not match the selected plan.")
        db = SessionLocal()
        try:
            user = db.query(User).filter_by(id=uid).first()
            if not user or user.stripe_customer_id != session.get("customer") or session.get("client_reference_id") != user.id:
                raise HTTPException(400, "Payment account mismatch.")
            rank = {"free": 0, "trial": 0, "essential": 1, "complete": 2, "lifetime": 3, "enterprise": 4}
            if rank.get(plan, -1) >= rank.get(user.plan or "free", 0):
                user.plan = plan
            if not user.license_key:
                user.license_key = secrets.token_hex(16)
            db.commit()
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, "Unable to confirm payment. Stripe should retry this event.") from exc
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
