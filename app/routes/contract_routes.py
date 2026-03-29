"""
contract_routes.py
==================
REST API for the Contract Management System.

Routes
------
GET    /              → HTML dashboard
GET    /contracts     → list all contracts (+ filter/sort/search params)
GET    /contracts/stats        → dashboard stats
GET    /contracts/search       → search by q= keyword
GET    /contracts/<id>         → single contract
POST   /contracts              → create contract (multipart)
PUT    /contracts/<id>         → update contract metadata
DELETE /contracts/<id>         → delete contract + files
POST   /contracts/<id>/signature → attach eSignature (file or base64)
"""

import os
import uuid
import base64

from flask import (Blueprint, request, jsonify,
                   render_template, current_app)
from werkzeug.utils import secure_filename
from datetime import datetime, date, timedelta

from app.models import Contract, db

contract_bp = Blueprint('contracts', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx'}


# ── Helpers ───────────────────────────────────────────────────────────

def allowed_file(filename: str) -> bool:
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _save_upload(file, folder: str) -> str:
    """Save an uploaded FileStorage object and return the relative path."""
    filename    = secure_filename(file.filename)
    unique_name = f"{uuid.uuid4()}_{filename}"
    abs_path    = os.path.join(folder, unique_name)
    file.save(abs_path)
    return unique_name  # store only filename; reconstruct path on frontend


def _refresh_statuses(contracts):
    """Auto-update status for a list of contracts and commit."""
    for c in contracts:
        c.update_status()
    db.session.commit()


# ── Dashboard (HTML) ──────────────────────────────────────────────────

@contract_bp.route('/')
def index():
    return render_template('index.html')


# ── GET /contracts ────────────────────────────────────────────────────

@contract_bp.route('/contracts', methods=['GET'])
def get_contracts():
    """
    Fetch all contracts with optional filters:
      ?search=       keyword search (contract_name or party_name)
      ?status=       Active | Expired
      ?expiring_soon=true
      ?sort_by=      newest | oldest | name | expiry
      ?start_from=   YYYY-MM-DD
      ?end_to=       YYYY-MM-DD
    """
    q      = Contract.query
    search = request.args.get('search', '').strip()
    status = request.args.get('status', '').strip()

    if search:
        like = f'%{search}%'
        q = q.filter(
            Contract.contract_name.like(like) |
            Contract.party_name.like(like)
        )

    if status:
        q = q.filter(Contract.status == status)

    if request.args.get('expiring_soon') == 'true':
        today  = date.today()
        in_30  = today + timedelta(days=30)
        q = q.filter(
            Contract.status  == 'Active',
            Contract.end_date >= today,
            Contract.end_date <= in_30
        )

    start_from = request.args.get('start_from')
    end_to     = request.args.get('end_to')
    if start_from:
        q = q.filter(Contract.start_date >= datetime.strptime(start_from, '%Y-%m-%d').date())
    if end_to:
        q = q.filter(Contract.end_date   <= datetime.strptime(end_to,     '%Y-%m-%d').date())

    sort_by = request.args.get('sort_by', 'newest')
    if   sort_by == 'name':   q = q.order_by(Contract.contract_name.asc())
    elif sort_by == 'expiry': q = q.order_by(Contract.end_date.asc())
    elif sort_by == 'oldest': q = q.order_by(Contract.id.asc())
    else:                     q = q.order_by(Contract.id.desc())   # newest

    contracts = q.all()
    _refresh_statuses(contracts)
    return jsonify([c.to_dict() for c in contracts]), 200


# ── GET /contracts/stats ──────────────────────────────────────────────

@contract_bp.route('/contracts/stats', methods=['GET'])
def get_stats():
    """Return dashboard summary counts."""
    today = date.today()
    in_30 = today + timedelta(days=30)

    total        = Contract.query.count()
    active       = Contract.query.filter_by(status='Active').count()
    expired      = Contract.query.filter_by(status='Expired').count()
    expiring_soon = Contract.query.filter(
        Contract.status   == 'Active',
        Contract.end_date >= today,
        Contract.end_date <= in_30
    ).count()

    return jsonify({
        'total':         total,
        'active':        active,
        'expired':       expired,
        'expiring_soon': expiring_soon,
    }), 200


# ── GET /contracts/search ─────────────────────────────────────────────

@contract_bp.route('/contracts/search', methods=['GET'])
def search_contracts():
    """
    Search contracts by keyword.
      GET /contracts/search?q=keyword
    Searches contract_name and party_name.
    """
    keyword = request.args.get('q', '').strip()
    if not keyword:
        return jsonify({'error': 'Query parameter "q" is required'}), 400

    like      = f'%{keyword}%'
    contracts = Contract.query.filter(
        Contract.contract_name.like(like) |
        Contract.party_name.like(like)
    ).order_by(Contract.id.desc()).all()

    _refresh_statuses(contracts)
    return jsonify([c.to_dict() for c in contracts]), 200


# ── GET /contracts/<id> ───────────────────────────────────────────────

@contract_bp.route('/contracts/<int:contract_id>', methods=['GET'])
def get_contract(contract_id):
    contract = Contract.query.get_or_404(contract_id)
    contract.update_status()
    db.session.commit()
    return jsonify(contract.to_dict()), 200


# ── POST /contracts ───────────────────────────────────────────────────

@contract_bp.route('/contracts', methods=['POST'])
def create_contract():
    """
    Create a new contract (multipart/form-data).
    Required fields: contract_name, party_name, start_date, end_date, file
    """
    # ── Validate required fields ──
    required = ['contract_name', 'party_name', 'start_date', 'end_date']
    missing  = [f for f in required if not request.form.get(f)]
    if missing:
        return jsonify({'error': f'Missing fields: {", ".join(missing)}'}), 400

    if 'file' not in request.files or request.files['file'].filename == '':
        return jsonify({'error': 'Contract file is required'}), 400

    file = request.files['file']
    if not allowed_file(file.filename):
        return jsonify({'error': f'File type not allowed. Use: {", ".join(ALLOWED_EXTENSIONS)}'}), 400

    try:
        unique_name = _save_upload(file, current_app.config['UPLOAD_FOLDER'])

        contract = Contract(
            contract_name = request.form['contract_name'],
            party_name    = request.form['party_name'],
            start_date    = datetime.strptime(request.form['start_date'], '%Y-%m-%d').date(),
            end_date      = datetime.strptime(request.form['end_date'],   '%Y-%m-%d').date(),
            file_path     = f'uploads/{unique_name}',
        )
        contract.update_status()
        db.session.add(contract)
        db.session.commit()

        return jsonify(contract.to_dict()), 201

    except KeyError as e:
        return jsonify({'error': f'Missing field: {e}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Database error: {str(e)}'}), 500


# ── PUT /contracts/<id> ───────────────────────────────────────────────

@contract_bp.route('/contracts/<int:contract_id>', methods=['PUT'])
def update_contract(contract_id):
    """Update contract metadata (JSON body)."""
    contract = Contract.query.get_or_404(contract_id)
    data     = request.get_json(silent=True)

    if not data:
        return jsonify({'error': 'JSON body required'}), 400

    try:
        if 'contract_name' in data: contract.contract_name = data['contract_name']
        if 'party_name'    in data: contract.party_name    = data['party_name']
        if 'start_date'    in data:
            contract.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        if 'end_date'      in data:
            contract.end_date   = datetime.strptime(data['end_date'],   '%Y-%m-%d').date()

        contract.update_status()
        db.session.commit()
        return jsonify(contract.to_dict()), 200

    except ValueError as e:
        return jsonify({'error': f'Invalid date format: {e}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Database error: {str(e)}'}), 500


# ── DELETE /contracts/<id> ────────────────────────────────────────────

@contract_bp.route('/contracts/<int:contract_id>', methods=['DELETE'])
def delete_contract(contract_id):
    """Delete a contract and its associated files."""
    contract = Contract.query.get_or_404(contract_id)

    def _remove(rel_path):
        if rel_path:
            full = os.path.join(
                current_app.root_path, 'static', rel_path.lstrip('/')
            )
            if os.path.exists(full):
                os.remove(full)

    try:
        _remove(contract.file_path)
        _remove(contract.signature_path)

        db.session.delete(contract)
        db.session.commit()
        return jsonify({'message': 'Contract deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Database error: {str(e)}'}), 500


# ── POST /contracts/<id>/signature ────────────────────────────────────

@contract_bp.route('/contracts/<int:contract_id>/signature', methods=['POST'])
def add_signature(contract_id):
    """
    Attach an eSignature to a contract.
    Accepts either:
      • multipart file upload  (field: "signature")
      • JSON body with base64  {"signature_base64": "data:image/png;base64,..."}
    """
    contract = Contract.query.get_or_404(contract_id)

    try:
        sig_folder = current_app.config['SIGNATURE_FOLDER']

        # ── Option A: file upload ──
        if 'signature' in request.files:
            sig_file = request.files['signature']
            if sig_file.filename == '':
                return jsonify({'error': 'Empty signature file'}), 400
            unique_name = _save_upload(sig_file, sig_folder)
            rel_path    = f'signatures/{unique_name}'

        # ── Option B: base64 string ──
        elif request.is_json and request.json.get('signature_base64'):
            raw    = request.json['signature_base64']
            # Strip data URI prefix (data:image/png;base64,...)
            if ',' in raw:
                raw = raw.split(',', 1)[1]
            unique_name = f"sig_{uuid.uuid4()}.png"
            abs_path    = os.path.join(sig_folder, unique_name)
            with open(abs_path, 'wb') as f:
                f.write(base64.b64decode(raw))
            rel_path = f'signatures/{unique_name}'

        else:
            return jsonify({'error': 'Provide "signature" file or "signature_base64" JSON'}), 400

        contract.signature_path = rel_path
        db.session.commit()
        return jsonify(contract.to_dict()), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Signature error: {str(e)}'}), 500


# ── Legacy API prefix shim (keeps old /api/contracts/* working) ───────

@contract_bp.route('/api/contracts', methods=['GET'])
def _legacy_list():
    return get_contracts()

@contract_bp.route('/api/contracts/stats', methods=['GET'])
def _legacy_stats():
    return get_stats()

@contract_bp.route('/api/contracts/search', methods=['GET'])
def _legacy_search():
    return search_contracts()

@contract_bp.route('/api/contracts/<int:cid>', methods=['GET'])
def _legacy_get(cid):
    return get_contract(cid)

@contract_bp.route('/api/contracts', methods=['POST'])
def _legacy_create():
    return create_contract()

@contract_bp.route('/api/contracts/<int:cid>', methods=['PUT'])
def _legacy_update(cid):
    return update_contract(cid)

@contract_bp.route('/api/contracts/<int:cid>', methods=['DELETE'])
def _legacy_delete(cid):
    return delete_contract(cid)

@contract_bp.route('/api/contracts/<int:cid>/signature', methods=['POST'])
def _legacy_sig(cid):
    return add_signature(cid)


# ── Internal/Dev/Demo Only ──────────────────────────────────────────
@contract_bp.route('/contracts/seed', methods=['POST'])
def seed_contracts():
    """Seed the database with sample data (demo only)."""
    from seed_db import seed_data
    try:
        seed_data()
        return jsonify({'message': 'Sample data created successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
