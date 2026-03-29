from app import db
from datetime import date, datetime, timedelta


class Contract(db.Model):
    """Contract database model."""
    __tablename__ = 'contracts'

    id             = db.Column(db.Integer, primary_key=True)
    contract_name  = db.Column(db.String(255), nullable=False)
    party_name     = db.Column(db.String(255), nullable=False)
    start_date     = db.Column(db.Date, nullable=False)
    end_date       = db.Column(db.Date, nullable=False)
    status         = db.Column(db.String(20), default='Active')
    file_path      = db.Column(db.String(512), nullable=False)
    signature_path = db.Column(db.String(512), nullable=True)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    # ── Computed properties ───────────────────────────────────────────

    @property
    def days_left(self):
        delta = (self.end_date - date.today()).days
        return max(delta, 0)

    @property
    def is_expiring_soon(self):
        return self.status == 'Active' and 0 <= self.days_left <= 30

    # ── Status management ─────────────────────────────────────────────

    def update_status(self):
        """Auto-set status based on end_date vs today."""
        self.status = 'Active' if self.end_date >= date.today() else 'Expired'

    # ── Serialization ─────────────────────────────────────────────────

    def to_dict(self):
        return {
            'id':               self.id,
            'contract_name':    self.contract_name,
            'party_name':       self.party_name,
            'start_date':       self.start_date.isoformat(),
            'end_date':         self.end_date.isoformat(),
            'status':           self.status,
            'file_path':        self.file_path,
            'signature_path':   self.signature_path,
            'created_at':       self.created_at.isoformat() if self.created_at else None,
            'days_left':        self.days_left,
            'is_expiring_soon': self.is_expiring_soon,
        }
