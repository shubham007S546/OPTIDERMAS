"""Test persistent consultation history, session resumption, and anti-leakage."""

import sys
import unittest
import uuid
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure app module is in Python path for test execution
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.services.persistence_service import persistence_service

client = TestClient(app)


class TestConversationHistory(unittest.TestCase):

    def setUp(self):
        self.user_id = "test-user-history"

    def test_create_general_conversation(self):
        """Test creating a consultation without an image or analysis."""
        payload = {
            "title": "General Consultation on Sun Protection",
            "analysis_id": None,
            "user_id": self.user_id
        }
        response = client.post("/conversations", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get("ok"))
        self.assertIn("conversation_id", data)
        self.assertIsNone(data.get("analysis_id"))
        self.assertEqual(data.get("title"), "General Consultation on Sun Protection")

    def test_create_analysis_linked_conversation(self):
        """Test creating a consultation linked to an analysis."""
        analysis_id = str(uuid.uuid4())
        # First save mock analysis
        persistence_service.save_analysis({
            "analysis_id": analysis_id,
            "user_id": self.user_id,
            "top_prediction": "melanoma",
            "top_confidence": 0.88,
            "top3": [["melanoma", 0.88], ["nevus", 0.08], ["bcc", 0.04]],
            "morphometrics": {"area": 120, "asymmetry_score": 0.42},
            "gradcam_heatmap": None,
        })

        payload = {
            "title": "Melanoma Analysis Consultation",
            "analysis_id": analysis_id,
            "user_id": self.user_id
        }
        response = client.post("/conversations", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("analysis_id"), analysis_id)

    def test_message_persistence_and_retrieval(self):
        """Test posting turns and verifying chronological message persistence."""
        conv_res = client.post("/conversations", json={"title": "Multi-Turn Chat", "user_id": self.user_id})
        self.assertEqual(conv_res.status_code, 200)
        conv_id = conv_res.json()["conversation_id"]

        # Send first message
        msg_payload = {
            "query": "What is the primary difference between UVA and UVB rays?",
            "conversation_id": conv_id,
            "user_id": self.user_id
        }
        post_res = client.post(f"/conversation/{conv_id}/messages", json=msg_payload)
        self.assertEqual(post_res.status_code, 200)
        data = post_res.json()
        self.assertIn("answer", data)
        self.assertEqual(data["conversation_id"], conv_id)

        # Retrieve conversation history
        get_res = client.get(f"/conversations/{conv_id}?user_id={self.user_id}")
        self.assertEqual(get_res.status_code, 200)
        history = get_res.json()
        messages = history.get("messages", [])
        self.assertGreaterEqual(len(messages), 2)
        # Verify chronological order: user first, assistant second
        self.assertEqual(messages[0]["role"], "user")
        self.assertIn("UVA and UVB", messages[0]["content"])
        self.assertEqual(messages[1]["role"], "assistant")
        self.assertIsNotNone(messages[1].get("timestamp"))

    def test_list_conversations_with_metadata(self):
        """Test listing conversations with preview, count, and sender."""
        # Create a conversation with messages
        conv_res = client.post("/conversations", json={"title": "Preview Test Chat", "user_id": self.user_id})
        conv_id = conv_res.json()["conversation_id"]
        client.post(f"/conversation/{conv_id}/messages", json={
            "query": "How do I care for dry skin in winter?",
            "conversation_id": conv_id,
            "user_id": self.user_id
        })

        list_res = client.get(f"/conversations?user_id={self.user_id}&limit=20")
        self.assertEqual(list_res.status_code, 200)
        conv_list = list_res.json().get("conversations", [])
        self.assertIsInstance(conv_list, list)
        matched = [c for c in conv_list if c["conversation_id"] == conv_id]
        self.assertEqual(len(matched), 1)
        item = matched[0]
        self.assertGreaterEqual(item["message_count"], 2)
        self.assertIsNotNone(item.get("last_message_preview"))
        self.assertEqual(item.get("last_sender"), "assistant")

    def test_rename_conversation(self):
        """Test updating conversation title."""
        conv_res = client.post("/conversations", json={"title": "Original Title", "user_id": self.user_id})
        conv_id = conv_res.json()["conversation_id"]

        patch_res = client.patch(
            f"/conversations/{conv_id}?user_id={self.user_id}",
            json={"title": "Updated Scientific Consultation Title"}
        )
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.json()["title"], "Updated Scientific Consultation Title")

        # Verify get reflects the new title
        get_res = client.get(f"/conversations/{conv_id}?user_id={self.user_id}")
        self.assertEqual(get_res.json()["title"], "Updated Scientific Consultation Title")

    def test_delete_conversation_preserves_analysis(self):
        """Deleting a conversation must remove its messages but never delete the linked analysis."""
        analysis_id = str(uuid.uuid4())
        # 1. Create analysis
        persistence_service.save_analysis({
            "analysis_id": analysis_id,
            "user_id": self.user_id,
            "top_prediction": "basal cell carcinoma",
            "top_confidence": 0.91,
            "top3": [["bcc", 0.91]],
            "morphometrics": {"area": 95},
        })
        # Verify analysis exists
        self.assertIsNotNone(persistence_service.get_analysis(analysis_id))

        # 2. Create conversation linked to this analysis
        conv_res = client.post("/conversations", json={
            "title": "BCC Discussion",
            "analysis_id": analysis_id,
            "user_id": self.user_id
        })
        conv_id = conv_res.json()["conversation_id"]

        # Add a message
        client.post(f"/conversation/{conv_id}/messages", json={
            "query": "What are common signs of BCC?",
            "conversation_id": conv_id,
            "user_id": self.user_id
        })

        # 3. Delete the conversation
        del_res = client.delete(f"/conversations/{conv_id}?user_id={self.user_id}")
        self.assertEqual(del_res.status_code, 200)
        self.assertTrue(del_res.json().get("ok"))

        # Verify conversation is gone
        get_res = client.get(f"/conversations/{conv_id}?user_id={self.user_id}")
        self.assertEqual(get_res.status_code, 404)

        # 4. CRITICAL: Verify the analysis still exists and was not deleted!
        rechecked_analysis = persistence_service.get_analysis(analysis_id)
        self.assertIsNotNone(rechecked_analysis, "Analysis must NOT be deleted when conversation is deleted")
        self.assertEqual(rechecked_analysis["analysis_id"], analysis_id)

    def test_invalid_conversation_id_returns_404(self):
        """Test that invalid conversation IDs return 404 gracefully."""
        bad_id = str(uuid.uuid4())
        get_res = client.get(f"/conversations/{bad_id}")
        self.assertEqual(get_res.status_code, 404)

        patch_res = client.patch(f"/conversations/{bad_id}", json={"title": "New Title"})
        self.assertEqual(patch_res.status_code, 404)

        del_res = client.delete(f"/conversations/{bad_id}")
        self.assertEqual(del_res.status_code, 404)


if __name__ == "__main__":
    unittest.main()
