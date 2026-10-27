"""Verified, consented, prepaid counselling appointments. No genomic files are copied."""
import calendar
import hashlib
import hmac
import os
import secrets
import time
from datetime import datetime, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import or_, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.flow.db import SessionLocal, User
from core.counselling.models import Profile, Consent, Consultant, Slot, Booking, Referral, uid
from core.counselling import providers

router = APIRouter()
DEFAULT_CONSENT = '''I consent to BioVerse collecting and storing my registration, referral, consent and appointment information to arrange virtual genetic counselling. My selected consultant may access information needed for my appointment. My raw DNA files and analysis reports are not automatically shared by this booking service. I will agree separately with the consultant about any reports I choose to share. I understand that virtual care has privacy and technical limitations, the AI phone assistant provides administrative support rather than clinical advice, and payment does not replace informed clinical consent. I can contact BioVerse to ask about access, correction or withdrawal of consent; legal record-retention obligations may still apply. I have read the privacy notice and understand the stated fee. This service is not for emergencies.'''


def now():
    return int(time.time())


def db_session():
    with SessionLocal() as db:
        yield db


def private_response(response: Response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Referrer-Policy'] = 'no-referrer'


def current_user(authorization: str = Header(default=''), db: Session = Depends(db_session), _=Depends(private_response)):
    if not authorization.startswith('Bearer ') or len(authorization[7:]) != 64:
        raise HTTPException(401, 'Please sign in.')
    user = db.query(User).filter_by(token=authorization[7:]).first()
    if not user:
        raise HTTPException(401, 'Please sign in again.')
    return user


def profile(db, user):
    result = db.get(Profile, user.id)
    if result is None:
        result = Profile(user_id=user.id)
        db.add(result)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
        result = db.get(Profile, user.id)
    return result


def verified(db, user):
    return profile(db, user).verified_email == user.email


def require_verified(db, user):
    if not verified(db, user):
        raise HTTPException(403, 'Confirm your email before continuing.')


def is_admin(user):
    return user.email.lower() in {x.strip().lower() for x in os.getenv('COUNSELLING_ADMIN_EMAILS', '').split(',') if x.strip()}


def admin(user=Depends(current_user), db: Session = Depends(db_session)):
    require_verified(db, user)
    if not is_admin(user):
        raise HTTPException(403, 'Administrator access is required.')
    return user


def consent_content():
    text = os.getenv('COUNSELLING_CONSENT_TEXT', DEFAULT_CONSENT)
    # Content hash prevents silently changing the wording under an existing version.
    version = os.getenv('COUNSELLING_CONSENT_VERSION', '2026-10-26') + '-' + hashlib.sha256(text.encode()).hexdigest()[:12]
    return version, text


def current_consent(db, user):
    version, _ = consent_content()
    return db.query(Consent).filter_by(user_id=user.id, version=version).order_by(Consent.accepted_at.desc()).first()


def require_enabled():
    if os.getenv('COUNSELLING_ENABLED', '').lower() != 'true':
        raise HTTPException(503, 'Online counselling bookings are not open yet.')


def consultant_view(c):
    return {k: getattr(c, k) for k in ('id', 'name', 'credentials', 'bio', 'timezone', 'duration_minutes', 'price_cents', 'currency')}


def iso(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat().replace('+00:00', 'Z')


def slot_view(s):
    return {'id': s.id, 'starts_at': iso(s.starts_at), 'ends_at': iso(s.ends_at)}


class RegisterIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=12, max_length=128)


@router.post('/register')
def register(body: RegisterIn, db: Session = Depends(db_session), _=Depends(private_response)):
    salt = secrets.token_hex(16)
    hashed = hashlib.scrypt(body.password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    user = User(email=str(body.email).lower(), name=body.name.strip(), password_hash=f'scrypt:{salt}:{hashed}', token=secrets.token_hex(32))
    if not user.name:
        raise HTTPException(422, 'Enter your name.')
    db.add(user)
    try:
        db.flush()
        db.add(Profile(user_id=user.id))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'This email is already registered. Please sign in.')
    return {'token': user.token, 'name': user.name, 'email': user.email}


@router.get('/config')
def config(db: Session = Depends(db_session)):
    version, text = consent_content()
    return {'enabled': os.getenv('COUNSELLING_ENABLED', '').lower() == 'true',
            'support_phone': os.getenv('COUNSELLING_SUPPORT_PHONE', ''),
            'consent_version': version, 'consent_text': text, 'video_provider': 'daily',
            'consultants': [consultant_view(c) for c in db.query(Consultant).filter_by(active=True).order_by(Consultant.name)]}


@router.get('/me')
def me(user=Depends(current_user), db: Session = Depends(db_session)):
    confirmed = verified(db, user)
    return {'name': user.name, 'email': user.email, 'verified': confirmed,
            'consented': bool(current_consent(db, user)), 'is_admin': confirmed and is_admin(user),
            'is_consultant': confirmed and bool(db.query(Consultant).filter_by(email=user.email, active=True).first())}


@router.post('/verification/send')
def send_code(user=Depends(current_user), db: Session = Depends(db_session)):
    p = profile(db, user)
    if p.verified_email == user.email:
        return {'message': 'Your email is already confirmed.'}
    sent = now()
    code = f'{secrets.randbelow(100000000):08d}'
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + code).encode()).hexdigest()
    changed = db.execute(update(Profile).where(Profile.user_id == user.id, Profile.sent_at <= sent - 60).values(
        sent_at=sent, code_hash=salt + ':' + hashed, code_expires=sent + 900, attempts=0))
    db.commit()
    if not changed.rowcount:
        raise HTTPException(429, 'Please wait one minute before requesting another code.')
    providers.send_verification(user.email, code)
    return {'message': 'Check your inbox for an eight-digit confirmation code.'}


class VerifyIn(BaseModel):
    code: str = Field(pattern=r'^\d{8}$')


@router.post('/verification/confirm')
def confirm_code(body: VerifyIn, user=Depends(current_user), db: Session = Depends(db_session)):
    profile(db, user)
    # A database write serializes competing attempts, including across workers.
    changed = db.execute(update(Profile).where(Profile.user_id == user.id, Profile.attempts < 5,
                                              Profile.code_expires > now(), Profile.code_hash.is_not(None)).values(attempts=Profile.attempts + 1))
    if not changed.rowcount:
        db.rollback()
        raise HTTPException(400, 'Code expired or attempt limit reached. Request a new code.')
    p = db.get(Profile, user.id, populate_existing=True)
    salt, hashed = p.code_hash.split(':', 1)
    if not hmac.compare_digest(hashed, hashlib.sha256((salt + body.code).encode()).hexdigest()):
        db.commit()
        raise HTTPException(400, 'That confirmation code is incorrect.')
    p.verified_email = user.email
    p.code_hash = None
    p.code_expires = 0
    db.commit()
    return {'message': 'Your email is confirmed.'}


class ConsentIn(BaseModel):
    version: str
    accepted: Literal[True]


@router.post('/consent')
def accept_consent(body: ConsentIn, user=Depends(current_user), db: Session = Depends(db_session)):
    require_verified(db, user)
    version, text = consent_content()
    if body.version != version:
        raise HTTPException(409, 'The consent wording changed. Refresh and review it again.')
    if not current_consent(db, user):
        db.add(Consent(user_id=user.id, version=version, text=text, accepted_at=now()))
        db.commit()
    return {'message': 'Your consent has been recorded.'}


class ReferralIn(BaseModel):
    referrer_name: str = Field(min_length=1, max_length=255)
    referrer_email: EmailStr
    reference: str = Field(default='', max_length=500)


@router.post('/referral')
def referral(body: ReferralIn, user=Depends(current_user), db: Session = Depends(db_session)):
    require_verified(db, user)
    if not current_consent(db, user):
        raise HTTPException(403, 'Please review and accept data consent first.')
    row = Referral(user_id=user.id, referrer_name=body.referrer_name, referrer_email=str(body.referrer_email), reference=body.reference, created_at=now())
    db.add(row)
    db.commit()
    return {'id': row.id, 'message': 'Your referral details have been saved.'}


class ConsultantIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    credentials: str = Field(min_length=1, max_length=500)
    bio: str = Field(default='', max_length=3000)
    timezone: str = 'America/Toronto'
    duration_minutes: int = Field(ge=15, le=180)
    price_cents: int = Field(ge=100, le=1000000)
    currency: str = Field(default='cad', pattern=r'^[a-z]{3}$')

    @field_validator('timezone')
    @classmethod
    def timezone_valid(cls, value):
        try:
            ZoneInfo(value)
        except Exception:
            raise ValueError('Use an IANA timezone, for example America/Toronto.')
        return value


@router.post('/admin/consultants')
def create_consultant(body: ConsultantIn, _=Depends(admin), db: Session = Depends(db_session)):
    values = body.model_dump()
    values['email'] = str(body.email).lower()
    c = Consultant(**values)
    db.add(c)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'A consultant with this email already exists.')
    return consultant_view(c)


@router.get('/admin/consultants')
def admin_consultants(_=Depends(admin), db: Session = Depends(db_session)):
    return [{**consultant_view(c), 'email': c.email, 'active': c.active} for c in db.query(Consultant).order_by(Consultant.name)]


class SlotIn(BaseModel):
    consultant_id: str
    starts_at: datetime
    ends_at: datetime

    @field_validator('starts_at', 'ends_at')
    @classmethod
    def aware(cls, value):
        if value.tzinfo is None:
            raise ValueError('Include a UTC offset in calendar times.')
        return value


@router.post('/admin/slots')
def create_slot(body: SlotIn, _=Depends(admin), db: Session = Depends(db_session)):
    # UPDATE obtains a row lock in Postgres and a writer lock in SQLite.
    changed = db.execute(update(Consultant).where(Consultant.id == body.consultant_id, Consultant.active.is_(True)).values(revision=Consultant.revision + 1))
    if not changed.rowcount:
        db.rollback()
        raise HTTPException(404, 'Consultant not found.')
    c = db.get(Consultant, body.consultant_id)
    starts, ends = int(body.starts_at.timestamp()), int(body.ends_at.timestamp())
    if starts <= now() or ends - starts != c.duration_minutes * 60:
        raise HTTPException(422, 'Choose a future time with the consultant’s exact session duration.')
    if db.query(Slot).filter(Slot.consultant_id == c.id, Slot.starts_at < ends, Slot.ends_at > starts).first():
        raise HTTPException(409, 'This time overlaps an existing session slot.')
    s = Slot(consultant_id=c.id, starts_at=starts, ends_at=ends)
    db.add(s)
    db.commit()
    return slot_view(s)


@router.get('/admin/slots')
def admin_slots(consultant_id: str, _=Depends(admin), db: Session = Depends(db_session)):
    return [{**slot_view(s), 'booked': bool(s.booking_id)} for s in db.query(Slot).filter(Slot.consultant_id == consultant_id, Slot.ends_at > now()).order_by(Slot.starts_at)]


@router.delete('/admin/slots/{slot_id}')
def delete_slot(slot_id: str, _=Depends(admin), db: Session = Depends(db_session)):
    if db.query(Booking).filter_by(slot_id=slot_id).first():
        raise HTTPException(409, 'This time has appointment history and must be retained.')
    changed = db.query(Slot).filter(Slot.id == slot_id, Slot.booking_id.is_(None)).delete()
    db.commit()
    if not changed:
        raise HTTPException(409, 'This slot is booked or no longer exists.')
    return {'ok': True}


@router.get('/consultants/{consultant_id}/slots')
def list_slots(consultant_id: str, month: str, db: Session = Depends(db_session)):
    try:
        if len(month) != 7:
            raise ValueError()
        date = datetime.strptime(month, '%Y-%m').replace(tzinfo=timezone.utc)
        end = date.replace(day=calendar.monthrange(date.year, date.month)[1], hour=23, minute=59, second=59)
    except ValueError:
        raise HTTPException(422, 'Use YYYY-MM for the calendar month.')
    if not db.query(Consultant).filter_by(id=consultant_id, active=True).first():
        raise HTTPException(404, 'Consultant not found.')
    return [slot_view(s) for s in db.query(Slot).filter(Slot.consultant_id == consultant_id, Slot.booking_id.is_(None),
        Slot.starts_at >= max(int(date.timestamp()), now() + 3600), Slot.starts_at <= int(end.timestamp())).order_by(Slot.starts_at)]


class BookingIn(BaseModel):
    slot_id: str


def checkout(db, b, user):
    stripe = providers.stripe_client()
    try:
        if b.stripe_session_id:
            session = stripe.checkout.Session.retrieve(b.stripe_session_id)
            if session.get('status') in ('expired', 'complete'):
                apply_payment(db, session, 'checkout.session.expired' if session['status'] == 'expired' else 'checkout.session.completed')
                raise HTTPException(409, 'This checkout has ended. Refresh your appointments to see its status.')
        else:
            front = os.getenv('FRONTEND_URL', '').rstrip('/')
            if not front.startswith('https://') and not front.startswith('http://localhost:'):
                raise HTTPException(503, 'The booking return address has not been configured.')
            session = stripe.checkout.Session.create(
                mode='payment', payment_method_types=['card'], customer_email=user.email,
                line_items=[{'price_data': {'currency': b.currency, 'unit_amount': b.price_cents,
                    'product_data': {'name': 'BioVerse consultation'}}, 'quantity': 1}],
                metadata={'counselling_booking_id': b.id}, client_reference_id=b.id,
                success_url=front + '/counselling?payment=returned', cancel_url=front + '/counselling?payment=cancelled',
                expires_at=b.expires_at, idempotency_key='counselling-' + b.id,
            )
        b.stripe_session_id = session['id']
        b.checkout_url = session.get('url')
        db.commit()
        return {'id': b.id, 'checkout_url': b.checkout_url}
    except HTTPException:
        raise
    except Exception as exc:
        # Keep the claim on uncertain provider outcomes. Repeating reuses the same
        # idempotency key; never make the slot available while a payment may exist.
        raise HTTPException(503, 'Payment could not be opened. Retry this appointment from your bookings.') from exc


@router.post('/bookings')
def create_booking(body: BookingIn, user=Depends(current_user), db: Session = Depends(db_session)):
    require_enabled()
    require_verified(db, user)
    consent = current_consent(db, user)
    if not consent:
        raise HTTPException(403, 'Please review and accept the current data consent.')
    providers.stripe_client()
    if not os.getenv('DAILY_API_KEY'):
        raise HTTPException(503, 'Video appointments are not available yet. Please contact support.')
    slot = db.get(Slot, body.slot_id)
    if not slot or slot.starts_at <= now() + 3600:
        raise HTTPException(409, 'Choose an available appointment at least one hour from now.')
    c = db.get(Consultant, slot.consultant_id)
    if not c or not c.active:
        raise HTTPException(409, 'This consultant is no longer accepting bookings.')
    if slot.booking_id:
        prior = db.get(Booking, slot.booking_id)
        if prior and prior.user_id == user.id and prior.status == 'pending_payment':
            return checkout(db, prior, user)
        raise HTTPException(409, 'This time is no longer available. Please choose another.')
    b = Booking(id=uid(), user_id=user.id, slot_id=slot.id, consent_id=consent.id,
                price_cents=c.price_cents, currency=c.currency, created_at=now(), expires_at=now() + 1830)
    changed = db.execute(update(Slot).where(Slot.id == slot.id, Slot.booking_id.is_(None)).values(booking_id=b.id))
    if not changed.rowcount:
        db.rollback()
        raise HTTPException(409, 'This time was just reserved. Please choose another.')
    db.add(b)
    db.commit()
    return checkout(db, b, user)


def apply_payment(db, session, event_type):
    booking_id = session.get('metadata', {}).get('counselling_booking_id')
    if not booking_id:
        return
    b = db.get(Booking, booking_id)
    if not b:
        raise HTTPException(409, 'Booking not available yet; retry delivery.')
    # Serialize expiry and successful payment and protect against duplicate delivery.
    db.execute(update(Booking).where(Booking.id == b.id).values(status=Booking.status))
    db.refresh(b)
    if b.stripe_session_id and b.stripe_session_id != session['id']:
        raise HTTPException(400, 'Payment session mismatch.')
    if session.get('client_reference_id') != b.id or session.get('amount_total') != b.price_cents or session.get('currency') != b.currency:
        raise HTTPException(400, 'Payment details do not match this booking.')
    s = db.get(Slot, b.slot_id)
    b.stripe_session_id = session['id']
    if event_type == 'checkout.session.expired' and session.get('status') == 'expired':
        if b.status == 'pending_payment':
            b.status = 'expired'
            db.execute(update(Slot).where(Slot.id == s.id, Slot.booking_id == b.id).values(booking_id=None))
    elif session.get('payment_status') == 'paid' and session.get('status') == 'complete':
        if b.status in ('confirmed', 'cancellation_requested', 'cancelled'):
            return
        if b.status != 'pending_payment' or s.booking_id != b.id:
            raise HTTPException(409, 'Payment requires manual reconciliation; slot is not owned by this booking.')
        b.status = 'confirmed'
        b.checkout_url = None
    db.commit()


@router.post('/stripe/webhook')
async def payment_webhook(request: Request, db: Session = Depends(db_session)):
    stripe = providers.stripe_client()
    try:
        event = stripe.Webhook.construct_event(await request.body(), request.headers.get('stripe-signature', ''), os.environ['COUNSELLING_STRIPE_WEBHOOK_SECRET'])
    except Exception:
        raise HTTPException(400, 'Invalid payment webhook signature.')
    if event['type'] in ('checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired'):
        apply_payment(db, event['data']['object'], event['type'])
    return {'received': True}


def accessible(db, user, booking_id):
    b = db.get(Booking, booking_id)
    if not b:
        raise HTTPException(404, 'Appointment not found.')
    s = db.get(Slot, b.slot_id)
    c = db.get(Consultant, s.consultant_id)
    if user.id != b.user_id and user.email != c.email:
        raise HTTPException(404, 'Appointment not found.')
    return b, s, c


@router.get('/bookings')
def bookings(user=Depends(current_user), db: Session = Depends(db_session)):
    require_verified(db, user)
    rows = db.query(Booking, Slot, Consultant).join(Slot, Booking.slot_id == Slot.id).join(Consultant, Slot.consultant_id == Consultant.id).filter(or_(Booking.user_id == user.id, Consultant.email == user.email)).order_by(Slot.starts_at.desc()).limit(200).all()
    result = []
    for b, s, c in rows:
        result.append({'id': b.id, 'consultant_name': c.name, 'starts_at': iso(s.starts_at), 'ends_at': iso(s.ends_at),
            'status': b.status, 'price_cents': b.price_cents, 'currency': b.currency,
            'checkout_url': b.checkout_url if b.user_id == user.id and b.status == 'pending_payment' else None,
            'slot_id': s.id,
            'patient_name': db.get(User, b.user_id).name if c.email == user.email else None})
    return result


@router.post('/bookings/{booking_id}/retry-payment')
def retry_payment(booking_id: str, user=Depends(current_user), db: Session = Depends(db_session)):
    require_enabled()
    require_verified(db, user)
    b, s, c = accessible(db, user, booking_id)
    if b.user_id != user.id or b.status != 'pending_payment' or s.booking_id != b.id:
        raise HTTPException(409, 'This booking cannot accept a payment.')
    if not current_consent(db, user):
        raise HTTPException(403, 'Review the current consent before paying.')
    return checkout(db, b, user)


@router.post('/bookings/{booking_id}/cancel-request')
def cancel_request(booking_id: str, user=Depends(current_user), db: Session = Depends(db_session)):
    require_verified(db, user)
    b, s, c = accessible(db, user, booking_id)
    if b.status not in ('confirmed', 'cancellation_requested'):
        raise HTTPException(409, 'Only confirmed appointments can request cancellation.')
    b.status = 'cancellation_requested'
    db.commit()
    return {'message': 'Cancellation requested. Your consultant will confirm any cancellation and refund.'}


@router.post('/bookings/{booking_id}/join')
def join(booking_id: str, user=Depends(current_user), db: Session = Depends(db_session)):
    require_verified(db, user)
    b, s, c = accessible(db, user, booking_id)
    if not c.active:
        raise HTTPException(403, 'This consultant is no longer active. Please contact support.')
    if b.status not in ('confirmed', 'cancellation_requested'):
        raise HTTPException(403, 'Only a confirmed, paid appointment can open a meeting.')
    if now() < s.starts_at - 600 or now() > s.ends_at + 900:
        raise HTTPException(403, 'Your meeting opens 10 minutes before the appointment and closes 15 minutes after it.')
    return {'url': providers.meeting_url(b.id, user.id, user.email == c.email, s.starts_at, s.ends_at)}


@router.get('/bookings/{booking_id}/referral')
def booking_referral(booking_id: str, user=Depends(current_user), db: Session = Depends(db_session)):
    require_verified(db, user)
    b, s, c = accessible(db, user, booking_id)
    if user.id != b.user_id and b.status not in ('confirmed', 'cancellation_requested'):
        raise HTTPException(403, 'Referral details are available after appointment confirmation.')
    return [{'referrer_name': r.referrer_name, 'referrer_email': r.referrer_email,
             'reference': r.reference, 'created_at': iso(r.created_at)}
            for r in db.query(Referral).filter(Referral.user_id == b.user_id, Referral.created_at <= b.created_at).order_by(Referral.created_at.desc())]


@router.post('/admin/bookings/{booking_id}/reconcile')
def reconcile_booking(booking_id: str, _=Depends(admin), db: Session = Depends(db_session)):
    """Recover missed webhooks or uncertain Checkout creation without guessing."""
    b = db.get(Booking, booking_id)
    if not b:
        raise HTTPException(404, 'Appointment not found.')
    stripe = providers.stripe_client()
    try:
        if b.stripe_session_id:
            session = stripe.checkout.Session.retrieve(b.stripe_session_id)
        else:
            if now() <= b.expires_at + 60:
                raise HTTPException(409, 'The payment window has not closed. Retry payment or wait before reconciliation.')
            session = None
            # A full, bounded provider search verifies whether initial creation succeeded.
            for count, candidate in enumerate(stripe.checkout.Session.list(created={'gte': b.created_at - 60, 'lte': b.expires_at}, limit=100).auto_paging_iter()):
                if count >= 1000:
                    raise HTTPException(503, 'Too many payment sessions to reconcile automatically. Contact support.')
                if candidate.get('metadata', {}).get('counselling_booking_id') == b.id:
                    if session is not None:
                        raise HTTPException(409, 'Multiple payment sessions require manual reconciliation.')
                    session = candidate
            if session is None:
                changed = db.execute(update(Booking).where(Booking.id == b.id, Booking.status == 'pending_payment', Booking.stripe_session_id.is_(None)).values(status='expired'))
                if changed.rowcount:
                    db.execute(update(Slot).where(Slot.id == b.slot_id, Slot.booking_id == b.id).values(booking_id=None))
                db.commit()
                return {'message': 'No payment session exists; the unpaid reservation has been released.'}
        apply_payment(db, session, 'checkout.session.expired' if session.get('status') == 'expired' else 'checkout.session.completed')
        return {'message': 'Payment status checked with Stripe. Refresh appointments.'}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, 'Could not reconcile with Stripe. No slot was released.') from exc


@router.post('/admin/bookings/{booking_id}/complete-cancellation')
def complete_cancellation(booking_id: str, _=Depends(admin), db: Session = Depends(db_session)):
    """After staff refunds in Stripe, verify the full refund before releasing a slot."""
    b = db.get(Booking, booking_id)
    if not b or b.status not in ('confirmed', 'cancellation_requested', 'cancelled'):
        raise HTTPException(409, 'A paid appointment is required.')
    if b.status == 'cancelled':
        return {'message': 'Appointment already cancelled.'}
    stripe = providers.stripe_client()
    try:
        session = stripe.checkout.Session.retrieve(b.stripe_session_id)
        intent = stripe.PaymentIntent.retrieve(session['payment_intent'])
        charge = stripe.Charge.retrieve(intent['latest_charge'])
        if not charge.get('refunded') or charge.get('amount_refunded') != b.price_cents or charge.get('currency') != b.currency:
            raise HTTPException(409, 'Issue and verify a full refund in Stripe before completing cancellation.')
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, 'Could not verify the refund. Appointment remains reserved.') from exc
    changed = db.execute(update(Booking).where(Booking.id == b.id, Booking.status.in_(['confirmed', 'cancellation_requested'])).values(status='cancelled'))
    if changed.rowcount:
        db.execute(update(Slot).where(Slot.id == b.slot_id, Slot.booking_id == b.id).values(booking_id=None))
    db.commit()
    return {'message': 'Refund verified and appointment cancelled.'}


@router.get('/admin/bookings')
def admin_bookings(_=Depends(admin), db: Session = Depends(db_session)):
    rows = db.query(Booking, Slot, Consultant, User).join(Slot, Booking.slot_id == Slot.id).join(Consultant, Slot.consultant_id == Consultant.id).join(User, Booking.user_id == User.id).order_by(Slot.starts_at.desc()).limit(500).all()
    return [{'id': b.id, 'consultant_name': c.name, 'patient_name': u.name,
             'starts_at': iso(s.starts_at), 'ends_at': iso(s.ends_at), 'status': b.status,
             'price_cents': b.price_cents, 'currency': b.currency}
            for b, s, c, u in rows]
