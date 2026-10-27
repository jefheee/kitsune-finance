# **🦊 Kitsune Finance | Autonomous Wealth Management & Open Finance**

**Kitsune Finance** is not just an account aggregator. It is a *mobile-first* wealth management and deep financial intelligence application, powered by Open Finance and orchestrated by an advanced Artificial Intelligence architecture (MSLR).

Developed with a focus on high visual fidelity (dual-theme Light/Dark), PWA performance, and absolute security (RLS) to act as the digital *Family Office* for my family core.

## **📖 The Challenge and Strategy (Zero-Cost Open Finance)**

B2C Open Finance applications usually hit the insurmountable barrier of costs (APIs like Belvo or Pluggy charge astronomical corporate monthly fees of +R$2,500).

**The Strategic Pivot:** To make this project viable for a closed group (Family & Friends), the architecture was designed around the **Pluggy** SDK using *Personal* developer keys. The application acts as a centralized hub: the family connects their banks simply and for a lifetime, while the server consolidates everything for free. Banking infrastructure cost: **R$ 0.00**.

## **🧠 AI Architecture: The MSLR Engine (Multi-Step Logical Reasoning)**

LLMs (like GPT-4 or Gemini) are excellent with language, but **terrible at exact math**. To create a financial assistant that doesn't "hallucinate" numbers, Kitsune's brain was fractionated:

1. **Groq (The Router):** Ultra-fast inference classifies the user's intent (e.g., *intent: QUERY_TRANSACTIONS*) and extracts numerical/date parameters in milliseconds.
2. **TS Customs + Supabase RAG:** TypeScript intercepts the route. It uses pgvector to search for similar transactions via *Cosine Similarity* directly in the database and solves all the math and consolidation in pure code.
3. **Gemini (The Persona):** The vision and empathy AI receives the immutable JSON (already calculated) and translates it into natural, astute, and elegant language for the user.

## **💻 Tech Stack**

* **Core:** Next.js 16 (App Router) + TypeScript (Strict)
* **Styling:** Tailwind CSS v4 (Native @theme syntax) + next-themes (Light/Dark mode)
* **Optimized Typography:** Inter (UI/UX) and JetBrains Mono (exclusive for mathematical matrices and balances).
* **Backend & Auth:** Supabase (PostgreSQL + Auth + SSR Cookies)
* **Semantic Search:** pgvector extension (Vector 1536)
* **Open Finance:** Pluggy SDK

## **🛡️ Technical Challenges Solved**

1. **Cross-Tenant Data Leakage:** Since AIs can suffer from prompt injection, security could not be on the application layer. The *match_transactions* function in the database was shielded with native **Row Level Security (RLS)** (WHERE user_id = auth.uid()). It is physically impossible for the AI to access *User B*'s data while serving *User A*.
2. **Hydration Mismatch in Dynamic Themes:** The transition from the *Cyber-Noir* (Dark) palette to the *Clean/Airy* (Light) interface in Server-Side Rendering caused screen flashes. Solved by orchestrating the <ThemeProvider> injected into an asynchronous AppShell.
3. **Mobile-First UX:** Implementation of *Click-outside listeners* and form interception to ensure that the chatbot input is not swallowed by native iOS/Android keyboards (using pb-safe spacing).

## **🚀 How to run locally**

1. **Clone the repository:**
git clone [https://github.com/jefheee/kitsune-finance.git](https://github.com/jefheee/kitsune-finance.git)
cd kitsune-finance
2. **Install dependencies:**
npm install
3. **Configure Environment Variables (.env.local):**
# Supabase


NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
# AI Engines


GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key
# Pluggy Open Finance


PLUGGY_CLIENT_ID=your_key
PLUGGY_CLIENT_SECRET=your_key
4. **Start the server:**
npm run dev

## **🔮 Roadmap**

* [x] Dual-Theme visual identity (Pierre Finance inspired).
* [x] Supabase + RLS + pgvector infrastructure activated.
* [x] Protected Chat route with MSLR structural simulation.
* [ ] **Auth:** Finalize Google OAuth2 callback flow.
* [ ] **Pluggy Connect:** Embed the bank connection widget on the "Agents" screen.
* [ ] **Vector Ingestion:** Create a CRON job to update and vectorize daily transactions.
