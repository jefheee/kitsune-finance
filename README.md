# **🦊 Kitsune Finance | Gestão Patrimonial Autônoma & Open Finance**

<img width="1024" height="1024" alt="logo" src="https://github.com/user-attachments/assets/3f4777f4-2406-4218-aec5-91deca948acc" />

---

O **Kitsune Finance** não é apenas um agregador de contas. É um aplicativo *mobile-first* de gestão patrimonial e inteligência financeira profunda, alimentado por Open Finance e orquestrado por uma arquitetura avançada de Inteligência Artificial (MSLR).

Desenvolvido com foco em alta fidelidade visual (dual-theme Light), performance PWA e segurança absoluta (RLS) para atuar como o *Family Office* digital do meu núcleo familiar.

## **📖 O Desafio e a Estratégia (Zero-Cost Open Finance)**

Aplicações B2C de Open Finance costumam esbarrar na barreira intransponível dos custos (APIs como Belvo ou Pluggy cobram mensalidades corporativas astronômicas de \+R$2.500).

**O Pivot Estratégico:** Para viabilizar este projeto para um grupo fechado (Family & Friends), a arquitetura foi desenhada em torno do SDK da **Pluggy** utilizando chaves de desenvolvedor *Personal*. A aplicação atua como um hub centralizado: a família conecta seus bancos de forma simples e vitalícia, enquanto o servidor consolida tudo gratuitamente. Custo de infraestrutura bancária: **R$ 0,00**.

## **🧠 Arquitetura de IA: O Motor MSLR (Multi-Step Logical Reasoning)**

LLMs (como GPT-4 ou Gemini) são excelentes com linguagem, mas **péssimos em matemática exata**. Para criar um assistente financeiro que não "alucina" números, o cérebro da Kitsune foi fracionado:

1. **Groq (O Roteador):** Uma inferência ultrarrápida classifica a intenção do usuário (ex: *intent: QUERY\_TRANSACTIONS*) e extrai parâmetros numéricos/datas em milissegundos.  
2. **Alfândega TS \+ Supabase RAG:** O TypeScript intercepta a rota. Ele usa pgvector para buscar transações similares via *Cosine Similarity* diretamente no banco de dados e resolve toda a matemática e consolidação em código puro.  
3. **Gemini (A Persona):** A IA de visão e empatia recebe o JSON imutável (já calculado) e o traduz para uma linguagem natural, astuta e elegante para o usuário.

## **💻 Stack Tecnológica**

* **Core:** Next.js 16 (App Router) \+ TypeScript (Strict)  
* **Styling:** Tailwind CSS v4 (Sintaxe @theme nativa) \+ next-themes (Light/Dark mode)  
* **Tipografia Otimizada:** Inter (UI/UX) e JetBrains Mono (exclusiva para matrizes matemáticas e saldos).  
* **Backend & Auth:** Supabase (PostgreSQL \+ Auth \+ SSR Cookies)  
* **Busca Semântica:** Extensão pgvector (Vector 1536\)  
* **Open Finance:** Pluggy SDK

## **🛡️ Desafios Técnicos Resolvidos**

1. **Cross-Tenant Data Leakage (Vazamento de Dados):** Como IAs podem sofrer injeção de prompt, a segurança não poderia estar na camada de aplicação. A função de *match\_transactions* no banco foi blindada com **Row Level Security (RLS)** nativo (WHERE user\_id \= auth.uid()). É fisicamente impossível a IA acessar dados do *Usuário B* enquanto atende o *Usuário A*.  
2. **Hydration Mismatch em Temas Dinâmicos:** A transição da paleta *Cyber-Noir* (Escuro) para a interface *Clean/Airy* (Claro) no Server-Side Rendering causava flashes na tela. Resolvido com a orquestração do \<ThemeProvider\> injetado em um AppShell assíncrono.  
3. **UX Mobile-First:** Implementação de *Click-outside listeners* e interceptação de formulários para garantir que o input do chatbot não seja engolido pelos teclados nativos do iOS/Android (utilizando espaçamento pb-safe).

## **🚀 Como rodar localmente**

1. **Clone o repositório:**  
   git clone \[https://github.com/jefheee/kitsune-finance.git\](https://github.com/jefheee/kitsune-finance.git)  
   cd kitsune-finance

2. **Instale as dependências:**  
   npm install

3. **Configure as Variáveis de Ambiente (.env.local):**  
   \# Supabase  
   NEXT\_PUBLIC\_SUPABASE\_URL=seu\_url  
   NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=sua\_key

   \# AI Engines  
   GEMINI\_API\_KEY=sua\_key  
   GROQ\_API\_KEY=sua\_key

   \# Pluggy Open Finance  
   PLUGGY\_CLIENT\_ID=sua\_key  
   PLUGGY\_CLIENT\_SECRET=sua\_key

4. **Inicie o servidor:**  
   npm run dev

## **🔮 Roadmap**

* \[x\] Identidade visual Dual-Theme (Pierre Finance inspired).  
* \[x\] Infraestrutura Supabase \+ RLS \+ pgvector ativada.  
* \[x\] Rota de Chat protegida com simulação estrutural MSLR.  
* \[ \] **Auth:** Finalizar fluxo de callback do Google OAuth2.  
* \[ \] **Pluggy Connect:** Embutir o widget de conexão bancária na tela de "Agentes".  
* \[ \] **Ingestão Vetorial:** Criar CRON job para atualizar e vetorizar transações diárias.
