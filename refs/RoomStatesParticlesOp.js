// welcome to your new op!
// have a look at the documentation:
// https://cables.gl/docs/5_writing_ops/dev_ops/dev_ops

// ─────────────────────────────────────────────────────────
// Op: ParticleStateSystem (Grid Room with Random Directions)
// ─────────────────────────────────────────────────────────

// INPUTS
const inTrigger = op.inTrigger("Trigger");
const inStateIndex = op.inInt("State Index", 0);
const inTransitionSpeed = op.inFloat("Transition Speed", 2.0);
const inGridSize = op.inInt("Grid Size", 10);
const inSpacing = op.inFloat("Grid Spacing", 0.18);
const inTravelScale = op.inFloat("Travel Scale", 1.0);
const inReset = op.inTriggerButton("Reset");
const inRandomizeDirections = op.inTriggerButton("Randomize Directions");

// OUTPUTS
const outTrigger = op.outTrigger("Trigger Out");
const outPositions = op.outArray("Positions");
const outScales = op.outArray("Scales");
const outStateName = op.outString("State Name");

// ─────────────────────────────────────────────────────────
// STATE NAMES
// ─────────────────────────────────────────────────────────

const STATE_NAMES = [
    "Idle / Settle (Sadness)",
    "Waking / Sensing (Fear)",
    "Predictive / Resist (Surprise)",
    "Surge / Burst (Anger)",
    "Advance / Expand (Affection)",
    "Retreat / Contract (Aversion)",
    "Scan / Drift (Happiness)",
    "Pulse / Rhythm (Embarrassment)"
];

// ─────────────────────────────────────────────────────────
// STATE PRESETS
// ─────────────────────────────────────────────────────────

const STATE_PRESETS = [
    // State 0: IDLE - barely moving, slow drift
    {
        name: "Idle",
        loopType: "continuous",
        loopDuration: 10.0,
        baseSpeed: 0.000005,
        wanderRange: 0.03,
        gravityY: -0.001,
        returnStrength: 0.003,
        damping: 0.998,
        pScaleBase: 0.012,
        pScaleVar: 0.002,
        centerInfluence: 0.0,
        phaseOffsetScale: 0.5,
        directionRandomness: 0.03,      // slight random drift
        reRandomizePerCycle: false
    },
    // State 1: WAKING - twitchy, nervous, accelerating
    {
        name: "Waking",
        loopType: "twitch",
        loopDuration: 2.0,
        baseSpeed: 0.003,
        wanderRange: 0.1,
        gravityY: 0.0,
        returnStrength: 0.008,
        damping: 0.97,
        pScaleBase: 0.01,
        pScaleVar: 0.006,
        centerInfluence: 0.1,
        phaseOffsetScale: 2.0,
        directionRandomness: 0.7,      // mostly random twitches
        reRandomizePerCycle: true      // new random direction each twitch
    },
    // State 2: SURPRISE - hold, scatter, snap back
    {
        name: "Surprise",
        loopType: "scatter_snap",
        loopDuration: 2.5,
        baseSpeed: 0.01,
        wanderRange: 0.05,
        gravityY: 0.0,
        returnStrength: 0.04,
        damping: 0.94,
        pScaleBase: 0.014,
        pScaleVar: 0.008,
        centerInfluence: 0.2,
        scatterForce: 0.5,
        phaseOffsetScale: 0.3,
        directionRandomness: 0.4,      // mostly outward, some random
        reRandomizePerCycle: false
    },
    // State 3: ANGER - violent burst, chaos, reset
    {
        name: "Anger",
        loopType: "burst",
        loopDuration: 1.8,
        baseSpeed: 0.025,
        wanderRange: 0.5,
        gravityY: 0.005,
        returnStrength: 0.005,
        damping: 0.92,
        pScaleBase: 0.018,
        pScaleVar: 0.012,
        centerInfluence: 0.5,
        burstForce: 0.9,
        phaseOffsetScale: 0.2,
        directionRandomness: 0.9,      // almost fully random chaos
        reRandomizePerCycle: true      // new direction each burst
    },
    // State 4: AFFECTION - gentle reach outward, soft return
    {
        name: "Affection",
        loopType: "breathe_out",
        loopDuration: 5.0,
        baseSpeed: 0.003,
        wanderRange: 0.15,
        gravityY: 0.002,
        returnStrength: 0.005,
        damping: 0.98,
        pScaleBase: 0.016,
        pScaleVar: 0.005,
        centerInfluence: -0.15,
        reachForce: 0.18,
        phaseOffsetScale: 1.0,
        directionRandomness: 0.2,      // mostly outward expansion
        reRandomizePerCycle: false
    },
    // State 5: AVERSION - pull inward, hold, release
    {
        name: "Aversion",
        loopType: "contract",
        loopDuration: 2.5,
        baseSpeed: 0.005,
        wanderRange: 0.05,
        gravityY: -0.002,
        returnStrength: 0.008,
        damping: 0.95,
        pScaleBase: 0.008,
        pScaleVar: 0.003,
        centerInfluence: 0.6,
        contractForce: 0.3,
        phaseOffsetScale: 0.5,
        directionRandomness: 0.1,      // mostly inward
        reRandomizePerCycle: false
    },
    // State 6: HAPPINESS - float, wander, playful
    {
        name: "Happiness",
        loopType: "float",
        loopDuration: 8.0,
        baseSpeed: 0.006,
        wanderRange: 0.25,
        gravityY: 0.004,
        returnStrength: 0.002,
        damping: 0.98,
        pScaleBase: 0.014,
        pScaleVar: 0.008,
        centerInfluence: 0.0,
        phaseOffsetScale: 3.0,
        directionRandomness: 1.0,      // fully random wandering
        reRandomizePerCycle: false     // but consistent per particle
    },
    // State 7: EMBARRASSMENT - rhythmic pulse in place
    {
        name: "Embarrassment",
        loopType: "pulse",
        loopDuration: 1.2,
        baseSpeed: 0.002,
        wanderRange: 0.06,
        gravityY: 0.0,
        returnStrength: 0.025,
        damping: 0.98,
        pScaleBase: 0.012,
        pScaleVar: 0.004,
        centerInfluence: 0.0,
        pulseForce: 0.12,
        phaseOffsetScale: 0.8,
        directionRandomness: 0.5,      // half radial, half random
        reRandomizePerCycle: false
    }
];

// ─────────────────────────────────────────────────────────
// PARTICLE DATA
// ─────────────────────────────────────────────────────────

let homePositions = null;
let positions = null;
let velocities = null;
let scales = null;
let particlePhases = null;
let particleDistFromCenter = null;
let particleDirections = null;        // Random direction per particle
let particleCycleTracker = null;      // Track which cycle each particle is on

let currentParams = null;
let targetParams = null;
let time = 0;
let lastTime = performance.now();
let needsInit = true;
let currentState = 0;

// ─────────────────────────────────────────────────────────
// HELPER: Generate random direction
// ─────────────────────────────────────────────────────────

function randomDirection() {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    return {
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.sin(phi) * Math.sin(theta),
        z: Math.cos(phi)
    };
}

// ─────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────

function initParticles(gridSize, spacing) {
    const count = gridSize * gridSize * gridSize;

    homePositions = new Float32Array(count * 3);
    positions = new Float32Array(count * 3);
    velocities = new Float32Array(count * 3);
    scales = new Float32Array(count);
    particlePhases = new Float32Array(count);
    particleDistFromCenter = new Float32Array(count);
    particleDirections = new Float32Array(count * 3);
    particleCycleTracker = new Float32Array(count);

    currentParams = JSON.parse(JSON.stringify(STATE_PRESETS[0]));
    targetParams = JSON.parse(JSON.stringify(STATE_PRESETS[0]));

    const offset = (gridSize - 1) * spacing * 0.5;

    let i = 0;
    for (let gx = 0; gx < gridSize; gx++) {
        for (let gy = 0; gy < gridSize; gy++) {
            for (let gz = 0; gz < gridSize; gz++) {
                const idx = i * 3;

                const x = gx * spacing - offset;
                const y = gy * spacing - offset;
                const z = gz * spacing - offset;

                homePositions[idx + 0] = x;
                homePositions[idx + 1] = y;
                homePositions[idx + 2] = z;

                positions[idx + 0] = x;
                positions[idx + 1] = y;
                positions[idx + 2] = z;

                velocities[idx + 0] = 0;
                velocities[idx + 1] = 0;
                velocities[idx + 2] = 0;

                particlePhases[i] = Math.random() * Math.PI * 2;
                particleDistFromCenter[i] = Math.sqrt(x * x + y * y + z * z);

                // Random direction for this particle
                const dir = randomDirection();
                particleDirections[idx + 0] = dir.x;
                particleDirections[idx + 1] = dir.y;
                particleDirections[idx + 2] = dir.z;

                particleCycleTracker[i] = 0;

                scales[i] = STATE_PRESETS[0].pScaleBase;

                i++;
            }
        }
    }

    needsInit = false;
}

// ─────────────────────────────────────────────────────────
// RANDOMIZE ALL DIRECTIONS
// ─────────────────────────────────────────────────────────

function randomizeAllDirections() {
    if (!particleDirections) return;
    const count = particleDirections.length / 3;
    for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const dir = randomDirection();
        particleDirections[idx + 0] = dir.x;
        particleDirections[idx + 1] = dir.y;
        particleDirections[idx + 2] = dir.z;
    }
}

// ─────────────────────────────────────────────────────────
// EASING FUNCTIONS
// ─────────────────────────────────────────────────────────

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutElastic(t) {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
}

function easeInBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
}

// ─────────────────────────────────────────────────────────
// MOVEMENT PHRASE FUNCTIONS
// ─────────────────────────────────────────────────────────

function getLoopPhase(time, duration, particlePhase, phaseOffsetScale) {
    const offset = particlePhase * phaseOffsetScale * duration / (Math.PI * 2);
    return ((time + offset) % duration) / duration;
}

function getCycleNumber(time, duration, particlePhase, phaseOffsetScale) {
    const offset = particlePhase * phaseOffsetScale * duration / (Math.PI * 2);
    return Math.floor((time + offset) / duration);
}

function calculatePhraseForce(loopType, phase, params, distFromCenter, homeX, homeY, homeZ, randDirX, randDirY, randDirZ, travelScale) {
    let forceX = 0, forceY = 0, forceZ = 0;

    // Normalized radial direction from center
    const dist = distFromCenter + 0.001;
    const radialX = homeX / dist;
    const radialY = homeY / dist;
    const radialZ = homeZ / dist;

    // Blend between radial and random direction
    const r = params.directionRandomness || 0;
    const dirX = radialX * (1 - r) + randDirX * r;
    const dirY = radialY * (1 - r) + randDirY * r;
    const dirZ = radialZ * (1 - r) + randDirZ * r;

    // Normalize blended direction
    const dirMag = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) + 0.001;
    const normDirX = dirX / dirMag;
    const normDirY = dirY / dirMag;
    const normDirZ = dirZ / dirMag;

    switch (loopType) {
        case "continuous":
            // Gentle drift in random direction
            forceX = normDirX * 0.001 * travelScale;
            forceY = normDirY * 0.001 * travelScale;
            forceZ = normDirZ * 0.001 * travelScale;
            break;

        case "twitch":
            // Random twitches at irregular intervals
            if (phase > 0.7 && phase < 0.85) {
                const twitchPhase = (phase - 0.7) / 0.15;
                const twitchStrength = Math.sin(twitchPhase * Math.PI) * 0.2 * travelScale;
                forceX = normDirX * twitchStrength;
                forceY = normDirY * twitchStrength;
                forceZ = normDirZ * twitchStrength;
            }
            break;

        case "scatter_snap":
            if (phase >= 0.3 && phase < 0.5) {
                // Scatter outward in particle's direction
                const scatterPhase = (phase - 0.3) / 0.2;
                const scatterStrength = easeInBack(scatterPhase) * (params.scatterForce || 0.2) * travelScale;
                forceX = normDirX * scatterStrength;
                forceY = normDirY * scatterStrength;
                forceZ = normDirZ * scatterStrength;
            } else if (phase >= 0.5 && phase < 0.8) {
                // Snap back (returnStrength handles most of this)
                const snapPhase = (phase - 0.5) / 0.3;
                const snapStrength = easeOutElastic(snapPhase) * -0.05 * travelScale;
                forceX = normDirX * snapStrength;
                forceY = normDirY * snapStrength;
                forceZ = normDirZ * snapStrength;
            }
            break;

        case "burst":
            if (phase < 0.2) {
                // Burst in particle's random direction
                const burstPhase = phase / 0.2;
                const burstStrength = (1 - burstPhase) * (params.burstForce || 0.3) * travelScale;
                forceX = normDirX * burstStrength;
                forceY = normDirY * burstStrength;
                forceZ = normDirZ * burstStrength;
            } else if (phase < 0.7) {
                // Chaotic wandering
                forceX = (Math.random() - 0.5) * 0.08 * travelScale;
                forceY = (Math.random() - 0.5) * 0.08 * travelScale;
                forceZ = (Math.random() - 0.5) * 0.08 * travelScale;
            }
            break;

        case "breathe_out":
            const breathe = Math.sin(phase * Math.PI * 2) * (params.reachForce || 0.05) * travelScale;
            forceX = normDirX * breathe;
            forceY = normDirY * breathe + Math.abs(breathe) * 0.3;  // upward bias
            forceZ = normDirZ * breathe;
            break;

        case "contract":
            if (phase < 0.3) {
                // Pull inward (opposite of particle direction, toward center)
                const contractPhase = phase / 0.3;
                const contractStrength = easeInOutCubic(contractPhase) * (params.contractForce || 0.1) * travelScale;
                // Inward = negative of outward direction, but blend with center pull
                forceX = -radialX * contractStrength;
                forceY = -radialY * contractStrength - 0.01 * travelScale;
                forceZ = -radialZ * contractStrength;
            } else if (phase >= 0.7) {
                const releasePhase = (phase - 0.7) / 0.3;
                const releaseStrength = easeInOutCubic(releasePhase) * 0.03 * travelScale;
                forceX = normDirX * releaseStrength;
                forceY = normDirY * releaseStrength;
                forceZ = normDirZ * releaseStrength;
            }
            break;

        case "float":
            // Continuous wandering in particle's direction with variation
            const floatWave = Math.sin(phase * Math.PI * 4);
            forceX = normDirX * 0.015 * travelScale + Math.sin(phase * Math.PI * 6 + homeX * 5) * 0.01 * travelScale;
            forceY = 0.012 * travelScale + floatWave * 0.008 * travelScale;  // upward float
            forceZ = normDirZ * 0.015 * travelScale + Math.cos(phase * Math.PI * 6 + homeZ * 5) * 0.01 * travelScale;
            break;

        case "pulse":
            // Rhythmic pulse in particle's direction
            const pulse = Math.sin(phase * Math.PI * 2);
            const pulseStrength = pulse * (params.pulseForce || 0.04) * travelScale;
            forceX = normDirX * pulseStrength;
            forceY = normDirY * pulseStrength;
            forceZ = normDirZ * pulseStrength;
            break;
    }

    return { x: forceX, y: forceY, z: forceZ };
}

// ─────────────────────────────────────────────────────────
// LERP HELPER
// ─────────────────────────────────────────────────────────

function lerpNum(a, b, t) {
    return a + (b - a) * t;
}

function lerpParams(current, target, t) {
    for (const key in target) {
        if (typeof target[key] === 'number') {
            current[key] = lerpNum(current[key], target[key], t);
        } else if (typeof target[key] === 'string' || typeof target[key] === 'boolean') {
            if (t > 0.5) current[key] = target[key];
        }
    }
}

// ─────────────────────────────────────────────────────────
// NOISE
// ─────────────────────────────────────────────────────────

function noise(x) {
    const n = Math.sin(x * 12.9898) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
}

// ─────────────────────────────────────────────────────────
// SIMULATION
// ─────────────────────────────────────────────────────────

function updateParticles(dt, params, travelScale) {
    const count = positions.length / 3;

    for (let i = 0; i < count; i++) {
        const idx = i * 3;

        const homeX = homePositions[idx + 0];
        const homeY = homePositions[idx + 1];
        const homeZ = homePositions[idx + 2];

        const distFromCenter = particleDistFromCenter[i];
        const phase = particlePhases[i];

        // Get particle's random direction
        let randDirX = particleDirections[idx + 0];
        let randDirY = particleDirections[idx + 1];
        let randDirZ = particleDirections[idx + 2];

        // Check if we should re-randomize direction (new cycle)
        if (params.reRandomizePerCycle) {
            const currentCycle = getCycleNumber(time, params.loopDuration, phase, params.phaseOffsetScale);
            if (currentCycle !== particleCycleTracker[i]) {
                // New cycle - randomize direction
                const newDir = randomDirection();
                particleDirections[idx + 0] = newDir.x;
                particleDirections[idx + 1] = newDir.y;
                particleDirections[idx + 2] = newDir.z;
                randDirX = newDir.x;
                randDirY = newDir.y;
                randDirZ = newDir.z;
                particleCycleTracker[i] = currentCycle;
            }
        }

        let vx = velocities[idx + 0];
        let vy = velocities[idx + 1];
        let vz = velocities[idx + 2];

        const px = positions[idx + 0];
        const py = positions[idx + 1];
        const pz = positions[idx + 2];

        // Displacement from home
        const dx = px - homeX;
        const dy = py - homeY;
        const dz = pz - homeZ;

        // ─── PHRASE-BASED FORCE ───
        const loopPhase = getLoopPhase(time, params.loopDuration, phase, params.phaseOffsetScale);
        const phraseForce = calculatePhraseForce(
            params.loopType,
            loopPhase,
            params,
            distFromCenter,
            homeX, homeY, homeZ,
            randDirX, randDirY, randDirZ,
            travelScale
        );

        vx += phraseForce.x;
        vy += phraseForce.y;
        vz += phraseForce.z;

        // ─── WANDER (noise-based drift in particle's direction) ───
        const wanderStrength = noise(homeX * 3 + homeY * 5 + homeZ * 7 + time * params.baseSpeed * 10) * params.wanderRange * 0.01 * travelScale;
        vx += randDirX * wanderStrength;
        vy += randDirY * wanderStrength;
        vz += randDirZ * wanderStrength;

        // ─── GRAVITY ───
        vy += params.gravityY * travelScale;

        // ─── CENTER INFLUENCE ───
        if (Math.abs(params.centerInfluence) > 0.001) {
            const toCenterDist = Math.sqrt(px * px + py * py + pz * pz) + 0.001;
            vx += (-px / toCenterDist) * params.centerInfluence * 0.01 * travelScale;
            vy += (-py / toCenterDist) * params.centerInfluence * 0.01 * travelScale;
            vz += (-pz / toCenterDist) * params.centerInfluence * 0.01 * travelScale;
        }

        // ─── RETURN TO HOME ───
        vx -= dx * params.returnStrength;
        vy -= dy * params.returnStrength;
        vz -= dz * params.returnStrength;

        // ─── DAMPING ───
        vx *= params.damping;
        vy *= params.damping;
        vz *= params.damping;

        // ─── UPDATE POSITION ───
        positions[idx + 0] = px + vx;
        positions[idx + 1] = py + vy;
        positions[idx + 2] = pz + vz;

        velocities[idx + 0] = vx;
        velocities[idx + 1] = vy;
        velocities[idx + 2] = vz;

        // ─── SCALE ───
        const scalePhase = Math.sin(loopPhase * Math.PI * 2);
        scales[i] = params.pScaleBase + scalePhase * params.pScaleVar;
    }
}

// ─────────────────────────────────────────────────────────
// TRIGGER HANDLER
// ─────────────────────────────────────────────────────────

inTrigger.onTriggered = function() {
    const gridSize = inGridSize.get();
    const spacing = inSpacing.get();
    const stateIdx = Math.max(0, Math.min(7, inStateIndex.get()));
    const transSpeed = inTransitionSpeed.get();
    const travelScale = inTravelScale.get();

    // Delta time
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    time += dt;

    // Initialize if needed
    const expectedCount = gridSize * gridSize * gridSize;
    if (needsInit || !positions || positions.length !== expectedCount * 3) {
        initParticles(gridSize, spacing);
    }

    // Update target state
    if (stateIdx !== currentState) {
        targetParams = JSON.parse(JSON.stringify(STATE_PRESETS[stateIdx]));
        currentState = stateIdx;

        // Optionally randomize directions on state change
        // randomizeAllDirections();
    }

    // Lerp params
    lerpParams(currentParams, targetParams, dt * transSpeed);

    // Update simulation
    updateParticles(dt, currentParams, travelScale);

    // Output
    outPositions.setRef(positions);
    outScales.setRef(scales);
    outStateName.set(STATE_NAMES[stateIdx]);

    outTrigger.trigger();
};