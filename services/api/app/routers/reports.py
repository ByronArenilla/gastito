"""Reportes de un mes elegido (spec 013, RF-5).

El cálculo vive en `app/reports.py` (principio 10). La ruta recibe el
espacio por `member_space`, nunca consultando por `space_id` directamente.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import member_space, requested_report_period, requested_window
from app.models import Space
from app.reports import build_reports
from app.schemas import ReportsOut

router = APIRouter(prefix="/spaces/{space_id}/reports", tags=["reports"])


@router.get("")
def read_reports(
    space: Annotated[Space, Depends(member_space)],
    db: Annotated[Session, Depends(get_db)],
    period: Annotated[str, Depends(requested_report_period)],
    months: Annotated[int, Depends(requested_window)],
) -> ReportsOut:
    """ "¿En qué se me va la plata?" y "¿Planeo bien?" del mes `period` (por
    defecto el anterior al actual), y "¿Estoy ahorrando?" en los `months`
    meses que terminan en él (1, 3, 6 o 12; por defecto 1)."""
    return build_reports(db, space.id, period, months)
