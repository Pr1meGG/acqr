import os
import json
import re
from typing import Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "database", "bpeid_index.json")

_BPEID_DATABASE = {}

try:
    if os.path.exists(DB_PATH):
        with open(DB_PATH, "r", encoding="utf-8") as f:
            _BPEID_DATABASE = json.load(f)
        print(f"[BPEID Retriever] Loaded {len(_BPEID_DATABASE)} educational error schemas successfully.")
    else:
        print(f"[BPEID Retriever] Warning: BPEID index database file not found at {DB_PATH}")
except Exception as e:
    print(f"[BPEID Retriever] Error loading BPEID database: {e}")


def find_bpeid_record(message_id: Optional[str], message: str) -> Optional[Dict[str, Any]]:
    """
    Search the BPEID index to locate an educational card matching the error.
    Retrieval follows a multi-tiered fallback signature matching strategy:
    1. Direct match on linter match_keys (e.g. W0102, shadows-builtin).
    2. Case-insensitive substring matching in match_keys/category names.
    3. Regex matching of error message against signature.regex_pattern.
    """
    if not message:
        return None
        
    msg_lower = message.lower()
    
    # Tier 1: Look by Direct match of linter message_id / message-id
    if message_id:
        for record_id, record in _BPEID_DATABASE.items():
            sig = record.get("signature", {})
            match_keys = sig.get("match_keys", [])
            if any(message_id == key or message_id.lower() == key.lower() for key in match_keys):
                return record
                
    # Tier 2: Substring matching in signature match keys
    for record_id, record in _BPEID_DATABASE.items():
        sig = record.get("signature", {})
        match_keys = sig.get("match_keys", [])
        
        # Check if the error message contains any key identifier in the match keys
        for key in match_keys:
            if key.lower() in msg_lower:
                return record
                
    # Tier 3: Regex pattern scanning on error message
    for record_id, record in _BPEID_DATABASE.items():
        sig = record.get("signature", {})
        pattern = sig.get("regex_pattern")
        if pattern:
            try:
                if re.search(pattern, message, re.IGNORECASE):
                    return record
            except Exception:
                pass
                
    return None
