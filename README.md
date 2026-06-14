# SupportSphere - Production-Ready RAG Customer Support Chatbot

SupportSphere is a Retrieval-Augmented Generation (RAG) customer support chatbot built using Next.js (App Router), TypeScript, Tailwind CSS, PostgreSQL, Prisma ORM, and the official Google Gemini SDK.

## Features
- **Semantic Chat Interface**: Real-time streaming response using Server-Sent Events (SSE), markdown rendering, typing indicator, and scroll anchors.
- **RAG Reference & Citation deck**: Lists citations used in every assistant response. Clicking a citation opens a reference drawer highlighting the exact document/URL text chunk and its similarity score.
- **Robust Ingestion Pipeline**: Extracts text from PDF, DOCX, TXT, MD, and URLs. Cleans and splits text using a boundary-aware recursive chunker, generates 768-dimensional embeddings via Gemini, and indexes them in a PostgreSQL database with `pgvector`.
- **Hybrid Search**: Performs Reciprocal Rank Fusion (RRF) combining vector similarity search and full-text search.
- **Admin Control Panel**: View stats (total documents, chunks, conversations), upload files/website links with configurable chunking slider parameters, manage/purge documents, re-index website URLs, and inspect customer chat transcripts.
- **Custom JWT Auth**: Session persistence and role-based access control (CUSTOMER vs ADMIN roles).

---

## Quick Setup Instructions

### 1. Start the pgvector Database
Before running the app, boot the database container containing `pgvector`. Ensure you launch **Docker Desktop** on your computer first, then run:

```bash
docker compose up -d db
```

*Note: The container database is exposed on host port `5433` to prevent conflicts with other PostgreSQL instances running on port `5432` on your machine.*

### 2. Configure Environment Variables
Create a `.env` file in the root directory (based on `.env.example`):

```env
# Connection URL pointing to our Docker PostgreSQL container on port 5433
DATABASE_URL="postgresql://postgres:password@localhost:5433/customer_support?schema=public"

# Gemini API Key (Generate one at https://aistudio.google.com/)
GEMINI_API_KEY="your-gemini-api-key-here"

# Secure JWT signing key
JWT_SECRET="some-secure-random-phrase-here"

# Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Push Database Schema
Initialize the database tables and apply configurations by running Prisma's schema push:

```bash
npx prisma db push
```

*This command automatically connects to the PostgreSQL container, creates the `customer_support` database, and maps all 6 tables.*

### 4. Launch Development Server
Start the local Next.js server:

```bash
npm run dev
```

Open your browser and navigate to **[http://localhost:3000](http://localhost:3000)**.

---

## Testing & Authentication Flow

1. **Initial Admin Setup**: Navigate to the register page (`/register`). Create your account. 
   - *Security Rule*: The very first user who registers in the database is automatically granted the **ADMIN** role.
2. **Access Control**: 
   - Customers (`/chat` interface) can create conversations, search history, modify RAG parameters in real-time, and query document resources.
   - Admins (`/admin` panel) can upload files and URLs, delete/re-index documents, track active customer transcripts, and view analytics.
3. **Upload Knowledge**:
   - Go to the Admin Panel. Upload a support document (PDF, DOCX, TXT, MD) or paste a static URL. Adjust the chunk size and overlap sliders if desired.
   - Click "Submit to Vector DB". The document status changes to `PROCESSING` while it chunks and embeds via Gemini, and then updates to `COMPLETED`.
4. **Interactive RAG Querying**:
   - Return to Chat. Ask a question related to your uploaded document.
   - The response will stream, citing references (e.g. `[Source 1]`, `[Source 2]`). Click "View Sources Used" at the bottom of the message to inspect matching vector text and scoring details.

---

## Docker Deployment (Production Mode)

To package and run the entire stack (Next.js Application + PostgreSQL + pgvector) in Docker:

1. Ensure your `.env` contains your active `GEMINI_API_KEY`.
2. Run:
   ```bash
   docker compose up --build
   ```
3. The web app will compile, build statically, and launch on port `3000`.
