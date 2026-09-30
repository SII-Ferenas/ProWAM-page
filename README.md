# ProWAM — project page

Source for the [ProWAM](https://sii-ferenas.github.io/ProWAM-page/) project page.

**ProWAM: World Action Modeling with Progressive Visual Planning.** A world
action model that imagines an ordered chain of sparse sub-goals indexed by task
progress, then grounds action prediction in that plan.

Static HTML, CSS and vanilla JS — no build step. Open `index.html` directly, or
serve the directory:

```bash
python3 -m http.server 8000
```

Figures are baked to the page background so they sit seamlessly on the dark
theme; `scripts/recolor_figure_for_dark.py` in the main repository regenerates
them from the paper PDFs.

Released under the MIT License. The rollout and sub-goal imagery is from the
ProWAM paper.
