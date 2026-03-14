/**
 * FurrGuard - Professional JavaScript
 * Smooth animations and interactions
 */

(function() {
    'use strict';

    // ============================================
    // Configuration
    // ============================================

    const CONFIG = {
        scrollThreshold: 50,
        observerRootMargin: '0px 0px -80px 0px',
        observerThreshold: 0.15,
        counterDuration: 2000,
        parallaxStrength: 0.3
    };

    // ============================================
    // Utility Functions
    // ============================================

    const debounce = (fn, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    };

    const throttle = (fn, limit) => {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };

    const easeOutQuart = t => 1 - Math.pow(1 - t, 4);

    // ============================================
    // 3D Card Effect
    // ============================================

    const initCard3DEffect = () => {
        const cards = document.querySelectorAll('.card-3d, .service-card');

        cards.forEach(card => {
            let bounds;

            const rotateToMouse = (e) => {
                bounds = card.getBoundingClientRect();
                const mouseX = e.clientX;
                const mouseY = e.clientY;
                const leftX = mouseX - bounds.x;
                const topY = mouseY - bounds.y;
                const center = {
                    x: leftX - bounds.width / 2,
                    y: topY - bounds.height / 2
                };
                const distance = Math.sqrt(center.x ** 2 + center.y ** 2);

                card.style.setProperty('--rotate-x', (center.y * -1) / 15 + 'deg');
                card.style.setProperty('--rotate-y', center.x / 15 + 'deg');
                card.style.setProperty('--mouse-x', leftX + 'px');
                card.style.setProperty('--mouse-y', topY + 'px');
            };

            const resetRotation = () => {
                card.style.setProperty('--rotate-x', '0deg');
                card.style.setProperty('--rotate-y', '0deg');
            };

            card.addEventListener('mousemove', throttle(rotateToMouse, 16));
            card.addEventListener('mouseleave', resetRotation);
        });
    };

    // ============================================
    // Header Scroll Effect
    // ============================================

    const initHeaderScroll = () => {
        const header = document.querySelector('.header');
        if (!header) return;

        let lastScroll = 0;
        let ticking = false;

        const updateHeader = () => {
            const currentScroll = window.pageYOffset;

            if (currentScroll > CONFIG.scrollThreshold) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }

            lastScroll = currentScroll;
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(updateHeader);
                ticking = true;
            }
        });
    };

    // ============================================
    // Mobile Navigation
    // ============================================

    const initMobileNav = () => {
        const menuBtn = document.querySelector('.menu-btn');
        const nav = document.querySelector('.nav');

        if (!menuBtn || !nav) return;

        const toggleMenu = (e) => {
            e.stopPropagation();
            menuBtn.classList.toggle('active');
            nav.classList.toggle('active');
            document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
        };

        const closeMenu = () => {
            menuBtn.classList.remove('active');
            nav.classList.remove('active');
            document.body.style.overflow = '';
        };

        menuBtn.addEventListener('click', toggleMenu);

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!nav.contains(e.target) && !menuBtn.contains(e.target)) {
                closeMenu();
            }
        });

        // Close on link click
        nav.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', closeMenu);
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && nav.classList.contains('active')) {
                closeMenu();
            }
        });
    };

    // ============================================
    // Scroll Animations
    // ============================================

    const initScrollAnimations = () => {
        const animatedElements = document.querySelectorAll(
            '.fade-on-scroll, .reveal-3d, .service-card, .job-card, .team-member, .why-card, .team-card'
        );

        const observerOptions = {
            threshold: CONFIG.observerThreshold,
            rootMargin: CONFIG.observerRootMargin
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    // Add staggered delay based on position
                    const delay = entry.target.dataset.delay || 0;
                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, delay);
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        animatedElements.forEach(el => observer.observe(el));
    };

    // ============================================
    // Counter Animation
    // ============================================

    const initCounters = () => {
        const counters = document.querySelectorAll('.stat-number[data-target]');

        const animateCounter = (element, target) => {
            const duration = CONFIG.counterDuration;
            const startTime = performance.now();
            const startValue = 0;

            const update = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easedProgress = easeOutQuart(progress);
                const currentValue = Math.floor(startValue + (target - startValue) * easedProgress);

                element.textContent = currentValue.toLocaleString();

                if (progress < 1) {
                    requestAnimationFrame(update);
                } else {
                    element.textContent = target.toLocaleString();
                }
            };

            requestAnimationFrame(update);
        };

        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = parseInt(entry.target.dataset.target);
                    animateCounter(entry.target, target);
                    counterObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.8 });

        counters.forEach(counter => counterObserver.observe(counter));
    };

    // ============================================
    // Copy to Clipboard
    // ============================================

    const initCopyToClipboard = () => {
        const copyButtons = document.querySelectorAll('[data-copy]');

        const showCopyFeedback = (button) => {
            button.classList.add('copied');
            setTimeout(() => {
                button.classList.remove('copied');
            }, 2000);
        };

        copyButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const textToCopy = button.getAttribute('data-copy');

                try {
                    await navigator.clipboard.writeText(textToCopy);
                    showCopyFeedback(button);
                } catch {
                    // Fallback for older browsers
                    const textarea = document.createElement('textarea');
                    textarea.value = textToCopy;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    showCopyFeedback(button);
                }
            });
        });
    };

    // ============================================
    // Smooth Scroll
    // ============================================

    const initSmoothScroll = () => {
        const header = document.querySelector('.header');
        const headerHeight = header ? header.offsetHeight : 72;

        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                const href = anchor.getAttribute('href');
                if (href === '#' || href === '#!') return;

                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });

                    // Focus management
                    target.focus({ preventScroll: true });
                }
            });
        });
    };

    // ============================================
    // Active Navigation Link
    // ============================================

    const initActiveNavLinks = () => {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-link[href^="#"]');

        if (!sections.length || !navLinks.length) return;

        const updateActiveLink = () => {
            const scrollY = window.pageYOffset;
            const headerHeight = document.querySelector('.header')?.offsetHeight || 72;

            let currentSection = '';

            sections.forEach(section => {
                const sectionTop = section.offsetTop - headerHeight - 100;
                const sectionHeight = section.offsetHeight;

                if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
                    currentSection = section.getAttribute('id');
                }
            });

            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === '#' + currentSection) {
                    link.classList.add('active');
                }
            });
        };

        window.addEventListener('scroll', throttle(updateActiveLink, 100));
        updateActiveLink();
    };

    // ============================================
    // Parallax Effect (subtle)
    // ============================================

    const initParallax = () => {
        const parallaxElements = document.querySelectorAll('[data-parallax]');

        if (!parallaxElements.length) return;

        const updateParallax = () => {
            const scrollY = window.pageYOffset;

            parallaxElements.forEach(el => {
                const speed = parseFloat(el.dataset.parallax) || CONFIG.parallaxStrength;
                const yPos = -(scrollY * speed);
                el.style.transform = 'translate3d(0, ' + yPos + 'px, 0)';
            });
        };

        window.addEventListener('scroll', throttle(updateParallax, 16));
    };

    // ============================================
    // Magnetic Button Effect
    // ============================================

    const initMagneticButtons = () => {
        const buttons = document.querySelectorAll('.btn-primary, .nav-btn');

        buttons.forEach(button => {
            button.addEventListener('mousemove', (e) => {
                const rect = button.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;

                button.style.transform = 'translate(' + (x * 0.2) + 'px, ' + (y * 0.2) + 'px)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.transform = '';
            });
        });
    };

    // ============================================
    // Reveal Animations on Page Load
    // ============================================

    const initLoadAnimations = () => {
        const heroElements = document.querySelectorAll(
            '.hero-badge, .hero-title, .hero-subtitle, .hero-actions, .hero-stats, .hero-scroll'
        );

        heroElements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.animation = 'fadeInUp 0.8s ease-out ' + (index * 0.1) + 's forwards';
        });
    };

    // ============================================
    // Lazy Loading Images
    // ============================================

    const initLazyLoading = () => {
        const images = document.querySelectorAll('img[data-src]');

        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.add('loaded');
                        imageObserver.unobserve(img);
                    }
                });
            });

            images.forEach(img => imageObserver.observe(img));
        } else {
            // Fallback for older browsers
            images.forEach(img => {
                img.src = img.dataset.src;
                img.classList.add('loaded');
            });
        }
    };

    // ============================================
    // Initialize Everything
    // ============================================

    const init = () => {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initAll);
        } else {
            initAll();
        }
    };

    const initAll = () => {
        initCard3DEffect();
        initHeaderScroll();
        initMobileNav();
        initScrollAnimations();
        initCounters();
        initCopyToClipboard();
        initSmoothScroll();
        initActiveNavLinks();
        initParallax();
        initMagneticButtons();
        initLoadAnimations();
        initLazyLoading();

        // Add loaded class to body
        document.body.classList.add('loaded');
    };

    // Start initialization
    init();

})();
