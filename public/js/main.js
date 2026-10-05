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

  // Give the main content a gentle, staggered entrance like a product page.
  document.querySelectorAll('.cards-grid .card, .path-cards .path-card, .testimonial-grid .testimonial-card, .plan-card-inline').forEach(function(el, index) {
    el.classList.add('motion-item');
    el.style.setProperty('--motion-delay', (index % 3) * 90 + 'ms');
    observer.observe(el);
  });

  // --- Navbar shadow on scroll ---
  var navbar = document.getElementById('navbar');
  var hero = document.querySelector('.hero');
  var heroGlow = document.querySelector('.hero-glow');
  var heroGlowTwo = document.querySelector('.hero-glow-2');
  var ticking = false;

  function updateScrollMotion() {
    var scrollY = window.scrollY || 0;
    if (scrollY > 10) {
      navbar.classList.add('is-scrolled');
    } else {
      navbar.classList.remove('is-scrolled');
    }
    if (hero && scrollY < window.innerHeight) {
      hero.style.setProperty('--hero-shift', Math.min(scrollY * 0.12, 60) + 'px');
    }
    ticking = false;
  }

  window.addEventListener('scroll', function() {
    if (!ticking) {
      window.requestAnimationFrame(updateScrollMotion);
      ticking = true;
    }
  });

  // Desktop pointer glow: subtle depth without distracting from the CTA.
  if (window.matchMedia('(pointer: fine)').matches) {
    document.addEventListener('pointermove', function(event) {
      var x = (event.clientX / window.innerWidth - 0.5) * 2;
      var y = (event.clientY / window.innerHeight - 0.5) * 2;
      if (heroGlow) heroGlow.style.transform = 'translate(calc(-50% + ' + (x * 18) + 'px),' + (y * 12) + 'px)';
      if (heroGlowTwo) heroGlowTwo.style.transform = 'translate(' + (x * -12) + 'px,' + (y * -8) + 'px)';
    }, { passive: true });
  }

  updateScrollMotion();
})();
