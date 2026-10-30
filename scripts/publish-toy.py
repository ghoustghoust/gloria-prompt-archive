"""Publish through the official CLI, keeping the session out of output and artifacts."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

TOY_ID = '42481513136128'
OWNER_UID = 486682682
TOY_URL = 'https://www.bilibili.com/toy/gloria/index.html'

def safe_message(text, token=''):
    if token: text = text.replace(token, '[redacted]')
    text = re.sub(r'(?i)(Bearer\s+)[A-Za-z0-9._~-]+', r'\1[redacted]', text)
    text = re.sub(r'[A-Za-z0-9_-]{32,}', '[redacted]', text)
    return text[:500]

def update_command(binary, archive, mode):
    command = [binary, 'update', TOY_ID, str(archive), '--json']
    if mode == 'submit':
        if os.environ.get('TOY_SUBMIT_APPROVED') != '1':
            raise ValueError('Submitting needs explicit approval; preview mode remains available')
        command.append('--yes')
    return command

@contextmanager
def session():
    token = os.environ.get('TOY_SESSION_TOKEN', '')
    target = Path.home() / '.toy/session.json'
    old = target.read_bytes() if target.exists() else None
    if token:
        if len(token) < 24 or any(c.isspace() for c in token):
            raise ValueError('Invalid Toy session secret')
        target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(descriptor, 'w') as stream:
            json.dump({'session_token':token, 'uid':OWNER_UID}, stream)
        target.chmod(0o600)
    elif not target.exists():
        raise ValueError('No Toy session: configure the encrypted environment secret first')
    try:
        yield token
    finally:
        if token:
            if old is None: target.unlink(missing_ok=True)
            else: target.write_bytes(old); target.chmod(0o600)

def cli(command, token):
    env = os.environ.copy()
    env.pop('TOY_SESSION_TOKEN', None)
    result = subprocess.run(command, capture_output=True, text=True, env=env, timeout=600)
    if result.returncode:
        # Never echo raw CLI stdout/stderr: transport errors may contain credentials.
        try:
            data = json.loads(result.stdout or result.stderr)
            message = data.get('message') or data.get('error') or 'Toy CLI request failed'
            if not isinstance(message, str): message = 'Toy CLI request failed'
        except ValueError:
            message = 'Toy CLI request failed; check the session and network connection'
        raise ValueError(safe_message(message, token))
    try: data = json.loads(result.stdout)
    except ValueError: raise ValueError('Toy CLI did not return JSON') from None
    if isinstance(data, dict) and isinstance(data.get('data'), dict): data = data['data']
    return data

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--binary', default='toy')
    parser.add_argument('--mode', choices=['preview','submit','check-auth'], default='preview')
    parser.add_argument('--archive', default='.local/toy/gloria-toy.zip')
    parser.add_argument('--report', default='.local/toy/package-report.json')
    args = parser.parse_args()
    with session() as token:
        user = cli([args.binary, 'whoami', '--json'], token)
        if user.get('uid') != OWNER_UID: raise ValueError('Toy session belongs to a different creator')
        listing = cli([args.binary, 'mylist', '--json'], token)
        target = next((i for i in listing.get('list', []) if str(i.get('id')) == TOY_ID), None)
        if not target or target.get('url') != TOY_URL: raise ValueError('The intended Gloria Toy is not available to this session')
        if args.mode == 'check-auth':
            print(json.dumps({'authenticated':True, 'uid':OWNER_UID, 'toyId':TOY_ID, 'status':target.get('status')}))
            return
        archive, report_path = Path(args.archive), Path(args.report)
        report = json.loads(report_path.read_text())
        if hashlib.sha256(archive.read_bytes()).hexdigest() != report['sha256']:
            raise ValueError('Package differs from its checked build report')
        expires = report.get('mediaExpiresAt')
        if expires and datetime.fromisoformat(expires.replace('Z', '+00:00')) < datetime.now(timezone.utc) + timedelta(hours=8):
            raise ValueError('Media links are too close to expiration; regenerate the package')
        result = cli(update_command(args.binary, archive, args.mode), token)
        preview = result.get('preview_url')
        if not isinstance(preview, str) or not re.fullmatch(r'https://www\.bilibili\.com/toy/preview/[A-Za-z0-9_-]+/index\.html', preview):
            raise ValueError('Toy did not return a valid platform preview URL')
        output = {'mode':args.mode, 'toyId':TOY_ID, 'targetUrl':TOY_URL, 'previewUrl':preview,
                  'status':result.get('status') or ('preview' if args.mode == 'preview' else 'submitted'),
                  'catalogCount':report['catalogCount'], 'catalogUpdatedAt':report['catalogUpdatedAt'],
                  'mediaExpiresAt':report.get('mediaExpiresAt'), 'sha256':report['sha256']}
        (report_path.parent / 'publication-result.json').write_text(json.dumps(output, indent=2)+'\n')
        print(json.dumps(output, ensure_ascii=False))
        if os.environ.get('GITHUB_STEP_SUMMARY'):
            with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as stream:
                stream.write(f"## Gloria Toy {args.mode}\n\n[Open preview]({preview})\n\nWorks: {report['catalogCount']} · Status: {output['status']}\n\nMedia links expire: {output['mediaExpiresAt']}\n")

if __name__ == '__main__':
    try: main()
    except (ValueError, OSError, KeyError, subprocess.TimeoutExpired):
        # Suppress tracebacks and raw exception values, which may contain CLI output.
        import sys
        error = sys.exc_info()[1]
        print(safe_message(str(error), os.environ.get('TOY_SESSION_TOKEN','')), file=sys.stderr)
        raise SystemExit(1) from None
