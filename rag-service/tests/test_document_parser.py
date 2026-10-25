from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from document_parser import extract_document_pages


def test_plain_text_parser_preserves_exact_phone_format():
    source = b"Contact details\nMobile: +91 98765-43210\nEmail: kaif@example.com"
    pages = extract_document_pages(source, "profile.txt")
    assert pages == [(0, "Contact details\nMobile: +91 98765-43210\nEmail: kaif@example.com")]


def test_empty_plain_text_returns_no_pages():
    assert extract_document_pages(b"  \n\x00", "empty.txt") == []


def test_unsupported_file_type_is_rejected():
    with pytest.raises(ValueError, match="Unsupported file type"):
        extract_document_pages(b"not a file", "notes.exe")
