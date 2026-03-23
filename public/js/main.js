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
    
    // Mobile Services Dropdown Toggle
    const dropdownWrapper = document.querySelector('.nav-dropdown-wrapper');
    const dropdownTrigger = document.querySelector('.nav-dropdown-trigger');
    if (dropdownWrapper && dropdownTrigger) {
        dropdownTrigger.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                dropdownWrapper.classList.toggle('open');
            }
        });
    }

    // Navbar Background on Scroll
    const nav = document.getElementById('nav');

    if (nav) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                nav.style.background = 'rgba(255, 255, 255, 0.95)';
            } else {
                nav.style.background = 'rgba(255, 255, 255, 0.8)';
            }
        });
    }
    
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
                if (navLinks && navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                    if (navToggle) navToggle.classList.remove('active');
                }
            }
        });
    });
    
    // Logo Carousel - Enhanced infinite scroll with pause on hover and touch support
    const logoCarousel = document.querySelector('.logo-carousel');
    const logoTrack = document.querySelector('.logo-track');
    
    if (logoCarousel && logoTrack) {
        let isPaused = false;
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
            logoTrack.style.animationPlayState = 'paused';
        }, { passive: true });
        
        logoCarousel.addEventListener('touchmove', () => {
            // Animation is already paused by touchstart — no action needed
        }, { passive: true });
        
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
