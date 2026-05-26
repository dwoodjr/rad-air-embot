# Room States → Electromagnet Translation Guide

Reference doc for translating the `RoomStatesParticlesOp.js` particle simulation
into electromagnet activation patterns for the embot hardware.

---

## What the particle sim is doing

The cables.gl op runs a 3D grid of particles (default 10×10×10 = 1000 particles),
each with physics — velocity, damping, return-to-home force, center influence.
There are 8 emotional states, each defining how particles move through that 3D space.
The experience is essentially: *a field of moving points that collectively express a mood.*

The embot does something structurally analogous — a field of electromagnetic activations
that collectively produce a physical, spatial effect. The translation is lossy by design:
we're not trying to recreate the particle sim, but instad the **felt quality** of each state
and expressing it through what 4 (eventually N) magnets can physically do.

Link to the original particle sim: https://cables.gl/p/Y3urr9

---

## The conceptual mapping

| Particle sim concept | Electromagnet equivalent |
|---|---|
| Particle position in 3D grid | Physical location of a magnet in the room |
| Particle activation / scale | Magnet intensity (binary now, PWM later) |
| Field-wide energy level | How many magnets are on, and at what level |
| Movement phrase / loopType | Switching pattern over time |
| `loopDuration` | Period/tempo of the activation pattern |
| `directionRandomness` | How unpredictable the switching order is |
| `returnStrength` | How quickly pattern returns to a base state |
| `damping` | How gradually intensity fades (binary = instant; PWM = gradual) |
| `centerInfluence` | Whether activation radiates outward from center or contracts inward |
| `reRandomizePerCycle` | Whether pattern repeats exactly or varies each cycle |
| Particle phase offset | Staggered timing between individual magnets |

**What we lose without PWM:** `damping`, `pScaleBase/pScaleVar`, and smooth state
transitions all become blunt — magnets snap on and off. PWM restores most of this
expressiveness. See the PWM note at the bottom.

---

## State-by-state translation

### State 0 — Idle / Settle (Sadness)
**Particle quality:** barely moving, slow continuous drift, high damping, small scale.
Almost nothing is happening. The field is at rest.

**Magnet interpretation:**
- Very slow cycle (2–10s per phase)
- Only a few magnets on at a time?, at low intensity if PWM available
- Minimal pattern — just the steady A↔B alternation slowed way down
- With binary: single magnet on, long hold, slow transition
- Feels like: *a room that's almost asleep*

**Key params driving this:** `baseSpeed: 0.000005`, `damping: 0.998`, `wanderRange: 0.03`

---

### State 1 — Waking / Sensing (Fear)
**Particle quality:** twitchy, nervous twitches at 2s intervals, re-randomizes direction each cycle.
High `directionRandomness: 0.7` — mostly unpredictable.

**Magnet interpretation:**
- Short sharp on/off bursts (0.05–0.1s)
- Random magnet selection — no fixed sequence
- Long pauses between bursts (the "twitchy stillness")
- Each burst: pick 1 or 2 random magnets, fire briefly, go quiet
- With binary: A fires, gap, C fires, gap, B fires, gap...
- Feels like: *something sensing, startled, not sure where to look*

**Key params:** `loopDuration: 2.0`, `directionRandomness: 0.7`, `reRandomizePerCycle: true`

---

### State 2 — Predictive / Resist (Surprise)
**Particle quality:** hold → scatter outward → elastic snap back. Has structure: 30% hold,
20% scatter, 30% snap, 20% settle. High `returnStrength: 0.04`.

**Magnet interpretation:**
- Pattern: **all off** (hold) → **all on burst** → **snap to single** → settle
- The "scatter" = all four magnets fire simultaneously
- The "snap back" = drop to one or two magnets fast
- Cycle period ~2.5s
- Strong sense of compression then release
- Feels like: *sudden full-body flinch, then catching yourself*

**Key params:** `loopType: scatter_snap`, `returnStrength: 0.04`, `scatterForce: 0.5`

---

### State 3 — Surge / Burst (Anger)
**Particle quality:** violent burst, then chaotic wandering (random forces 60–70% of cycle),
fast reset. `directionRandomness: 0.9`, `damping: 0.92` — least stable state.

**Magnet interpretation:**
- Maximum speed (0.05s or faster)
- All four magnets cycling rapidly and semi-randomly
- No predictable pairing — fire in sequences like A, D, B, C, A, C...
- Occasional full-on (all four) moments
- Feels relentless — no quiet gaps
- With binary: this is the fastest, most chaotic switching possible
- Feels like: *something thrashing*

**Key params:** `loopDuration: 1.8`, `burstForce: 0.9`, `directionRandomness: 0.9`, `reRandomizePerCycle: true`

---

### State 4 — Advance / Expand (Affection)
**Particle quality:** gentle outward breathing (`breathe_out`), upward bias, long 5s cycle,
low `directionRandomness: 0.2` — mostly organized outward expansion.

**Magnet interpretation:**
- Slow, regular outward propagation if magnets are spatially arranged center→out
- If not, use a slow **ripple**: A→B→C→D→A in sequence, long hold per step
- Soft cycle (0.5–1s per step)
- Breathing quality — build up, peak, release
- With PWM: gradual fade-in and fade-out per magnet
- Feels like: *something reaching toward you gently*

**Key params:** `loopDuration: 5.0`, `reachForce: 0.18`, `directionRandomness: 0.2`, upward bias in `forceY`

---

### State 5 — Retreat / Contract (Aversion)
**Particle quality:** pull inward (negative `centerInfluence: 0.6`), hold contracted,
then slow release. Quiet, restrained. `directionRandomness: 0.1` — mostly inward.

**Magnet interpretation:**
- If magnets have a physical center: activate center-most, deactivate outer
- Without spatial arrangement: all magnets at low level simultaneously (not alternating) — the "held contraction"
- Then gradual release back to normal alternation
- Very slow, deliberate
- Feels like: *pulling away, holding still, waiting*

**Key params:** `loopDuration: 2.5`, `contractForce: 0.3`, `centerInfluence: 0.6`

---

### State 6 — Scan / Drift (Happiness)
**Particle quality:** slow wandering, `directionRandomness: 1.0` (fully random per particle),
long 8s cycle, `phaseOffsetScale: 3.0` — particles are highly de-synchronized from each other.

**Magnet interpretation:**
- Each magnet treated **independently** — its own timing, not synchronized
- Stagger activation start times so they never all switch at once
- Slow, varying hold durations — some short, some long
- No strong pairing logic — any magnet can be on or off independently
- This is the **most complex pattern** to program — needs per-magnet timers
- Feels like: *each part of the room doing its own thing, playfully*

**Key params:** `directionRandomness: 1.0`, `phaseOffsetScale: 3.0`, `loopDuration: 8.0`

---

### State 7 — Pulse / Rhythm (Embarrassment)
**Particle quality:** regular rhythmic pulse in place, `loopDuration: 1.2`, half radial/half random.
The most clock-like state. `returnStrength: 0.025` — springs back to home on each beat.

**Magnet interpretation:**
- All magnets pulse **together** on a steady beat
- Period: 1.2s (or tempo-synced to Max/MSP BPM)
- On the beat: all four on simultaneously → off
- Variation: alternate between all-on and paired (A+C / B+D) on alternating beats
- This is the state most naturally locked to music
- **This is the bridge between soundscape and physical pattern** — Max drives the tempo, this state responds
- Feels like: *synchronized, self-conscious, a little too regular*

**Key params:** `loopDuration: 1.2`, `pulseForce: 0.12`, `returnStrength: 0.025`

---

## Physical layout matters

The translations above reference "outward from center" and "inward" — these only mean
something if the magnets are physically arranged in space. Right now ABCD are four
discrete magnets. As the installation scales:

- **If arranged in a line (A–B–C–D):** ripple patterns make sense (A→B→C→D or reverse)
- **If arranged in a 2×2 grid:** diagonal pairs (A+D, B+C) vs. corner pairs (A+C, B+D) create spatial texture
- **If arranged radially:** centerInfluence maps directly to activation order
- **If distributed across a room:** "zones" can have their own state independently

Document the physical layout in this file as it's finalized — it changes how every state
above gets interpreted.

---

## Binary vs PWM — what you gain

The particle sim lives in a continuous world. Binary magnets are a step function.
PWM gives you back continuity:

| Particle param | Binary only | With PWM |
|---|---|---|
| `pScaleBase + pScaleVar` | always full on | baseline intensity + variation |
| `damping` | instant off | gradual fade |
| `returnStrength` | snap to pattern | eased return |
| State transitions | hard cut | crossfade between states |
| `centerInfluence` as intensity | can't express | center-most = higher intensity |

PWM is driven by the same MOSFET — you just output a PWM signal from the ESP32 GPIO
instead of a simple HIGH/LOW. It's a firmware change, not a hardware change.
The OSC schema already uses `float` values (0.0–1.0) to support this without breaking changes.

---

## Suggested starting points for TD visual programming

If building a TD patch to drive patterns:

1. **Start with State 7 (Pulse/Rhythm)** — simplest pattern, tempo-lockable, gives immediate
   audio-visual sync feedback with Max. All four magnets, one beat, on/off.

2. **Then State 0 (Idle)** — slowest, easiest to verify single-magnet timing without chaos.

3. **State 4 (Affection) ripple** — introduces sequencing logic without randomness.

4. **State 3 (Anger) as stress test** — maximum speed, reveals any timing/latency issues
   in the TD→ESP32 pipeline before committing to complex patterns.

Use `/embot/pattern` (four float values) for all pattern changes — it's one UDP packet
per frame, which is cleaner than four individual actuator messages per frame.
