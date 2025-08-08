function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleTypes = ['particle-small', 'particle-medium', 'particle-large', 'particle-glow', 'particle-star'];
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        const randomType = particleTypes[Math.floor(Math.random() * particleTypes.length)];
        particle.className = `particle ${randomType}`;
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (Math.random() * 15 + 10) + 's';
        const drift = (Math.random() - 0.5) * 100;
        particle.style.setProperty('--drift', drift + 'px');
        particlesContainer.appendChild(particle);
    }
}

function generateNewParticle() {
    const particlesContainer = document.getElementById('particles');
    const particleTypes = ['particle-small', 'particle-medium', 'particle-large', 'particle-glow', 'particle-star'];

    const particle = document.createElement('div');
    const randomType = particleTypes[Math.floor(Math.random() * particleTypes.length)];
    particle.className = `particle ${randomType}`;
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (Math.random() * 15 + 10) + 's';
    particlesContainer.appendChild(particle);

    setTimeout(() => {
        if (particle.parentNode) {
            particle.parentNode.removeChild(particle);
        }
    }, 35000);
}

window.addEventListener('load', () => {
    createParticles();
    setInterval(generateNewParticle, 2000);
});
