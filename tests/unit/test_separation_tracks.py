import importlib.util
from pathlib import Path
import tempfile
import unittest
spec=importlib.util.spec_from_file_location('worker', Path(__file__).resolve().parents[2]/'server/separate_audio.py')
worker=importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
class TracksTest(unittest.TestCase):
    def test_case_and_model_suffix(self):
        for vocal,background in [('original_(vocals)_vocals_mel_band_roformer.wav','original_(other)_vocals_mel_band_roformer.wav'),('original_(Vocals)_model.wav','original_(Instrumental)_model.wav'),('original_Vocals_model.wav','original_Instrumental_model.wav')]:
            with tempfile.TemporaryDirectory() as d:
                for name in [vocal,background]: (Path(d)/name).touch()
                tracks=worker.collect_tracks(Path(d),[background,vocal])
                self.assertEqual([x['kind'] for x in tracks],['original','background','vocals'])
    def test_unknown_stem_is_not_silently_background(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d)/'original_unknown_vocals.wav').touch()
            with self.assertRaises(RuntimeError):worker.collect_tracks(Path(d),['original_unknown_vocals.wav'])
if __name__=='__main__':unittest.main()
