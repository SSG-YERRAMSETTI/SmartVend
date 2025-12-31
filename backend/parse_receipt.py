import regex as re
from dateutil import parser as dateparser

# Detect vendor names
VENDOR_PAT = re.compile(
    r"(Costco|Sam.?s Club|Metro Cash.?&.?Carry|Walmart|Warehouse Wholesalers|Target|Kroger)",
    re.I,
)

# Costco patterns
# 1) "5 @ 33.79"
COSTCO_QTY_UNIT = re.compile(r"(?P<qty>\d+)\s*@\s*(?P<unit>\d+(?:\.\d+)?)")

# 2) "E 395046 DRPEPP24/. 5L 15.49"
#    "E 383612 OZARKA 20OZ 1.79"
#    "E) 390846 D. COKE 500M 16.39"
COSTCO_SIMPLE_LINE = re.compile(
    r"""^E\)?\s+\d+\s+        # E or E) then item code
        (?P<name>.+?)\s+      # product name (lazy)
        (?P<total>\d+\.\d{2}) # final price at end
        \s*$""",
    re.X,
)

# Sam's Club / generic pickup emails: "Qty 3"
QTY_LINE = re.compile(r"^Qty\s+(?P<qty>\d+)\b", re.I)

# Generic grocery-style: "Some Product Name   3 x 0.55 = 1.65"
GENERIC_LINE_WITH_EQ = re.compile(
    r"""^
    (?P<name>.+?)\s+                 # product name
    (?P<qty>\d+(?:\.\d+)?)\s*[xX]\s* # quantity x
    (?P<unit>\d+(?:\.\d+)?)\s*       # unit price
    =\s*(?P<total>\d+(?:\.\d+)?)\s*$ # total
    """,
    re.X,
)

# Generic fallback: "Product Name something   12.34"
GENERIC_TRAILING_PRICE = re.compile(
    r"""^
    (?P<name>.*?[A-Za-z][A-Za-z0-9\/\-\s]*?)  # must contain at least one letter
    \s+
    (?P<price>\d+\.\d{2})                     # price at end
    \s*$
    """,
    re.X,
)

# Words that indicate non-product monetary lines (subtotal, tax, etc.)
NON_ITEM_KEYWORDS = re.compile(
    r"\b(subtotal|tax|total|change|amount|approved|visa|mastercard|cash|tender|balance)\b",
    re.I,
)


def parse_vendor(text: str):
    m = VENDOR_PAT.search(text)
    return m.group(1) if m else None


def parse_date(text: str):
    """
    Try to find a reasonable date in the receipt text.
    Handles things like 09/26/2025, 9/26/25, 2025-09-26, etc.
    """
    for line in text.splitlines():
        line = line.strip()
        if re.search(r"\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}", line):
            try:
                return dateparser.parse(line, dayfirst=False).date()
            except Exception:
                continue
    return None


def parse_lines(text: str):
    """
    Parse line items from various formats:

    1) Costco wholesale:

       a) Two-line pattern:
          "5 @ 33.79"
          "E 105508 COOKIE/CREME     168.95"

       b) Single-line pattern (many Costco receipts):
          "E 395046 DRPEPP24/. 5L 15.49"
          "E 383612 OZARKA 20OZ 1.79"
          "E) 390846 D. COKE 500M 16.39"

    2) Sam's Club pickup PDF/email:

       Product name line, followed by:
         "Qty 3"

    3) Generic supermarket:
       "Cola 12oz       3 x 0.55 = 1.65"

    4) Generic fallback:
       Any line that looks like "Some Product Name ... 12.34"
       (and doesn't contain words like subtotal, tax, total, etc.)
    """

    lines_out = []

    # For Costco "5 @ 33.79" patterns
    pending_qty = None
    pending_unit = None

    # For Sam's Club name + "Qty N"
    last_name_line = None

    text_lines = text.splitlines()

    for raw in text_lines:
        line = raw.strip()
        if not line:
            continue

        # ---------- pattern 1: generic "name  qty x unit = total" ----------
        m_generic_eq = GENERIC_LINE_WITH_EQ.match(line)
        if m_generic_eq:
            name = m_generic_eq.group("name").strip()
            qty = float(m_generic_eq.group("qty"))
            unit_cost = float(m_generic_eq.group("unit"))
            total_cost = float(m_generic_eq.group("total"))
            lines_out.append(
                {
                    "product_raw": name,
                    "quantity": qty,
                    "unit_cost": unit_cost,
                    "total_cost": total_cost,
                    "raw_line": line,
                }
            )
            continue

        # ---------- pattern 2: Costco qty/unit line: "5 @ 33.79" ----------
        m_qty = COSTCO_QTY_UNIT.search(line)
        if m_qty:
            pending_qty = float(m_qty.group("qty"))
            pending_unit = float(m_qty.group("unit"))
            # don't treat this as a product line itself
            continue

        # ---------- pattern 3: Costco product + total on one line ----------
        m_costco = COSTCO_SIMPLE_LINE.search(line)
        if m_costco:
            name = m_costco.group("name").strip()
            total_cost = float(m_costco.group("total"))

            # Use previous qty/unit if we saw "5 @ 33.79"
            if pending_qty is not None:
                qty = pending_qty
                unit_cost = pending_unit if pending_unit is not None else total_cost / pending_qty
            else:
                # If there's no explicit qty, assume 1
                qty = 1.0
                unit_cost = total_cost

            lines_out.append(
                {
                    "product_raw": name,
                    "quantity": qty,
                    "unit_cost": unit_cost,
                    "total_cost": total_cost,
                    "raw_line": line,
                }
            )

            # reset for next item
            pending_qty = None
            pending_unit = None
            continue

        # ---------- pattern 4: Sam's Club / generic "Qty N" ----------
        m_qty_line = QTY_LINE.match(line)
        if m_qty_line and last_name_line:
            qty = float(m_qty_line.group("qty"))
            name = last_name_line.strip()

            # We don't have price in these emails → set cost to 0 for now
            unit_cost = 0.0
            total_cost = 0.0

            lines_out.append(
                {
                    "product_raw": name,
                    "quantity": qty,
                    "unit_cost": unit_cost,
                    "total_cost": total_cost,
                    "raw_line": f"{name} / {line}",
                }
            )

            # don't clear last_name_line; sometimes multiple Qty lines can follow
            continue

        # ---------- pattern 5: generic fallback "name ... 12.34" ----------
        m_trailing = GENERIC_TRAILING_PRICE.match(line)
        if m_trailing and not NON_ITEM_KEYWORDS.search(line):
            name = m_trailing.group("name").strip()
            price = float(m_trailing.group("price"))

            # treat as qty=1, unit_cost=total_cost
            qty = 1.0
            unit_cost = price
            total_cost = price

            lines_out.append(
                {
                    "product_raw": name,
                    "quantity": qty,
                    "unit_cost": unit_cost,
                    "total_cost": total_cost,
                    "raw_line": line,
                }
            )
            continue

        # ---------- track potential product name line for Sam's Club ----------
        # Heuristic: long-ish line with letters/digits and not starting with "Qty"
        if len(line) > 3 and not line.lower().startswith("qty "):
            last_name_line = line

    return lines_out
