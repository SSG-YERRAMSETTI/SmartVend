"""
Reads a receipt (as one or more page images) and returns structured purchase
data: vendor, date, and line items matched against the org's product catalog.

Two-stage design, per the architecture we settled on:
  1. OCR/vision extraction — reads the image, produces text/markdown.
     Provider: GLM-OCR (Zhipu, hosted) — cheap, fast, purpose-built for this.
  2. Reasoning — takes that raw extraction (or the images directly) and
     figures out what was actually bought: matches abbreviated names against
     your catalog, infers case-pack quantities, classifies discount/void
     lines, flags anything it isn't confident about.
     Provider: Claude (Anthropic) — this is the part that needs real judgment,
     not just character recognition.

Set RECEIPT_AI_PROVIDER in backend/.env to choose:
  - "claude_vision" (default): sends receipt images directly to Claude, which does
    extraction + reasoning in one pass. Needs ANTHROPIC_API_KEY (paid).
  - "gemini_vision": sends receipt images directly to Google Gemini — genuinely free
    (no credit card, ~1,500 requests/day), native vision, does extraction + reasoning
    in one pass same as Claude. Needs GEMINI_API_KEY from https://aistudio.google.com.
  - "glm_ocr": calls Zhipu's hosted GLM-OCR API for extraction first, then passes that
    text to Claude for the reasoning/matching step. Needs both ZHIPU_API_KEY and
    ANTHROPIC_API_KEY.
"""
import base64
import json
import os
from pathlib import Path
from typing import List, Dict, Any

import requests

RECEIPT_AI_PROVIDER = os.getenv("RECEIPT_AI_PROVIDER", "claude_vision")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ZHIPU_API_KEY = os.getenv("ZHIPU_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
CLAUDE_MODEL = os.getenv("RECEIPT_AI_MODEL", "claude-sonnet-4-5")
GEMINI_MODEL = os.getenv("RECEIPT_AI_GEMINI_MODEL", "gemini-flash-latest")

SYSTEM_PROMPT = """You are reading a purchase document (wholesale club receipt, fuel receipt, repair
invoice, equipment purchase, or similar) for a vending machine operator's business system.

FIRST, decide what kind of document this is:
- "inventory_purchase" — buying products to stock in vending machines (Costco/Sam's Club style
  product receipts).
- "expense" — anything that is NOT inventory: fuel, vehicle repair/maintenance, a replacement
  card reader or other equipment, insurance, supplies, tolls, etc.

Return ONLY valid JSON matching this shape, no other text:
{
  "document_type": "inventory_purchase" | "expense",
  "vendor_name": string,
  "receipt_date": "YYYY-MM-DD" or null,
  "receipt_time": "HH:MM" or null,
  "total_amount": number or null,

  // Fill this in ONLY when document_type is "expense". Leave lines empty ([]) in that case.
  "expense_category": "Fuel" | "Vehicle Maintenance" | "Equipment" | "Supplies" | "Tolls" | "Insurance" | "Other" | null,

  // Fill this in ONLY when document_type is "inventory_purchase". Leave [] for expense documents.
  "lines": [
    {
      "product_raw": string,          // the product text exactly as printed
      "line_type": "product" | "discount" | "void" | "unknown",
      "quantity": number,             // how many CASES/UNITS were bought (count repeated
                                       // identical lines as separate quantity if the
                                       // receipt has no explicit qty column — e.g. two
                                       // "SPRITE" lines = quantity 2)
      "units_per_case": number or null,  // individual packets per case/unit, if the
                                          // receipt states it (e.g. "24 pk", "46 pk")
                                          // otherwise null — do not guess from memory.
                                          // If you have a web search tool available and this
                                          // is a real, identifiable retail product with no
                                          // stated pack size, you may use it to look up the
                                          // likely case-pack size for that exact product at
                                          // that exact retailer (e.g. "Costco Kirkland almonds
                                          // pack size"). Only do this for products not already
                                          // listed in "known packaging" below — those are
                                          // already confirmed by the user, don't re-search them.
                                          // If search doesn't turn up a confident answer, leave
                                          // this null rather than guessing.
      "unit_price": number or null,   // price per case/unit
      "line_total": number or null,
      "matched_product_name": string or null,  // your best match from the provided
                                                 // catalog list (exact string from the
                                                 // list), or null if nothing reasonable matches
      "match_confidence": "matched" | "new" | "needs_review",
      "reasoning": string  // one short phrase on why you matched (or didn't), and note if you
                            // used a web search to determine units_per_case
    }
  ]
}

Rules:
- VOID sections: include those lines with line_type "void" — they must NOT count toward inventory.
- Discount / "Instant Savings" / coupon adjustment lines: line_type "discount", not a product.
- Some receipts list one row per case bought instead of a quantity column (repeated identical
  rows). In that case set quantity to the count of matching rows, not 1.
- Wholesale-club receipts often abbreviate names harshly (e.g. "FARLF NP CHF", "CHTOS CHD/JL",
  "MSS VKS JALA"). Use brand/price/category context to reason out the likely full product,
  and match it against the provided catalog list if a reasonable candidate exists.
- units_per_case: only fill this if the receipt text states a pack size (e.g. "24 pk", "36 CT"),
  it's already in "known packaging" below (copy that value), or a web search confidently answers
  it. Otherwise leave it null rather than guessing — the app will ask the user, and remember
  their answer for this exact product+supplier combination from then on.
- If a line has no price at all, set unit_price and line_total to null and match_confidence to
  "needs_review" — never invent a price.
- match_confidence "new": no existing catalog product is a reasonable match, this looks like a
  genuinely new product.
- match_confidence "needs_review": you're not confident (ambiguous abbreviation, missing price,
  garbled text, etc.) — surface it rather than guessing.
- For "expense" documents: total_amount should be the full amount paid. Pick the closest
  expense_category from the allowed list — use "Other" only if genuinely nothing fits.
"""


def _image_to_b64(path: Path) -> Dict[str, str]:
    data = base64.standard_b64encode(path.read_bytes()).decode("utf-8")
    media_type = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    return {"media_type": media_type, "data": data}


def _catalog_prompt(org_products: List[Dict[str, Any]], known_packaging: List[Dict[str, Any]] = None) -> str:
    lines = [f"- {p['name']} (sku {p['sku']}, category {p['category']})" for p in org_products]
    catalog_text = "Existing product catalog to match against:\n" + "\n".join(lines) if lines else "Existing product catalog: (empty — everything will be a new product)"

    if known_packaging:
        pack_lines = [f"- {kp['product_name']} from {kp['supplier_name']}: {kp['units_per_case']} units per case" for kp in known_packaging]
        catalog_text += "\n\nKnown packaging (already confirmed by the user — reuse these, don't re-search):\n" + "\n".join(pack_lines)

    return catalog_text


def _call_claude_vision(image_paths: List[Path], org_products: List[Dict[str, Any]], known_packaging: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set in backend/.env — required for RECEIPT_AI_PROVIDER=claude_vision")

    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    content = []
    for p in image_paths:
        img = _image_to_b64(p)
        content.append({"type": "image", "source": {"type": "base64", **img}})
    content.append({"type": "text", "text": _catalog_prompt(org_products, known_packaging) + "\n\nExtract this receipt as JSON."})

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )
    text = "".join(block.text for block in response.content if hasattr(block, "text"))
    return _parse_json_response(text)


def _call_glm_ocr(image_paths: List[Path]) -> str:
    """Stage 1: raw extraction via Zhipu's hosted GLM-OCR API."""
    if not ZHIPU_API_KEY:
        raise RuntimeError("ZHIPU_API_KEY not set in backend/.env — required for RECEIPT_AI_PROVIDER=glm_ocr")

    all_text = []
    for p in image_paths:
        img = _image_to_b64(p)
        data_uri = f"data:{img['media_type']};base64,{img['data']}"
        resp = requests.post(
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            headers={"Authorization": f"Bearer {ZHIPU_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": "glm-ocr",
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_uri}},
                        {"type": "text", "text": "Text Recognition:"},
                    ],
                }],
            },
            timeout=60,
        )
        resp.raise_for_status()
        result = resp.json()
        all_text.append(result["choices"][0]["message"]["content"])
    return "\n\n--- page break ---\n\n".join(all_text)


def _call_claude_reasoning_on_text(raw_text: str, org_products: List[Dict[str, Any]], known_packaging: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Stage 2: reasoning/matching over GLM-OCR's raw text output."""
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set in backend/.env — required for the reasoning stage")

    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    prompt = f"{_catalog_prompt(org_products, known_packaging)}\n\nRaw OCR text extracted from the receipt:\n{raw_text}\n\nExtract this receipt as JSON."
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(block.text for block in response.content if hasattr(block, "text"))
    return _parse_json_response(text)


def _call_gemini_vision(image_paths: List[Path], org_products: List[Dict[str, Any]], known_packaging: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Free-tier option: Google Gemini, native vision + generous no-card free quota.

    Google Search grounding is enabled so the model can look up a product's real
    case-pack size when the receipt doesn't state one, instead of guessing from
    training memory — see the "units_per_case" instructions in SYSTEM_PROMPT."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not set in backend/.env — required for RECEIPT_AI_PROVIDER=gemini_vision")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=GEMINI_API_KEY)

    parts = []
    for p in image_paths:
        img = _image_to_b64(p)
        parts.append(types.Part.from_bytes(data=base64.standard_b64decode(img["data"]), mime_type=img["media_type"]))
    parts.append(types.Part.from_text(text=_catalog_prompt(org_products, known_packaging) + "\n\nExtract this receipt as JSON."))

    search_tool = types.Tool(google_search=types.GoogleSearch())
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[types.Content(role="user", parts=parts)],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT, max_output_tokens=4096, tools=[search_tool],
        ),
    )
    return _parse_json_response(response.text)


def _parse_json_response(text: str) -> Dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


VOICE_FILL_SYSTEM_PROMPT = """You are helping a warehouse worker fill in expiration dates and
case-pack sizes for a purchase receipt by voice, hands-free, while counting boxes.

You'll get a numbered list of coil/product lines from the current receipt, each showing whether
its "units per case" and "expiration date" are already set. You'll also get an audio recording
of the person speaking. They say a product name, then an expiration date, and — only if that
line's units-per-case is still missing — how many units per case. They say "next" to move to the
next line, or "skip" to leave a line untouched. They may correct themselves mid-recording; if
they clearly restate something, use their latest statement, not the first one.

Return ONLY valid JSON, no other text:
{
  "transcript": string,  // your best transcription of the whole recording, for the user to read back
  "actions": [
    {
      "line_number": number,       // which numbered line this refers to, from the list given
      "expiration_date": "YYYY-MM-DD" or null,
      "units_per_case": number or null,
      "skip": boolean              // true if they said "skip" for this line
    }
  ]
}

If you can't confidently match what was said to any line in the list, omit that action rather
than guessing at a line_number. Interpret relative dates (e.g. "expires in one month", "end of
September") against today's date if given."""


def parse_voice_fill(audio_bytes: bytes, mime_type: str, product_lines: List[Dict[str, Any]], today: str) -> Dict[str, Any]:
    """Sends a voice recording + the receipt's current product lines to Gemini,
    and gets back a transcript plus structured per-line fill actions.

    product_lines: list of {"line_number": int, "product_raw": str, "units_per_case": int|None, "expiry_date": str|None}
    """
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not set in backend/.env — required for voice fill")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=GEMINI_API_KEY)

    lines_text = "\n".join(
        f"{l['line_number']}. {l['product_raw']} — units/case: {l['units_per_case'] or 'NOT SET'}, "
        f"expiry: {l['expiry_date'] or 'NOT SET'}"
        for l in product_lines
    )
    prompt_text = f"Today's date: {today}\n\nLines on this receipt:\n{lines_text}\n\nHere is the recording:"

    parts = [
        types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
        types.Part.from_text(text=prompt_text),
    ]
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[types.Content(role="user", parts=parts)],
        config=types.GenerateContentConfig(system_instruction=VOICE_FILL_SYSTEM_PROMPT, max_output_tokens=2048),
    )
    return _parse_json_response(response.text)


def extract_receipt(image_paths: List[Path], org_products: List[Dict[str, Any]], known_packaging: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Main entry point. Returns the structured dict described in SYSTEM_PROMPT,
    plus 'extraction_provider' noting which pipeline produced it.

    known_packaging: list of {"product_name", "supplier_name", "units_per_case"} the
    org has already confirmed before — passed as context so the model reuses them
    instead of asking again or re-searching."""
    if RECEIPT_AI_PROVIDER == "glm_ocr":
        raw_text = _call_glm_ocr(image_paths)
        result = _call_claude_reasoning_on_text(raw_text, org_products, known_packaging)
        result["_raw_text"] = raw_text
        result["extraction_provider"] = "glm_ocr"
        return result
    elif RECEIPT_AI_PROVIDER == "claude_vision":
        result = _call_claude_vision(image_paths, org_products, known_packaging)
        result["extraction_provider"] = "claude_vision"
        return result
    elif RECEIPT_AI_PROVIDER == "gemini_vision":
        result = _call_gemini_vision(image_paths, org_products, known_packaging)
        result["extraction_provider"] = "gemini_vision"
        return result
    else:
        raise ValueError(
            f"Unknown RECEIPT_AI_PROVIDER '{RECEIPT_AI_PROVIDER}' — use 'claude_vision', 'gemini_vision', or 'glm_ocr'"
        )
