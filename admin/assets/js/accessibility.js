/**
 * FurrGuard Accessibility Enhancements
 * Adds ARIA labels, keyboard navigation, and screen reader support
 *
 * @version 1.0.0
 */

(function() {
    'use strict';

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAccessibility);
    } else {
        initAccessibility();
    }

    function initAccessibility() {
        addARIALabels();
        enhanceKeyboardNavigation();
        addFocusIndicators();
        enhanceModalAccessibility();
        addSkipLinks();
        improveTableAccessibility();
        enhanceFormAccessibility();
        addLiveRegions();
    }

    /**
     * Add ARIA labels to interactive elements
     */
    function addARIALabels() {
        // Navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            if (!item.getAttribute('aria-label')) {
                const text = item.textContent.trim();
                item.setAttribute('aria-label', text);
                item.setAttribute('role', 'menuitem');
            }
        });

        // Buttons without proper labels
        document.querySelectorAll('button').forEach(btn => {
            if (!btn.getAttribute('aria-label') && !btn.textContent.trim()) {
                const icon = btn.querySelector('svg');
                if (icon) {
                    const title = btn.getAttribute('title') || btn.id;
                    if (title) {
                        btn.setAttribute('aria-label', title);
                    } else {
                        btn.setAttribute('aria-label', 'Botón');
                    }
                }
            }
        });

        // Action buttons in tables
        document.querySelectorAll('.action-btn').forEach(btn => {
            const text = btn.textContent.trim();
            if (!btn.getAttribute('aria-label')) {
                // Get context from parent row
                const row = btn.closest('tr');
                if (row) {
                    const playerName = row.querySelector('.player-nick')?.textContent;
                    const ipAddress = row.querySelector('.ip-address')?.textContent;
                    const identifier = playerName || ipAddress || 'este elemento';
                    btn.setAttribute('aria-label', `${text} ${identifier}`);
                }
            }
        });

        // Status badges
        document.querySelectorAll('.status-badge').forEach(badge => {
            badge.setAttribute('role', 'status');
        });

        // Loading spinners
        document.querySelectorAll('.loading-spinner').forEach(spinner => {
            spinner.setAttribute('role', 'status');
            spinner.setAttribute('aria-live', 'polite');
            spinner.setAttribute('aria-label', 'Cargando...');
        });
    }

    /**
     * Enhance keyboard navigation
     */
    function enhanceKeyboardNavigation() {
        // Make all interactive elements focusable
        document.querySelectorAll('[onclick]').forEach(el => {
            if (!el.hasAttribute('tabindex')) {
                el.setAttribute('tabindex', '0');
                el.setAttribute('role', 'button');

                el.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.target.click();
                    }
                });
            }
        });

        // Keyboard navigation for dropdowns
        document.querySelectorAll('.filter-group, .nav-category').forEach(group => {
            group.setAttribute('role', 'group');

            const buttons = group.querySelectorAll('button, .nav-item');
            buttons.forEach((btn, index) => {
                btn.addEventListener('keydown', function(e) {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                        e.preventDefault();
                        const next = buttons[index + 1] || buttons[0];
                        next.focus();
                    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                        e.preventDefault();
                        const prev = buttons[index - 1] || buttons[buttons.length - 1];
                        prev.focus();
                    } else if (e.key === 'Home') {
                        e.preventDefault();
                        buttons[0].focus();
                    } else if (e.key === 'End') {
                        e.preventDefault();
                        buttons[buttons.length - 1].focus();
                    }
                });
            });
        });

        // Escape key to close modals and sidebar
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                // Close modals
                document.querySelectorAll('.modal.active').forEach(modal => {
                    modal.classList.remove('active');
                });

                // Close sidebar on mobile
                if (window.innerWidth <= 768) {
                    const sidebar = document.querySelector('.sidebar.open');
                    if (sidebar) {
                        sidebar.classList.remove('open');
                    }
                }
            }
        });
    }

    /**
     * Add visible focus indicators
     */
    function addFocusIndicators() {
        const style = document.createElement('style');
        style.textContent = `
            /* Focus visible styles */
            *:focus-visible {
                outline: 2px solid var(--accent-green) !important;
                outline-offset: 2px !important;
            }

            /* Better focus for navigation */
            .nav-item:focus-visible {
                background: var(--bg-card-hover);
                box-shadow: 0 0 0 2px var(--accent-green);
            }

            /* Focus for buttons */
            button:focus-visible,
            .action-btn:focus-visible,
            .btn-primary:focus-visible,
            .btn-secondary:focus-visible {
                box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.3);
            }

            /* Focus for inputs */
            input:focus-visible,
            select:focus-visible,
            textarea:focus-visible {
                outline: 2px solid var(--accent-green);
                outline-offset: -2px;
            }

            /* Skip link styling */
            .skip-link {
                position: absolute;
                top: -40px;
                left: 0;
                background: var(--accent-green);
                color: white;
                padding: 8px 16px;
                text-decoration: none;
                border-radius: 0 0 4px 0;
                z-index: 10000;
                transition: top 0.3s;
            }

            .skip-link:focus {
                top: 0;
            }

            /* High contrast focus option */
            @media (prefers-contrast: high) {
                *:focus-visible {
                    outline-width: 3px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Enhance modal accessibility
     */
    function enhanceModalAccessibility() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');

            // Trap focus within modal
            modal.addEventListener('transitionend', function() {
                if (modal.classList.contains('active')) {
                    const focusableElements = modal.querySelectorAll(
                        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    );
                    if (focusableElements.length) {
                        focusableElements[0].focus();
                    }

                    // Trap focus
                    const firstElement = focusableElements[0];
                    const lastElement = focusableElements[focusableElements.length - 1];

                    modal.addEventListener('keydown', function trapFocus(e) {
                        if (e.key === 'Tab') {
                            if (e.shiftKey && document.activeElement === firstElement) {
                                e.preventDefault();
                                lastElement.focus();
                            } else if (!e.shiftKey && document.activeElement === lastElement) {
                                e.preventDefault();
                                firstElement.focus();
                            }
                        }
                    });
                }
            });
        });
    }

    /**
     * Add skip links for keyboard users
     */
    function addSkipLinks() {
        const mainContent = document.querySelector('.main-content');
        if (mainContent && !document.querySelector('.skip-link')) {
            const skipLink = document.createElement('a');
            skipLink.href = '#main-content';
            skipLink.className = 'skip-link';
            skipLink.textContent = 'Saltar al contenido principal';
            skipLink.setAttribute('aria-label', 'Saltar al contenido principal');
            document.body.prepend(skipLink);

            if (!mainContent.id) {
                mainContent.id = 'main-content';
            }
        }
    }

    /**
     * Improve table accessibility
     */
    function improveTableAccessibility() {
        document.querySelectorAll('.data-table').forEach(table => {
            // Add proper ARIA attributes
            table.setAttribute('role', 'table');

            // Caption for screen readers
            if (!table.querySelector('caption')) {
                const sectionTitle = table.closest('.section')?.querySelector('h2, h3')?.textContent;
                if (sectionTitle) {
                    const caption = document.createElement('caption');
                    caption.className = 'visually-hidden';
                    caption.textContent = sectionTitle;
                    table.prepend(caption);
                }
            }

            // Header cells
            table.querySelectorAll('th').forEach(th => {
                th.setAttribute('role', 'columnheader');
                if (!th.getAttribute('scope')) {
                    th.setAttribute('scope', 'col');
                }
            });

            // Row headers
            table.querySelectorAll('td:first-child').forEach(td => {
                if (td.querySelector('.player-nick, .player-name')) {
                    td.setAttribute('role', 'rowheader');
                    td.setAttribute('scope', 'row');
                }
            });

            // Striped rows for better readability
            table.querySelectorAll('tbody tr').forEach((row, index) => {
                if (index % 2 === 0) {
                    row.classList.add('even-row');
                } else {
                    row.classList.add('odd-row');
                }
            });
        });
    }

    /**
     * Enhance form accessibility
     */
    function enhanceFormAccessibility() {
        document.querySelectorAll('input, select, textarea').forEach(input => {
            // Ensure labels exist
            if (!input.labels || input.labels.length === 0) {
                let labelText = input.getAttribute('placeholder') ||
                               input.getAttribute('aria-label') ||
                               input.id ||
                               'Campo';

                const label = document.createElement('label');
                label.className = 'visually-hidden';
                label.textContent = labelText;
                label.setAttribute('for', input.id || `input-${Math.random().toString(36).substr(2, 9)}`);

                if (!input.id) {
                    input.id = label.getAttribute('for');
                }

                input.parentNode.insertBefore(label, input);
            }

            // Add required indicators
            if (input.required && !input.getAttribute('aria-required')) {
                input.setAttribute('aria-required', 'true');
            }

            // Invalid state
            input.addEventListener('invalid', function() {
                this.setAttribute('aria-invalid', 'true');
                const errorMessage = this.validationMessage;
                if (errorMessage) {
                    this.setAttribute('aria-describedby', `${this.id}-error`);
                }
            });

            input.addEventListener('input', function() {
                if (this.checkValidity()) {
                    this.removeAttribute('aria-invalid');
                }
            });
        });

        // Add visual styles for visually hidden elements
        if (!document.querySelector('#visually-hidden-styles')) {
            const style = document.createElement('style');
            style.id = 'visually-hidden-styles';
            style.textContent = `
                .visually-hidden {
                    position: absolute !important;
                    width: 1px !important;
                    height: 1px !important;
                    padding: 0 !important;
                    margin: -1px !important;
                    overflow: hidden !important;
                    clip: rect(0, 0, 0, 0) !important;
                    white-space: nowrap !important;
                    border: 0 !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Add ARIA live regions for dynamic content
     */
    function addLiveRegions() {
        // Toast notifications
        const toastContainer = document.querySelector('.toast-container') ||
                              document.createElement('div');
        toastContainer.className = 'toast-container';
        toastContainer.setAttribute('aria-live', 'polite');
        toastContainer.setAttribute('aria-atomic', 'true');

        if (!document.querySelector('.toast-container')) {
            document.body.appendChild(toastContainer);
        }

        // Status updates
        const sections = ['overview', 'players', 'connections', 'ips', 'whitelist', 'blacklist'];
        sections.forEach(section => {
            const sectionEl = document.querySelector(`#section-${section}`);
            if (sectionEl && !sectionEl.querySelector('[aria-live]')) {
                const statusRegion = document.createElement('div');
                statusRegion.className = 'visually-hidden';
                statusRegion.setAttribute('aria-live', 'polite');
                statusRegion.setAttribute('aria-atomic', 'true');
                statusRegion.id = `${section}-status`;
                sectionEl.appendChild(statusRegion);
            }
        });
    }

    /**
     * Announce messages to screen readers
     */
    window.announceToScreenReader = function(message, priority = 'polite') {
        let announcer = document.querySelector(`#screen-reader-announcer-${priority}`);

        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = `screen-reader-announcer-${priority}`;
            announcer.className = 'visually-hidden';
            announcer.setAttribute('aria-live', priority);
            announcer.setAttribute('aria-atomic', 'true');
            document.body.appendChild(announcer);
        }

        announcer.textContent = '';
        setTimeout(() => {
            announcer.textContent = message;
        }, 100);
    };

    /**
     * Update page title on section change
     */
    const originalSwitchSection = window.switchSection;
    if (typeof originalSwitchSection === 'function') {
        window.switchSection = function(section) {
            originalSwitchSection.apply(this, arguments);

            const titles = {
                'overview': 'Resumen - FurrGuard',
                'players': 'Jugadores - FurrGuard',
                'connections': 'Conexiones - FurrGuard',
                'ips': 'Direcciones IP - FurrGuard',
                'whitelist': 'Whitelist - FurrGuard',
                'blacklist': 'Blacklist - FurrGuard',
                'providers': 'Proveedores - FurrGuard',
                'countries': 'Países - FurrGuard',
                'continents': 'Continentes - FurrGuard',
                'sanctions': 'Sanciones - FurrGuard',
                'messages': 'Mensajes - FurrGuard',
                'logs': 'Logs - FurrGuard',
                'settings': 'Configuración - FurrGuard',
                'users': 'Usuarios - FurrGuard',
                'furrperms': 'FurrPerms - FurrGuard'
            };

            if (titles[section]) {
                document.title = titles[section];
            }

            // Announce to screen readers
            announceToScreenReader(`Sección cambiada a ${titles[section] || section}`, 'polite');
        };
    }

})();
