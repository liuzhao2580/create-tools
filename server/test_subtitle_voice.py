import tempfile
import unittest
from pathlib import Path
import numpy as np
import soundfile as sf
from subtitle_voice import SR, write_timeline

class TimelineTests(unittest.TestCase):
    def test_exact_offsets_and_silence(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            a, b, out = root/'a.wav', root/'b.wav', root/'out.wav'
            sf.write(a, np.full(SR, .25), SR, subtype='PCM_24')
            sf.write(b, np.full(SR//2, -.25), SR, subtype='PCM_24')
            write_timeline([dict(start=2, end=4), dict(start=5.125, end=6)], [a,b], out)
            x, rate = sf.read(out)
            self.assertEqual(rate, SR)
            self.assertEqual(len(x), 6*SR)
            self.assertTrue(np.all(x[:2*SR] == 0))
            self.assertTrue(np.all(x[2*SR:3*SR] == .25))
            self.assertTrue(np.all(x[3*SR:round(5.125*SR)] == 0))
            self.assertEqual(x[round(5.125*SR)], -.25)
            self.assertTrue(np.all(x[round(5.625*SR):] == 0))
    def test_never_truncates_overflow(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)/'voice.wav'
            sf.write(p, np.full(SR, .2), SR)
            with self.assertRaises(ValueError):
                write_timeline([dict(start=0, end=.5)], [p], Path(d)/'out.wav')

if __name__ == '__main__': unittest.main()
