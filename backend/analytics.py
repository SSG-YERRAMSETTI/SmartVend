# backend/analytics.py
from sqlalchemy import text
from db import SessionLocal

def get_profit_summary():
    """
    Overall revenue, cost, and profit across all machines/products.
    Revenue = quantity_sold * products.sell_price
    Cost    = quantity_sold * avg(receipt_lines.unit_cost per product)
              (fallback to products.cost_price if no receipts)
    """
    sql = text("""
        WITH cost_per_product AS (
            SELECT
                rl.product_id,
                AVG(rl.unit_cost)::numeric(10,2) AS avg_cost
            FROM receipt_lines rl
            WHERE rl.product_id IS NOT NULL
            GROUP BY rl.product_id
        )
        SELECT
            COALESCE(SUM(d.quantity_sold * p.sell_price), 0)::numeric(12,2) AS total_revenue,
            COALESCE(
              SUM(d.quantity_sold * COALESCE(c.avg_cost, p.cost_price)),
              0
            )::numeric(12,2) AS total_cost
        FROM daily_sales_summary d
        JOIN products p ON p.id = d.product_id
        LEFT JOIN cost_per_product c ON c.product_id = d.product_id;
    """)

    with SessionLocal() as session:
        row = session.execute(sql).mappings().first()
        total_revenue = float(row["total_revenue"] or 0)
        total_cost = float(row["total_cost"] or 0)
        return {
            "total_revenue": total_revenue,
            "total_cost": total_cost,
            "total_profit": total_revenue - total_cost,
        }


def get_profit_by_machine():
    """
    Profit breakdown per machine:
    machine_id, machine_name (asset_tag), location_name, revenue, cost, profit.
    """
    sql = text("""
        WITH cost_per_product AS (
            SELECT
                rl.product_id,
                AVG(rl.unit_cost)::numeric(10,2) AS avg_cost
            FROM receipt_lines rl
            WHERE rl.product_id IS NOT NULL
            GROUP BY rl.product_id
        )
        SELECT
            m.id AS machine_id,
            m.asset_tag AS machine_name,
            l.name AS location_name,
            COALESCE(SUM(d.quantity_sold * p.sell_price), 0)::numeric(12,2) AS revenue,
            COALESCE(
              SUM(d.quantity_sold * COALESCE(c.avg_cost, p.cost_price)),
              0
            )::numeric(12,2) AS cost
        FROM daily_sales_summary d
        JOIN products p ON p.id = d.product_id
        JOIN machines m ON m.id = d.machine_id
        JOIN locations l ON l.id = m.location_id
        LEFT JOIN cost_per_product c ON c.product_id = d.product_id
        GROUP BY m.id, m.asset_tag, l.name
        ORDER BY revenue DESC;
    """)

    with SessionLocal() as session:
        rows = session.execute(sql).mappings().all()
        results = []
        for row in rows:
            revenue = float(row["revenue"] or 0)
            cost = float(row["cost"] or 0)
            results.append({
                "machine_id": str(row["machine_id"]),
                "machine_name": row["machine_name"],
                "location_name": row["location_name"],
                "revenue": revenue,
                "cost": cost,
                "profit": revenue - cost,
            })
        return results
