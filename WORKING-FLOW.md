# How the application works

A document travels through four local programs. Only the extracted text is sent to Amazon Bedrock. The original file stays in memory for that request and is then discarded.

```text
Browser (5173)  →  Express (5000)  →  Python (8000)  →  Amazon Bedrock
                         ↓
                    MongoDB (27017)   history only
```

| Program | Address | Role |
| --- | --- | --- |
| React | http://localhost:5173 | Upload page and history page |
| Express | http://127.0.0.1:5000 | Checks the file, calls Python, saves history |
| Python (FastAPI) | http://127.0.0.1:8000 | Extracts text and calls Bedrock |
| MongoDB | mongodb://127.0.0.1:27017/ai_document_summarizer | Stores summary metadata only |
| Amazon Bedrock | region `ap-south-1`, model `apac.amazon.nova-lite-v1:0` | Writes the summary |

The Python process listens on localhost. It rejects `POST /summarize` unless the `X-Service-Token` header matches the token in the server `.env` files. The browser never receives that token.

## 1. You choose a file

On the dashboard you pick a PDF, DOCX, or TXT file and click **Generate Summary**.

The browser checks the file before sending it:

- the extension must be `pdf`, `docx`, or `txt`
- the file must not be empty
- the file must be 10 MB or smaller

It then sends the file to Express as `multipart/form-data`, in the field `document`:

`POST http://localhost:5000/api/summaries`

## 2. Express checks the file and forwards it

Express keeps the upload in memory with Multer. It does not write the file to disk.

It checks the upload again:

- extension
- size
- opening bytes (the file signature), so a renamed file is rejected
- a safe display name, taken from the base filename only

This route is also rate limited.

Express does not call Bedrock itself. It sends the same bytes to the private Python service:

`POST http://127.0.0.1:8000/summarize`

- form field: `file`
- header: `X-Service-Token`

## 3. Python reads the text and asks Bedrock

Python checks the token, reads the file into memory, and extracts text:

- **PDF:** page text with `pypdf`. Encrypted, corrupt, empty, and textless PDFs return a clear error. Scanned PDFs need OCR and are not supported.
- **DOCX:** paragraphs and table cells with `python-docx`. Macros are not executed.
- **TXT:** UTF-8, including a leading BOM. Other encodings are rejected.

What happens next depends on the length of the extracted text:

- **About 50,000 characters or less:** one Bedrock request.
- **Longer, up to 200,000 characters:** the text is split on paragraph and sentence boundaries into chunks of about 40,000 characters. Each chunk gets a short partial summary. One final Bedrock request combines those notes into the summary.
- **Over 200,000 characters:** the document is rejected. It is not cut off silently.

Bedrock is called with the Converse API. The instructions and the document are separate messages. The document is treated as untrusted text, so instructions inside the file are not followed. The model is asked for 5–10 numbered lines. The exact count can vary. Python strips numbering and markdown, then returns the points and the model id. It does not save the file.

Document contents and prompts are not written to the logs.

## 4. Express saves the summary, not the file

Express checks that the reply is a short list of non-empty points and a model id.

If MongoDB is connected, it stores:

- filename
- file type
- file size
- summary points
- model id
- created time

It does not store the original document or the extracted text.

If MongoDB is down, you still receive the summary. The response includes `persisted: false` and a message that history was not saved.

## 5. The page shows the result

The dashboard lists the numbered points. From that card you can copy the summary or download it as a text file.

**History** loads saved summaries from Express (`GET /api/summaries`), which reads MongoDB. From a saved item you can view, copy, download, or delete it. History routes return an error when the database is unavailable.

## What each request returns

A successful summary looks like this:

```json
{
  "success": true,
  "persisted": true,
  "message": null,
  "summary": {
    "id": "…",
    "filename": "notes.txt",
    "fileType": "txt",
    "fileSize": 209,
    "summary": ["First point.", "Second point."],
    "modelId": "apac.amazon.nova-lite-v1:0",
    "createdAt": "2026-10-30T05:43:45.257Z"
  }
}
```

Failures use this shape:

```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_FILE_TYPE",
    "message": "Upload a PDF, DOCX, or TXT file."
  }
}
```
