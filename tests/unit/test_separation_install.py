"""Installer readiness must never accept an incomplete model installation."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('worker', Path(__file__).resolve().parents[2] / 'server/separate_audio.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

class InstallationTests(unittest.TestCase):
    def test_missing_models_are_not_ready(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(RuntimeError):
                worker.check_models(Path(folder))

    def test_failure_removes_previous_ready_marker(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            (directory / 'ready.json').write_text('{}')
            with patch.object(worker.subprocess, 'run', side_effect=RuntimeError('download failed')):
                with self.assertRaises(RuntimeError):
                    worker.prepare(directory)
            self.assertFalse((directory / 'ready.json').exists())

    def test_both_models_verified_and_changes_invalidate_ready(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            for filename in worker.MODELS.values():
                (directory / filename).write_bytes(b'model')
            with patch.object(worker, 'version', return_value='test'), patch.object(worker.subprocess, 'run') as run:
                worker.prepare(directory)
                self.assertEqual(run.call_count, 2)
                worker.check_models(directory)
                (directory / next(iter(worker.MODELS.values()))).write_bytes(b'changed')
                with self.assertRaises(RuntimeError):
                    worker.check_models(directory)

if __name__ == '__main__':
    unittest.main()
