from io import BytesIO
import zipfile

import pytest

from app.document_reader import extract_text, public_filename
from app.errors import AppServiceError
from tests.helpers import build_blank_pdf, build_docx, build_encrypted_pdf, build_text_pdf


def test_valid_pdf_text_is_extracted():
    pdf = build_text_pdf("Revenue reached 42 million in May 2024.")
    text = extract_text("reports/research.pdf", pdf)
    assert "42 million" in text
    assert "May 2024" in text


def test_valid_docx_includes_paragraphs_and_table_text():
    document = build_docx(
        ["The study compared two teaching methods."],
        [["Group", "Score"], ["Control", "71"], ["Trial", "84"]],
    )
    text = extract_text("classroom.docx", document)
    assert "teaching methods" in text
    assert "Control" in text
    assert "84" in text


def test_valid_txt_is_decoded():
    text = extract_text("notes.txt", "Project Atlas starts on 3 March 2026.\n\nBudget: 150000.".encode("utf-8"))
    assert "Project Atlas" in text
    assert "150000" in text


def test_utf8_bom_is_accepted():
    text = extract_text("notes.txt", "Hello from a UTF-8 file.".encode("utf-8-sig"))
    assert text == "Hello from a UTF-8 file."


def test_unsupported_file_type_is_rejected():
    with pytest.raises(AppServiceError) as error:
        extract_text("photo.png", b"\x89PNG\r\n")
    assert error.value.code == "UNSUPPORTED_FILE_TYPE"
    assert error.value.status_code == 415


def test_empty_file_is_rejected():
    with pytest.raises(AppServiceError) as error:
        extract_text("empty.txt", b"")
    assert error.value.code == "EMPTY_FILE"


def test_whitespace_only_text_is_rejected():
    with pytest.raises(AppServiceError) as error:
        extract_text("blank.txt", b"   \n\n  \t")
    assert error.value.code == "NO_EXTRACTABLE_TEXT"


def test_invalid_encoding_is_rejected():
    with pytest.raises(AppServiceError) as error:
        extract_text("latin.txt", bytes([0xC3, 0x28]))
    assert error.value.code == "ENCODING_ERROR"
    assert "UTF-8" in str(error.value)


def test_corrupted_pdf_is_rejected():
    with pytest.raises(AppServiceError) as error:
        extract_text("broken.pdf", b"%PDF-1.4\nthis is not a complete pdf")
    assert error.value.code == "CORRUPTED_PDF"


def test_pdf_extension_with_plain_text_is_rejected():
    with pytest.raises(AppServiceError) as error:
        extract_text("notes.pdf", b"This is plain text, not a PDF.")
    assert error.value.code == "INVALID_DOCUMENT"


def test_pdf_without_extractable_text_explains_ocr_limit():
    with pytest.raises(AppServiceError) as error:
        extract_text("scan.pdf", build_blank_pdf())
    assert error.value.code == "NO_EXTRACTABLE_TEXT"
    assert "OCR" in str(error.value)


def test_encrypted_pdf_is_rejected():
    with pytest.raises(AppServiceError) as error:
        extract_text("secret.pdf", build_encrypted_pdf())
    assert error.value.code == "ENCRYPTED_PDF"


def test_corrupted_docx_is_rejected():
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("word/document.xml", "this is not document xml")
    with pytest.raises(AppServiceError) as error:
        extract_text("broken.docx", buffer.getvalue())
    assert error.value.code == "CORRUPTED_DOCX"


def test_filename_is_not_used_as_a_path():
    text = extract_text(r"..\..\secret.txt", b"A safe in-memory document about rivers.")
    assert "rivers" in text
    assert public_filename(r"..\..\secret.txt") == "secret.txt"


def test_public_filename_removes_unsafe_characters():
    assert public_filename("my report (final).txt") == "my report (final).txt"
    assert "/" not in public_filename("../../etc/passwd.txt")
    assert public_filename("../../etc/passwd.txt") == "passwd.txt"
