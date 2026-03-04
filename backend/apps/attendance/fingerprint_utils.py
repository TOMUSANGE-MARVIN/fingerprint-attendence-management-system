"""
Fingerprint template matching utilities.
Uses base64-encoded ISO 19794-2 (FMR) templates from Mantra MFS100.
"""
import base64
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def decode_template(base64_template: str) -> bytes:
    """Decode base64 fingerprint template to bytes."""
    try:
        return base64.b64decode(base64_template)
    except Exception as e:
        logger.error(f"Failed to decode fingerprint template: {e}")
        raise ValueError("Invalid fingerprint template encoding")


def encode_template(template_bytes: bytes) -> str:
    """Encode fingerprint template bytes to base64."""
    return base64.b64encode(template_bytes).decode("utf-8")


def match_fingerprint(captured_template: bytes, stored_template: bytes, threshold: float = None) -> tuple:
    """
    Compare two fingerprint templates.
    Returns (is_match: bool, confidence_score: float).
    
    This uses a byte-level comparison approach for ISO 19794-2 FMR templates.
    For production, integrate with sourceafis or Mantra SDK for proper minutiae matching.
    """
    if threshold is None:
        threshold = getattr(settings, "FINGERPRINT_SETTINGS", {}).get("MATCH_THRESHOLD", 60.0)
    
    if not captured_template or not stored_template:
        return False, 0.0
    
    # Simple byte comparison for identical templates (same sensor, same session)
    if captured_template == stored_template:
        return True, 100.0
    
    # For FMR format templates from the same sensor, compare template data
    # Skip header bytes (which may vary) and compare minutiae data
    try:
        # Normalize lengths
        min_len = min(len(captured_template), len(stored_template))
        if min_len < 30:  # Too short to be a valid template
            return False, 0.0
        
        # Skip first 28 bytes (FMR header) and compare minutiae data
        header_size = 28
        captured_data = captured_template[header_size:]
        stored_data = stored_template[header_size:]
        
        min_data_len = min(len(captured_data), len(stored_data))
        if min_data_len == 0:
            return False, 0.0
        
        # Count matching bytes as a simple similarity metric
        matching_bytes = sum(1 for a, b in zip(captured_data[:min_data_len], stored_data[:min_data_len]) if a == b)
        similarity = (matching_bytes / min_data_len) * 100
        
        is_match = similarity >= threshold
        return is_match, round(similarity, 2)
    except Exception as e:
        logger.error(f"Fingerprint matching error: {e}")
        return False, 0.0


def find_matching_student(captured_template: bytes, students_queryset, threshold: float = None):
    """
    Search for matching student among enrolled students (1:N identification).
    Returns (student, confidence) or (None, 0).
    """
    if threshold is None:
        threshold = getattr(settings, "FINGERPRINT_SETTINGS", {}).get("MATCH_THRESHOLD", 60.0)
    
    best_match = None
    best_confidence = 0.0
    
    for student in students_queryset.filter(fingerprint_registered=True):
        if student.fingerprint_template:
            stored_bytes = bytes(student.fingerprint_template)
            is_match, confidence = match_fingerprint(captured_template, stored_bytes, threshold)
            if is_match and confidence > best_confidence:
                best_match = student
                best_confidence = confidence
    
    return best_match, best_confidence
