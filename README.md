# AI News

Practical AI news Telegram bot. It collects AI, LLM, agent, automation, GitHub trend, and research sources, ranks them by usefulness, and sends compact Telegram messages.

## Message Shape

- L1-L10 level
- Short title
- Category
- Brief summary
- Practical insight
- Small experiment idea
- Source link

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

## Main Sources

- OpenAI, Google AI, Google DeepMind, Mistral, Microsoft Research
- MIT News, BAIR, Stanford Gradient Science, Distill, arXiv
- Hugging Face, NVIDIA Developer, AWS ML, Weaviate, GitHub Blog
- Anthropic pages and GitHub AI trend search
- GeekNews, Simon Willison, Latent Space, Lilian Weng, Chip Huyen

## Environment

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
CRON_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Upstash Redis is optional but recommended. Without it, cross-run duplicate filtering is disabled.

## Run

```bash
npm install
npm run lint
npx tsc --noEmit
npm run build
```

Manual one-item test:

```bash
curl 'http://localhost:3000/api/cron?limit=1' \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Cron

`vercel.json` and GitHub Actions run once daily at 08:00 KST.
