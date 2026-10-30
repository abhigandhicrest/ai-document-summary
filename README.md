# AI Document Summarizer

Upload a PDF, DOCX, or TXT document and get a short summary of about 5–10 numbered lines. A React app sends the file to an Express API. Express checks the file and forwards it to a private Python service. Python extracts the text and asks Amazon Bedrock to summarize it. Express can store the summary metadata in MongoDB. The original document is not stored.

```text
Browser (React, Vite)
        |  POST /api/summaries
        v
Express API  ---- optional ----> MongoDB (filename, size, summary, model id)
        |  POST /summarize + private token, localhost only
        v
FastAPI service
        |  extract text, then Bedrock Converse API
        v
Amazon Bedrock
```

Amazon Bedrock is the only model provider. The app does not call OpenAI, Gemini, or any other LLM API.

## Prerequisites

- Node.js 20 or newer, with npm
- Python 3.11 or newer (this project was developed with Python 3.14)
- MongoDB Community Server, or a MongoDB Atlas database, for summary history
- An AWS account with Amazon Bedrock model access in your chosen Region
- AWS CLI v2, configured with a profile or IAM role

The AWS credential chain is the normal one used by the AWS CLI and Boto3. Do not put access keys in source files or `.env` files.

On this style of Laragon setup, Node.js may be installed but missing from `PATH`. A typical location is `laragon\bin\nodejs\node-v22*\`. Add that folder to `PATH` before running the npm commands below.

## Project layout

```text
frontend/     React + Vite + Bootstrap 5
backend/      Express + Mongoose
ai-service/   FastAPI + document extraction + Bedrock
```

Vite also needs `frontend/index.html` and `frontend/vite.config.js`. The Python package keeps settings in `ai-service/app/config.py` and shared errors in `ai-service/app/errors.py`. Express keeps file checks, uploads, and the history store in small modules next to the files from the original layout. Uploaded documents are handled in memory, so `backend/uploads/` is not used for storage.

## MongoDB setup

Install [MongoDB Community Server](https://www.mongodb.com/try/download/community) and start the service, or create a free Atlas cluster.

Local default:

```text
mongodb://127.0.0.1:27017/ai_document_summarizer
```

On this computer, MongoDB 9.0.4 is unpacked under Laragon and is not installed as a Windows service. Start it with:

```powershell
D:\laragon\bin\mongodb\mongodb-win32-x86_64-windows-9.0.4\bin\mongod.exe --dbpath D:\laragon\data\mongodb --bind_ip 127.0.0.1 --port 27017
```

Summarization still works when MongoDB is down. History requests then return `503 DATABASE_UNAVAILABLE`, and a new summary is returned with `persisted: false`. A summary is never reported as saved when the database write fails.

## AWS and Amazon Bedrock

1. Sign in to the AWS account you want to use.
2. Choose a Region. The sample configuration uses `ap-south-1` (Mumbai). Confirm the model exists there:

   ```bash
   aws bedrock list-foundation-models --region ap-south-1 --by-output-modality TEXT
   ```

3. In the Bedrock console, enable or request access to **Amazon Nova Lite** if your account still requires model access.
4. Set `BEDROCK_MODEL_ID` to a model that supports the [Bedrock Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html). In `ap-south-1`, Nova Lite must use the inference profile `apac.amazon.nova-lite-v1:0`. The foundation model ID `amazon.nova-lite-v1:0` is rejected for on-demand requests.

The Python service uses `bedrock-runtime` and the Converse API. The trusted summarization instructions are sent as the system prompt. The document text is sent separately as the user message and is labeled as untrusted data.

### IAM permissions

Attach a policy like this to the IAM user or role that the AWS CLI profile uses. Replace the Region and model ID if you change them. This permission allows model invocation and can incur charges. It does not create infrastructure.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InvokeSummarizerModel",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": [
        "arn:aws:bedrock:ap-south-1::foundation-model/amazon.nova-lite-v1:0",
        "arn:aws:bedrock:ap-south-1:YOUR_ACCOUNT_ID:inference-profile/apac.amazon.nova-lite-v1:0"
      ]
    }
  ]
}
```

The `ap-south-1` sample uses the `apac.amazon.nova-lite-v1:0` inference profile, so the policy needs both the profile and the underlying foundation model. Replace `YOUR_ACCOUNT_ID` with the account number from `aws sts get-caller-identity`.

Configure credentials with one of these methods:

```bash
aws configure
```

or, for a named profile:

```bash
aws configure --profile your-profile-name
set AWS_PROFILE=your-profile-name
```

Do not create long-lived access keys inside this repository.

Automated tests mock Bedrock. They do not call AWS and do not create a charge. A real summary from the running app does call Bedrock and is billed by AWS.

## Install dependencies

From the repository root, in PowerShell:

```powershell
cd frontend
copy .env.example .env
npm install

cd ..\backend
copy .env.example .env
npm install

cd ..\ai-service
py -3.14 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
copy .env.example .env
```

Use the same `PYTHON_SERVICE_TOKEN` in `backend/.env` and `ai-service/.env`. Replace the sample token before anyone else can reach the machine. Change `MONGODB_URI` if your database is not on localhost. Change `AWS_REGION` and `BEDROCK_MODEL_ID` if you are not using Nova Lite in `ap-south-1`.

`MAX_FILE_SIZE_MB` in the Express `.env` and `MAX_UPLOAD_MB` in the Python `.env` should stay the same. The upload limit shown in the React page is 10 MB (`frontend/src/constants.js`). Update that constant if you change the server limit.

## Environment variables

### Frontend (`frontend/.env`)

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Public Express URL, for example `http://localhost:5000` |

Only `VITE_` variables are visible to the browser. Do not put the Python URL, service token, AWS credentials, or model ID in the frontend.

### Express (`backend/.env`)

| Variable | Purpose |
| --- | --- |
| `PORT` | API port, default `5000` |
| `HOST` | Bind address, default `127.0.0.1` |
| `MONGODB_URI` | MongoDB connection string |
| `PYTHON_SERVICE_URL` | Private Python base URL, `http://127.0.0.1:8000` |
| `PYTHON_SERVICE_TOKEN` | Shared secret sent only from Express to Python |
| `FRONTEND_ORIGIN` | Allowed browser origin. Separate several origins with commas |
| `MAX_FILE_SIZE_MB` | Upload limit, initially `10` |

Optional: `AI_REQUEST_TIMEOUT_MS` (default 120000), `RATE_LIMIT_MAX` (default 20 summary requests per 15 minutes per IP).

### Python (`ai-service/.env`)

| Variable | Purpose |
| --- | --- |
| `HOST` | Bind address. Keep `127.0.0.1` |
| `PORT` | Default `8000` |
| `AWS_REGION` | Bedrock Region |
| `BEDROCK_MODEL_ID` | Foundation model or inference profile ID |
| `MAX_DOCUMENT_CHARACTERS` | Hard cap for extracted text, default `200000` |
| `MAX_OUTPUT_TOKENS` | Model output cap, default `800` |
| `PYTHON_SERVICE_TOKEN` | Same value as the Express token |
| `MAX_UPLOAD_MB` | Optional upload cap, default `10` |

AWS access keys are intentionally absent.

## Run the app locally

Use three terminals.

Terminal 1, Python:

```powershell
cd ai-service
.\.venv\Scripts\Activate.ps1
python -m app.main
```

Terminal 2, Express. Make sure `node` and `npm` are on `PATH`.

```powershell
cd backend
npm run dev
```

Terminal 3, React:

```powershell
cd frontend
npm run dev
```

| Service | URL |
| --- | --- |
| React | http://localhost:5173 |
| Express health | http://127.0.0.1:5000/api/health |
| Python health | http://127.0.0.1:8000/health |
| Python API docs | http://127.0.0.1:8000/docs |

The Python process listens on localhost and rejects `/summarize` unless the `X-Service-Token` header matches. The browser never receives that token. Do not expose port 8000 to the internet.

## How a summary is produced

1. The browser sends one file as `multipart/form-data` in the field `document`.
2. Express checks the extension, size, and file signature. The client MIME type is not trusted by itself.
3. Express sends the bytes to Python as the field `file`, with the service token.
4. Python checks the format again and extracts text.
   - PDF: page text via PyPDF. Encrypted, corrupt, empty, and textless PDFs return a clear error. Scanned PDFs need OCR and are not supported.
   - DOCX: paragraphs and table cells via python-docx. Macros are not executed.
   - TXT: UTF-8, including a leading BOM. Other encodings are rejected.
5. Whitespace is collapsed, and blank lines stay as paragraph breaks.
6. Text up to 50,000 characters is summarized in one Bedrock request. Larger text, up to `MAX_DOCUMENT_CHARACTERS`, is split on paragraph and sentence boundaries, summarized in parts, and then combined into the final summary. Text over the configured character limit is rejected instead of being cut off silently.
7. The model is asked for 5–10 numbered lines. The result is shown as a numbered list. The exact line count can vary.
8. If MongoDB is connected, Express stores the filename, type, size, summary points, and model ID. It does not store the document text.

Document contents and prompts are not written to the logs.

## API

Error responses use this shape:

```json
{
  "success": false,
  "error": { "code": "UNSUPPORTED_FILE_TYPE", "message": "Upload a PDF, DOCX, or TXT file." }
}
```

### Python

`GET /health`

```json
{ "status": "ok" }
```

This does not call Bedrock.

`POST /summarize`

Header: `X-Service-Token: <shared token>`

Form field: `file`

```json
{
  "success": true,
  "filename": "research.pdf",
  "summary": ["The document states its main finding."],
  "model": "amazon.nova-lite-v1:0"
}
```

The summary above is only an example of the JSON shape. A running service returns text generated from the uploaded document. The extracted document is not included in the response.

### Express

`GET /api/health`

Reports whether Express is up, whether MongoDB is connected, and whether the Python health check succeeded. It does not include secrets or service URLs.

`POST /api/summaries`

Form field: `document`

```json
{
  "success": true,
  "persisted": true,
  "message": null,
  "summary": {
    "id": "64b7f3a2c1d4e5f678901234",
    "filename": "notes.txt",
    "fileType": "txt",
    "fileSize": 128,
    "summary": ["The note records the launch date."],
    "modelId": "amazon.nova-lite-v1:0",
    "createdAt": "2026-03-03T10:00:00.000Z"
  }
}
```

When MongoDB is unavailable, `persisted` is `false`, `id` is `null`, and `message` explains that history was not saved. The summary itself is still returned.

`GET /api/summaries?page=1&limit=10`

Returns saved summaries, newest first. `limit` cannot be higher than 50.

`GET /api/summaries/:id`

Returns one saved summary.

`DELETE /api/summaries/:id`

Deletes one saved summary.

## Tests

Python tests mock Bedrock. No AWS request is made.

```powershell
cd ai-service
.\.venv\Scripts\Activate.ps1
python -m pytest
```

```powershell
cd backend
npm test
```

```powershell
cd frontend
npm test
```

| Case | Where it is covered |
| --- | --- |
| Valid PDF, DOCX, and TXT | Python extraction and API tests; Express accepts the matching file signatures |
| Unsupported type | Python, Express, and the Dashboard |
| Empty file | Python, Express, and the Dashboard |
| Corrupt PDF | Python reader |
| PDF with no extractable text | Python reader and API, including the scanned-PDF message |
| Upload over the limit | Python API and Express |
| AWS authentication failure | Python Bedrock client, with a mocked credential error |
| Model access denied | Python client and Express forwarding |
| Throttling or timeout | Python client retries, then returns a safe error |
| Python service unavailable | Express client |
| MongoDB unavailable | Express history routes |
| Copy and download | Frontend summary actions and Summary card |
| History list and delete | Express routes and the History page |
| Large document | Python map-reduce test checks that chunk prompts still contain every section |
| Malicious instructions inside the document | Python tests: the system prompt stays fixed, the document stays in the user message, and the app returns the model summary rather than following the document |

Express also checks that an internal exception does not send a stack trace or a filesystem path to the client.

## Common errors

| What you see | What to check |
| --- | --- |
| `node` is not recognized | Add Node.js to `PATH`, then open a new terminal |
| Python service is unavailable | Start `python -m app.main` and compare `PYTHON_SERVICE_URL` |
| API could not authenticate to the summarization service | The token in `backend/.env` and `ai-service/.env` must match exactly |
| Summary history is unavailable | Start MongoDB or set `MONGODB_URI`, then restart Express |
| AWS credentials were not accepted | Run `aws sts get-caller-identity`. Set `AWS_PROFILE` if you use a named profile |
| Bedrock denied access | Enable the model in that Region and confirm the IAM policy allows `bedrock:InvokeModel` |
| The configured model could not be used | Check `BEDROCK_MODEL_ID`. Try the inference profile ID shown in the Bedrock console |
| Bedrock is temporarily busy | Wait and try again. The Python client retries three times |
| File exceeds the upload limit | The default limit is 10 MB |
| PDF has no usable text | The PDF is probably scanned. OCR is not included |
| PDF is encrypted | Remove the password and upload it again |
| Text file is not valid UTF-8 | Save the file as UTF-8 |
| Browser request is blocked | `FRONTEND_ORIGIN` must match the Vite origin, usually `http://localhost:5173` |

## Cost

Each summary sends one or more requests to Amazon Bedrock. A short document is one request. A long document can be several chunk requests plus one final request. You pay the price of the selected model. Nova Lite is the default because it is a smaller Amazon model and it is listed in `ap-south-1`. Check the current [Amazon Bedrock pricing](https://aws.amazon.com/bedrock/pricing/) before processing large files. This repository does not create AWS resources for you.

The test suite does not call Bedrock.

## Security

- Express checks extension, size, and file bytes. Python checks the format again.
- Filenames from the browser are not used as filesystem paths.
- Files are read into memory and are not written to `backend/uploads/`.
- The app does not execute uploaded documents or follow instructions inside them.
- Helmet and an explicit CORS origin list are enabled.
- Express is bound to `127.0.0.1` by default. Python is bound to `127.0.0.1` by default.
- Errors returned to the browser do not include stack traces, AWS account details, or credentials.
- There is a small in-memory rate limit on summary requests. It resets when Express restarts.

This first version has no user login. Do not put it on the public internet as it is. A public deployment needs authentication, a stricter rate limit, request logging that still avoids document text, and a private network path to the Python service.

Document text is sent to Amazon Bedrock. Do not upload material you are not allowed to send to that AWS account.

## What was not verified against a live model

The Bedrock client is implemented and covered with mocked AWS errors. A live `InvokeModel` call was not run, so this project does not claim that your IAM permissions or model access already succeed. After the `.env` files and AWS credentials are in place, upload a small TXT file from the dashboard to confirm the real model response.
