"""Validate and package a same-origin Toy catalog without including source or credentials."""
import argparse
from datetime import datetime, timezone, timedelta
import hashlib
import json
from pathlib import Path
import re
import zipfile

REMOTE_CATALOG = b'https://seasnakes.github.io/gloria-prompt-archive/data/catalog.json'

def validate_catalog(raw, now=None):
    data = json.loads(raw)
    items = data.get('items')
    if data.get('schemaVersion') != 1 or not isinstance(items, list) or not items or data.get('count') != len(items):
        raise ValueError('Incomplete catalog; the previous Toy must be retained')
    ids = [item.get('id') for item in items]
    if any(not isinstance(i, str) or not re.fullmatch(r'[a-f0-9]{14}', i) for i in ids) or len(set(ids)) != len(ids):
        raise ValueError('Invalid or duplicate work IDs')
    if re.search(rb'"(?:app_secret|session_token|tenant_access_token|user_access_token|file_token|record_id)"\s*:', raw, re.I):
        raise ValueError('Private metadata in the public catalog')
    if data.get('mediaMode') == 'feishu-links':
        expires = datetime.fromisoformat(data.get('mediaExpiresAt', '').replace('Z', '+00:00'))
        if expires.tzinfo is None or expires < (now or datetime.now(timezone.utc)) + timedelta(hours=8):
            raise ValueError('Media links expire in less than 8 hours; run the full Feishu sync first')
    return data

def package(dist, output, report_path, max_bytes=50_000_000):
    dist, output, report_path = Path(dist), Path(output), Path(report_path)
    entry = dist / 'index.html'
    if not entry.is_file() or entry.stat().st_size > 1_000_000:
        raise ValueError('Toy requires an index.html smaller than 1 MB')
    catalog = validate_catalog((dist / 'data/catalog.json').read_bytes())
    files = sorted(p for p in dist.rglob('*') if p.is_file())
    for p in files:
        relative = p.relative_to(dist)
        if p.is_symlink() or any(part.startswith('.') or part in ('node_modules', 'src', 'scripts') for part in relative.parts):
            raise ValueError('Source, hidden files or links in the upload package')
        if p.suffix in ('.js', '.mjs') and REMOTE_CATALOG in p.read_bytes():
            raise ValueError('The Toy still contains a GitHub catalog dependency')
    if not any(b'./data/catalog.json' in p.read_bytes() for p in files if p.suffix == '.js'):
        raise ValueError('The Toy must explicitly load its packaged catalog')
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for p in files:
            archive.write(p, p.relative_to(dist).as_posix())
    size = output.stat().st_size
    if size > max_bytes:
        output.unlink()
        raise ValueError('Toy ZIP exceeds the configured 50 MB budget')
    report = {'catalogCount': catalog['count'], 'catalogUpdatedAt': catalog.get('updatedAt'),
              'mediaExpiresAt': catalog.get('mediaExpiresAt'), 'catalogLocation': 'data/catalog.json',
              'githubCatalogRequired': False, 'archiveBytes': size,
              'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
              'files': [p.relative_to(dist).as_posix() for p in files]}
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dist', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--report', required=True)
    args = parser.parse_args()
    try:
        report = package(args.dist, args.output, args.report)
    except (ValueError, OSError, KeyError) as error:
        raise SystemExit(str(error)) from None
    print(f"Packaged {report['catalogCount']} works; ZIP {report['archiveBytes'] / 1_000_000:.2f} MB; no GitHub catalog dependency.")
