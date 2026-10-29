// Interface text in Chinese and English. Collected content (titles, prompts, notes) stays as published;
// facet names get English labels for display, and both names are searchable in either language.
export const ENGLISH_NAMES = {
  '即梦 / Seedance': 'Seedance (即梦)', 'minimax h3': 'MiniMax H3', '可灵 Kling': 'Kling (可灵)', '海螺': 'Hailuo (海螺)',
  '待确认': 'Unconfirmed', '其他': 'Other',
  '文生视频': 'Text to video', '图像生成': 'Image', '图生视频': 'Image to video', '代码生成视频': 'Video made in code',
  '视频生视频': 'Video to video', '首尾帧': 'First & last frame',
  '原创': 'Original', '官方案例': 'Official example', '小红书': 'Xiaohongshu', '抖音': 'Douyin', 'B站': 'Bilibili',
  '电影感': 'Cinematic', '人物': 'People', '动画': 'Animation', '写实': 'Realistic', '剧情动作与趣味': 'Story & action',
  '产品广告': 'Product ads', '奇幻场景与角色': 'Fantasy', '运镜': 'Camera moves', '科幻': 'Sci-fi', '风景': 'Landscape',
  '动态图形': 'Motion graphics', '3D与仿真': '3D & simulation', '运镜与转场': 'Camera & transitions', '科普讲解': 'Explainers',
  'UI动效': 'UI motion', '音乐视频': 'Music video', '画面风格与图形叠加': 'Style & overlays', '像素艺术': 'Pixel art',
  '分身与尺度错觉': 'Clones & scale tricks', '时间冻结与悬浮': 'Time freeze', '空间形变与消失': 'Warp & vanish',
  '历史叙事': 'History', '名画再创作': 'Famous paintings remade',
  // Fixed media captions written by the sync.
  '作品图片': 'Image', '提示词出处截图': 'Screenshot of where the prompt came from', '本站补图 · 按收录提示词生成，非原作者原图': "Cover by this site · made from the collected prompt, not the author's image",
};

export const POEM = {
  source: 'https://www.zhihu.com/pin/1567984951919906816',
  zh: ['宛如一只蓝色蝴蝶', '扑闪着翅膀', '在无边海洋上空漫舞、求索。', '不为争渡到某个梦境般的彼岸，', '只是幻想着在微澜之间掀起一场风暴浪潮，', '让世界感受自己的壮阔波澜。', '在它心中，自己翅膀上那抹色彩并非天蓝或海蓝，而是独一无二、属于自己的生命之蓝。'],
  en: ['A blue butterfly,', 'wings aflutter,', 'drifting and searching over an endless sea.', 'Not racing toward a phantom shore,', 'only dreaming of raising a storm from a ripple—', 'to move the world with its own vast tide.', 'For it knows the color on its wings', 'is neither sky nor ocean,', 'but a blue all its own: the blue of life.'],
  // Typewriter pages: the same lines, grouped to fit the hero. The long last line breaks at its commas.
  pages: {
    zh: [['宛如一只蓝色蝴蝶', '扑闪着翅膀', '在无边海洋上空漫舞、求索。'], ['不为争渡到某个梦境般的彼岸，', '只是幻想着在微澜之间掀起一场风暴浪潮，', '让世界感受自己的壮阔波澜。'], ['在它心中，', '自己翅膀上那抹色彩并非天蓝或海蓝，', '而是独一无二、属于自己的生命之蓝。']],
    en: [['A blue butterfly,', 'wings aflutter,', 'drifting and searching over an endless sea.'], ['Not racing toward a phantom shore,', 'only dreaming of raising a storm from a ripple—', 'to move the world with its own vast tide.'], ['For it knows the color on its wings', 'is neither sky nor ocean,', 'but a blue all its own: the blue of life.']],
  },
};

export const TEXT = {
  zh: {
    'page.title': '光彩跃然 · 影像灵感库',
    'page.description': '光彩跃然，SEASNAKE 的影像灵感库。收藏提示词、视频和视觉效果，沿着一点灵感，走进自己的生命之蓝。',
    'lang.switch': 'EN', 'lang.switchLabel': 'Switch to English',
    'skip': '跳到影像灵感库', 'top.label': '回到顶部', 'brand.label': '打开 SEASNAKE 的 X 主页',
    'hero.enter': '浏览灵感', 'hero.countLoading': '提示词 · 视频 · 创作参考', 'hero.count': '{works} 个作品 · {prompts} 条提示词',
    'hero.pause': '暂停流动', 'hero.resume': '继续流动',
    'poem.open': '读整首诗：首页背景的由来', 'poem.title': '这片蓝的由来', 'poem.note': '几年前写的一首小诗，首页这片蓝色流体就是从它来的。',
    'poem.source': '知乎原文', 'poem.close': '关闭',
    'archive.title': '影像灵感库', 'archive.intro': '让片刻的灵感，有处可寻。', 'archive.updated': '最近收录同步 {date}',
    'search.placeholder': '搜索作品、提示词、风格…', 'filter.open': '筛选', 'filter.clear': '清除',
    'result.loading': '正在整理影像…', 'result.count': '{count} 个作品', 'result.failed': '加载未完成', 'batch.status': '已呈现 {shown} / {total}',
    'catalog.error': '暂时没能读取灵感库。', 'catalog.retry': '重新加载',
    'empty.title': '灵感还在别处', 'empty.text': '换个关键词，或清除筛选再看看。', 'empty.reset': '查看全部作品',
    'gallery.label': '作品画廊', 'loadMore': '加载更多',
    'footnote': '标记「效果参考」的收录未提供原始提示词。提示词与效果说明分别呈现。', 'footnote.likes': '点赞按当前浏览器记录；更换设备或清空浏览器数据后可能再次点赞。',
    'footer.bilibili': 'B站', 'footer.zhihu': '知乎',
    'filter.title': '筛选作品', 'filter.close': '关闭筛选', 'filter.kinds': '收录类型', 'kind.all': '全部', 'kind.prompt': '有提示词', 'kind.reference': '效果参考',
    'filter.source': '来源', 'filter.model': '模型', 'filter.method': '生成方式', 'filter.allSources': '全部来源', 'filter.allModels': '全部模型', 'filter.allMethods': '全部方式',
    'filter.sourceLabel': '筛选来源', 'filter.modelLabel': '筛选模型', 'filter.methodLabel': '筛选生成方式', 'filter.styles': '风格与效果',
    'filter.reset': '重置', 'filter.apply': '应用筛选',
    'sort.label': '作品排序', 'sort.current': '作品排序：{label}', 'sort.recent': '最近收录', 'sort.popular': '最多点赞',
    'work.swipe': '左右滑动切换', 'work.close': '关闭详情', 'work.video': '作品视频', 'work.prompt': '提示词', 'work.effect': '效果说明',
    'work.copyPrompt': '复制提示词', 'work.copyLink': '复制作品链接', 'work.negative': '负面提示词', 'work.copy': '复制', 'work.parameters': '视频信息与参数',
    'work.source': '查看原始来源', 'work.open': '查看作品：{title}',
    'work.model': '模型', 'work.archivedModel': '原帖归档模型', 'work.method': '生成方式', 'work.coverMethod': '补图方式', 'work.coverMade': '本站按提示词生成',
    'work.modelVersion': '模型版本', 'work.unconfirmed': '待确认', 'work.promptSource': '提示词来源',
    'work.effectOnly': '这条收录用于视觉效果参考。', 'work.usage': '适合用途：{usage}',
    'work.promptNote': '保留收录时的原文。使用时可按自己的素材调整。', 'work.effectNote': '原作者未提供原始提示词；以上为效果说明，不代表可直接复现的提示词。',
    'work.size': '{width} × {height} · {duration}', 'work.seconds': '{seconds} 秒', 'work.noDuration': '时长未标注',
    'media.playHint': '点击播放视频 · 作品及提示词权利归原作者所有', 'media.videoError': '视频暂时无法播放。', 'media.imageError': '图片暂时无法加载。',
    'media.retryVideo': '重新加载视频', 'media.retryImage': '重新加载图片', 'media.none': '这条收录暂无可展示的媒体。',
    'media.image': '图片', 'media.rights': '作品及提示词权利归原作者所有', 'media.coverRights': '提示词来源详见原帖',
    'media.prevLabel': '上一张图片', 'media.prev': '上一张', 'media.nextLabel': '下一张图片', 'media.next': '下一张',
    'evidence.title': '提示词出处截图', 'evidence.image': '提示词出处截图 {n}', 'cover.generated': '本站补图',
    'card.coverPending': '封面暂未就绪', 'card.openForVideo': '可打开作品查看视频',
    'summary.effect': '效果：{text}', 'summary.none': '效果参考 · 原作者未提供提示词',
    'like.add': '点赞此作品', 'like.remove': '取消点赞', 'like.count': '，{count} 个赞', 'like.retry': '点赞数暂未加载，点击重试', 'like.failed': '点赞暂时不可用，请稍后重试。',
    'toast.promptCopied': '提示词已复制', 'toast.noPrompt': '这条作品没有原始提示词，已复制作品链接', 'toast.negativeCopied': '负面提示词已复制',
    'toast.linkCopied': '作品链接已复制', 'toast.copyFailed': '复制未成功，请长按或选中文字复制', 'toast.playFailed': '暂时无法播放，请使用播放器重试',
    'toast.missing': '未找到这个作品，可能已从收录中移除',
  },
  en: {
    'page.title': '光彩跃然 · GLORIA Prompt Archive',
    'page.description': "SEASNAKE's archive of AI video and image prompts, each credited to its author.",
    'lang.switch': '中文', 'lang.switchLabel': '切换到中文',
    'skip': 'Skip to the gallery', 'top.label': 'Back to top', 'brand.label': 'SEASNAKE on X',
    'hero.enter': 'Browse', 'hero.countLoading': 'Prompts · Videos · References', 'hero.count': '{works} works · {prompts} prompts',
    'hero.pause': 'Pause the flow', 'hero.resume': 'Resume the flow',
    'poem.open': 'Read the whole poem behind this page', 'poem.title': 'Where the blue comes from', 'poem.note': 'A short poem I wrote a few years ago. The blue fluid on this page grew out of it.',
    'poem.source': 'Original on Zhihu', 'poem.close': 'Close',
    'archive.title': 'Prompt Gallery', 'archive.intro': 'Somewhere for a passing idea to be found again.', 'archive.updated': 'Last synced {date}',
    'search.placeholder': 'Search works, prompts, styles…', 'filter.open': 'Filter', 'filter.clear': 'Clear',
    'result.loading': 'Gathering the works…', 'result.count': '{count} works', 'result.failed': "Couldn't finish loading", 'batch.status': 'Showing {shown} / {total}',
    'catalog.error': "Couldn't load the library just now.", 'catalog.retry': 'Try again',
    'empty.title': 'Nothing here yet', 'empty.text': 'Try another keyword, or clear the filters.', 'empty.reset': 'Show all works',
    'gallery.label': 'Gallery', 'loadMore': 'Load more',
    'footnote': 'Works marked "Effect reference" come without the original prompt. Prompts and effect notes are kept apart.', 'footnote.likes': 'Likes are kept per browser, so another device or cleared browser data lets you like again.',
    'footer.bilibili': 'Bilibili', 'footer.zhihu': 'Zhihu',
    'filter.title': 'Filter works', 'filter.close': 'Close filters', 'filter.kinds': 'Type', 'kind.all': 'All', 'kind.prompt': 'With prompt', 'kind.reference': 'Effect reference',
    'filter.source': 'Source', 'filter.model': 'Model', 'filter.method': 'Method', 'filter.allSources': 'All sources', 'filter.allModels': 'All models', 'filter.allMethods': 'All methods',
    'filter.sourceLabel': 'Filter by source', 'filter.modelLabel': 'Filter by model', 'filter.methodLabel': 'Filter by method', 'filter.styles': 'Style & effect',
    'filter.reset': 'Reset', 'filter.apply': 'Apply',
    'sort.label': 'Sort', 'sort.current': 'Sort: {label}', 'sort.recent': 'Newest', 'sort.popular': 'Most liked',
    'work.swipe': 'Swipe to switch', 'work.close': 'Close', 'work.video': 'Video', 'work.prompt': 'Prompt', 'work.effect': 'Effect',
    'work.copyPrompt': 'Copy prompt', 'work.copyLink': 'Copy link', 'work.negative': 'Negative prompt', 'work.copy': 'Copy', 'work.parameters': 'Media details & parameters',
    'work.source': 'Original post', 'work.open': 'Open {title}',
    'work.model': 'Model', 'work.archivedModel': 'Model in the original post', 'work.method': 'Method', 'work.coverMethod': 'Cover made by', 'work.coverMade': 'This site, from the prompt',
    'work.modelVersion': 'Model version', 'work.unconfirmed': 'Unconfirmed', 'work.promptSource': 'Prompt from',
    'work.effectOnly': 'This work is here as a visual reference.', 'work.usage': 'Good for: {usage}',
    'work.promptNote': 'The text as collected. Adjust it to your own material.', 'work.effectNote': "The author didn't publish a prompt. This describes the effect; it isn't a prompt that reproduces it.",
    'work.size': '{width} × {height} · {duration}', 'work.seconds': '{seconds} s', 'work.noDuration': 'duration not noted',
    'media.playHint': "Tap to play · Rights stay with the author", 'media.videoError': "The video can't play right now.", 'media.imageError': "The image can't load right now.",
    'media.retryVideo': 'Reload video', 'media.retryImage': 'Reload image', 'media.none': 'Nothing to show for this one.',
    'media.image': 'Image', 'media.rights': 'Rights stay with the author', 'media.coverRights': 'See the original post for the prompt',
    'media.prevLabel': 'Previous image', 'media.prev': 'Previous', 'media.nextLabel': 'Next image', 'media.next': 'Next',
    'evidence.title': 'Screenshots of where the prompt came from', 'evidence.image': 'Prompt source screenshot {n}', 'cover.generated': 'Cover by this site',
    'card.coverPending': 'Cover not ready yet', 'card.openForVideo': 'Open the work to watch',
    'summary.effect': 'Effect: {text}', 'summary.none': 'Effect reference · no prompt from the author',
    'like.add': 'Like this work', 'like.remove': 'Unlike', 'like.count': ', {count} likes', 'like.retry': "Likes didn't load. Tap to retry", 'like.failed': "Likes aren't working right now. Try again later.",
    'toast.promptCopied': 'Prompt copied', 'toast.noPrompt': 'No original prompt here, so the link was copied', 'toast.negativeCopied': 'Negative prompt copied',
    'toast.linkCopied': 'Link copied', 'toast.copyFailed': "Couldn't copy. Select the text and copy it by hand", 'toast.playFailed': "Can't play right now. Try the player controls",
    'toast.missing': "That work isn't in the library any more",
  },
};

let current = 'zh';
export const language = () => current;
export function setLanguage(lang) { current = TEXT[lang] ? lang : 'zh'; return current; }

// A ?lang= link wins, then the visitor's earlier choice, then the browser's languages.
export function pickLanguage({ search = '', stored = '', languages = [] } = {}) {
  const asked = new URLSearchParams(search).get('lang');
  if (TEXT[asked]) return asked;
  if (TEXT[stored]) return stored;
  return languages.some(value => /^zh\b/i.test(value)) || !languages.length ? 'zh' : 'en';
}

export function t(key, values = {}) {
  const text = TEXT[current][key] ?? TEXT.zh[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}
export const label = value => current === 'en' ? ENGLISH_NAMES[value] || value : value;
export const searchAlias = item => [item.model, item.method, item.source, ...(item.tags || [])].map(value => ENGLISH_NAMES[value]).filter(Boolean).join(' ');

// Static markup carries data-i18n (text) and data-i18n-attr ("attr:key;attr:key").
export function translatePage(root = document) {
  root.documentElement.lang = current === 'en' ? 'en' : 'zh-CN';
  root.title = t('page.title');
  root.querySelector('meta[name="description"]')?.setAttribute('content', t('page.description'));
  root.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  root.querySelectorAll('[data-i18n-attr]').forEach(element => {
    for (const pair of element.dataset.i18nAttr.split(';')) { const [attribute, key] = pair.split(':'); element.setAttribute(attribute, t(key)); }
  });
}
