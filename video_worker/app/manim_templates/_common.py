"""Shared helpers for all Manim scene templates."""
from __future__ import annotations

import re

from manim import (
    LEFT,
    UP,
    MathTex,
    Rectangle,
    RoundedRectangle,
    Text,
    VGroup,
    config,
)

from ._style import (
    BG_ACCENT,
    BG_COLOR,
    DIM,
    FORMULA_COLOR,
    SECTION_LABEL_SCALE,
    TEXT_COLOR,
)

_UNICODE_MAP: dict[str, str] = {
    r"\alpha": "α",
    r"\beta": "β",
    r"\gamma": "γ",
    r"\delta": "δ",
    r"\epsilon": "ε",
    r"\varepsilon": "ε",
    r"\zeta": "ζ",
    r"\eta": "η",
    r"\theta": "θ",
    r"\vartheta": "ϑ",
    r"\iota": "ι",
    r"\kappa": "κ",
    r"\lambda": "λ",
    r"\mu": "μ",
    r"\nu": "ν",
    r"\xi": "ξ",
    r"\pi": "π",
    r"\rho": "ρ",
    r"\sigma": "σ",
    r"\tau": "τ",
    r"\upsilon": "υ",
    r"\phi": "φ",
    r"\varphi": "φ",
    r"\chi": "χ",
    r"\psi": "ψ",
    r"\omega": "ω",
    r"\Gamma": "Γ",
    r"\Delta": "Δ",
    r"\Theta": "Θ",
    r"\Lambda": "Λ",
    r"\Xi": "Ξ",
    r"\Pi": "Π",
    r"\Sigma": "Σ",
    r"\Phi": "Φ",
    r"\Psi": "Ψ",
    r"\Omega": "Ω",
    r"\infty": "∞",
    r"\partial": "∂",
    r"\nabla": "∇",
    r"\int": "∫",
    r"\sum": "Σ",
    r"\prod": "Π",
    r"\leq": "≤",
    r"\le": "≤",
    r"\geq": "≥",
    r"\ge": "≥",
    r"\neq": "≠",
    r"\ne": "≠",
    r"\approx": "≈",
    r"\sim": "∼",
    r"\equiv": "≡",
    r"\pm": "±",
    r"\mp": "∓",
    r"\times": "×",
    r"\cdot": "·",
    r"\div": "÷",
    r"\circ": "∘",
    r"\to": "→",
    r"\rightarrow": "→",
    r"\leftarrow": "←",
    r"\Rightarrow": "⇒",
    r"\Leftarrow": "⇐",
    r"\leftrightarrow": "↔",
    r"\Leftrightarrow": "⇔",
    r"\forall": "∀",
    r"\exists": "∃",
    r"\in": "∈",
    r"\notin": "∉",
    r"\subset": "⊂",
    r"\supset": "⊃",
    r"\cup": "∪",
    r"\cap": "∩",
    r"\emptyset": "∅",
    r"\ldots": "…",
    r"\cdots": "⋯",
    r"\dots": "…",
    r"\quad": "  ",
    r"\qquad": "    ",
    r"\,": " ",
    r"\;": " ",
    r"\!": "",
}

_SUPERSCRIPTS = str.maketrans("0123456789+-=()ni", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ")
_SUBSCRIPTS = str.maketrans("0123456789+-=()aeiourkhmnpstlj", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑᵢₒᵤᵣₖₕₘₙₚₛₜₗⱼ")


def latex_to_text(s: str) -> str:
    """Best-effort conversion of LaTeX markup to readable Unicode text."""
    if not s:
        return s

    text = s

    # \text{...} → inner text
    text = re.sub(r"\\text\{([^}]*)\}", r"\1", text)
    # \mathrm{...}, \mathbf{...}, etc.
    text = re.sub(r"\\math(?:rm|bf|it|cal|bb|sf|tt)\{([^}]*)\}", r"\1", text)
    # \textbf, \textit
    text = re.sub(r"\\text(?:bf|it|rm)\{([^}]*)\}", r"\1", text)
    # \overline{x} → x̄  (append combining overline)
    text = re.sub(
        r"\\overline\{([^}]*)\}",
        lambda m: f"{m.group(1)}\u0304",
        text,
    )
    # \hat{x} → x̂
    text = re.sub(
        r"\\hat\{([^}]*)\}",
        lambda m: f"{m.group(1)}\u0302",
        text,
    )

    # \frac{a}{b} → (a)/(b)
    text = re.sub(r"\\frac\{([^}]*)\}\{([^}]*)\}", r"(\1)/(\2)", text)
    # \dfrac, \tfrac
    text = re.sub(r"\\[dt]frac\{([^}]*)\}\{([^}]*)\}", r"(\1)/(\2)", text)

    # \sqrt[n]{x} → ⁿ√x,  \sqrt{x} → √x
    text = re.sub(r"\\sqrt\[([^\]]*)\]\{([^}]*)\}", r"\1√\2", text)
    text = re.sub(r"\\sqrt\{([^}]*)\}", r"√\1", text)

    # Simple superscripts: ^{2} → ²  (single-char and common combos)
    def _sup_repl(m: re.Match) -> str:
        inner = m.group(1)
        translated = inner.translate(_SUPERSCRIPTS)
        if translated != inner:
            return translated
        return "^" + inner

    text = re.sub(r"\^\{([^}]*)\}", _sup_repl, text)
    text = re.sub(r"\^(\w)", lambda m: m.group(1).translate(_SUPERSCRIPTS) if m.group(1).translate(_SUPERSCRIPTS) != m.group(1) else "^" + m.group(1), text)

    # Simple subscripts: _{i} → ᵢ
    def _sub_repl(m: re.Match) -> str:
        inner = m.group(1)
        translated = inner.translate(_SUBSCRIPTS)
        if translated != inner:
            return translated
        return "_" + inner

    text = re.sub(r"_\{([^}]*)\}", _sub_repl, text)
    text = re.sub(r"_(\w)", lambda m: m.group(1).translate(_SUBSCRIPTS) if m.group(1).translate(_SUBSCRIPTS) != m.group(1) else "_" + m.group(1), text)

    # Apply symbol map (sorted longest-first to avoid partial matches)
    for macro, ch in sorted(_UNICODE_MAP.items(), key=lambda kv: -len(kv[0])):
        text = text.replace(macro, ch)

    # Strip decorators: \left, \right, \big, \Big, \bigg, \Bigg
    text = re.sub(r"\\(?:left|right|[Bb]ig{1,2})\b", "", text)
    # Strip \begin{...}, \end{...}
    text = re.sub(r"\\(?:begin|end)\{[^}]*\}", "", text)
    # Strip any remaining \command (single backslash + letters)
    text = re.sub(r"\\[a-zA-Z]+", "", text)

    # Clean up braces and whitespace
    text = text.replace("{", "").replace("}", "")
    text = re.sub(r"  +", " ", text).strip()
    return text


def _sanitize_latex(s: str) -> str:
    """Pre-process LaTeX string to fix common issues before MathTex."""
    s = s.strip()
    s = s.strip("$")
    # Drop accidental escaping before spaces/Cyrillic letters (e.g. "C\ и\ F")
    s = re.sub(r"\\(?=[\s\u0400-\u04FF])", "", s)
    s = re.sub(r"\\\\\s*$", "", s)
    open_b = s.count("{")
    close_b = s.count("}")
    if open_b > close_b:
        s += "}" * (open_b - close_b)
    elif close_b > open_b:
        s = "{" * (close_b - open_b) + s
    return s


def safe_mathtex(
    latex: str,
    *,
    scale: float = 1.0,
    color: str | None = None,
    fallback_font_size: int = 36,
):
    """Try MathTex with sanitisation; fall back to readable Unicode text."""
    if color is None:
        color = FORMULA_COLOR
    sanitized = _sanitize_latex(latex)
    # MathTex is fragile with Cyrillic snippets; use Text fallback for readability.
    if re.search(r"[\u0400-\u04FF]", sanitized):
        fallback = Text(latex_to_text(sanitized), color=color, font_size=fallback_font_size)
        if scale != 1.0:
            fallback.scale(scale)
        return fallback
    try:
        mob = MathTex(sanitized)
        mob.scale(scale)
        mob.set_color(color)
        return mob
    except Exception:
        pass
    fallback = Text(latex_to_text(latex), color=color, font_size=fallback_font_size)
    if scale != 1.0:
        fallback.scale(scale)
    return fallback


def add_background(scene) -> VGroup:
    """Add a dark themed background to the scene. Returns the bg group."""
    w = config.frame_width * 1.2
    h = config.frame_height * 1.2
    bg = Rectangle(width=w, height=h, fill_opacity=1.0)
    bg.set_fill(color=BG_COLOR)
    bg.set_stroke(opacity=0)
    bg.move_to(scene.camera.frame_center)

    accent_strip = Rectangle(
        width=w, height=h * 0.35, fill_opacity=0.15,
    )
    accent_strip.set_fill(color=BG_ACCENT)
    accent_strip.set_stroke(opacity=0)
    accent_strip.align_to(bg, UP)
    accent_strip.shift(UP * 0.1)

    group = VGroup(bg, accent_strip)
    scene.add(group)
    return group


def section_label(label_text: str) -> Text:
    """Small uppercase section header badge for top-left corner."""
    label = Text(
        label_text.upper(),
        color=DIM,
        font_size=28,
    )
    label.scale(SECTION_LABEL_SCALE)
    label.to_edge(UP, buff=0.35).to_edge(LEFT, buff=0.5)
    return label


def wrap_text_lines(text: str, max_chars: int = 42) -> str:
    """Word-wrap long text into multiple lines."""
    words = text.split()
    lines: list[str] = []
    current_line = ""
    for word in words:
        candidate = f"{current_line} {word}".strip() if current_line else word
        if len(candidate) > max_chars and current_line:
            lines.append(current_line)
            current_line = word
        else:
            current_line = candidate
    if current_line:
        lines.append(current_line)
    return "\n".join(lines)


def safe_fit(mob, max_w: float | None = None, max_h: float | None = None):
    """Scale a mobject down so it fits within max_w and max_h, if given."""
    if max_w is None:
        max_w = config.frame_width * 0.88
    if max_h is None:
        max_h = config.frame_height * 0.85
    if mob.width > max_w:
        mob.scale_to_fit_width(max_w)
    if mob.height > max_h:
        mob.scale_to_fit_height(max_h)
    return mob
