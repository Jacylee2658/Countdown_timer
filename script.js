/* ================= DOM Elements ================= */
const targetTimeInput = document.getElementById('targetTimeInput');
const hoursSpan = document.getElementById('hours');
const minutesSpan = document.getElementById('minutes');
const secondsSpan = document.getElementById('seconds');
const secondsUnit = document.getElementById('secondsUnit');
const progressBar = document.getElementById('progressBar');
const currentTimeMsSpan = document.getElementById('currentTimeMs');
const tiltCard = document.getElementById('tilt-card');

/* ================= State ================= */
let selectedHour = 17;
let selectedMinute = 0;
let alarmStarted = false;
let alarmInterval = null;
let lastTickSecond = -1;

/* ================= 3D Tilt Effect (Parallax) ================= */
document.addEventListener('mousemove', (e) => {
    const rect = tiltCard.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    // Max rotation of 8 degrees
    const rotateX = (y / rect.height) * -8;
    const rotateY = (x / rect.width) * 8;
    
    tiltCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
});

document.addEventListener('mouseleave', () => {
    tiltCard.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
});

/* ================= Time Formatting ================= */
function formatNumber(num) {
    return num.toString().padStart(2, '0');
}

/* ================= Audio Synthesis (Web Audio API) ================= */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, duration, type = 'sine', volume = 0.5) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playTick() {
    // A subtle high-pitched tick
    playTone(1200, 0.05, 'triangle', 0.2);
}

function playFinale() {
    // A huge cinematic chord
    const notes = [261.63, 329.63, 392.00, 523.25]; // C Major
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 2, 'sawtooth', 0.1), i * 50);
    });
}

/* ================= Countdown Logic ================= */
function updateSelectedTime() {
    const parts = targetTimeInput.value.split(':');
    selectedHour = parseInt(parts[0], 10);
    selectedMinute = parseInt(parts[1], 10);
}

function getTargetTime() {
    const now = new Date();
    const target = new Date(now);
    target.setHours(selectedHour, selectedMinute, 0, 0);
    if (target <= now) {
        target.setDate(target.getDate() + 1); // Roll to tomorrow
    }
    return target;
}

function calculateCountdown() {
    const now = Date.now();
    const target = getTargetTime().getTime();
    const diff = target - now;

    if (diff <= 0) return { h: 0, m: 0, s: 0, total: 0 };

    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    return { h, m, s, total: diff };
}

function updateProgress(totalMs) {
    const maxMs = 24 * 60 * 60 * 1000;
    const progress = Math.min((totalMs / maxMs) * 100, 100);
    progressBar.style.width = progress + '%';
}

/* ================= Main Loop ================= */
function updateDisplay() {
    currentTimeMsSpan.textContent = Math.floor(Date.now() / 1000).toLocaleString();
    
    const countdown = calculateCountdown();
    hoursSpan.textContent = formatNumber(countdown.h);
    minutesSpan.textContent = formatNumber(countdown.m);
    secondsSpan.textContent = formatNumber(countdown.s);
    updateProgress(countdown.total);

    // 1. Urgency state (last 10 seconds)
    if (countdown.s <= 10 && countdown.total > 0) {
        secondsUnit.classList.add('is-urgent');
        
        // Play a tick sound once per second
        if (countdown.s !== lastTickSecond) {
            playTick();
            lastTickSecond = countdown.s;
        }
    } else {
        secondsUnit.classList.remove('is-urgent');
        lastTickSecond = -1;
    }

    // 2. Timer Finished
    if (countdown.total <= 0 && !alarmStarted) {
        alarmStarted = true;
        secondsUnit.classList.remove('is-urgent');
        playFinale();
        fireConfetti();
    }
}

/* ================= Confetti Physics Engine ================= */
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
let animationId;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        
        // Random velocity in a circle
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 15 + 5;
        this.vx = Math.cos(angle) * velocity;
        this.vy = Math.sin(angle) * velocity;
        
        this.size = Math.random() * 8 + 4;
        this.color = ['#00f0ff', '#ff00ff', '#00ff88', '#ffffff'][Math.floor(Math.random() * 4)];
        this.life = 1; // 1 = full, 0 = dead
        this.decay = Math.random() * 0.015 + 0.01;
        this.gravity = 0.3;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 10 - 5;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity; // Apply gravity
        this.vx *= 0.98;         // Air resistance
        this.life -= this.decay;
        this.rotation += this.rotationSpeed;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
}

function fireConfetti() {
    particles = [];
    for (let i = 0; i < 150; i++) {
        particles.push(new Particle());
    }
    
    if (animationId) cancelAnimationFrame(animationId);
    animateConfetti();
}

function animateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let activeParticles = 0;
    
    particles.forEach(p => {
        if (p.life > 0) {
            p.update();
            p.draw();
            activeParticles++;
        }
    });

    if (activeParticles > 0) {
        animationId = requestAnimationFrame(animateConfetti);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

/* ================= Event Listeners ================= */
targetTimeInput.addEventListener('input', () => {
    updateSelectedTime();
    alarmStarted = false; // Reset alarm state
    updateDisplay();
});

// Initial Start
updateSelectedTime();
setInterval(updateDisplay, 1000);
updateDisplay();