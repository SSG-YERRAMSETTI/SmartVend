"""
Seeds the local database with your real business data.

What it does, in order:
  1. Creates the Platform Admin account (skipped if one already exists)
  2. Creates one Organization ("your business") + its Route Owner login
  3. Creates that org's default warehouse
  4. Imports Locations-*.xlsx, Machines-*.xlsx, Products-*.xlsx into the new schema

Run once, after init_db.py:
    cd backend
    python seed_real_data.py --locations "path/to/Locations.xlsx" \
                              --machines  "path/to/Machines.xlsx" \
                              --products  "path/to/Products.xlsx" \
                              --admin-email admin@example.com --admin-password changeme123 \
                              --org-name "My Vending Co" \
                              --owner-email owner@example.com --owner-password changeme123

Safe to re-run: it looks up existing rows by name/sku before inserting, so
running it twice against the same data won't create duplicates.
"""
import argparse
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from db import SessionLocal
from models import User, Organization, Warehouse, Location, Machine, Product
from auth import hash_password

load_dotenv()


def get_or_create_admin(db, email, password):
    admin = db.query(User).filter(User.role == "platform_admin").first()
    if admin:
        print(f"Platform admin already exists ({admin.email}) — skipping.")
        return admin
    admin = User(
        org_id=None,
        email=email,
        password_hash=hash_password(password),
        full_name="Platform Admin",
        role="platform_admin",
    )
    db.add(admin)
    db.flush()
    print(f"Created platform admin: {email}")
    return admin


def get_or_create_org(db, admin, org_name, owner_email, owner_password):
    org = db.query(Organization).filter(Organization.name == org_name).first()
    if org:
        print(f"Organization '{org_name}' already exists — skipping.")
        return org
    org = Organization(name=org_name)
    db.add(org)
    db.flush()

    warehouse = Warehouse(org_id=org.id, name="Main Warehouse", address="")
    db.add(warehouse)

    owner = User(
        org_id=org.id,
        email=owner_email,
        password_hash=hash_password(owner_password),
        full_name="Route Owner",
        role="route_owner",
        created_by=admin.id,
    )
    db.add(owner)
    db.flush()
    print(f"Created organization '{org_name}' with owner {owner_email}")
    return org


def import_locations(db, org_id, path):
    if not path or not Path(path).exists():
        print(f"  Skipping locations — file not found: {path}")
        return {}
    df = pd.read_excel(path)
    name_to_id = {}
    created, skipped = 0, 0
    for _, row in df.iterrows():
        name = str(row.get("Name", "")).strip()
        if not name or name.lower() == "nan":
            continue
        existing = db.query(Location).filter(Location.org_id == org_id, Location.name == name).first()
        if existing:
            name_to_id[name] = existing.id
            skipped += 1
            continue
        loc = Location(
            org_id=org_id,
            name=name,
            address=str(row.get("Address", "")) if pd.notna(row.get("Address")) else "",
            city=str(row.get("City", "")) if pd.notna(row.get("City")) else None,
            zip=str(row.get("ZIP", "")) if pd.notna(row.get("ZIP")) else None,
            working_hours=str(row.get("Working Hours", "")) if pd.notna(row.get("Working Hours")) else None,
            next_visit=row.get("Next Visit") if pd.notna(row.get("Next Visit")) else None,
            commission_type="percentage",
            commission_value=0,  # not present in the VendSoft export — set per-location later in Admin
        )
        db.add(loc)
        db.flush()
        name_to_id[name] = loc.id
        created += 1
    print(f"  Locations: {created} created, {skipped} already existed")
    return name_to_id


def import_machines(db, org_id, path, location_name_to_id):
    if not path or not Path(path).exists():
        print(f"  Skipping machines — file not found: {path}")
        return
    df = pd.read_excel(path)
    created, skipped, unmatched = 0, 0, 0
    for i, row in df.iterrows():
        name = str(row.get("Name", "")).strip()
        telemetry_id = str(row.get("Telemetry ID", "")).strip() if pd.notna(row.get("Telemetry ID")) else None
        # asset_tag/serial aren't in this export — derive stable ones from telemetry ID (unique in the data)
        asset_tag = telemetry_id or f"MACHINE-{i+1}"
        existing = db.query(Machine).filter(Machine.org_id == org_id, Machine.asset_tag == asset_tag).first()
        if existing:
            skipped += 1
            continue

        loc_name = str(row.get("Location", "")).strip()
        location_id = location_name_to_id.get(loc_name)
        if not location_id:
            unmatched += 1

        machine = Machine(
            org_id=org_id,
            name=name,
            asset_tag=asset_tag,
            model="Unknown",  # not present in the VendSoft export — edit in Admin once machine make/model is known
            serial=telemetry_id or asset_tag,
            location_id=location_id,
            column_count=int(row["Columns"]) if pd.notna(row.get("Columns")) else None,
            telemetry_device_id=telemetry_id,
            status="active",
        )
        db.add(machine)
        created += 1
    print(f"  Machines: {created} created, {skipped} already existed, {unmatched} without a matching location")


def import_products(db, org_id, path):
    if not path or not Path(path).exists():
        print(f"  Skipping products — file not found: {path}")
        return
    df = pd.read_excel(path)
    created, skipped, missing_cost = 0, 0, 0
    seen_skus_this_run = {}
    duplicates_found = []
    for _, row in df.iterrows():
        raw_sku = str(row.get("Code", "")).strip()
        if not raw_sku or raw_sku.lower() == "nan":
            continue

        # The source export has a handful of duplicate Codes reused for two
        # different products (e.g. Code 90 = both "Cheetos Crunchy" and
        # "Gatorade (Mix)"). Rather than crash or silently drop one, keep
        # both and make the SKU unique.
        sku = raw_sku
        if raw_sku in seen_skus_this_run:
            seen_skus_this_run[raw_sku] += 1
            sku = f"{raw_sku}-DUP{seen_skus_this_run[raw_sku]}"
            duplicates_found.append((raw_sku, sku, str(row.get("Name", "")).strip()))
        else:
            seen_skus_this_run[raw_sku] = 1

        existing = db.query(Product).filter(Product.org_id == org_id, Product.sku == sku).first()
        if existing:
            skipped += 1
            continue

        cost = row.get("Last Cost")
        cost = float(cost) if pd.notna(cost) else 0.0
        if cost == 0.0:
            missing_cost += 1
        # VendSoft's export has no sell price column — default markup until you set real prices in Admin
        sell_price = round(cost * 1.5, 2) if cost > 0 else 0.0

        product = Product(
            org_id=org_id,
            sku=sku,
            name=str(row.get("Name", "")).strip(),
            category=str(row.get("Type", "Uncategorized")) if pd.notna(row.get("Type")) else "Uncategorized",
            cost_price=cost,
            sell_price=sell_price,
            barcode=str(row.get("Barcode", "")) if pd.notna(row.get("Barcode")) else None,
            active=(str(row.get("Status", "")).strip().lower() == "active"),
            last_supplier=str(row.get("Last Supplier", "")) if pd.notna(row.get("Last Supplier")) else None,
            warehouse_stock=int(row["In Warehouse"]) if pd.notna(row.get("In Warehouse")) else 0,
        )
        db.add(product)
        created += 1
    print(f"  Products: {created} created, {skipped} already existed, {missing_cost} had no cost data (set to $0 — fix in Admin)")
    if duplicates_found:
        print(f"  WARNING: {len(duplicates_found)} product(s) shared a Code with another product in the source file:")
        for original, new_sku, name in duplicates_found:
            print(f"    - Code {original} was reused for '{name}' — imported with SKU {new_sku} instead. Fix the real code in Admin.")
    print(
        "  NOTE: sell prices were not in the source export, so they were auto-set to cost x 1.5. "
        "Update real sell prices in Admin > Products before going live."
    )
    print(
        "  NOTE: some warehouse_stock values in the source data are negative (unreconciled inventory drift "
        "from before the migration) — imported as-is rather than silently zeroed out."
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--locations", default=str(Path(__file__).parent / "seed_data" / "Locations-2026-08-02.xlsx"))
    parser.add_argument("--machines", default=str(Path(__file__).parent / "seed_data" / "Machines-2026-08-02.xlsx"))
    parser.add_argument("--products", default=str(Path(__file__).parent / "seed_data" / "Products-2026-08-02.xlsx"))
    parser.add_argument("--admin-email", default="admin@smartvend.app")
    parser.add_argument("--admin-password", default="ChangeMe123!")
    parser.add_argument("--org-name", default="LMF Investments Vending")
    parser.add_argument("--owner-email", default="investments.lmf@gmail.com")
    parser.add_argument("--owner-password", default="test123")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        admin = get_or_create_admin(db, args.admin_email, args.admin_password)
        org = get_or_create_org(db, admin, args.org_name, args.owner_email, args.owner_password)
        db.commit()

        print(f"\nImporting real data into '{org.name}'...")
        location_map = import_locations(db, org.id, args.locations)
        db.commit()
        import_machines(db, org.id, args.machines, location_map)
        db.commit()
        import_products(db, org.id, args.products)
        db.commit()

        print("\nDone.")
        print(f"  Platform admin login: {args.admin_email} / (the password you passed in)")
        print(f"  Route owner login:    {args.owner_email} / (the password you passed in)")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
