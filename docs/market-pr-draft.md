# Market PR draft (awesome-dsh-plugin & dsh-market)

Target: [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) repository.
File path: `data/plugins/SQDR2__dsh-agy-worker.yml`

> **Note**: Submitting to `awesome-dsh-plugin` automatically indexes the plugin into `dsh-market` (the in-app GUI plugin market inside DeepSeek Harness), `awesome-dsh-plugin.com`, DSH Desktop, and DSH Get!

---

### `data/plugins/SQDR2__dsh-agy-worker.yml`

```yaml
url: https://github.com/SQDR2/dsh-agy-worker
name: SQDR2/dsh-agy-worker
category: model
description:
  en: 'Google Antigravity (agy CLI) models for DSH — streaming chat with Gemini/Claude/GPT-OSS subscriptions, native tool cards, thinking turns, and in-GUI Google OAuth login.'
  zh: '将 Google Antigravity (agy CLI) 接入 DSH：无 API Key 使用 Gemini/Claude/GPT-OSS 订阅模型，支持流式对话、原生工具卡片、思考轮次注记及 Web 界面 Google OAuth 扫码登录。'
```

---

### PR Title & Body Draft

**Title**: `Add SQDR2/dsh-agy-worker (model)`

**Body**:

```markdown
## Add SQDR2/dsh-agy-worker (model)

- **Repo**: https://github.com/SQDR2/dsh-agy-worker
- **npm**: https://www.npmjs.com/package/dsh-agy-worker
- **Category**: `model`

Brings Google Antigravity models (Gemini / Claude / GPT-OSS slugs exposed by the agy CLI) into DSH as a first-class provider route:
- Full streaming responses with thinking turns and token usage.
- Native DSH tool cards (terminal, diff, view, search) mirrored via `agy_tool`.
- Multi-turn continuity with session-conversation binding and continuation spans.
- In-GUI Google OAuth login with QR code & auth helper.
- Sliding activity watchdog supporting indefinite execution for active long tasks.
- `/agy` command suite (`status`, `auth`, `doctor`, `ask`).

### Pre-submission Checklist
- [x] `dsh.bundle` manifest present in `package.json`
- [x] >= 10 commits (currently 40+)
- [x] Repository age >= 1 day
- [x] `dsh-plugin` topic set on GitHub repository
- [x] Published and verified on npm (`dsh-agy-worker`)
```

