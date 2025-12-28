// ============================================
// SIGNATURE CLEANS - Main JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    
    // Mobile Navigation Toggle
    const navToggle = document.getElementById('nav-toggle');
    const navLinks = document.getElementById('nav-links');
    
    if (navToggle && navLinks) {
        navToggle.addEventListener('click', function() {
            navLinks.classList.toggle('active');
            navToggle.classList.toggle('active');
        });
    }
    
    // Navbar Background on Scroll
    const nav = document.getElementById('nav');
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            nav.style.background = 'rgba(255, 255, 255, 0.95)';
        } else {
            nav.style.background = 'rgba(255, 255, 255, 0.8)';
        }
    });
    
    // Animated Counter
    const counters = document.querySelectorAll('.stat-number');
    const speed = 200;
    
    const animateCounter = (counter) => {
        const target = +counter.getAttribute('data-target');
        const count = +counter.innerText;
        const inc = target / speed;
        
        if (count < target) {
            counter.innerText = Math.ceil(count + inc);
            setTimeout(() => animateCounter(counter), 10);
        } else {
            counter.innerText = target;
        }
    };
    
    // Intersection Observer for counters
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    counters.forEach(counter => {
        counterObserver.observe(counter);
    });
    
    // Fade In Animation on Scroll
    const fadeElements = document.querySelectorAll('.service-card, .why-point, .testimonial-quote');
    
    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                fadeObserver.unobserve(entry.target);
            }
        });
    }, { 
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    fadeElements.forEach(el => {
        el.classList.add('fade-in');
        fadeObserver.observe(el);
    });
    
    // Smooth Scroll for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                // Close mobile nav if open
                if (navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                    navToggle.classList.remove('active');
                }
            }
        });
    });
    
    // Logo Carousel - Enhanced infinite scroll with pause on hover and touch support
    const logoCarousel = document.querySelector('.logo-carousel');
    const logoTrack = document.querySelector('.logo-track');
    
    if (logoCarousel && logoTrack) {
        let isPaused = false;
        let startX = 0;
        let scrollLeft = 0;
        let isDown = false;
        
        // Clone logos for seamless infinite scroll
        const logoItems = logoTrack.querySelectorAll('.logo-item');
        if (logoItems.length > 0) {
            // Already duplicated in HTML, so animation works correctly
            // Just ensure smooth behavior
        }
        
        // Pause on hover
        logoCarousel.addEventListener('mouseenter', () => {
            isPaused = true;
            logoTrack.style.animationPlayState = 'paused';
        });
        
        logoCarousel.addEventListener('mouseleave', () => {
            isPaused = false;
            logoTrack.style.animationPlayState = 'running';
        });
        
        // Touch/swipe support for mobile
        logoCarousel.addEventListener('touchstart', (e) => {
            isDown = true;
            logoCarousel.style.cursor = 'grabbing';
            startX = e.touches[0].pageX - logoCarousel.offsetLeft;
            scrollLeft = logoCarousel.scrollLeft;
            logoTrack.style.animationPlayState = 'paused';
        }, { passive: true });
        
        logoCarousel.addEventListener('touchmove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.touches[0].pageX - logoCarousel.offsetLeft;
            const walk = (x - startX) * 2;
            // Note: We don't actually scroll here since it's CSS animation
            // This just pauses the animation during touch
        }, { passive: false });
        
        logoCarousel.addEventListener('touchend', () => {
            isDown = false;
            logoCarousel.style.cursor = 'grab';
            if (!isPaused) {
                logoTrack.style.animationPlayState = 'running';
            }
        }, { passive: true });
        
        logoCarousel.addEventListener('touchcancel', () => {
            isDown = false;
            logoCarousel.style.cursor = 'grab';
            if (!isPaused) {
                logoTrack.style.animationPlayState = 'running';
            }
        }, { passive: true });
    }
    
});
