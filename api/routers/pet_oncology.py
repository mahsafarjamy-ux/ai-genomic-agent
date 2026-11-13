"""Dog oncology intake and staff-only dispatch to a private worker."""
import os
import re
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy import JSON, select
from sqlalchemy.orm import Mapped, mapped_column

from api.routers.counselling import current_user, db_session
from core.flow.db import Base, _now, _uuid

router = APIRouter()
CASE_ID = re.compile(r"[a-f0-9-]{36}")


class PetCase(Base):
    __tablename__ = "pet_oncology_cases"

    id: Mapped[str] = mapped_column(primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(index=True)
    pet_name: Mapped[str]
    pathway: Mapped[str]
    status: Mapped[str] = mapped_column(default="submitted")
    consented_at: Mapped[str]
    job_id: Mapped[str | None]
    consent_version: Mapped[str] = mapped_column(default="pet-intake-v2")
    intake_details: Mapped[dict] = mapped_column(JSON)


class OwnerDetails(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=40)
    city: str = Field(min_length=1, max_length=100)
    region: str = Field(min_length=1, max_length=100)
    country: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=1, max_length=20)


class PetDetails(BaseModel):
    breed: str = Field(min_length=1, max_length=100)
    age_years: float = Field(ge=0, le=35)
    sex: Literal["female", "male", "unknown"]
    weight_kg: float | None = Field(default=None, gt=0, le=150)
    clinic: str = Field(min_length=1, max_length=160)
    veterinarian: str = Field(default="", max_length=120)
    clinic_email: EmailStr | None = None
    diagnosis: str = Field(min_length=1, max_length=500)
    tumor_site: str = Field(default="", max_length=120)
    history: str = Field(default="", max_length=2000)


class InsuranceDetails(BaseModel):
    status: Literal["insured", "uninsured", "unsure"]
    provider: str = Field(default="", max_length=120)
    policy_number: str = Field(default="", max_length=120)
    claim_number: str = Field(default="", max_length=120)

    @model_validator(mode="after")
    def check_policy(self):
        if self.status == "insured" and not (self.provider.strip() and self.policy_number.strip()):
            raise ValueError("Enter the insurer and policy number.")
        if self.status != "insured" and any((self.provider, self.policy_number, self.claim_number)):
            raise ValueError("Policy details require an insured status.")
        return self


class Intake(BaseModel):
    pet_name: str = Field(min_length=1, max_length=80)
    pathway: Literal["existing", "sequencing"]
    owner: OwnerDetails
    pet: PetDetails
    insurance: InsuranceDetails
    consent: Literal[True]


def summary(case):
    return {"id": case.id, "pet_name": case.pet_name, "pathway": case.pathway, "status": case.status}


@router.get("/cases")
def list_cases(user=Depends(current_user), db=Depends(db_session)):
    cases = db.scalars(select(PetCase).where(PetCase.owner_id == user.id)
                       .order_by(PetCase.consented_at.desc()).limit(100))
    return [summary(case) for case in cases]


@router.post("/cases", status_code=201)
def create_case(body: Intake, user=Depends(current_user), db=Depends(db_session)):
    name = body.pet_name.strip()
    if not name:
        raise HTTPException(422, "Enter your dog's name.")
    case = PetCase(owner_id=user.id, pet_name=name, pathway=body.pathway,
                   consented_at=_now().isoformat(),
                   intake_details=body.model_dump(mode="json", include={"owner", "pet", "insurance"}))
    db.add(case)
    db.commit()
    return summary(case)


def staff(user=Depends(current_user)):
    allowed = {email.strip().lower() for email in os.getenv("PET_ONCOLOGY_STAFF", "").split(",")}
    if user.email.lower() not in allowed:
        raise HTTPException(403, "Staff access required.")
    return user


def worker_request(method, operation, body=None):
    endpoint = os.getenv("PET_RUNPOD_ENDPOINT", "")
    key = os.getenv("PET_RUNPOD_API_KEY", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", endpoint) or not key:
        raise HTTPException(503, "GPU endpoint is not configured.")
    try:
        response = httpx.request(method, f"https://api.runpod.ai/v2/{endpoint}/{operation}",
                                 headers={"Authorization": f"Bearer {key}"}, json=body, timeout=12)
        response.raise_for_status()
        result = response.json()
        if not isinstance(result, dict):
            raise ValueError("Expected a job record.")
        return result
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(503, "GPU request could not be confirmed. Check provider history before retrying.") from exc


def case_by_id(db, case_id):
    if not CASE_ID.fullmatch(case_id):
        raise HTTPException(404, "Case not found.")
    case = db.scalar(select(PetCase).where(PetCase.id == case_id).with_for_update())
    if not case:
        raise HTTPException(404, "Case not found.")
    return case


@router.get("/staff/cases/{case_id}")
def staff_intake(case_id: str, _=Depends(staff), db=Depends(db_session)):
    case = case_by_id(db, case_id)
    return {**summary(case), "intake": case.intake_details,
            "consented_at": case.consented_at, "consent_version": case.consent_version}


@router.post("/staff/cases/{case_id}/dispatch", status_code=202)
def dispatch(case_id: str, _=Depends(staff), db=Depends(db_session)):
    # Check configuration before reserving a dispatch attempt.
    if not re.fullmatch(r"[A-Za-z0-9_-]+", os.getenv("PET_RUNPOD_ENDPOINT", "")) or not os.getenv("PET_RUNPOD_API_KEY"):
        raise HTTPException(503, "GPU endpoint is not configured.")
    case = case_by_id(db, case_id)
    if case.status != "submitted":
        raise HTTPException(409, "This case already has a dispatch attempt.")
    case.status = "dispatching"
    db.commit()
    result = worker_request("POST", "run", {"input": {"case_id": case_id}})
    job_id = result.get("id")
    if not isinstance(job_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", job_id):
        raise HTTPException(503, "Dispatch needs reconciliation in the GPU dashboard.")
    case.job_id = job_id
    case.status = "queued"
    db.commit()
    return summary(case)


@router.post("/cases/{case_id}/sync")
def sync(case_id: str, user=Depends(current_user), db=Depends(db_session)):
    case = case_by_id(db, case_id)
    if case.owner_id != user.id:
        raise HTTPException(404, "Case not found.")
    if case.status == "queued" and case.job_id:
        result = worker_request("GET", f"status/{case.job_id}")
        if result.get("status") == "COMPLETED":
            output = result.get("output")
            case.status = "review" if isinstance(output, dict) and output.get("case_id") == case.id else "failed"
        elif result.get("status") in {"FAILED", "CANCELLED", "TIMED_OUT"}:
            case.status = "failed"
        db.commit()
    return summary(case)
