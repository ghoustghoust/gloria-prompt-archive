---
name: gloria-prompts
description: Find AI video and image prompts in 光彩跃然 · 影像灵感库 (the GLORIA prompt archive), about 9,000 prompts for Seedance / 即梦, GPT Image, Claude Opus code-made video, MiniMax H3 and more, each with its image or video and credited to its author. Use when the user wants prompts, ideas or references for an AI video or image, either on a theme (题材, 主题, 风格: 赛博朋克, 雨夜, 咖啡, 水墨) or for a task (做产品广告, 音乐 MV, 科普动画, 运镜, 转场, 图生视频), or mentions 光彩跃然, GLORIA or gloria-prompt-archive.
---

# 光彩跃然 · 影像灵感库

SEASNAKE's collection of AI video and image prompts, gathered from public posts on X, LINUX DO and elsewhere. Each work has the author, a link to the original post, its image or video and, for 8,900+ of them, the complete original prompt. Gallery: https://seasnakes.github.io/gloria-prompt-archive/

## What to hand back

Unless the user asks for something else, answer with **about four picks, each with its image and its prompt**. Four that differ from each other beat four near-copies from one author.

## Tools

Use the MCP tools `search_prompts`, `get_prompts` and `list_facets` if they are available. If not, run the script in this skill's folder (Node 18+, no install):

```sh
node <this skill's folder>/scripts/gloria.mjs search neon "rainy night" --model seedance
node <this skill's folder>/scripts/gloria.mjs show <id> <id> <id> <id>
node <this skill's folder>/scripts/gloria.mjs show <id> <id> --save ./gloria-covers
node <this skill's folder>/scripts/gloria.mjs facets
```

`search` returns ranked summaries and ids. `show` / `get_prompts` returns, for each work, a Markdown image of its cover, the full prompt, the credits, and current image and video links. `--save` also downloads the cover images, for when you need to look at them yourself or the user wants files. The first run downloads the library (about 8 MB) and keeps it for six hours; if the sandbox blocks the download, ask the user for network access for this command.

## Two kinds of request

**A theme** (题材 / 主题 / 风格): a subject, mood or look, such as 赛博朋克雨夜, 猫, 水墨, 复古胶片, a coffee brand. Search the subject itself, in Chinese and in English (most prompts are English): `赛博朋克 雨夜`, then `cyberpunk rain`. Add a style tag when one fits (`--tag 电影感`, `--tag 动画`, `--tag 写实`).

**A task**: what the user is trying to make. Turn it into filters first, then add one or two keywords for their subject:

| The user wants to make | Filters to start from |
|---|---|
| A product or brand ad | `--tag 产品广告`, plus `--method 文生视频` or `图生视频` |
| A video from their own photo or key frame | `--method 图生视频` |
| A still image, poster or cover | `--method 图像生成` |
| A motion-graphics or animation piece written in code | `--method 代码生成视频` (often `--tag 动态图形`) |
| Camera moves or transitions | `--tag 运镜` or `--tag 运镜与转场` |
| A music video | `--tag 音乐视频` |
| An explainer or science video | `--tag 科普讲解` |
| UI or app motion | `--tag UI动效` |
| Something for a named model | `--model seedance`, `--model "gpt image 2.5"`, `--model "claude opus"`, `--model "minimax h3"` |

`facets` / `list_facets` lists every exact model, method and tag name. Nothing specific in mind? `--sort random --limit 8`, with or without filters.

## Searching well

- Use one to four short keywords; every keyword must match. Chinese has no spaces, so split it yourself: `赛博朋克 雨夜 城市`, not `赛博朋克雨夜的城市`.
- When a search comes back thin, try the other language, drop a keyword, or loosen a filter.
- Search for more than you need (the default is 10 results), then pick about four. Read them with one `show` / `get_prompts` call before recommending; snippets are cut short and can mislead.

## Presenting the picks

For each pick:

```markdown
### 1. <title>
![<title>](<image link>)
<model> · <method> · by <author> · [original post](<source link>) · [watch in the gallery](<gallery link>)
<one line on why it fits>

    <the full prompt, in a code block>
```

- Paste the prompt in full. If one runs past about 3,000 characters, show the first part, say how long it is, and offer the rest.
- For a video, the image is its cover frame; add the video link too.
- Image and video links are temporary (about a day). The gallery link is permanent, so always include it.
- Your interface may not display images. If the user can't see them, give the image links, or save the covers with `--save` and tell them where the files are.
- If the user wants a prompt adapted to their own subject, adapt it, say what you changed, and keep the credit to the original author.

## Labels to respect

- `待测试`: nobody has re-run the prompt here. Don't promise the same result.
- `待整理`: model, method or prompt not checked yet. Prefer other results, or say so.
- `reference` / 效果参考: the author published no prompt. Never present the effect description as their prompt.
- `待确认` as model or method: the original post didn't say.
- An image marked "made by this site from the prompt" is not the author's own image. Say so if you show it.
