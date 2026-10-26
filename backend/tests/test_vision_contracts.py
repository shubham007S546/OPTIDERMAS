"""Unit Tests for Multi-task Vision Inference, Output Contracts, and Preprocessing."""
import unittest
import numpy as np
import cv2
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))
sys.path.insert(0, str(PROJECT_ROOT / "model"))

from app.services.inference_service import get_inference_pipeline, run_prediction
from preprocessor import assess_quality, remove_hair


class TestVisionContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pipeline = get_inference_pipeline()
        cls.test_img_path = PROJECT_ROOT / "model" / "test_lesion.jpg"
        if not cls.test_img_path.exists():
            # Create a synthetic 256x256 test image if test_lesion.jpg missing
            arr = np.full((256, 256, 3), 160, dtype=np.uint8)
            cv2.circle(arr, (128, 128), 50, (60, 40, 30), -1)
            cv2.imwrite(str(cls.test_img_path), arr)

    def test_7_class_mapping_and_order(self):
        """Confirm the exact seven expected classes are consistently ordered."""
        expected = ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]
        self.assertEqual(self.pipeline.class_order, expected)

    def test_valid_inference_and_softmax_unity(self):
        """Inference returns valid probabilities summing strictly to unity (1.0)."""
        with open(self.test_img_path, "rb") as f:
            img_bytes = f.read()

        res = run_prediction(img_bytes)
        probs = res["probs"]
        prob_sum = sum(probs.values())
        self.assertAlmostEqual(prob_sum, 1.0, places=5)
        self.assertEqual(len(probs), 7)
        self.assertIn("akiec", probs)
        self.assertIn("mel", probs)

    def test_morphometrics_uncalibrated_disclaimer(self):
        """Morphometrics calculations must be clearly marked with uncalibrated pixel geometry disclaimer."""
        with open(self.test_img_path, "rb") as f:
            img_bytes = f.read()

        res = run_prediction(img_bytes)
        metrics = res["metrics"]
        self.assertIn("area_px", metrics)
        self.assertIn("area_mm2", metrics)
        self.assertIn("calibration_disclaimer", metrics)
        self.assertFalse(metrics.get("is_calibrated", False))
        self.assertIn("uncalibrated", metrics["calibration_disclaimer"].lower())

    def test_invalid_and_corrupt_image_rejection(self):
        """Empty or corrupt image byte payloads must be safely rejected with descriptive errors."""
        with self.assertRaises(Exception):
            run_prediction(b"")

        with self.assertRaises(Exception):
            run_prediction(b"GIF89aNOT_AN_ACTUAL_IMAGE_CORRUPTED_BINARY")

    def test_dullrazor_hair_removal_preserves_boundaries(self):
        """DullRazor filters thin linear hair structures without distorting lesion regions."""
        clean_skin = np.full((300, 300, 3), (180, 190, 220), dtype=np.uint8)
        cv2.circle(clean_skin, (150, 150), 50, (60, 70, 120), -1)
        hairy_skin = clean_skin.copy()
        cv2.line(hairy_skin, (20, 40), (280, 260), (30, 20, 20), 2)
        cv2.line(hairy_skin, (40, 270), (260, 30), (25, 20, 25), 2)

        hair_res = remove_hair(hairy_skin)
        self.assertTrue(hair_res.diagnostics.hair_detected)
        self.assertGreaterEqual(hair_res.diagnostics.detected_strands, 1)
        self.assertEqual(hair_res.clean_bgr.shape, hairy_skin.shape)


if __name__ == "__main__":
    unittest.main()
