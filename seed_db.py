import os
import uuid
import base64
from datetime import date, timedelta
from app import create_app, db
from app.models import Contract

def seed_data():
    app = create_app()
    with app.app_context():
        # Clear existing data if any (optional, but good for demo)
        # Contract.query.delete()
        
        # Check if we already have data
        if Contract.query.count() > 0:
            print("Database already has data. Skipping seed.")
            return

        print("Seeding sample contracts...")
        
        today = date.today()
        
        samples = [
            {
                "name": "Cloud Services Agreement",
                "party": "Azure Cloud Solutions",
                "days_ago": 60,
                "duration_days": 365,
                "file": "sample_agreement.pdf"
            },
            {
                "name": "Office Lease - HQ",
                "party": "Skyline Properties LLC",
                "days_ago": 300,
                "duration_days": 730,
                "file": "lease_contract.pdf"
            },
            {
                "name": "Content Marketing Retainer",
                "party": "Creative Minds Agency",
                "days_ago": 15,
                "duration_days": 180,
                "file": "marketing_sop.pdf"
            },
            {
                "name": "Software License - Enterprise",
                "party": "Oracle Corp",
                "days_ago": 350,
                "duration_days": 365, # Expiring soon
                "file": "software_license.pdf"
            },
            {
                "name": "Consulting Services",
                "party": "Global Strategy Group",
                "days_ago": 400,
                "duration_days": 365, # Expired
                "file": "consulting_contract.pdf"
            }
        ]

        # Create dummy files if they don't exist
        # Minimal valid PDF content
        MINIMAL_PDF = base64.b64decode(
            "JVBERi0xLjcKCjEgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iagoyIDAgb2JqCjw8IC9UeXBlIC9QYWdlcyAvS2lkcyBbIDMgMCBSIF0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWyAwIDAgNjEyIDc5MiBdIC9Db250ZW50cyA0IDAgUiAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4gPj4gPj4gPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWyAwIDAgNjEyIDc5MiBdIC9Db250ZW50cyA0IDAgUiA+PgplbmRvYmoKNCAwIG9iago8PCAvTGVuZ3RoIDQ0ID4+CnN0cmVhbQpCVCAvRjEgMjQgVGYgMTAwIDcwMCBUZCAoU2FtcGxlIENvbnRyYWN0KSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY4IDAwMDAwIG4gCjAwMDAwMDAxMjEgMDAwMDAgbiAKMDAwMDAwMDIyOSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDUgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjI3MgolJUVPRgo="
        )

        for s in samples:
            unique_name = f"seed_{uuid.uuid4()}_{s['file']}"
            rel_path = f"uploads/{unique_name}"
            abs_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
            
            # Create a valid minimal PDF
            with open(abs_path, 'wb') as f:
                f.write(MINIMAL_PDF)

            start = today - timedelta(days=s['days_ago'])
            end   = start + timedelta(days=s['duration_days'])
            
            contract = Contract(
                contract_name = s['name'],
                party_name    = s['party'],
                start_date    = start,
                end_date      = end,
                file_path     = rel_path
            )
            contract.update_status()
            db.session.add(contract)

        db.session.commit()
        print(f"Successfully seeded {len(samples)} contracts.")

if __name__ == "__main__":
    seed_data()
