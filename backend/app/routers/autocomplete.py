from fastapi import APIRouter
from app.schemas import AutocompleteRequest, AutocompleteResponse
import re

router = APIRouter(tags=["autocomplete"])


def find_token_near_cursor(code: str, cursor: int) -> str:
    """
    Return the identifier fragment that is:
      1) the token that contains the character at cursor-1 (if any), or
      2) the nearest identifier immediately to the left of the cursor, or
      3) the last identifier on the line.
    """
    cursor = max(0, min(len(code), cursor))
    # find line bounds
    line_start = code.rfind("\n", 0, cursor) + 1
    line_end = code.find("\n", cursor)
    if line_end == -1:
        line_end = len(code)
    line_text = code[line_start:line_end]

    # find all identifiers in the line with spans
    matches = list(re.finditer(r"[A-Za-z_][A-Za-z0-9_]*", line_text))
    if not matches:
        return ""

    # absolute cursor position inside the line_text
    pos_in_line = cursor - line_start

    # 1) token that contains cursor-1
    for m in matches:
        if m.start() <= pos_in_line - 1 < m.end():
            return m.group(0)

    # 2) nearest identifier strictly to the left of cursor
    left_matches = [m for m in matches if m.end() <= pos_in_line]
    if left_matches:
        return left_matches[-1].group(0)

    # 3) fallback: last identifier on the line
    return matches[-1].group(0)


def candidate_prefix_match(fragment: str, candidate: str) -> bool:
    """Return True if candidate startswith fragment (case-insensitive)."""
    if not fragment:
        return False
    return candidate.lower().startswith(fragment.lower())


@router.post("/autocomplete", response_model=AutocompleteResponse)
async def autocomplete(req: AutocompleteRequest):
    code = req.code or ""
    cursor = req.cursorPosition if req.cursorPosition is not None else len(code)
    lang = (req.language or "python").lower()

    # clamp
    cursor = max(0, min(len(code), cursor))

    # token detection (robust)
    token = find_token_near_cursor(code, cursor)
    frag = (token or "").lower()

    # compute indent for multi-line templates
    line_start = code.rfind("\n", 0, cursor) + 1
    current_line = code[line_start:cursor]
    indent = ""
    for ch in current_line:
        if ch == " ":
            indent += " "
        else:
            break
    IND = indent

    suggestion = None

    if lang == "python":
        # 1) Exact keyword matches (highest priority)
        if frag in ("import", "imp", "im"):
            # default import suggestion (simple)
            suggestion = "import os"
        elif frag == "def":
            suggestion = f"def function_name(params):\n{IND}    pass"
        elif frag == "return" or frag == "ret":
            suggestion = "return "
        elif frag == "for":
            suggestion = f"for i in range(10):\n{IND}    pass"
        elif frag == "while":
            suggestion = f"while True:\n{IND}    pass"
        elif frag == "if":
            suggestion = f"if condition:\n{IND}    pass"
        elif frag == "elif":
            suggestion = f"elif condition:\n{IND}    pass"
        elif frag == "else":
            suggestion = f"else:\n{IND}    pass"
        elif frag == "class":
            suggestion = (
                f"class MyClass:\n"
                f"{IND}    def __init__(self):\n"
                f"{IND}        pass"
            )
        elif frag == "try":
            suggestion = (
                f"try:\n"
                f"{IND}    pass\n"
                f"{IND}except Exception as e:\n"
                f"{IND}    print(e)"
            )
        elif frag.startswith("print") or frag.startswith("pri"):
            suggestion = "print('Hello World')"
        elif frag.startswith("list") or frag == "ls":
            suggestion = "[]"
        elif frag.startswith("dict") or frag == "di":
            suggestion = "{}"
        elif frag.startswith("set"):
            suggestion = "set()"

        # 2) Short-fragment priority pass:
        # For very short fragments prefer these common keywords first
        if not suggestion and frag:
            short_priority = [
                ("if", f"if condition:\n{IND}    pass"),
                ("elif", f"elif condition:\n{IND}    pass"),
                ("else", f"else:\n{IND}    pass"),
                ("for", f"for i in range(10):\n{IND}    pass"),
                ("while", f"while True:\n{IND}    pass"),
                ("def", f"def function_name(params):\n{IND}    pass"),
                ("class", (
                    f"class MyClass:\n"
                    f"{IND}    def __init__(self):\n"
                    f"{IND}        pass"
                )),
                ("try", (
                    f"try:\n"
                    f"{IND}    pass\n"
                    f"{IND}except Exception as e:\n"
                    f"{IND}    print(e)"
                )),
                ("return", "return "),
                ("continue", "continue"),
            ]
            # check short-priority list first (preserve this order)
            for key, template in short_priority:
                if candidate_prefix_match(frag, key):
                    suggestion = template
                    break

        # 3) Prefix-based fallback: check a short set of common keywords by startswith (insertion order)
        if not suggestion and frag:
            prefix_candidates = {
                "import": "import os",
                "print": "print('Hello World')",
                "list": "[]",
                "dict": "{}",
                "set": "set()",
            }

            for key, template in prefix_candidates.items():
                if candidate_prefix_match(frag, key):
                    suggestion = template
                    break

        # 4) If token looks like an identifier suggest <token>_value
        if not suggestion and token and re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", token):
            suggestion = f"{token}_value"

        # 5) Final fallback
        if not suggestion:
            suggestion = "pass"

    return {"suggestion": suggestion}
