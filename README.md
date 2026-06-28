# AI News

Practical AI news Telegram sender. It collects AI, LLM, agent, automation, GitHub activity, and research sources, then sends the most useful items once daily.

## Message Format

```text
1. [L8][AI 에이전트][Short title]
내용: Brief context
인사이트: Why it matters and a small experiment idea
출처: Source · 원문 직접
```

## Levels

| Level | Meaning |
| --- | --- |
| L1 | AI general news |
| L2 | Product or feature release |
| L3 | Prompt or usage tip |
| L4 | Tutorial or guide |
| L5 | Workflow automation |
| L6 | API, SDK, or open source |
| L7 | Inference, deployment, or ops |
| L8 | Agent, RAG, or eval |
| L9 | Model or benchmark research |
| L10 | Paper or frontier research |

## Sources

- OpenAI, Google AI, Google DeepMind, Mistral, Microsoft Research
- MIT News, BAIR, Stanford Gradient Science, Distill, arXiv
- Hugging Face, NVIDIA Developer, AWS ML, Weaviate, GitHub Blog
- Anthropic pages and GitHub AI repo search
- GeekNews, Simon Willison, Latent Space, Lilian Weng, Chip Huyen

## Environment

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
SENT_URLS_FILE=.cache/ai-news-sent.json
```

## Run

```bash
npm ci
npm run lint
NEWS_LIMIT=1 npm run send
```

## Cron

GitHub Actions runs once daily at 08:00 KST. Manual workflow runs accept an optional `limit` input for format tests.

Sent URL deduplication is stored in the GitHub Actions cache for 72 hours.
