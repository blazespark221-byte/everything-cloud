# SPEC — Specs Explains: Weird But True

GOAL:    The viewer laughs at least once per topic and leaves able to retell six "sounds fake, is true" facts, each with its real reason.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps.
TIME:    ~420 s (7:00) x 30 = ~12,600 frames. Narrated, so the voice is the clock: every reveal is keyed to a line in `assets/data/timing.json`.

LOOK:    A sketchbook page drawn in felt-tip.
         - Ground: paper #FBF7EE, speckle grain overlay (`assets/grain.png`, alpha 0-16%), pale-blue 64 px graph grid (`assets/grid.png`, 27% alpha) in studio scenes only.
         - Ink: #1F1D1A, 8 px strokes on Specs, 6 px on props, 4 px on details, round caps; outlines re-jitter ±1.1 px 12 times a second (line boil).
         - Markers: flat fills printed 6 px right / 5 px down off the ink (misregistered marker colouring), one topic colour per chapter:
           sky #2F80ED, ocean #18A999, banana #FFC832, honey #F2A007, spine #FF8FA3 discs on #E9E2D0 bones, Venus #F08A3C, Specs' bow tie #FF5A4E.
         - Type: Permanent Marker for question cards and stamps (72-96 px), Patrick Hand for labels (44-60 px). Never smaller than 40 px.
         - Light and depth: none. Flat paper, one soft contact shadow under Specs (13% ink ellipse). No glow, no gradients except watercolour-flat sky/sea/space fields with grain on top.
OBJECTS: Specs (circle head r66, round glasses with pale-blue lenses and a white glint, three-hair tuft, coral bow tie, stick body ~480 px tall at scale 1);
         the Question Jar (glass jar with coral lid, folded coloured notes inside, paper tag "QUESTIONS");
         the question note (pale-yellow folded slip #FFF1A8 that unfolds into a card).
MOTION:  Arrivals expo/back out (back.out(2.2) for pops, damping ~0.5 = playful); camera moves power2.inOut (Specs.EASE.inOut);
         zoom-throughs ease in; exits 40% shorter than entrances. Specs' head leads by 0.05 s, arms follow by 0.06 s, hair lags 0.14 s.
         Lines draw on (stroke-dashoffset) when they are named; nothing appears all at once.
SHOTS:   (scene-local seconds come from the cue named in brackets)
         intro   [caught] book drops off Specs' face · [name] name arrow · [about] sketch labels on him · [jar] jar drops in · [drop] notes fly in · [promise] TRUE stamp · [ready] he pulls the first note.
         sky     [q] note unfolds to card · [closer] push glasses, dive through his lens into the sky · [white→colours] beam splits into six strands as each is named ·
                 [molecules] N2/O2 pop in · [red/blue] long wave slips past, short wave ricochets · [glows] sky floods blue · [violet] sky flashes purple "?" ·
                 [sunset] pull back to round Earth, long path sheds blue · [painted] sunset; sun sinks into the sea, camera dives underwater.
         octopus [q] note in a bottle · [yes] three hearts pop and beat · [weird] octopus jets, big heart flatlines · [crawl] crawls · [iron/copper] red vs blue drops ·
                 [brain] neuron dots run down the arms · [alien] Specs gives it glasses · ink cloud fills the frame.
         banana  ink clears to the lab page · [botanist] flower → ovary → fruit grows · [fit] banana cross-section, specks circled · [yes] BERRY stamp ·
                 [club] berry club lineup · [straw] strawberry rejected, zoom on a seed-fruit · [rasp] raspberry rejected · honey drips down and floods amber.
         honey   [tombs] tomb, jar opened, honey still gold · [sugar] germ shrivels · [acid] pH strip · [enzyme] bee + peroxide bubbles · [lid] lid on / ferment bubbles ·
                 [crystals] cloudy jar warmed clear · whip to the height chart.
         taller  [yes] height mark +1 cm · [spine] stack of bones and discs · [gravity] arrows squash discs · [night] bed, moon, discs refill · [wake] up taller, shrinks ·
                 [astro] Specs floats in a helmet, tape +3% · [me] a giant pencil stretches his legs · he floats up into space.
         venus   [day/year] spin vs orbit with Earth · [slow/zips] two counters race, year wins · [west] sunrise in the west · [lead] thermometer melts lead · dive back out of his lens.
         outro   studio again · [recap] six doodle icons scatter around him as named · [wait] last note · [next] the question card · [bye] wave, title.
SOUND:   Kokoro voice (am_michael, 0.92x) as the clock. Local MusicGen beds (playful ukulele/glockenspiel; marimba underwater; celesta in space; brighter finale)
         crossfaded at scene seams, ducked to ~0.14 under speech and lifted between topics. Bundled SFX (Pixabay licence) only on visible actions:
         whoosh on throws and dives, pop on things landing, impact on the TRUE stamp, sparkle on discoveries.
BANNED:  dark void grounds; glow, neon, particles as decoration; purple/blue gradients; serif display; numbered "01/02" labels; monospace caps labels; pills/chips;
         three cards in a row; everything centred; everything fading in at once; titles that drift after landing; bullet lists; captions that repeat the voice word for word.
QA:      each scene's first frame matches the previous scene's last frame; Specs' feet touch the ground in every grounded shot; the mouth moves only while the voice speaks;
         every label is readable at phone width; no text under 40 px.
