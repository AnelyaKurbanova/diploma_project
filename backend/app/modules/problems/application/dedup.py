from __future__ import annotations

import re


_spaces_re = re.compile(r"[ \t]+")


def normalize_statement_for_dedup(text: str) -> str:
    """Normalize problem statement for strict duplicate detection.

    The goal is to collapse only purely formatting differences while preserving
    all semantic content (numbers, math signs, variables, etc.).
    """
    if not text:
        return ""

                            
    normalized = text.strip()

                                                     
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")

                                                             
    normalized = _spaces_re.sub(" ", normalized)

    return normalized

