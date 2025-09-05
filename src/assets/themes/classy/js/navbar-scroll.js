// Navbar scroll effect for Classy theme
export default function setupNavbarScroll() {
  const navbar = document.querySelector('.navbar-floating');
  if (!navbar) return;
  
  let scrollThreshold = 50; // Pixels to scroll before showing background
  
  function updateNavbar() {
    if (window.scrollY > scrollThreshold) {
      navbar.classList.add('bg-glassy');
    } else {
      navbar.classList.remove('bg-glassy');
    }
  }
  
  // Initial check
  updateNavbar();
  
  // Listen for scroll events with throttling
  let ticking = false;
  function requestTick() {
    if (!ticking) {
      window.requestAnimationFrame(updateNavbar);
      ticking = true;
      setTimeout(() => { ticking = false; }, 100);
    }
  }
  
  window.addEventListener('scroll', requestTick, { passive: true });
}