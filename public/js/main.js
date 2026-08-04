(function() {
  // --- Hamburger Menu ---
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  const navCta = document.getElementById('navCta');

  hamburger.addEventListener('click', function() {
    this.classList.toggle('active');
    navLinks.classList.toggle('mobile-open');
    navCta.classList.toggle('mobile-open');
  });

  // Close mobile menu when a nav link is clicked
  document.querySelectorAll('[data-nav]').forEach(function(link) {
    link.addEventListener('click', function() {
      hamburger.classList.remove('active');
      navLinks.classList.remove('mobile-open');
      navCta.classList.remove('mobile-open');
    });
  });

  // --- Scroll-triggered Fade-in (Intersection Observer) ---
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

  document.querySelectorAll('.fade-in').forEach(function(el) {
    observer.observe(el);
  });

  // --- Navbar shadow on scroll ---
  var navbar = document.getElementById('navbar');
  window.addEventListener('scroll', function() {
    if (window.scrollY > 10) {
      navbar.style.boxShadow = '0 2px 20px rgba(44,36,22,0.06)';
    } else {
      navbar.style.boxShadow = '';
    }
  });
})();
