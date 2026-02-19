from __future__ import annotations

import re
import unicodedata

_UNIT_MAP: dict[str, str] = {
    # Speed
    "км/ч": "km/h",
    "km/hour": "km/h",
    "km/hr": "km/h",
    "кm/h": "km/h",
    "кмч": "km/h",
    "m/s": "m/s",
    "м/с": "m/s",
    "м/c": "m/s",
    # Length
    "км": "km",
    "м": "m",
    "см": "cm",
    "мм": "mm",
    "дм": "dm",
    "ft": "ft",
    "in": "in",
    "mi": "mi",
    "yd": "yd",
    # Mass
    "кг": "kg",
    "г": "g",
    "мг": "mg",
    "т": "t",
    "lb": "lb",
    "oz": "oz",
    # Time
    "с": "s",
    "сек": "s",
    "мин": "min",
    "ч": "h",
    "час": "h",
    "мс": "ms",
    # Area
    "м²": "m^2",
    "м2": "m^2",
    "см²": "cm^2",
    "см2": "cm^2",
    "км²": "km^2",
    "км2": "km^2",
    # Volume
    "м³": "m^3",
    "м3": "m^3",
    "см³": "cm^3",
    "см3": "cm^3",
    "л": "L",
    "мл": "mL",
    # Force / Energy / Power
    "н": "N",
    "кн": "kN",
    "дж": "J",
    "кдж": "kJ",
    "вт": "W",
    "квт": "kW",
    "па": "Pa",
    "кпа": "kPa",
    "мпа": "MPa",
    "атм": "atm",
    # Electric
    "в": "V",
    "а": "A",
    "ом": "Ohm",
    "ка": "kA",
    "ма": "mA",
    "кв": "kV",
    "мв": "mV",
    "ф": "F",
    "мкф": "uF",
    "кл": "C",
    # Temperature
    "°c": "°C",
    "°с": "°C",
    "°f": "°F",
    "к": "K",
    # Angle
    "°": "°",
    "град": "°",
    "рад": "rad",
    # Frequency
    "гц": "Hz",
    "кгц": "kHz",
    "мгц": "MHz",
    # Percentage
    "%": "%",
    # Common math
    "π": "pi",
}

_UNIT_KEYS_BY_LENGTH = sorted(_UNIT_MAP.keys(), key=len, reverse=True)

_NUMBER_RE = re.compile(
    r"^([+-]?\d+(?:[.,]\d+)?(?:[eEеЕ][+-]?\d+)?)"
)

_FRACTION_RE = re.compile(
    r"^([+-]?\d+(?:[.,]\d+)?)\s*/\s*(\d+(?:[.,]\d+)?)$"
)


def _clean_unicode(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("\u00a0", " ")
    s = s.replace("\u2212", "-")
    s = s.replace("\u2013", "-")
    s = s.replace("\u2014", "-")
    return s.strip()


def _collapse_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _format_number(n: float) -> str:
    if n == int(n) and abs(n) < 1e15:
        return str(int(n))
    return f"{n:g}"


def _try_parse_number_canon(s: str) -> float | None:
    s = s.replace(",", ".").replace(" ", "").replace("\u00a0", "")
    try:
        return float(s)
    except ValueError:
        pass
    m = _FRACTION_RE.match(s)
    if m:
        num = float(m.group(1).replace(",", "."))
        den = float(m.group(2).replace(",", "."))
        if den != 0:
            return num / den
    return None


def _extract_number_and_rest(s: str) -> tuple[float | None, str]:
    m = _NUMBER_RE.match(s)
    if m:
        num_str = m.group(1).replace(",", ".")
        try:
            num = float(num_str)
            rest = s[m.end():].strip()
            return num, rest
        except ValueError:
            pass
    return None, s


def _normalize_unit(raw_unit: str) -> str | None:
    if not raw_unit:
        return None
    lower = raw_unit.lower().strip()
    if not lower:
        return None
    for key in _UNIT_KEYS_BY_LENGTH:
        if lower == key.lower():
            return _UNIT_MAP[key]
    canonical_values = set(_UNIT_MAP.values())
    if raw_unit in canonical_values:
        return raw_unit
    if lower in {v.lower() for v in canonical_values}:
        for v in canonical_values:
            if v.lower() == lower:
                return v
    return raw_unit


def normalize_for_storage(raw: str) -> str | None:
    if not raw or not raw.strip():
        return None

    cleaned = _clean_unicode(raw)
    cleaned = _collapse_spaces(cleaned)

    if not cleaned:
        return None

    frac = _FRACTION_RE.match(cleaned)
    if frac:
        num = float(frac.group(1).replace(",", "."))
        den = float(frac.group(2).replace(",", "."))
        if den != 0:
            val = num / den
            return _format_number(val)
        return None

    num, rest = _extract_number_and_rest(cleaned)
    if num is not None:
        unit = _normalize_unit(rest) if rest else None
        num_str = _format_number(num)
        if unit:
            return f"{num_str} {unit}"
        return num_str

    pure_num = _try_parse_number_canon(cleaned)
    if pure_num is not None:
        return _format_number(pure_num)

    text = cleaned.lower().strip()
    text = re.sub(r"^[^\w]+|[^\w]+$", "", text)
    text = _collapse_spaces(text)
    return text if text else None


def answers_match(canonical_stored: str, canonical_user: str) -> bool:
    return canonical_stored == canonical_user
