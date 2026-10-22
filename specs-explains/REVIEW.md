# REVIEW — Specs Explains: Weird But True

## Creative calls

- **Medium:** a felt-tip sketchbook page. Ink outlines that boil 12 times a second, flat marker fills
  printed a few pixels off the line, graph paper in Specs' studio, and each topic gets its own coloured
  world (sky, sea, botany page, tomb, bedroom, space) instead of one generic background.
- **Host:** Specs is a procedural rig rather than drawn frames, so he can act on every line: he leads with
  his head, his arms follow, he blinks, his feet stay planted, and his mouth follows the voice track.
- **Spine:** each chapter opens with a question from the Question Jar and closes with a transition that
  something on screen causes. He dives through his own glasses into the sky, the sunset sinks into the sea,
  the octopus inks the screen, honey drips over the page, the tomb whips away, he floats up into space, and
  he comes back out through his glasses for the recap.
- **Facts:** each one is worked as a single example (one beam of light, one octopus, one banana slice,
  one jar of honey, one spine, two planets) rather than a list of facts.
- **Storylines not built:** a quiz show with Specs as host and the viewer guessing, and a single
  7-minute deep dive on light and colour. The six-question jar gave the most variety for the length.

## What was measured

- `npx hyperframes check`: lint, runtime, layout, motion, contrast and craft all pass. The only warnings
  left are `composition_file_too_large` on six scenes, kept on purpose: each scene is one continuous
  chapter, and splitting them would break the camera moves that run through them.
- `snapshot --review`: every seam was checked frame by frame (−0.2 s to +0.2 s). The intro→sky, octopus→banana,
  banana→honey and venus→outro seams match exactly; sky→octopus carries the bubbles across;
  honey→taller is a whip; taller→venus cuts between two views of the same space.
- Scene by scene: each scene was snapshotted at 12–25 points while it was built, and the issues found
  were fixed (stroke caps peeking out of hidden draw-ons, transform-origin bugs on the question cards,
  overlapping labels, a snail drifting onto Venus).
- Facts checked against standard references: Rayleigh scattering and the violet caveat; octopus
  branchial/systemic hearts, the systemic heart stopping while swimming, hemocyanin, about two-thirds of
  neurons in the arms; botanical berries (banana, grape, tomato, kiwi, eggplant) and strawberry achenes;
  honey's low water activity, acidity (pH about 3.9, close to orange juice) and glucose oxidase; disc
  compression (about 1 cm a day) and astronauts growing up to 3%; Venus at 243 days per rotation, 225 per
  orbit, retrograde spin, and a surface above lead's melting point.

- The rendered film: 420.0 s, 1920 x 1080 at 30 fps. Integrated loudness is -16.4 LUFS, loudness range
  2.8 LU and true peak -1.5 dBFS, with no gap quieter than -45 dB longer than 2 s. Fourteen frames pulled
  from the MP4 match the previews.

## What nobody checked

- **The sound was measured, not heard.** Voice, music and effects levels were measured; nobody listened
  to the Kokoro voice, the MusicGen music or the mix. Kokoro may mispronounce a word; "Rayleigh" is spelled
  "Ray-lee" for the voice.
- The lip-sync follows loudness and a rough vowel shape, not real phonemes.

## Weakest moments, and what I would change with more time

- The Venus comparison table's small captions ("one spin", "one lap") are hard to read at phone width.
- The octopus x-ray hearts are small in the wide shot; a push-in during "two small hearts" would help.
- The honey scene's "Trick" panel covers the wall art. It works, but a scroll or papyrus look would suit the tomb better.
- Music is generated: it loops 30-second clips. A real licensed track would lift the whole film.
