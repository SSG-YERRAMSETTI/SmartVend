from datetime import date, timedelta
from sqlalchemy import func
from db import SessionLocal
from models import Product, MachineInventory, DailySalesSummary

def compute_restock_recommendations():
    session = SessionLocal()

    results = []

    # last 7 days
    window_start = date.today() - timedelta(days=7)

    machines = session.query(MachineInventory.machine_id).distinct().all()
    machines = [m[0] for m in machines]

    for machine_id in machines:
        # get all products in this machine
        products = (
            session.query(MachineInventory)
            .filter(MachineInventory.machine_id == machine_id)
            .all()
        )

        for mp in products:
            product_id = mp.product_id

            # 1. Sales in last 7 days
            sold_7d = session.query(
                func.coalesce(func.sum(DailySalesSummary.quantity_sold), 0)
            ).filter(
                DailySalesSummary.machine_id == machine_id,
                DailySalesSummary.product_id == product_id,
                DailySalesSummary.sales_date >= window_start
            ).scalar()

            # 2. Daily demand estimate
            demand_per_day = sold_7d / 7.0

            # 3. Forecast next 3 days
            forecast_3d = demand_per_day * 3

            # 4. Current stock
            current_stock = mp.quantity

            # 5. Recommendation needed?
            if current_stock < forecast_3d:
                needed = int(forecast_3d - current_stock + 1)

                # Get product + explanation
                product = session.query(Product).filter(Product.id == product_id).first()

                results.append({
                    "machine_id": machine_id,
                    "product_id": product_id,
                    "product_name": product.name,
                    "current_stock": current_stock,
                    "predicted_need": forecast_3d,
                    "recommended_restock": needed,
                    "reason": (
                        f"Sold {sold_7d} units in last 7 days "
                        f"({demand_per_day:.1f}/day). "
                        f"Forecast next 3 days is {forecast_3d:.1f}. "
                        f"Stock is {current_stock}, so restock {needed}."
                    )
                })

    session.close()
    return results
