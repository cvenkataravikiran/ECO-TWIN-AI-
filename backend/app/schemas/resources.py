from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from typing import Optional, List, Generic, TypeVar
from datetime import datetime

T = TypeVar("T")


class ResourceRecordBase(BaseModel):
    category: str = Field(..., description="Category: electricity, water, gas, travel, food, waste, shopping, other")
    description: Optional[str] = Field(None, max_length=255)
    quantity: float = Field(..., description="Recorded numeric quantity")
    unit: str = Field(..., max_length=30, description="Unit of measurement, e.g. kWh, m³, km")
    cost: float = Field(default=0.0, description="Cost amount in currency")
    currency: str = Field(default="INR", max_length=3)
    period_start: str = Field(..., description="ISO 8601 date YYYY-MM-DD")
    period_end: str = Field(..., description="ISO 8601 date YYYY-MM-DD")
    measurement_type: str = Field(default="measured", description="measured, estimated, imported")
    source: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Quantity must be greater than 0")
        return v

    @field_validator("cost")
    @classmethod
    def validate_cost(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Cost must be non-negative (>= 0)")
        return v

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized != "INR":
            raise ValueError("Only INR is supported.")
        return normalized

    @model_validator(mode="after")
    def validate_period(self) -> "ResourceRecordBase":
        if self.period_start and self.period_end:
            if self.period_start > self.period_end:
                raise ValueError("period_start must be less than or equal to period_end")
        return self


class ResourceRecordCreate(ResourceRecordBase):
    workspace_id: str = Field(..., description="Target workspace ID")


class ResourceRecordUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    cost: Optional[float] = None
    currency: Optional[str] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    measurement_type: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError("Quantity must be greater than 0")
        return v

    @field_validator("cost")
    @classmethod
    def validate_cost(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Cost must be non-negative (>= 0)")
        return v

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip().upper()
        if normalized != "INR":
            raise ValueError("Only INR is supported.")
        return normalized

    @model_validator(mode="after")
    def validate_period(self) -> "ResourceRecordUpdate":
        if self.period_start and self.period_end:
            if self.period_start > self.period_end:
                raise ValueError("period_start must be less than or equal to period_end")
        return self


class ResourceRecordResponse(BaseModel):
    id: str
    workspace_id: str
    category: str
    description: Optional[str] = None
    quantity: float
    unit: str
    cost: float
    currency: str
    period_start: str
    period_end: str
    measurement_type: str
    source: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def create(cls, items: List[T], total: int, page: int, page_size: int) -> "PaginatedResponse[T]":
        pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        return cls(items=items, total=total, page=page, page_size=page_size, pages=pages)
