# Music

`bed.mp3` is built by `tools/music.py` from the six clips in `clips/`, looped under each scene,
crossfaded at the scene seams and ducked under the voice.

The clips were generated on this machine with Meta's MusicGen (`facebook/musicgen-small`, ~30 s each,
guidance 3.0). Its weights are licensed CC-BY-NC 4.0, so treat this music as fine for personal and
non-commercial use; swap in a licensed track before any commercial release.

| Clip | Used under | Prompt |
| --- | --- | --- |
| `main` | intro, honey | playful whimsical acoustic ukulele and glockenspiel, light pizzicato strings, bouncy children's science show background music, cheerful, 104 bpm, no vocals |
| `main2` | sky, taller | playful bouncy pizzicato strings and xylophone with light acoustic guitar, curious cartoon science show background music, 104 bpm, no vocals |
| `main3` | banana | cheerful whistling-free acoustic ukulele and marimba groove, light shaker, quirky fun kids educational video background music, 100 bpm, no vocals |
| `ocean` | octopus | gentle playful underwater marimba and soft bubbly synth plucks, curious and light, 96 bpm, no vocals, background music |
| `space` | venus | dreamy playful space music, soft twinkling celesta and warm synth pads with light pizzicato, curious, 92 bpm, no vocals, background music |
| `finale` | outro | upbeat happy acoustic ukulele, claps and glockenspiel, feel-good ending, children's show outro, 108 bpm, no vocals |
