"""
The dashboard chat bar's backend. One endpoint (POST /assistant/chat) runs a
full tool-calling loop against Gemini within a single request:
  - read-only tools execute automatically and feed results back to the model
  - the one write tool (confirm_purchase) is NEVER auto-executed — the model
    is told to describe what it wants to do and stop; the frontend shows a
    Confirm/Cancel button, and only a click on Confirm calls
    POST /assistant/execute-action, which actually runs it.

The conversation itself is stateless server-side: the frontend sends the full
visible message history each time (plain {role, content} pairs), and the tool
loop happens invisibly within that one request — intermediate tool calls are
never persisted or replayed, which avoids needing to serialize Gemini's
internal function-call protocol across HTTP requests.
"""
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_db, get_current_user
from models import User
from assistant_tools import READ_ONLY_TOOLS, WRITE_TOOLS, VALID_PAGES

router = APIRouter(prefix="/assistant", tags=["assistant"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("ASSISTANT_GEMINI_MODEL", "gemini-flash-latest")
MAX_TOOL_ITERATIONS = 5

SYSTEM_PROMPT = """You are the operations assistant embedded in SmartVend, a vending machine
management platform. You help the route/machine owner (or their driver) understand what's
happening in their business and navigate the app.

You have read-only tools to look up real data — use them whenever a question needs current
numbers rather than guessing. You have exactly one tool that changes anything
(confirm_purchase) — when a user asks you to confirm a purchase, call it, but the app will
intercept it and ask the user to explicitly approve before it actually runs. Never claim an
action has completed until you're told it has.

If the user seems to want to go to a specific part of the app (e.g. "show me my products",
"take me to purchases"), call navigate_to with the appropriate page.

Be concise. This is a chat bar in a business dashboard, not a long-form assistant — answer in
a few sentences, using real numbers from your tools, not generic advice."""


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


class PendingAction(BaseModel):
    name: str
    label: str
    args: dict


class ChatResponse(BaseModel):
    reply: str
    navigate: Optional[str] = None
    pending_action: Optional[PendingAction] = None


class ExecuteActionRequest(BaseModel):
    name: str
    args: dict


def _build_tool_declarations():
    from google.genai import types
    decls = [
        types.FunctionDeclaration(
            name="get_dashboard_summary", description="Counts of products, machines, locations, active trips, open tickets.",
            parameters_json_schema={"type": "object", "properties": {}},
        ),
        types.FunctionDeclaration(
            name="get_low_stock_products", description="Products at or below their reorder point in the warehouse.",
            parameters_json_schema={"type": "object", "properties": {"limit": {"type": "integer"}}},
        ),
        types.FunctionDeclaration(
            name="get_expiring_batches", description="Inventory batches expiring within N days (default 14).",
            parameters_json_schema={"type": "object", "properties": {"days": {"type": "integer"}}},
        ),
        types.FunctionDeclaration(
            name="get_pending_purchases", description="Receipts uploaded but not yet confirmed into inventory.",
            parameters_json_schema={"type": "object", "properties": {}},
        ),
        types.FunctionDeclaration(
            name="get_open_tickets", description="Maintenance/service tickets that aren't resolved or closed yet.",
            parameters_json_schema={"type": "object", "properties": {}},
        ),
        types.FunctionDeclaration(
            name="get_active_trips", description="Trips that are assigned or in progress (not completed).",
            parameters_json_schema={"type": "object", "properties": {}},
        ),
        types.FunctionDeclaration(
            name="get_margin_snapshot", description="Top products by margin percent (sell price vs. cost from receipts).",
            parameters_json_schema={"type": "object", "properties": {"limit": {"type": "integer"}}},
        ),
        types.FunctionDeclaration(
            name="navigate_to",
            description=f"Send the user to a page in the app. Valid pages: {list(VALID_PAGES.keys())}",
            parameters_json_schema={"type": "object", "properties": {"page": {"type": "string"}}, "required": ["page"]},
        ),
        types.FunctionDeclaration(
            name="confirm_purchase",
            description="Confirm a pending purchase, updating inventory and expenses. Requires the receipt_id from get_pending_purchases.",
            parameters_json_schema={"type": "object", "properties": {"receipt_id": {"type": "string"}}, "required": ["receipt_id"]},
        ),
    ]
    return types.Tool(function_declarations=decls)


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set in backend/.env — required for the assistant")
    if current_user.org_id is None:
        raise HTTPException(status_code=403, detail="Platform admin has no organization data for the assistant to use here")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=GEMINI_API_KEY)
    tool = _build_tool_declarations()
    config = types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT, tools=[tool])

    contents = [
        types.Content(role="user" if m.role == "user" else "model", parts=[types.Part.from_text(text=m.content)])
        for m in payload.messages
    ]

    navigate_result = None

    for _ in range(MAX_TOOL_ITERATIONS):
        response = client.models.generate_content(model=GEMINI_MODEL, contents=contents, config=config)
        candidate = response.candidates[0]
        function_calls = [p.function_call for p in candidate.content.parts if p.function_call]

        if not function_calls:
            reply_text = "".join(p.text for p in candidate.content.parts if p.text) or "..."
            return ChatResponse(reply=reply_text, navigate=navigate_result)

        contents.append(candidate.content)  # the model's turn, including its function call(s)

        response_parts = []
        for fc in function_calls:
            name = fc.name
            args = dict(fc.args or {})

            if name in WRITE_TOOLS:
                # Never auto-execute a write tool — hand it back to the frontend for approval.
                label = f"Confirm purchase from {args.get('receipt_id', 'this receipt')}"
                return ChatResponse(
                    reply="I'm ready to do this — please confirm below.",
                    pending_action=PendingAction(name=name, label=label, args=args),
                )

            if name in READ_ONLY_TOOLS:
                result = READ_ONLY_TOOLS[name](db=db, org_id=current_user.org_id, current_user=current_user, **args)
                if isinstance(result, dict) and "navigate" in result:
                    navigate_result = result["navigate"]
            else:
                result = {"error": f"Unknown tool '{name}'"}

            response_parts.append(types.Part(function_response=types.FunctionResponse(name=name, response={"result": result})))

        contents.append(types.Content(role="user", parts=response_parts))

    return ChatResponse(reply="I wasn't able to finish that within a reasonable number of steps — try asking more specifically.", navigate=navigate_result)


@router.post("/execute-action", response_model=ChatResponse)
def execute_action(payload: ExecuteActionRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Called only when the user clicks Confirm on a pending_action the chat proposed."""
    if current_user.org_id is None:
        raise HTTPException(status_code=403, detail="Platform admin has no organization data for the assistant to use here")
    if payload.name not in WRITE_TOOLS:
        raise HTTPException(status_code=400, detail=f"'{payload.name}' is not an executable action")

    result = WRITE_TOOLS[payload.name](db=db, org_id=current_user.org_id, current_user=current_user, **payload.args)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return ChatResponse(reply=f"Done — {result}")
