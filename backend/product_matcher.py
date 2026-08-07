from sqlalchemy.orm import Session
from sqlalchemy import select
from rapidfuzz import fuzz, process
from models import Product

def find_or_create_product(session: Session, product_raw: str, unit_cost: float):
    # 1) Exact name match
    stmt = select(Product).where(Product.name.ilike(product_raw))
    existing = session.execute(stmt).scalar_one_or_none()
    if existing:
        return existing

    # 2) Fuzzy match
    all_names = [row[0] for row in session.execute(select(Product.name))]
    if all_names:
        best, score, _ = process.extractOne(product_raw, all_names, scorer=fuzz.WRatio)
        if score >= 85:
            matched = session.execute(select(Product).where(Product.name == best)).scalar_one()
            return matched

    # 3) Create new product
    new_product = Product(
        name=product_raw,
        sku=product_raw.lower().replace(" ", "-")[:50],
        category="unspecified",
        unit_size=None,
        cost_price=unit_cost,
        sell_price=round(unit_cost * 1.5, 2),  # simple markup
        active=True,
    )
    session.add(new_product)
    session.flush()
    return new_product
