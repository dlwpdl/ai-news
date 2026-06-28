# AI News

Practical AI news Telegram sender. It watches research, official lab posts, developer tooling, open-source activity, and technical communities, then sends the most actionable items once per day.

The goal is not to summarize every AI headline. The bot favors items that can lead to a paper read, API test, repo evaluation, benchmark check, local experiment, or automation idea.

## What It Sends

Each item is formatted for quick triage:

```text
1. [L8][AI 에이전트][Short title]
내용: What changed and enough context to understand it
인사이트: Why it matters, what to verify, and a small experiment idea
출처: Source · 원문 직접
```

The Telegram labels are intentionally Korean because the message is consumed in Korean, while this README documents the project in English.

## Level System

| Level | Meaning |
| --- | --- |
| L1 | General AI news with low immediate actionability |
| L2 | Product, model, or feature release |
| L3 | Prompt, checklist, or usage tip |
| L4 | Tutorial, guide, or implementation note |
| L5 | Workflow automation or productized AI use case |
| L6 | API, SDK, CLI, library, framework, or open-source repo |
| L7 | Inference, serving, deployment, quantization, or ops |
| L8 | Agents, RAG, evals, tool use, MCP, or applied LLM systems |
| L9 | Model, benchmark, dataset, or serious research write-up |
| L10 | Paper, arXiv item, or frontier research |

## Source Strategy

Sources are intentionally split by trust and usefulness:

- Primary lab/company sources: OpenAI, Google AI, Google DeepMind, Mistral AI, Microsoft Research, Anthropic pages.
- Research sources: MIT News AI/ML, Berkeley BAIR, Stanford Gradient Science, Distill, arXiv `cs.AI`, `cs.LG`, `cs.CL`, `cs.CV`, `stat.ML`.
- Developer and platform sources: Hugging Face, NVIDIA Developer, AWS Machine Learning, Weaviate, LangChain Blog, GitHub Blog, Meta Engineering.
- Practitioner sources: Simon Willison, Latent Space, Lilian Weng, Chip Huyen, GeekNews.
- Community signals: Lobsters AI.
- Open-source signals: targeted GitHub searches for `ai-agent`, `rag`, `mcp`, and `llmops`.
- Runtime/tool release signals: vLLM, Ollama, and Model Context Protocol SDK release feeds.

Broad GitHub noise is deliberately limited. The bot avoids the generic `llm` topic, caps GitHub candidates, and filters obvious finance/trading repos because those tend to bury useful engineering updates.

## Filtering Rules

The collector:

- keeps only recent items from the last 26 hours,
- removes duplicate URLs and near-duplicate titles,
- requires AI keywords in the title, snippet, or trusted source signal,
- boosts practical signals like API, SDK, CLI, benchmark, eval, agent, RAG, inference, deployment, MCP, and open source,
- downranks low-signal business/legal/policy items unless they also contain strong technical signals.

## Runtime

This is a small Node/TypeScript script, not a web app.

- `scripts/send.ts` fetches, filters, deduplicates, formats, and sends.
- `src/lib/rss-parser.ts` owns source collection and ranking.
- `src/lib/telegram.ts` owns Telegram formatting.
- `src/lib/dedup-store.ts` stores recently sent URLs.

## Environment

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
SENT_URLS_FILE=.cache/ai-news-sent.json
GITHUB_TOKEN=optional_for_local_github_api_rate_limits
```

GitHub Actions provides `GITHUB_TOKEN` automatically. For local runs, it is optional but useful when testing GitHub repo searches repeatedly.

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

GitHub Actions runs once daily at 08:00 KST:

```text
0 23 * * *  # UTC, previous day
```

Manual workflow runs support an optional `limit` input for message format tests.

Sent URL deduplication is stored in the GitHub Actions cache for 72 hours, so the same item is not repeatedly sent across daily runs.
