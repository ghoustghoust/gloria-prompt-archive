import importlib.util
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from datetime import datetime, timezone, timedelta
import zipfile

ROOT = Path(__file__).resolve().parents[1]
def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

pack = load('pack', 'package-toy.py')
prepare = load('prepare', 'prepare-toy-catalog.py')
publish = load('publish', 'publish-toy.py')

def catalog():
    return {'schemaVersion':1, 'count':1, 'updatedAt':datetime.now(timezone.utc).isoformat(),
            'mediaMode':'feishu-links', 'mediaExpiresAt':(datetime.now(timezone.utc)+timedelta(hours=23)).isoformat(),
            'items':[{'id':'a'*14, 'title':'A work', 'prompt':'Original prompt'}]}

class ToyPipelineTests(unittest.TestCase):
    def test_zip_contains_the_exact_catalog_and_relative_entry(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); dist=root/'dist'
            (dist/'data').mkdir(parents=True);(dist/'assets').mkdir()
            (dist/'index.html').write_text('<script type="module" src="./assets/app.js"></script>')
            (dist/'assets/app.js').write_text("fetch('./data/catalog.json')")
            raw=json.dumps(catalog()).encode();(dist/'data/catalog.json').write_bytes(raw)
            report=pack.package(dist,root/'toy.zip',root/'report.json')
            self.assertFalse(report['githubCatalogRequired'])
            with zipfile.ZipFile(root/'toy.zip') as archive:
                self.assertEqual(archive.read('data/catalog.json'),raw)
                self.assertIn('index.html',archive.namelist())
            (dist/'assets/app.js').write_bytes(pack.REMOTE_CATALOG)
            with self.assertRaisesRegex(ValueError,'GitHub catalog dependency'):
                pack.package(dist,root/'toy.zip',root/'report.json')

    def test_stale_duplicate_and_private_catalogs_cannot_be_published(self):
        data=catalog();data['mediaExpiresAt']=(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat()
        with self.assertRaisesRegex(ValueError,'8 hours'): pack.validate_catalog(json.dumps(data).encode())
        data=catalog();data['items']*=2;data['count']=2
        with self.assertRaisesRegex(ValueError,'duplicate'): pack.validate_catalog(json.dumps(data).encode())
        data=catalog();data['items'][0]['app_secret']='should-never-be-published'
        with self.assertRaisesRegex(ValueError,'Private'): pack.validate_catalog(json.dumps(data).encode())

    def test_only_a_regular_catalog_member_is_read_from_the_pages_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            target=Path(directory)/'artifact.tar';raw=json.dumps(catalog()).encode()
            with tarfile.open(target,'w') as archive:
                member=tarfile.TarInfo('./data/catalog.json');member.size=len(raw)
                archive.addfile(member,io.BytesIO(raw))
                traversal=tarfile.TarInfo('../../not-extracted');traversal.size=0;archive.addfile(traversal,io.BytesIO())
            self.assertEqual(prepare.catalog_from_archive(target),raw)
            with tarfile.open(target,'w') as archive:
                member=tarfile.TarInfo('data/catalog.json');member.type=tarfile.SYMTYPE;member.linkname='/etc/passwd';archive.addfile(member)
            with self.assertRaises(ValueError): prepare.catalog_from_archive(target)

    def test_preview_never_submits_and_submit_requires_approval(self):
        with patch.dict(os.environ,{},clear=True):
            self.assertNotIn('--yes',publish.update_command('toy','toy.zip','preview'))
            with self.assertRaisesRegex(ValueError,'explicit approval'): publish.update_command('toy','toy.zip','submit')
        with patch.dict(os.environ,{'TOY_SUBMIT_APPROVED':'1'}):
            self.assertIn('--yes',publish.update_command('toy','toy.zip','submit'))

    def test_auth_errors_do_not_echo_the_credential(self):
        token='sensitive_session_token_'+('x'*40)
        self.assertNotIn(token,publish.safe_message('token='+token,token))
        self.assertNotIn(token,publish.safe_message('Bearer '+token))

if __name__ == '__main__': unittest.main()
