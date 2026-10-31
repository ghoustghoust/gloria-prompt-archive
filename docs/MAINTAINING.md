# 维护说明

给维护这个仓库的人看的：内容怎么同步、界面怎么发布、出了问题怎么回退。用的人看 [README](../README.zh-CN.md) 就够了（[English](../README.md)）。

## 整体怎么连起来

```
飞书「提示词作品库」 ──每六小时──▶ GitHub Actions ──▶ GitHub Pages
                                   sync:api            网站 + agent 文件
```

- 内容只在飞书里改。仓库不存线上数据：同步生成的 JSON 只进构建产物，不提交回来。
- 仓库自带的 `public/data/catalog.json` 是 46 条的本地样本，附件在 `public/media/`，只用于本地开发和测试。
- 首页流体沿用验收过的 Blue Tears V6 视觉引擎（`src/blue-tears/`）。早期独立的流体 V1–V6 预览不在这个仓库里。

## 本地开发

需要 Node.js 22。

```sh
npm ci
npm run dev        # http://127.0.0.1:5182/
npm test
npm run build
npm run preview    # http://127.0.0.1:5183/ ，看实际构建结果
```

网站用相对资源路径，作品分享链接是 `#work/作品ID`，直接打开不需要服务器路由。

## 内容同步

工作流 **Publish GitHub Pages**（`.github/workflows/pages.yml`）在推送 `main`、每六小时、手动运行时触发：跑测试，读飞书整张表，构建，部署。

它不是实时查询。新加的作品要等下一次同步成功才出现。

只改了 `README.md`、`README.zh-CN.md`、`docs/` 或 `reports/` 的推送不会触发它（工作流里的 `paths-ignore`）：这些文件 GitHub 直接从仓库读，网站用不到。改了别的文件照常触发；定时同步不受影响。以后要是网站开始用这几个目录里的文件，记得把它从 `paths-ignore` 里删掉。

### 凭据

仓库 Secrets：`LARK_APP_ID`、`LARK_APP_SECRET`、`LARK_BASE_TOKEN`、`LARK_TABLE_ID`。飞书应用需要 `bitable:app:readonly` 权限和目标表的读取权限。这些只在 Actions 里用，不进浏览器，也不进构建产物。`scripts/validate.mjs` 会拒绝发布带 token 字段的目录。

本地跑 `npm run sync:api` 前，设好同名环境变量。生成的 JSON 带签名链接，不要提交。旧的 `npm run sync` / `npm run publish` 是下载附件的老流程，已经不用。

### `npm run sync:api` 做了什么

- 分页读全部记录和完整字段选项，所以筛选项包括飞书里定义了但还没人用的值。
- 附件不下载，只换临时链接：四个并发，每批最多五个附件，所有线程加重试合计每秒最多四次请求。日志每 100 批报一次进度。
- 只发布展示需要的字段和媒体链接。远程模式构建时自动排除旧的 `public/media/`。
- 同时生成不含正文和媒体链接的 `data/work-ids.json`，给点赞服务识别新作品。点赞数不会被内容同步覆盖。

### 临时链接会过期

附件临时链接大约 24 小时有效。定时同步会续上，但 GitHub 的定时任务可能延迟，可以在 Actions 里手动运行 **Publish GitHub Pages**。整库换链接可能要 20 分钟以上，任务上限 90 分钟。

同步缺页、权限出错、附件链接不完整时会停止部署，线上保留上一次成功的版本。连续失败超过链接有效期，视频就放不出来了。

2026-10-17 有一次同步在附件链接接口返回 `90008001` 时中断，同版本重跑恢复。现在这个错误码最多请求四次，间隔 1、2、4 秒，重试也走共享限速。持续失败仍然停止部署；参数和权限错误不重试。错误日志只留数字错误码和安全的请求标识，不输出附件 token、签名链接或原始响应。

## 只改界面时

手动运行 **Rebuild gallery presentation**：复用线上那份还有至少两小时有效期的目录，不用重刷整库链接。可以顺带用已入库的生成图补缺失的封面（`media_patch` 输入，要求标明「本站补图」来源）；出处截图只在来源附件里展示。

常规内容同步和每六小时的链接续期仍然由 **Publish GitHub Pages** 负责。

## Bilibili Toy 自动更新

`Publish Bilibili Toy`（`.github/workflows/toy-publish.yml`）在正式分支的 `Publish GitHub Pages` 成功后运行，复用该次构建的完整目录，不重复读取飞书。流程会构建自带 `data/catalog.json` 的 Toy 包，并通过官方内容检查。图片和视频仍使用飞书临时链接；点赞服务独立运行。

- 包和检查报告在 `.local/toy/gloria-toy.zip`、`.local/toy/package-report.json`，报告记录作品数、目录时间、媒体有效期和 SHA-256。校验入口、私有字段、重复编号及 50 MB 包体预算；媒体链接剩余不足 8 小时则停止，保留已发布版本。
- 使用 GitHub 的 `bilibili-toy` 环境。创作者会话只存加密 secret `TOY_SESSION_TOKEN`，不进入源码、网页、日志或附件。失效时通过官方 `toy login` 重新授权后更新 secret。
- 环境变量 `TOY_AUTO_SUBMIT=true` 时，成功同步后自动提交 B 站审核；为 false 时只生成预览。手动运行可以通过 `submit_for_review` 选择提交。审核通过后正式版才会变更，提交成功不等于审核通过。
- Toy ID 固定为 `42481513136128`，slug 为 `gloria`。脚本先核对账号与目标 Toy。更新仅替换程序包，封面、图标、可见性保持现状。
- 飞书媒体链接约 24 小时有效，定时同步不能保证 B 站审核耗时。若审核延迟超过链接有效期，目录仍可读取，但媒体需要新版本续期；自动流程不等于永久媒体托管。

本地复用最近一次成功同步：

```sh
python3 scripts/prepare-toy-catalog.py --repository seasnakes/gloria-prompt-archive
npm run build:toy
python3 scripts/publish-toy.py --mode preview
# 已获得发布授权后才提交；使用同一个已检查的包。
TOY_SUBMIT_APPROVED=1 python3 scripts/publish-toy.py --mode submit
```

## 给 agent 的文件

`npm run build` 最后一步是 `scripts/build-agent-files.mjs`，从 `dist/data/catalog.json` 生成：

| 文件 | 用途 |
|---|---|
| `llms.txt` | agent 的入口说明，带当前所有筛选项和数量 |
| `agent/prompts.json` | 全部作品的全文，一行一条，去掉了媒体链接和参数说明 |
| `agent/works/<id>.md` | 单条作品的 Markdown，开头是封面图，后面有这次同步的图片和视频链接 |
| `agent/media/<id>.json` | 单条作品这次同步的封面、图片、视频链接和过期时间，脚本只在要展示某几条时才去取 |
| `agent/facets.json` | 各筛选项的数量 |
| `agent/badges/*.json` | README 顶部徽标（shields.io endpoint 格式），中文和 `-en` 英文各一套 |
| `agent/stats.svg`、`agent/stats-en.svg` | README 里的统计图，中英文各一张（`scripts/stats-svg.mjs`） |

两次 Actions 工作流都会生成这些文件，跟网站同步更新。媒体链接大约一天过期，所以 `prompts.json`（agent 会缓存六小时）里不放，只放在每次部署都重新生成的 `media/` 和 `works/` 里。

skill、MCP 服务和命令行是同一个文件：`plugin/skills/gloria-prompts/scripts/gloria.mjs`，零依赖，Node 18+。它下载 `agent/prompts.json`，缓存到 `~/.cache/gloria-prompts/`（写不了就用系统临时目录），六小时内不重复下载。改这个脚本或 `SKILL.md` 时，同步提高 `plugin/.claude-plugin/plugin.json` 和脚本里的 `VERSION`，Claude Code 插件靠版本号判断更新。

`agent/prompts.json` 的字段名是公开接口，agent 和别人的脚本会依赖。要改就加字段，不要改名或删字段；非改不可时提高文件头的 `schema` 版本。

本地试：

```sh
npm run build
npm run agent -- search neon --data dist/agent/prompts.json
claude plugin validate .            # 检查 marketplace 和插件清单
```

## 中英文界面

界面文字都在 `src/i18n.js`，中文和英文各一份，键名必须一致（`tests/i18n.test.mjs` 会查，也会查 `index.html` 里用到的每个键）。静态页面上的文字用 `data-i18n`（替换文字）和 `data-i18n-attr`（`属性:键;属性:键`）标出来；脚本里生成的文字用 `t('键')`。

- 语言的选择顺序：链接里的 `?lang=zh|en`，然后是访客上次的选择（浏览器存储 `gloria:lang`），最后看浏览器语言，中文浏览器默认中文，其余默认英文。`?lang=` 不会覆盖访客自己的选择。
- 切换语言会保存选择后重新加载页面，每次加载只用一种语言渲染。
- 收录内容（标题、提示词、模型版本说明）照原样显示。模型、生成方式、来源和风格标签在英文界面显示英文名，对照表是 `ENGLISH_NAMES`，README 的英文统计图也用它。飞书里新增了标签或模型，记得在这里补英文名，否则英文界面会直接显示中文。
- 两种名字都能搜：英文界面搜 `cinematic`、中文界面搜 `电影感` 都能找到带「电影感」标签的作品。
- 首页打字机按三页轮流打出那首小诗（`POEM.pages`）；点诗句会打开整首诗、译文和知乎原文链接（`src/poem.js`）。这个弹窗带 `data-keep-motion`，打开时背景流体不降帧。

## 点赞

2026-10-11 加的匿名点赞和「最多点赞」排序。点赞存在单独的持久数据库，访客标识存在当前站点的浏览器存储里，换设备、换入口或清空浏览器数据后可能再点一次。重复请求只计一次，取消只影响自己的记录。网页只用访客自己的随机凭证，后台凭据不进浏览器。

点赞接口默认 `https://gloria-likes-seasnake-1011.elatedeel.chatgpt.site`，本地用 `VITE_LIKES_URL` 指向测试服务（它只允许线上域名跨域，本地预览控制台会报 CORS 错，属正常）。Toy 用 `npm run build:toy` 构建，作品目录随包上传，读取 `./data/catalog.json`；不再通过 GitHub Pages 加载作品目录。每次内容更新都需要重新上传并经 B 站审核。

飞书「AI 页面搭建」的分享网页是另一套代码，要单独编辑发布。

## 画廊的交互细节

- 等宽卡片放进当前最短的一列，保留原始画幅；加载更多沿用同一布局。
- 卡片接近视口 600px 时排队加载封面，最多六张并发；图片真正解码后才替换文字骨架。
- 搜索和筛选基于完整目录。搜索栏只有搜索和筛选入口，收录类型放在筛选面板里；手机上是底部面板。选好点「应用」，直接关掉会丢弃未应用的修改；入口显示已选条件数。
- 标题栏高度实时测量，搜索栏紧贴其下；往下滚收起，往回滚展开。
- 首页是鲜明的蓝色流体，画廊背景更暗；保留打字机和滚动字幕。首屏只统计作品数和提示词数。图标是同一套线性 SVG。卡片标题电脑 17px、手机 14px。
- 「光彩跃然」四个字用随站提供的 Noto Serif SC 子集，各平台字形一致。
- 视频上的手势层避开底部原生控制条：点画面播放暂停，横滑切换作品，竖滑滚动详情。
- 卡片是烟灰色液态玻璃，带指针视差；详情切换有倾斜缩放和分层过渡，开了「减少动态效果」就关掉。视频按真实画幅排版：横屏上下排，电脑上竖屏左右排。不加黑色舞台，也不裁源视频自带的黑边。
- 打开详情时背景降帧，切到后台或开启减少动态效果时暂停。
- 毛玻璃参考了 [Abdughafur Khujzoda 的示例](https://codepen.io/Abdughafur-Khujzoda/pen/jEyVvqK)，模糊和折射单独一层，文字、封面、视频保持清晰。切换参考了 [TheMOZZARELLA 的视差卡片](https://codepen.io/TheMOZZARELLA/pen/OJqrvNo)，都是本地实现，不加载第三方演示或轮播库。手机用轻量毛玻璃；电脑只给接近视口的卡片开折射。

## 发布与回退

每次内容发布和源码修改都有提交记录，第一个完整站点打了 `v1.0.0` 标签。**Commits** 看改动，**Actions** 看构建和部署。

要撤回某次修改，`git revert <提交ID>` 后推送 `main`，会留下回退记录并重新部署。不要只改 URL 里的版本号。

## 历次导入

**2026-10-23 · MG 动画风格 15 种。** 收录 [Vincentwei1021/mg-styles-15](https://github.com/Vincentwei1021/mg-styles-15)：15 套完整原文提示词、15 个原始示例视频、15 张封面，归入「Claude Opus 5.5 / 代码生成视频」。提示词和仓库原文件逐条核对，视频全流解码通过，飞书字段和附件回读一致。这批没有重新生成，不代表提示词复现过。保留作者、源码、预览链接和 [MIT 许可](../public/licenses/mg-styles-15-MIT.txt)。入库后全库 8,962 条。

**2026-10-08 · Opus 5.5 补充。** 从 [Prompt Motion](https://prompt-motion.com/) 和 [YouMind](https://youmind.com/zh-CN/opus-5-5-prompts/explore?sortBy=views&sortOrder=desc) 收录 481 条作品、489 个视频、481 张封面，原有 6,779 条不动，合计 7,260 条。按原帖和完整视频指纹去重；同一视频的两个来源及提示词写法合并保留。3 条只公开了 Skill、1 条提示词和视频主题对不上，标为「待整理」。收录验收不代表提示词复现过。

**2026-09-19 · Seedance 视频与封面补齐。** 5,924 条补齐成功，69 条持续下载失败，备份后移除。作品库最终 6,779 条，其中 Seedance 案例 5,944 条。见 [整理结果与公开来源清单](../reports/2026-09-19-seedance-import/README.md)。
