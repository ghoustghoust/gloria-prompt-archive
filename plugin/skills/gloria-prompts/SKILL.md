---
name: gloria-prompts
description: Find AI video and image prompts in 光彩跃然 · 影像灵感库 (the GLORIA prompt archive), about 9,000 prompts for Seedance / 即梦, GPT Image, Claude Opus code-made video, MiniMax H3 and more, each credited to its author. Use when the user wants a prompt, an idea or a reference for an AI video or image (提示词, 找灵感, 参考案例, 运镜, 分镜, 产品广告, 文生视频, 图生视频), or mentions 光彩跃然, GLORIA or gloria-prompt-archive.
---

# 光彩跃然 · 影像灵感库

SEASNAKE's collection of AI video and image prompts, gathered from public posts on X, LINUX DO and elsewhere. Each work has the author, a link to the original post and, for 8,900+ of them, the complete original prompt. Gallery: https://seasnakes.github.io/gloria-prompt-archive/

## How to look things up

Use the MCP tools `search_prompts`, `get_prompts` and `list_facets` if they are available. If not, run the script in this skill's folder (Node 18+, no install):

```sh
node <this skill's folder>/scripts/gloria.mjs search neon "rainy night" --model seedance
node <this skill's folder>/scripts/gloria.mjs show 0119a9832d8a7f
node <this skill's folder>/scripts/gloria.mjs facets
```

The first run downloads the library (about 8 MB) and keeps it for six hours. If the sandbox blocks the download, ask the user for network access for this command.

## Searching well

- Most prompts are in English and many titles are in Chinese. When a search in one language comes back thin, run it again in the other: 霓虹 / neon, 雨夜 / "rainy night", 咖啡广告 / coffee.
- Use one to four short keywords. Every keyword must match. Chinese has no spaces, so split it yourself: `赛博朋克 雨夜 城市`, not `赛博朋克雨夜的城市`.
- When the user names a model or a way of making it, filter instead of adding a keyword: `--model seedance`, `--model "gpt image 2.5"`, `--method 图生视频`, `--method 代码生成视频`, `--tag 产品广告`. `facets` lists every exact name.
- Nothing specific in mind? `--sort random --limit 5`, with or without filters.
- Read the full text (`show` / `get_prompts`) of the two or three best results before recommending them. Snippets are cut short and can mislead.

## Presenting results

For each pick, give the title, model and method, one line on why it fits, and the gallery link (`…/#work/<id>`) so the user can watch the video. Name the author and link the original post. Paste a full prompt only for the one the user chooses or when they ask, inside a code block.

If the user wants a prompt adapted to their own subject, adapt it, say what you changed, and keep the credit to the original author.

## Labels to respect

- `待测试`: nobody has re-run the prompt here. Don't promise the same result.
- `待整理`: model, method or prompt not checked yet. Prefer other results, or say so.
- `reference` / 效果参考: the author published no prompt. Never present the effect description as their prompt.
- `待确认` as model or method: the original post didn't say.
- Media links are not in the agent data (the video links expire daily). Send people to the gallery link to see the work.
