# AI News

Practical AI news Telegram sender. It watches research, official lab posts, developer tooling, open-source activity, and technical communities, then sends the most actionable items twice per day.

The goal is not to summarize every AI headline. The bot favors items that can lead to a paper read, API test, repo evaluation, benchmark check, local experiment, or automation idea.

## What It Sends

A compact numbered list of linked original titles, matching the GeekNews format:

```text
🤖 AI 뉴스 · 2건
2026.10.06 (화) 08:00
1. Original article title (links to the article)
2. Another original title (links to the article)
```

GeekNews continues as its own unfiltered title-and-link list. Article bodies, summaries, level/category labels, and model calls are omitted. Link previews are disabled. Long lists split between articles while keeping each title and link together.

## Source Strategy

Sources are intentionally split by trust and usefulness:

- Primary lab/company sources: OpenAI, Google AI, Google DeepMind, Mistral AI, Microsoft Research, Anthropic pages.
- Research sources: MIT News AI/ML, Berkeley BAIR, Stanford Gradient Science, Distill, arXiv `cs.AI`, `cs.LG`, `cs.CL`, `cs.CV`, `stat.ML`.
- Developer and platform sources: Hugging Face, NVIDIA Developer, AWS Machine Learning, Weaviate, LangChain Blog, GitHub Blog, Meta Engineering.
- Practitioner sources: Simon Willison, Latent Space, Lilian Weng, Chip Huyen, GeekNews.
- Community signals: GeekNews RSS, Lobsters AI, and optional Threads keyword search.
- Open-source signals: targeted GitHub searches for `ai-agent`, `rag`, `mcp`, and `llmops`.
- Runtime/tool release signals: vLLM, Ollama, and Model Context Protocol SDK release feeds.

Broad GitHub noise is deliberately limited. The bot avoids the generic `llm` topic, caps GitHub candidates, and filters obvious finance/trading repos because those tend to bury useful engineering updates.

## Filtering Rules

The collector:

- keeps only recent items from the last 26 hours,
- removes duplicate URLs and near-duplicate titles,
- requires AI keywords in the title, snippet, or trusted source signal,
- boosts practical signals like API, SDK, CLI, benchmark, eval, agent, RAG, inference, deployment, MCP, and open source,
- downranks low-signal business/legal/policy items unless they also contain strong technical signals,
- prefers at most three items per source or domain when alternatives exist.

## Runtime

This is a small Node/TypeScript script, not a web app.

- `scripts/send.ts` fetches, filters, deduplicates, formats, and sends.
- `src/lib/rss-parser.ts` owns source collection and candidate ranking.
- `src/lib/telegram.ts` owns Telegram formatting.
- `src/lib/dedup-store.ts` stores recently sent URLs.

## Environment

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
SENT_URLS_FILE=.cache/ai-news-sent.json
GITHUB_TOKEN=optional_for_local_github_api_rate_limits
THREADS_ACCESS_TOKEN=optional_for_threads_keyword_search
```

GitHub Actions provides `GITHUB_TOKEN` automatically. For local runs, it is optional but useful when testing GitHub repo searches repeatedly.
Threads search is disabled unless `THREADS_ACCESS_TOKEN` is set. Public Threads keyword search also requires Meta's `threads_keyword_search` permission; without approval it is limited to posts owned by the authenticated user.

## Run Locally

```bash
npm ci
npm run lint
NEWS_LIMIT=1 npm run send
```

Use `NEWS_LIMIT=0` to test collection and filtering without sending Telegram messages:

```bash
NEWS_LIMIT=0 npm run send
```

## Schedule

GitHub Actions runs twice daily at 08:00 and 20:00 KST:

```text
0 23 * * *  # UTC, previous day
0 11 * * *  # UTC
```

Manual workflow runs support an optional `limit` input for message format tests.

Sent URL deduplication is stored in the GitHub Actions cache for 72 hours, so the same item is not repeatedly sent across scheduled runs.
