import uuid
from sqlalchemy import String, Integer, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from core.flow.db import Base


def uid():
    return str(uuid.uuid4())


class Profile(Base):
    __tablename__ = 'counselling_profiles'
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), primary_key=True)
    verified_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    code_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    code_expires: Mapped[int] = mapped_column(Integer, default=0)
    sent_at: Mapped[int] = mapped_column(Integer, default=0)
    attempts: Mapped[int] = mapped_column(Integer, default=0)


class Consent(Base):
    __tablename__ = 'counselling_consents'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    version: Mapped[str] = mapped_column(String(100))
    text: Mapped[str] = mapped_column(Text)
    accepted_at: Mapped[int] = mapped_column(Integer)


class Consultant(Base):
    __tablename__ = 'counselling_consultants'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    credentials: Mapped[str] = mapped_column(String(500))
    bio: Mapped[str] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(String(100))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    price_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default='cad')
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    revision: Mapped[int] = mapped_column(Integer, default=0)


class Slot(Base):
    __tablename__ = 'counselling_slots'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    consultant_id: Mapped[str] = mapped_column(ForeignKey('counselling_consultants.id'), index=True)
    starts_at: Mapped[int] = mapped_column(Integer, index=True)
    ends_at: Mapped[int] = mapped_column(Integer)
    booking_id: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)


class Booking(Base):
    __tablename__ = 'counselling_bookings'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    slot_id: Mapped[str] = mapped_column(ForeignKey('counselling_slots.id'))
    consent_id: Mapped[str] = mapped_column(ForeignKey('counselling_consents.id'))
    status: Mapped[str] = mapped_column(String(40), default='pending_payment')
    price_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3))
    created_at: Mapped[int] = mapped_column(Integer)
    stripe_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    checkout_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[int] = mapped_column(Integer)


class Referral(Base):
    __tablename__ = 'counselling_referrals'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    referrer_name: Mapped[str] = mapped_column(String(255))
    referrer_email: Mapped[str] = mapped_column(String(255))
    reference: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[int] = mapped_column(Integer)
