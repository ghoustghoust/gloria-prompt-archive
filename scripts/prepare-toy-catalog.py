"""Reuse the exact catalog from a successful trusted Pages workflow artifact."""
import argparse
import importlib.util
import json
from pathlib import Path, PurePosixPath
import subprocess
import tarfile

spec = importlib.util.spec_from_file_location('package_toy', Path(__file__).with_name('package-toy.py'))
package_toy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package_toy)

def catalog_from_archive(path):
    with tarfile.open(path) as archive:
        matches = [m for m in archive.getmembers() if PurePosixPath(m.name).as_posix().removeprefix('./') == 'data/catalog.json']
        if len(matches) != 1 or not matches[0].isfile() or matches[0].size > 60_000_000:
            raise ValueError('Expected one bounded catalog file in the Pages artifact')
        raw = archive.extractfile(matches[0]).read()
    package_toy.validate_catalog(raw)
    return raw

def gh(*args):
    return subprocess.check_output(['gh', *args], text=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repository', required=True)
    parser.add_argument('--run-id', default='')
    args = parser.parse_args()
    run_id = args.run_id
    if not run_id:
        runs = json.loads(gh('run', 'list', '--repo', args.repository, '--workflow', 'pages.yml', '--branch', 'main', '--status', 'success', '--limit', '1', '--json', 'databaseId'))
        if not runs: raise ValueError('No successful Pages sync is available')
        run_id = str(runs[0]['databaseId'])
    if not run_id.isdigit(): raise ValueError('Invalid source run ID')
    meta = json.loads(gh('run', 'view', run_id, '--repo', args.repository, '--json', 'name,status,conclusion,headBranch,headSha'))
    if meta['name'] != 'Publish GitHub Pages' or meta['status'] != 'completed' or meta['conclusion'] != 'success' or meta['headBranch'] != 'main':
        raise ValueError('Only a completed successful main-branch Pages run may supply the catalog')
    target = Path('.local/toy-source') / run_id
    target.mkdir(parents=True, exist_ok=True)
    if not (target / 'artifact.tar').exists():
        subprocess.run(['gh', 'run', 'download', run_id, '--repo', args.repository, '--name', 'github-pages', '--dir', str(target)], check=True)
    raw = catalog_from_archive(target / 'artifact.tar')
    public = Path('public/data'); public.mkdir(parents=True, exist_ok=True)
    (public / 'catalog.json').write_bytes(raw)
    data = json.loads(raw)
    (public / 'work-ids.json').write_text(json.dumps({'updatedAt':data['updatedAt'], 'ids':[i['id'] for i in data['items']]}) + '\n')
    print(f"Using verified Pages run {run_id}: {data['count']} works")

if __name__ == '__main__':
    try: main()
    except (ValueError, OSError, KeyError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error)) from None
