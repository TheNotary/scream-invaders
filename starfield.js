// Generate random stars
const starsEl = document.getElementById('stars');
for (let i = 0; i < 120; i++) {
  const star = document.createElement('div');
  star.className = 'star';
  star.style.left = Math.random() * 100 + '%';
  star.style.top = Math.random() * 100 + '%';
  star.style.opacity = (0.2 + Math.random() * 0.8).toFixed(2);
  star.style.animation = `twinkle ${2 + Math.random() * 4}s ease-in-out infinite ${Math.random() * 3}s`;
  if (Math.random() > 0.7) {
    star.style.width = '3px';
    star.style.height = '3px';
    star.style.boxShadow = '0 0 4px rgba(255,255,255,0.5)';
  }
  starsEl.appendChild(star);
}
