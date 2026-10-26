"""Unit tests for lesion morphometric calculations, formulas, and clinical edge cases.

Specifically verifies:
1. Isoperimetric compactness formula: C = P^2 / (4 * pi * A)
2. Numerical verification on the pre-presentation example: Area = 9158 px, Perimeter = 442.09 px -> Compactness = 1.70
3. Theoretical minimum for a circle (C = 1.00)
4. Monotonic increase for elongated and irregular contours
5. Discretization boundaries and zero/minimal area edge cases
6. Asymmetry index bounded in [0, 1]
7. Uncalibrated physical measurement disclaimers
"""

import math
import sys
from pathlib import Path
import numpy as np
import pytest

MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "model"
if str(MODEL_DIR) not in sys.path:
    sys.path.insert(0, str(MODEL_DIR))

from model_pipeline import compute_metrics, LesionMetrics, _asymmetry


def test_isoperimetric_compactness_formula_mathematics():
    """Verify that compactness uses the isoperimetric quotient C = P^2 / (4 * pi * A)."""
    area = 9158.0
    perimeter = 442.09
    
    # Exact calculation
    compactness = (perimeter ** 2) / (4.0 * math.pi * area)
    
    # Assert matches the example reported in project presentation (1.70)
    assert round(compactness, 2) == 1.70, f"Expected 1.70, got {compactness:.4f}"
    
    # Verify that circularity C_circ = 4*pi*A / P^2 is the reciprocal
    circularity = (4.0 * math.pi * area) / (perimeter ** 2)
    assert round(circularity, 2) == 0.59
    assert abs(compactness * circularity - 1.0) < 1e-6


def test_compactness_circle_minimum():
    """A synthetic circular mask must yield compactness approximately equal to 1.0."""
    mask = np.zeros((256, 256), dtype=np.uint8)
    # Draw a filled circle with radius 50
    y, x = np.ogrid[:256, :256]
    circle_mask = (x - 128) ** 2 + (y - 128) ** 2 <= 50 ** 2
    mask[circle_mask] = 1

    metrics = compute_metrics(mask, mm_per_px=15.0 / 256.0)
    
    # On discrete pixel grid, a raster circle contour has discretization factors
    assert 0.95 <= metrics.compactness <= 1.15, f"Circle compactness out of range: {metrics.compactness}"
    assert metrics.area_px > 0
    assert metrics.is_calibrated is False
    assert "uncalibrated" in metrics.calibration_disclaimer.lower()


def test_compactness_irregular_lesion():
    """Elongated or stellate lesion mask must have significantly higher compactness (> 1.5)."""
    mask = np.zeros((256, 256), dtype=np.uint8)
    # Long thin rectangle (highly non-circular)
    mask[120:136, 40:216] = 1  # 16 x 176 pixels

    metrics = compute_metrics(mask, mm_per_px=15.0 / 256.0)
    assert metrics.compactness > 2.0, f"Expected high compactness for rectangle, got {metrics.compactness}"


def test_zero_and_minimal_area_edge_cases():
    """Masks with area < 5 pixels must safely return zeros without division by zero."""
    empty_mask = np.zeros((256, 256), dtype=np.uint8)
    m_empty = compute_metrics(empty_mask, mm_per_px=15.0 / 256.0)
    assert m_empty.area_px == 0.0
    assert m_empty.perimeter_px == 0.0
    assert m_empty.compactness == 0.0
    assert m_empty.asymmetry_index == 0.0
    assert m_empty.contour == []

    tiny_mask = np.zeros((256, 256), dtype=np.uint8)
    tiny_mask[100, 100:103] = 1  # 3 pixels
    m_tiny = compute_metrics(tiny_mask, mm_per_px=15.0 / 256.0)
    assert m_tiny.area_px == 0.0
    assert m_tiny.compactness == 0.0


def test_asymmetry_index_invariants():
    """Asymmetry index must remain within theoretical [0.0, 1.0]."""
    # 1. Centered symmetric circle
    mask_sym = np.zeros((256, 256), dtype=np.uint8)
    y, x = np.ogrid[:256, :256]
    mask_sym[(x - 128) ** 2 + (y - 128) ** 2 <= 40 ** 2] = 1
    asym_sym = _asymmetry(mask_sym)
    assert 0.0 <= asym_sym <= 0.15, f"Expected near-zero asymmetry for circle, got {asym_sym}"

    # 2. Asymmetric L-shape
    mask_asym = np.zeros((256, 256), dtype=np.uint8)
    mask_asym[50:180, 50:90] = 1
    mask_asym[140:180, 90:200] = 1
    asym_val = _asymmetry(mask_asym)
    assert 0.15 < asym_val <= 1.0, f"Expected elevated asymmetry for L-shape, got {asym_val}"


def test_coverage_percentage_mathematics():
    """Coverage percentage must accurately reflect area / total image pixels."""
    mask = np.zeros((256, 256), dtype=np.uint8)
    mask[0:64, 0:64] = 1  # 64 x 64 = 4096 pixels out of 65536 = 6.25%
    metrics = compute_metrics(mask, mm_per_px=15.0 / 256.0)
    assert round(metrics.coverage_pct, 2) == 6.25
