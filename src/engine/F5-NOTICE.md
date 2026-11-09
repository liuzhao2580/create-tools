# Experimental F5 browser engine

The ONNX encoder / transformer / decoder graph orchestration in `f5-worker.ts` is adapted from [nsarang/voice-cloning-f5-tts](https://github.com/nsarang/voice-cloning-f5-tts), licensed under Apache-2.0. A copy is in `F5-UPSTREAM-LICENSE.txt`. The implementation has been substantially rewritten: Mandarin whole-syllable tokenization, explicit tensor disposal, pinned model revision, single-threaded WASM initialization, Web Worker cancellation, duration validation and paragraph-aware WAV assembly.

The browser downloads model files from `nsarang/F5-TTS-ONNX` at revision `2e7e47e103a565c85dcd32141b6b11eeeb57eee6` (approximately 792 MB for three graphs plus vocabulary). No model weights or private reference audio are included in this repository.

The model repository currently labels its weights Apache-2.0 but supplies no provenance documentation. The upstream [SWivid/F5-TTS](https://github.com/SWivid/F5-TTS#license) project distinguishes MIT code from CC-BY-NC pretrained weights. The conversion's metadata must not be treated as evidence that the upstream model's noncommercial restrictions have been removed. Model licensing and provenance remain unresolved for redistribution or commercial use; this engine is a research prototype.

Chinese text preprocessing follows the upstream F5 whole-syllable vocabulary format using pinyin-pro (MIT). It is not an exact port of rjieba + pypinyin; names, polyphones and tone sandhi need listening tests. This is a different synthesis model from the Qwen3-TTS model used in prior local video production. Loading the same reference clip does not by itself demonstrate identical voice similarity or pacing.
