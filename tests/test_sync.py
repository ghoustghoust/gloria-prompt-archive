import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
spec = importlib.util.spec_from_file_location('sync', Path(__file__).parents[1] / 'scripts/sync_feishu_api.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)
class SyncTests(unittest.TestCase):
    def test_prompt_source_screenshots_are_evidence_and_not_work_covers(self):
        records=[{'record_id':'linuxdo-206','fields':{'作品名称':'城市宣传海报提示词出处截图','关联图片':[{'file_token':'one'},{'file_token':'two'}]}}]
        item=sync.build_catalog(records,{'one':'https://example.com/one.png','two':'https://example.com/two.png'},[])['items'][0]
        self.assertEqual(item['cover'],'')
        self.assertEqual(item['images'],[])
        self.assertEqual(item['sourceImages'],['https://example.com/one.png','https://example.com/two.png'])
    def test_generated_supplement_keeps_its_provenance_and_source_evidence(self):
        records=[{'record_id':'supplement','fields':{'封面':[{'file_token':'cover'}],'关联图片':[{'file_token':'proof'}],'复现笔记':'【本站补图】依据原提示词生成'}}]
        item=sync.build_catalog(records,{'cover':'https://example.com/cover.png','proof':'https://example.com/proof.png'},[])['items'][0]
        self.assertTrue(item['generatedCover'])
        self.assertIn('非原作者原图',item['imageCaptions'][0])
        self.assertEqual(item['images'],['https://example.com/cover.png'])
        self.assertEqual(item['sourceImages'],['https://example.com/proof.png'])
    def test_image_cases_keep_every_display_image_without_a_video(self):
        records=[{'record_id':'image-case','fields':{'作品名称':'two images','封面':[{'file_token':'a'},{'file_token':'b'}],'参考图':[{'file_token':'ref'}]}},
                 {'record_id':'video-case','fields':{'封面':[{'file_token':'a'}],'对应视频':[{'file_token':'video'}]}}]
        catalog=sync.build_catalog(records,{'a':'https://example.com/a.png','b':'https://example.com/b.png','ref':'https://example.com/reference.png','video':'https://example.com/video.mp4'},[])
        image,video=catalog['items']
        self.assertEqual(image['images'],['https://example.com/a.png','https://example.com/b.png'])
        self.assertEqual(image['video'],'')
        self.assertEqual(video['images'],[])
    def test_pagination_stops_and_rejects_repeated_cursor(self):
        with patch.object(sync, 'request', side_effect=[{'data': {'items': [1], 'has_more': True, 'page_token': 'p2'}}, {'data': {'items': [2], 'has_more': False}}]):
            self.assertEqual(sync.pages('test', 'secret'), [1, 2])
        with patch.object(sync, 'request', return_value={'data': {'items': [], 'has_more': True, 'page_token': 'same'}}):
            with self.assertRaises(RuntimeError): sync.pages('test', 'secret')
    def test_only_public_projection_and_complete_options(self):
        records = [{'record_id': 'private-record', 'fields': {'作品名称': 'Example', '提示词': 'Prompt', '封面': [{'file_token': 'private-token'}], '内部备注': 'private-note', '风格标签': ['风景']}}]
        result = sync.build_catalog(records, {'private-token': 'https://example.com/cover'}, [{'field_name': '风格标签', 'property': {'options': [{'name': '风景'}, {'name': '人物'}]}}])
        self.assertEqual(result['items'][0]['cover'], 'https://example.com/cover')
        self.assertEqual(result['options']['tags'], ['风景', '人物'])
        self.assertNotIn('private-', str(result))
        self.assertEqual(result['items'][0]['prompt'], 'Prompt')
        with self.assertRaises(RuntimeError): sync.build_catalog(records * 2, {}, [])
    def test_dimensions_and_source(self):
        self.assertEqual(sync.dimensions('目标 1920x1080；实测 720×1280'), (720, 1280, True))
        self.assertEqual(sync.dimensions(''), (4, 3, False))
        self.assertIsNone(sync.public_url('https://my.feishu.cn/base/private'))
        self.assertIsNone(sync.public_url('javascript:alert(1)'))

    def test_measured_dimensions_survive_trailing_measurement_note(self):
        parameters = ('目标 1920x1080。\n实测配套成片：\n'
                      'video-1.mp4：1440×1440，14.000 秒。\n'
                      'video-2.mp4：720×1280，14.000 秒。\n'
                      '帧率、时长和尺寸是成片实测值。')
        self.assertEqual(sync.dimensions(parameters), (1440, 1440, True))

class MediaRefreshTests(unittest.TestCase):
    def test_concurrent_batches_deduplicate_and_keep_complete_results(self):
        import threading
        barrier = threading.Barrier(4)
        lock = threading.Lock()
        active, peak, calls = [0], [0], []
        def fake_request(path, token, params, gate):
            batch = params['file_tokens']
            with lock:
                active[0] += 1
                peak[0] = max(peak[0], active[0])
                calls.append(batch)
            if int(batch[0]) < 20:
                barrier.wait(timeout=5)
            with lock:
                active[0] -= 1
            return {'data': {'tmp_download_urls': [{'file_token': t, 'tmp_download_url': 'https://example.com/' + t} for t in reversed(batch)]}}
        with patch.object(sync, 'request', side_effect=fake_request):
            result = sync.refresh_media_urls([str(i) for i in range(23)] + ['0'], 'secret')
        self.assertEqual(len(result), 23)
        self.assertEqual(peak[0], 4)
        self.assertEqual(sorted(map(len, calls)), [3, 5, 5, 5, 5])
        self.assertEqual(result['22'], 'https://example.com/22')

    def test_missing_or_invalid_link_blocks_publication(self):
        with patch.object(sync, 'request', return_value={'data': {'tmp_download_urls': [{'file_token': 'a', 'tmp_download_url': 'http://example.com/a'}]}}):
            with self.assertRaisesRegex(RuntimeError, 'Missing media URL'):
                sync.refresh_media_urls(['a', 'b'], 'secret')

    def test_shared_gate_spaces_request_starts(self):
        now = [10.0]
        def sleep(delay): now[0] += delay
        with patch.object(sync.time, 'monotonic', side_effect=lambda: now[0]), patch.object(sync.time, 'sleep', side_effect=sleep):
            gate = sync.RateGate()
            starts = []
            for _ in range(5):
                gate.wait(); starts.append(now[0])
        self.assertEqual(starts, [10, 10.25, 10.5, 10.75, 11])

    def test_http_400_reports_code_without_sensitive_response(self):
        import io
        from urllib.error import HTTPError
        error = HTTPError('https://example.com/private-token', 400, 'bad', {'X-Tt-Logid': 'request123'}, io.BytesIO(b'{"code":1061002,"msg":"private-token"}'))
        with patch.object(sync, 'urlopen', side_effect=error):
            with self.assertRaisesRegex(RuntimeError, 'API code 1061002.*request123') as caught:
                sync.request('drive/test', 'secret')
        self.assertNotIn('private-token', str(caught.exception))

    def test_http_400_business_rate_limit_retries(self):
        import io
        from urllib.error import HTTPError
        error = HTTPError('https://example.com', 400, 'bad', {}, io.BytesIO(b'{"code":99991400}'))
        with patch.object(sync, 'urlopen', side_effect=[error, io.BytesIO(b'{"code":0}')]), patch.object(sync.time, 'sleep'):
            self.assertEqual(sync.request('drive/test'), {'code': 0})

    def test_retry_also_uses_shared_gate(self):
        import io
        from urllib.error import HTTPError
        from unittest.mock import Mock
        gate = Mock()
        response = io.BytesIO(b'{"code":0,"data":{}}')
        with patch.object(sync, 'urlopen', side_effect=[HTTPError('https://example.com', 429, 'limited', {}, None), response]), patch.object(sync.time, 'sleep'):
            self.assertEqual(sync.request('drive/test', 'secret', gate=gate), {'code': 0, 'data': {}})
        self.assertEqual(gate.wait.call_count, 2)

if __name__ == '__main__': unittest.main()
