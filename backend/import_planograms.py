"""
Imports real per-machine planogram (coil) data from VendSoft exports.

Each file is named `Planogram__<code>__<Machine_Name>-<date>.xlsx` and contains
one row per coil: Column, Current Count, Product Name, Last Count, Max Capacity,
Vend Price, DEX Price, Units Needed.

Matches each file to an existing machine by name (spaces <-> underscores),
matches each Product Name to an existing product by exact name within the org,
and upserts one `slots` row per coil.

Run after seed_real_data.py, once machines and products already exist:
    cd backend
    python import_planograms.py --org-name "LMF Investments Vending"
"""
import argparse
import re
import sys
from pathlib import Path

import pandas as pd

from db import SessionLocal
from models import Organization, Machine, Product, Slot


def parse_filename(path: Path):
    # Planogram__<code>__<Name_With_Underscores>-<date>.xlsx
    m = re.match(r"Planogram__(\d+)__(.+)-\d{4}-\d{2}-\d{2}\.xlsx$", path.name)
    if not m:
        return None, None
    code, raw_name = m.group(1), m.group(2)
    name = raw_name.replace("_-_", " - ").replace("_", " ")
    return code, name


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--org-name", default="LMF Investments Vending")
    parser.add_argument(
        "--dir", default=str(Path(__file__).parent / "seed_data" / "planograms")
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        org = db.query(Organization).filter(Organization.name == args.org_name).first()
        if not org:
            print(f"ERROR: organization '{args.org_name}' not found. Run seed_real_data.py first.")
            sys.exit(1)

        machines_by_name = {
            m.name: m for m in db.query(Machine).filter(Machine.org_id == org.id).all() if m.name
        }
        products_by_name = {
            p.name: p for p in db.query(Product).filter(Product.org_id == org.id).all()
        }

        files = sorted(Path(args.dir).glob("Planogram__*.xlsx"))
        if not files:
            print(f"No planogram files found in {args.dir}")
            sys.exit(1)

        total_coils_created = 0
        total_coils_updated = 0
        unmatched_machines = []
        unmatched_products = set()

        for path in files:
            code, machine_name = parse_filename(path)
            if not machine_name:
                print(f"  Skipping unrecognized filename: {path.name}")
                continue

            machine = machines_by_name.get(machine_name)
            if not machine:
                unmatched_machines.append((path.name, machine_name))
                continue

            df = pd.read_excel(path)
            created, updated = 0, 0
            for _, row in df.iterrows():
                position = str(row["Column"]).strip()
                product_name = str(row.get("Product Name", "")).strip()
                product = products_by_name.get(product_name) if product_name and product_name.lower() != "nan" else None
                if product_name and product_name.lower() != "nan" and not product:
                    unmatched_products.add(product_name)

                capacity = int(row["Max Capacity"]) if pd.notna(row.get("Max Capacity")) else 0
                current_qty = int(row["Current Count"]) if pd.notna(row.get("Current Count")) else 0
                last_count = int(row["Last Count"]) if pd.notna(row.get("Last Count")) else None
                vend_price = float(row["Vend Price"]) if pd.notna(row.get("Vend Price")) else None
                dex_price = float(row["DEX Price"]) if pd.notna(row.get("DEX Price")) else None

                existing = (
                    db.query(Slot)
                    .filter(Slot.machine_id == machine.id, Slot.position == position)
                    .first()
                )
                if existing:
                    existing.product_id = product.id if product else None
                    existing.price_override = vend_price
                    existing.dex_price = dex_price
                    existing.last_count = last_count
                    existing.capacity = capacity
                    existing.current_qty = current_qty
                    existing.par_level = capacity
                    updated += 1
                else:
                    db.add(Slot(
                        machine_id=machine.id,
                        position=position,
                        product_id=product.id if product else None,
                        price_override=vend_price,
                        dex_price=dex_price,
                        last_count=last_count,
                        capacity=capacity,
                        current_qty=current_qty,
                        par_level=capacity,
                    ))
                    created += 1

            db.commit()
            total_coils_created += created
            total_coils_updated += updated
            print(f"  {machine_name} (code {code}): {created} coils created, {updated} updated")

        print(f"\nDone. {total_coils_created} coils created, {total_coils_updated} updated across {len(files)} machines.")

        if unmatched_machines:
            print(f"\nWARNING: {len(unmatched_machines)} planogram file(s) had no matching machine by name:")
            for fname, mname in unmatched_machines:
                print(f"    - {fname} -> looked for machine named '{mname}'")

        if unmatched_products:
            print(f"\nWARNING: {len(unmatched_products)} product name(s) in the planograms had no exact match in the catalog "
                  f"(coil created with no product assigned — fix in Admin):")
            for p in sorted(unmatched_products):
                print(f"    - {p}")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
