<div align="center">
  <img src="assets/logo.png" width="500" alt="OptimizeQL Logo">

  # 🔍 OptimizeQL — Your SQL Assistant

<p align="center">
  <a href="https://www.python.org"><img src="https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.12+"></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16"></a>
  <a href="https://www.docker.com"><img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker Ready"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License"></a>
</p>

AI-powered SQL query optimizer that analyzes EXPLAIN plans and suggests indexes, rewrites, and configuration changes.

<p>
  <a href="#-quick-start">🚀 Quick Start</a> &middot;
  <a href="#-features">✨ Features</a> &middot;
  <a href="#%EF%B8%8F-configuration">⚙️ Configuration</a> &middot;
  <a href="#-contributing">🤝 Contributing</a>
</p>
</div>

---

## ✨ Features

- 🔬 **EXPLAIN ANALYZE introspection** — connects to your PostgreSQL or MySQL database, runs EXPLAIN ANALYZE, and gathers schema, indexes, and column statistics automatically
- 🤖 **Multi-provider LLM analysis** — supports Anthropic, OpenAI, Gemini, DeepSeek, xAI, Qwen, Meta Llama, Kimi, and OpenRouter out of the box
- 💡 **Actionable suggestions** — returns `CREATE INDEX` statements, query rewrites, materialized views, statistics recommendations, and config tuning with estimated impact levels
- 🔐 **Encrypted credential storage** — all database passwords and API keys are encrypted with Fernet before storage
- ✏️ **No-connection mode** — paste any SQL and get optimization suggestions without connecting to a live database
- 📜 **Query history** — every analysis is persisted and searchable
- 🐳 **Dockerized** — single `docker compose up` deploys the full stack

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| 🐍 Backend | Python 3.12, FastAPI, SQLAlchemy, SQLite |
| ⚛️ Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| 🐳 Containerization | Docker, Docker Compose |
| 📝 SQL Parsing | sqlglot |
| 🔒 Encryption | cryptography (Fernet) |

## 🚀 Quick Start

### 🐳 Docker (recommended)

```bash
git clone https://github.com/SubhanHakverdiyev/OptimizeQL.git
cd OptimizeQL
docker compose up --build
```

That's it. Open 👉 [http://localhost:3000](http://localhost:3000)

> 💡 No environment setup required — the encryption key auto-generates on first run, and LLM provider keys are configured through the UI.

### 💻 Local Development

**Backend:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

> 📍 Backend runs at `http://localhost:8000`, frontend at `http://localhost:3000`.

## ⚙️ Configuration

All configuration is done through the UI — add your LLM API key and database connections from the settings page. No `.env` editing required for basic usage.

### 📋 Environment Variables (optional)

For advanced users, the backend reads from `backend/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `ENCRYPTION_KEY` | 🔑 Auto-generated | Fernet key for encrypting stored credentials. Auto-generates and persists to `data/.encryption_key` if empty. |
| `APP_ENV` | `development` | Set to `production` in Docker. Controls CORS behavior. |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins for production. |
| `LLM_PROVIDER` | `openrouter` | Fallback LLM provider if none configured via UI. |
| `LLM_MODEL` | `meta-llama/llama-3.3-70b-instruct:free` | Fallback model. |
| `RATE_LIMIT` | `10/minute` | Rate limit for the analyze endpoint. |
| `EXPLAIN_TIMEOUT_MS` | `10000` | Max milliseconds for EXPLAIN ANALYZE execution. |
| `API_KEY` | Empty (disabled) | Static API key for `X-API-Key` header auth. |
| `LOG_LEVEL` | `INFO` | Logging verbosity. |

> 💡 LLM provider API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, etc.) can also be set in `.env` as fallbacks, but the recommended approach is to add them through the UI where they are stored encrypted.

### 🐳 Docker Configuration

The `docker-compose.yml` uses `env_file: ./backend/.env` and overrides `APP_ENV=production`. Data persists in a Docker volume (`backend-data`) mounted at `/app/data`, which holds the SQLite database and encryption key.

> 🔄 When running in Docker, `localhost` database connections are automatically rewritten to `host.docker.internal` so the container can reach databases on your host machine.

## 📡 API

Interactive API docs are available at:

- 📘 **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- 📗 **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/analyze` | 🔬 Analyze a SQL query |
| `GET` | `/api/v1/analyze/history` | 📜 Query analysis history |
| `POST` | `/api/v1/connections` | 🔌 Add a database connection |
| `POST` | `/api/v1/connections/{id}/test` | 🧪 Test a saved connection |
| `POST` | `/api/v1/llm-settings` | 🤖 Add an LLM provider config |
| `POST` | `/api/v1/llm-settings/{id}/activate` | ✅ Set the active LLM provider |
| `GET` | `/api/v1/llm-settings/providers` | 📋 List supported providers and models |
| `GET` | `/health` | 💚 Health check |

## 🧪 Testing

```bash
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v
```

✅ **83 tests** covering encryption, API endpoints, schema validation, SQL parsing, prompt building, LLM response parsing, and authentication. No external services required — all tests run against an in-memory SQLite database with mocked LLM providers.

## 📁 Project Structure

```
OptimizeQL/
├── 🐳 docker-compose.yml
├── 🐍 backend/
│   ├── main.py                    # FastAPI entry point
│   ├── api/
│   │   ├── routes/                # API endpoints
│   │   ├── models/                # Pydantic schemas + ORM models
│   │   └── dependencies.py        # Auth middleware
│   ├── core/
│   │   ├── config.py              # Settings (pydantic-settings)
│   │   ├── database.py            # SQLAlchemy setup
│   │   └── encryption.py          # Fernet encrypt/decrypt
│   ├── connectors/                # PostgreSQL + MySQL connectors
│   ├── services/
│   │   ├── llm_analyzer.py        # LLM orchestration + JSON parsing
│   │   ├── prompt_builder.py      # Dialect-aware prompt assembly
│   │   ├── query_introspector.py  # EXPLAIN + schema collection
│   │   ├── connection_manager.py  # DB connection CRUD
│   │   └── llm_providers/         # Anthropic, OpenAI, Gemini, etc.
│   └── tests/                     # 83 pytest tests
└── ⚛️ frontend/
    ├── src/app/                   # Next.js pages
    ├── src/components/            # React components
    └── src/lib/                   # API client
```

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. 🍴 **Fork** the repository
2. 🌿 **Create a branch** for your feature: `git checkout -b feature/my-feature`
3. ✍️ **Make your changes** and add tests if applicable
4. 🧪 **Run the test suite**: `python -m pytest tests/ -v`
5. 💾 **Commit** with a clear message: `git commit -m "Add my feature"`
6. 🚀 **Push** and open a Pull Request

### 📏 Guidelines

- Follow existing code patterns and naming conventions
- Add tests for new backend functionality
- Keep PRs focused — one feature or fix per PR
- Use type hints in Python code

## 🛡️ Security

- 🔐 All stored credentials (database passwords, LLM API keys) are encrypted with Fernet symmetric encryption
- 🔑 The encryption key auto-generates on first run and persists across restarts
- ⏱️ API key authentication uses constant-time comparison (`secrets.compare_digest`)
- 🛑 Database connections are forced into read-only transaction mode before running EXPLAIN ANALYZE
- ⏳ EXPLAIN execution has a configurable timeout to prevent resource exhaustion
- 🚫 The `.env` file is excluded from Docker images via `.dockerignore`

> 🐛 If you discover a security vulnerability, please open an issue or contact the maintainer directly.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  ⚡ Built with FastAPI, Next.js, and a lot of EXPLAIN ANALYZE ⚡
</p>
