#!/usr/bin/env python3
"""Read the public gallery projection. Publish links, never attachment binaries or credentials."""
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
API = 'https://open.feishu.cn/open-apis/'
BASE = os.environ.get('LARK_BASE_TOKEN', 'Fiqwbq0xeahG6RsvP3TcCJgQnNf')
TABLE = os.environ.get('LARK_TABLE_ID', 'tbl5wfUVflIsVTvv')

class RateGate:
    """Share request-start pacing across workers and retries."""
    def __init__(self, interval=.25):
        self.interval = interval
        self.next_start = 0
        self.lock = threading.Lock()

    def wait(self):
        with self.lock:
            delay = self.next_start - time.monotonic()
            if delay > 0:
                time.sleep(delay)
            self.next_start = time.monotonic() + self.interval


def request(path, token=None, params=None, body=None, gate=None):
    url = API + path + ('?' + urlencode(params, doseq=True) if params else '')
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    for attempt in range(4):
        if gate is not None:
            gate.wait()
        req = Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers)
        try:
            with urlopen(req, timeout=35) as response:
                result = json.load(response)
        except HTTPError as error:
            try:
                detail = json.loads(error.read(65536))
            except (ValueError, OSError, KeyError, AttributeError):
                detail = {}
            code = detail.get('code')
            if error.code == 429 or error.code >= 500 or code in (99991400, 99991401):
                retry_after = error.headers.get('Retry-After', '') if error.headers else ''
                delay = float(retry_after) if retry_after.isdigit() else 2 ** attempt
                time.sleep(min(delay, 60)); continue
            # Log only numeric codes and request IDs, never request URLs or response bodies.
            request_id = error.headers.get('X-Tt-Logid', '') if error.headers else ''
            request_id = re.sub(r'[^a-zA-Z0-9_-]', '', request_id)[:100]
            raise RuntimeError(f'Feishu HTTP {error.code}; API code {code}; operation {path.split("/")[0]}; request ID {request_id or "unavailable"}') from None
        except (URLError, TimeoutError):
            if attempt == 3: raise RuntimeError('Feishu connection failed; previous deployment retained') from None
            time.sleep(2 ** attempt); continue
        if result.get('code') in (99991400, 99991401):
            time.sleep(2 ** attempt); continue
        if result.get('code') != 0:
            raise RuntimeError(f'Feishu API error {result.get("code")}; operation {path.split("/")[0]}')
        return result
    raise RuntimeError('Feishu retry limit reached')

def pages(path, token):
    cursor = None
    visited = set()
    result = []
    while True:
        params = {'page_size': 100}
        if cursor: params['page_token'] = cursor
        data = request(path, token, params=params)['data']
        result.extend(data.get('items', []))
        if not data.get('has_more'): return result
        cursor = data.get('page_token')
        if not cursor or cursor in visited: raise RuntimeError('Incomplete or repeated pagination')
        visited.add(cursor)

def text(value):
    if value is None: return ''
    if isinstance(value, str): return value
    if isinstance(value, list): return ''.join(text(v) for v in value)
    if isinstance(value, dict): return str(value.get('text') or value.get('link') or value.get('name') or '')
    return str(value)

def options(value):
    if not value: return []
    return [text(x) for x in value] if isinstance(value, list) else [text(value)]

def public_url(value):
    value = text(value).strip()
    p = urlparse(value)
    if p.scheme not in ('https', 'http') or not p.hostname or p.username or p.password: return None
    if p.hostname.endswith(('feishu.cn', 'larksuite.com')): return None
    return value

def dimensions(parameters):
    # Prefer actual downloaded media dimensions over prompt target ratios.
    sections = re.split(r'实测|实际(?:WebM|MP4|成片)|下载成片', parameters)
    # A later note such as "成片实测值" has no dimensions; keep the measured
    # section before it instead of discarding that section.
    for section in reversed(sections):
        match = re.search(r'(\d{2,5})\s*[×xX]\s*(\d{2,5})', section)
        if match: return int(match[1]), int(match[2]), True
    return 4, 3, False

def build_catalog(records, urls, fields):
    output = []
    seen = set()
    for record in records:
        rid = record['record_id']
        if rid in seen: raise RuntimeError('Duplicate record in pagination')
        seen.add(rid)
        f = record.get('fields', {})
        def media(name):
            return [urls[a['file_token']] for a in f.get(name, []) if isinstance(a, dict) and a.get('file_token') in urls]
        covers, videos = media('封面'), media('对应视频')
        prompt, notes, parameters = text(f.get('提示词')), text(f.get('复现笔记')), text(f.get('生成参数'))
        description = re.search(r'效果说明[：:]\s*(.+?)(?:\n\s*\n|$)', notes, re.S)
        usage = re.search(r'适合用途[：:]\s*([^\n]+)', notes)
        width, height, known = dimensions(parameters)
        created = f.get('收录时间')
        output.append({
            'id': hashlib.sha256(rid.encode()).hexdigest()[:14],
            'title': text(f.get('作品名称')) or '未命名作品',
            'kind': 'prompt' if prompt.strip() else 'reference', 'prompt': prompt,
            'negativePrompt': text(f.get('负面提示词')),
            'description': description.group(1).strip() if description else '',
            'usage': usage.group(1).strip() if usage else '',
            'source': text(f.get('来源')) or '未标注', 'sourceUrl': public_url(f.get('原始链接')),
            'author': text(f.get('作者')), 'model': text(f.get('模型')) or '待确认',
            'modelVersion': text(f.get('模型版本')), 'method': text(f.get('生成方式')) or '待确认',
            'tags': options(f.get('风格标签')), 'status': text(f.get('状态')),
            'parameters': parameters, 'createdAt': created,
            'cover': covers[0] if covers else '', 'video': videos[0] if videos else public_url(f.get('视频链接')) or '',
            'references': media('参考图'), 'width': width, 'height': height, 'aspectKnown': known, 'duration': 0,
        })
    output.sort(key=lambda x: str(x.get('createdAt') or ''), reverse=True)
    for i, item in enumerate(output): item['order'] = i
    field_names = {'来源': 'source', '模型': 'model', '生成方式': 'method', '风格标签': 'tags'}
    choices = {field_names[f['field_name']]: [o['name'] for o in f.get('property', {}).get('options', [])] for f in fields if f['field_name'] in field_names}
    now = datetime.now(timezone.utc)
    return {'schemaVersion': 1, 'updatedAt': now.isoformat(), 'mediaExpiresAt': (now + timedelta(hours=24)).isoformat(), 'mediaMode': 'feishu-links', 'count': len(output), 'items': output, 'options': choices}

def refresh_media_urls(tokens, token):
    tokens = list(dict.fromkeys(tokens))
    batches = [tokens[start:start + 5] for start in range(0, len(tokens), 5)]
    gate = RateGate()  # Four starts/second, below the documented five QPS cap.
    started = time.monotonic()

    def fetch(batch):
        data = request('drive/v1/medias/batch_get_tmp_download_url', token,
                       params={'file_tokens': batch, 'extra': json.dumps({'bitablePerm': {'tableId': TABLE}})},
                       gate=gate)['data']
        urls = {item['file_token']: item['tmp_download_url']
                for item in data.get('tmp_download_urls', [])
                if item.get('file_token') in batch and isinstance(item.get('tmp_download_url'), str)
                and item['tmp_download_url'].startswith('https://')}
        if any(t not in urls for t in batch):
            raise RuntimeError('Missing media URL; previous deployment retained')
        return urls

    urls = {}
    print(f'Refreshing {len(tokens)} media links in {len(batches)} batches; four workers, at most four requests/second.', flush=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for completed, result in enumerate(pool.map(fetch, batches), 1):
            urls.update(result)
            if completed % 100 == 0 or completed == len(batches):
                print(f'Media batches {completed}/{len(batches)}; elapsed {time.monotonic() - started:.0f}s.', flush=True)
    return urls


def main():
    app_id, secret = os.environ.get('LARK_APP_ID'), os.environ.get('LARK_APP_SECRET')
    if not app_id or not secret: raise RuntimeError('Missing LARK_APP_ID / LARK_APP_SECRET')
    token = request('auth/v3/tenant_access_token/internal', body={'app_id': app_id, 'app_secret': secret})['tenant_access_token']
    prefix = f'bitable/v1/apps/{BASE}/tables/{TABLE}'
    fields = pages(prefix + '/fields', token)
    records = pages(prefix + '/records', token)
    if not records: raise RuntimeError('Refusing to replace the gallery with an empty result')
    tokens = list(dict.fromkeys(a['file_token'] for r in records for name in ['封面', '对应视频', '参考图'] for a in r.get('fields', {}).get(name, []) if isinstance(a, dict) and a.get('file_token')))
    urls = refresh_media_urls(tokens, token)
    catalog = build_catalog(records, urls, fields)
    out = ROOT / 'public/data/catalog.json'
    temp = out.with_suffix('.tmp')
    temp.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) + '\n')
    temp.replace(out)
    print(f'Synchronized {len(records)} works and {len(urls)} media links. No media files downloaded.')

if __name__ == '__main__':
    try: main()
    except Exception as error:
        print(str(error), file=sys.stderr); sys.exit(1)
