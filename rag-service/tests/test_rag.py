from types import SimpleNamespace

import main


class WhitespaceTokenizer:
    def encode(self, text, add_special_tokens=False):
        return text.split()

    def decode(self, tokens, skip_special_tokens=True):
        return " ".join(tokens)


def test_chunker_handles_empty_text(monkeypatch):
    monkeypatch.setattr(main, "get_model", lambda: SimpleNamespace(tokenizer=WhitespaceTokenizer()))
    assert main.chunk_text(" \n\n ") == []


def test_chunker_keeps_paragraphs_and_splits_oversized_text(monkeypatch):
    monkeypatch.setattr(main, "get_model", lambda: SimpleNamespace(tokenizer=WhitespaceTokenizer()))
    text = " ".join(f"w{i}" for i in range(160))
    chunks = main.chunk_text(text, chunk_size=64, overlap=8)
    assert len(chunks) >= 3
    assert all(chunk.strip() for chunk in chunks)
    # Sliding windows preserve some boundary context for long paragraphs.
    assert set(chunks[0].split()[-8:]) & set(chunks[1].split()[:8])


def test_self_reference_uses_word_boundaries():
    profile = {"name": "Md Kaif Ali"}
    assert main.is_self_referential_query("Mera CGPA kya hai?", profile)
    assert main.is_self_referential_query("What is Md Kaif Ali's role?", profile)
    assert not main.is_self_referential_query("Explain semester 6 syllabus", profile)


def test_scope_filter_denies_unauthenticated_user():
    clause, params = main._scope_filter(None, "College + Personal")
    assert clause == "FALSE"
    assert params == ()


def test_personal_scope_is_parameterized():
    clause, params = main._scope_filter(42, "Personal Only")
    assert "d.user_id" in clause
    assert params == (42,)


def test_college_scope_checks_current_users_college():
    clause, params = main._scope_filter(42, "College Only")
    assert "d.college_id" in clause
    assert "u.college_id" in clause
    assert params == (42, 42)


def test_unknown_citation_falls_back_to_source_excerpt():
    context = [{"filename": "syllabus.pdf", "content": "The exam is in December."}]
    answer = "The exam is in May. [Source: made-up.pdf]"
    result = main._validate_source_citations(answer, context)
    assert "made-up.pdf" not in result
    assert "syllabus.pdf" in result
    assert "could not be verified" in result


def test_missing_citation_adds_actual_source_label():
    context = [{"filename": "syllabus.pdf", "content": "The exam is in December."}]
    result = main._validate_source_citations("The exam is in December.", context)
    assert "[Source: syllabus.pdf]" in result


def test_valid_citation_is_preserved():
    context = [{"filename": "syllabus.pdf", "content": "The exam is in December."}]
    answer = "The exam is in December. [Source: syllabus.pdf]"
    assert main._validate_source_citations(answer, context) == answer
