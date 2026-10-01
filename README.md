# birddraw

*procedurally generated bird drawings. [demo](https://niklasprobul.github.io/birddraw/). a sister of [fishdraw](https://github.com/LingDong-/fishdraw) by Lingdong Huang.*

![](samples/000000.svg)

- generates all sorts of weird birds
- outputs polylines (supported format svg, json, csv, etc.)
- full procedural generation, single file no dependencies
- plotter-centric
- export drawing animation:

![](samples/animated.svg)



## usage

basic

```
node birddraw.js > output.svg
```

specify seed (from a string), speed of drawing and output format:

```
node birddraw.js --seed "Avis magnifica" --format smil --speed 2 > output.svg
```

- the seed string is used as the name of the bird (printed in the drawing). If unspecified, a random pseudo-Latin name will be auto generated.
- the speed number is used to control the speed of drawing animation. Larger the number is, faster it draws. This option works only with format `smil`.
- format options: `svg` (regular svg), `smil` (animated svg), `csv` (each polyline on a comma-separated line), `json` and `ps`.

in the browser: `index.html` draws a new bird on every visit, seeded by the time of the visit.
`index.html?seed=Avis%20magnifica` draws a fixed bird. it works on any static host, such as
GitHub Pages, with no build step.

use as JS library:

```js
const {bird,generate_params} = require('./birddraw.js');
let polylines = bird(generate_params());
console.log(polylines);
```


## from fish to bird

fishdraw builds a fish from two body curves (back and belly), fills them with scales,
attaches fins along the curves, a head at the front and a tail at the back, and composes
everything by clipping each part against the parts in front of it. birddraw keeps that
skeleton, the geometry kernel (clipping, polygon union, hatching, Perlin noise, Poisson
disk sampling, Douglas-Peucker cleanup), the Hershey-font caption and all output formats,
and replaces the anatomy:

| fishdraw | birddraw |
| --- | --- |
| long fish body, horizontal | egg-shaped body, drawn level and then tilted into a posture |
| scales (4 scale types) | plumage: breast streaks, feather fringes, soft down, chevron bars; overlays of spots, mottling or faint bars |
| pectoral fin | folded wing: lesser coverts, greater coverts, tertials, secondaries, primaries |
| caudal fin (6 types) | tail of overlapping feathers: square, rounded, forked, graduated, streamer |
| dorsal fin | crest: swept-back tuft or drooping nape plumes |
| head with lips, jaw, teeth | round head on a neck, with one of 14 beaks after the feeding guilds in [BirdBeaksA.svg](https://commons.wikimedia.org/wiki/File:BirdBeaksA.svg): generalist, insect catching, grain eating, nectar feeding, fruit eating, chiseling, surface skimming, scything, probing, filter feeding, aerial fishing, pursuit fishing, scavenging, raptorial (fruit eating and filter feeding are rare) |
| barbels and beard | head markings: cap, hood, eye stripe, malar stripe, bib |
| pelvic and anal fins | legs with scaled tarsi and clawed toes |
| (water) | a branch with bark and a cut end, the ground with grass, a still water surface, or a tree trunk |
| (swimming) | five poses: standing, singing (head raised, beak open), foraging (beak to the ground), swimming (lower body under water), clinging to a trunk (tail braced on the bark) |

the new building block is a single feather (shaft, narrow leading vane, wide trailing vane
with barb hatching); wings, tails and crests are stacks of feathers, each tucked behind the
ones in front of it.

to keep the drawings organic rather than diagrammatic, every silhouette is bent by noise,
feather edges fade toward their hidden bases, contours are made of small feather tips, and
the folded wing is tucked into the body: back feathers drape over its top and flank feathers
over its bottom, and each wing feather shows only its exposed edge toward the tip. the head is a smooth curve through anatomical landmarks
(beak base, forehead, domed crown, nape, throat, chin), with the eye about one eye-width
behind the beak. shading follows the style of 19th-century wood engravings: evenly spaced
lines running along the body and following the crown, dark upperparts, a pale underside.


## gallery

![](samples/000001.svg)
![](samples/000002.svg)
![](samples/000003.svg)
![](samples/000004.svg)
![](samples/000005.svg)
![](samples/000006.svg)
![](samples/000007.svg)
![](samples/000008.svg)
![](samples/000009.svg)
