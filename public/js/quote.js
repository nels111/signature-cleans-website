/**
 * Signature Cleans - Quote Estimator
 * Side-by-side layout: Calculator (left) + Contact Form (right)
 * Calculator is immediately interactive; price is gated behind contact form.
 * 2-hour minimum. 30+ weekly hours triggers site-visit recommendation.
 */

document.addEventListener('DOMContentLoaded', function() {

    // ========================================
    // STATE
    // ========================================

    var selectedSiteType = null;
    var selectedHours = null;
    var selectedFrequency = null;
    var currentCalcStep = 1;
    var contactFormValid = false;
    var estimateSubmitted = false;
    var pendingEstimate = null; // holds estimate data when form wasn't filled

    // ========================================
    // DOM ELEMENTS
    // ========================================

    var calcSteps = {
        1: document.getElementById('calc-step-1'),
        2: document.getElementById('calc-step-2'),
        3: document.getElementById('calc-step-3')
    };

    var calcDots = document.querySelectorAll('.calc-dot');

    // Form elements
    var gateName = document.getElementById('gate-name');
    var gateEmail = document.getElementById('gate-email');
    var gatePhone = document.getElementById('gate-phone');
    var gateCompany = document.getElementById('gate-company');
    var gatePostcode = document.getElementById('gate-postcode');
    var gateErrors = document.getElementById('gate-errors');
    var formSubmitBtn = document.getElementById('form-submit-btn');

    // Calculator elements
    var siteTypeCards = document.querySelectorAll('.site-type-card');
    var hoursOptions = document.querySelectorAll('.hours-option');
    var freqOptions = document.querySelectorAll('.freq-option');
    var calcBtn = document.getElementById('calc-estimate');

    // Navigation
    var backTo1 = document.getElementById('back-to-1');
    var backTo2 = document.getElementById('back-to-2');

    // Results elements
    var resultSiteType = document.getElementById('result-site-type');
    var cellTypeBanner = document.getElementById('cell-type-banner');
    var cellTypeBadge = document.getElementById('cell-type-badge');
    var cellTypeLabel = document.getElementById('cell-type-label');
    var resultWeekly = document.getElementById('result-weekly');
    var resultMonthly = document.getElementById('result-monthly');
    var resultHoursSummary = document.getElementById('result-hours-summary');
    var resultHours = document.getElementById('result-hours');
    var resultFrequency = document.getElementById('result-frequency');
    var resultWeeklyHours = document.getElementById('result-weekly-hours');

    // Overlay & banners
    var resultGateOverlay = document.getElementById('result-gate-overlay');
    var overlayToForm = document.getElementById('overlay-to-form');
    var siteVisitBanner = document.getElementById('site-visit-banner');
    var estimateDisclaimer = document.getElementById('estimate-disclaimer');
    var weeklyHoursWarning = document.getElementById('weekly-hours-warning');
    var warningHoursTotal = document.getElementById('warning-hours-total');

    // ========================================
    // CALCULATOR STEP NAVIGATION
    // ========================================

    function goToCalcStep(step) {
        if (calcSteps[currentCalcStep]) {
            calcSteps[currentCalcStep].classList.remove('active');
        }

        currentCalcStep = step;
        if (calcSteps[currentCalcStep]) {
            calcSteps[currentCalcStep].classList.add('active');
        }

        // Update progress dots
        calcDots.forEach(function(dot) {
            var s = parseInt(dot.dataset.step);
            dot.classList.toggle('active', s <= step);
            dot.classList.toggle('completed', s < step);
        });

        // Scroll calculator into view
        var calculator = document.querySelector('.estimator-calculator');
        if (calculator) {
            calculator.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // ========================================
    // SITE TYPE SELECTION (Step 1)
    // ========================================

    siteTypeCards.forEach(function(card) {
        card.addEventListener('click', function() {
            siteTypeCards.forEach(function(c) { c.classList.remove('selected'); });
            card.classList.add('selected');
            selectedSiteType = card.dataset.type;

            setTimeout(function() {
                goToCalcStep(2);
            }, 300);
        });
    });

    // ========================================
    // HOURS & FREQUENCY (Step 2)
    // ========================================

    hoursOptions.forEach(function(opt) {
        opt.addEventListener('click', function() {
            hoursOptions.forEach(function(o) { o.classList.remove('selected'); });
            opt.classList.add('selected');
            selectedHours = parseFloat(opt.dataset.hours);
            checkStep2Ready();
        });
    });

    freqOptions.forEach(function(opt) {
        opt.addEventListener('click', function() {
            freqOptions.forEach(function(o) { o.classList.remove('selected'); });
            opt.classList.add('selected');
            selectedFrequency = parseInt(opt.dataset.freq);
            checkStep2Ready();
        });
    });

    function checkStep2Ready() {
        var ready = !!(selectedHours && selectedFrequency);
        if (calcBtn) calcBtn.disabled = !ready;

        // Show/hide 30+ hours warning
        if (ready && weeklyHoursWarning) {
            var total = selectedHours * selectedFrequency;
            if (total >= 30) {
                if (warningHoursTotal) warningHoursTotal.textContent = total;
                weeklyHoursWarning.style.display = 'flex';
            } else {
                weeklyHoursWarning.style.display = 'none';
            }
        } else if (weeklyHoursWarning) {
            weeklyHoursWarning.style.display = 'none';
        }

        updateSubmitButton();
    }

    // ========================================
    // CONTACT FORM VALIDATION (real-time)
    // ========================================

    function validateForm() {
        var name = gateName ? gateName.value.trim() : '';
        var email = gateEmail ? gateEmail.value.trim() : '';
        var phone = gatePhone ? gatePhone.value.trim() : '';

        contactFormValid = (
            name.length >= 2 &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
            phone.replace(/\D/g, '').length >= 10
        );

        updateSubmitButton();
    }

    // Phone formatting
    if (gatePhone) {
        gatePhone.addEventListener('input', function(e) {
            var value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);

            if (value.startsWith('07') && value.length > 5) {
                value = value.slice(0, 5) + ' ' + value.slice(5);
            } else if (value.startsWith('01') && value.length > 4) {
                value = value.slice(0, 4) + ' ' + value.slice(4);
            }

            e.target.value = value;
            validateForm();
        });
    }

    // Real-time validation on all form fields
    [gateName, gateEmail, gatePhone, gateCompany, gatePostcode].forEach(function(field) {
        if (field) {
            field.addEventListener('input', validateForm);
            field.addEventListener('change', validateForm);
        }
    });

    // Allow Enter key in form to submit
    [gateName, gateEmail, gatePhone, gateCompany, gatePostcode].forEach(function(field) {
        if (field) {
            field.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (formSubmitBtn && !formSubmitBtn.disabled) formSubmitBtn.click();
                }
            });
        }
    });

    // ========================================
    // SUBMIT BUTTON STATE
    // ========================================

    function updateSubmitButton() {
        if (!formSubmitBtn) return;

        // Button is enabled when BOTH calculator selections AND form fields are complete
        var calcComplete = !!(selectedSiteType && selectedHours && selectedFrequency);
        formSubmitBtn.disabled = !(calcComplete && contactFormValid);
    }

    // ========================================
    // NAVIGATION BUTTONS
    // ========================================

    if (backTo1) backTo1.addEventListener('click', function() { goToCalcStep(1); });
    if (backTo2) backTo2.addEventListener('click', function() { goToCalcStep(2); });

    // Calculator "Get My Estimate" → advance to step 3
    if (calcBtn) {
        calcBtn.addEventListener('click', function() {
            goToCalcStep(3);

            if (contactFormValid) {
                // Form already filled: fire API call immediately
                fetchEstimate();
            } else {
                // Show overlay with placeholder values
                showPlaceholderResults();
                showOverlay();
            }
        });
    }

    // Form "Get My Estimate" button
    if (formSubmitBtn) {
        formSubmitBtn.addEventListener('click', function() {
            // Clear previous errors
            if (gateErrors) {
                gateErrors.textContent = '';
                gateErrors.className = 'form-messages';
            }

            // Validate
            var errors = [];
            var name = gateName ? gateName.value.trim() : '';
            var email = gateEmail ? gateEmail.value.trim() : '';
            var phone = gatePhone ? gatePhone.value.trim() : '';

            if (!name || name.length < 2) errors.push('Please enter your name');
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Please enter a valid email address');
            if (!phone || phone.replace(/\D/g, '').length < 10) errors.push('Please enter a valid phone number');

            if (errors.length > 0) {
                if (gateErrors) {
                    gateErrors.textContent = '';
                    errors.forEach(function(msg, i) {
                        if (i > 0) gateErrors.appendChild(document.createElement('br'));
                        gateErrors.appendChild(document.createTextNode(msg));
                    });
                    gateErrors.className = 'form-messages error';
                }
                return;
            }

            // If not on step 3 yet, go there
            if (currentCalcStep !== 3) {
                goToCalcStep(3);
                showPlaceholderResults();
            }

            fetchEstimate();
        });
    }

    // Overlay "Enter Details" → scroll to form + focus name
    if (overlayToForm) {
        overlayToForm.addEventListener('click', function() {
            var formPanel = document.querySelector('.estimator-form-panel');
            if (formPanel) {
                formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            if (gateName) {
                setTimeout(function() { gateName.focus(); }, 500);
            }
        });
    }

    // ========================================
    // OVERLAY MANAGEMENT
    // ========================================

    function showOverlay() {
        if (resultGateOverlay) resultGateOverlay.style.display = 'flex';
        var priceCard = document.getElementById('estimate-price-card');
        if (priceCard) priceCard.classList.add('blurred');
    }

    function hideOverlay() {
        if (resultGateOverlay) resultGateOverlay.style.display = 'none';
        var priceCard = document.getElementById('estimate-price-card');
        if (priceCard) priceCard.classList.remove('blurred');
    }

    // ========================================
    // PLACEHOLDER RESULTS (shown behind blur)
    // ========================================

    function showPlaceholderResults() {
        if (resultSiteType) resultSiteType.textContent = selectedSiteType + ' Cleaning';
        if (resultWeekly) resultWeekly.textContent = '\u00A3***';
        if (resultMonthly) resultMonthly.textContent = '\u00A3***';
        var weeklyHrs = selectedHours * selectedFrequency;
        if (resultHoursSummary) resultHoursSummary.textContent = weeklyHrs + ' hours per week';
        if (resultHours) resultHours.textContent = selectedHours + ' hours';
        if (resultFrequency) resultFrequency.textContent = selectedFrequency + 'x per week';
        if (resultWeeklyHours) resultWeeklyHours.textContent = weeklyHrs + ' hours';
        if (cellTypeBanner) cellTypeBanner.style.display = 'none';
    }

    // ========================================
    // SERVER-SIDE ESTIMATE
    // ========================================

    async function fetchEstimate() {
        formSubmitBtn.disabled = true;
        formSubmitBtn.textContent = 'Calculating...';

        try {
            var response = await fetch('/api/estimate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteType: selectedSiteType,
                    hours: selectedHours,
                    frequency: selectedFrequency,
                    name: gateName ? gateName.value.trim() : '',
                    email: gateEmail ? gateEmail.value.trim() : '',
                    phone: gatePhone ? gatePhone.value.trim() : '',
                    company: gateCompany ? gateCompany.value.trim() : '',
                    postcode: gatePostcode ? gatePostcode.value.trim() : '',
                    website: document.getElementById('website') ? document.getElementById('website').value : ''
                })
            });

            var data = await response.json();

            if (data.success) {
                estimateSubmitted = true;
                hideOverlay();
                showEstimate(data.estimate);
                showFormSuccess();
            } else {
                var errMsg = data.errors ? data.errors.join('\n') : data.error || 'Unable to calculate estimate. Please try again.';
                if (gateErrors) {
                    gateErrors.textContent = errMsg;
                    gateErrors.className = 'form-messages error';
                }
            }
        } catch (err) {
            if (gateErrors) {
                gateErrors.textContent = 'Something went wrong. Please try again.';
                gateErrors.className = 'form-messages error';
            }
        }

        formSubmitBtn.disabled = false;
        formSubmitBtn.textContent = 'Get My Estimate';
    }

    function showEstimate(estimate) {
        if (resultSiteType) resultSiteType.textContent = selectedSiteType + ' Cleaning';

        // Cell Type classification
        if (cellTypeBadge) cellTypeBadge.textContent = 'Cell Type ' + estimate.cellType;
        if (cellTypeLabel) cellTypeLabel.textContent = 'Cell Type ' + estimate.cellType + ' \u2014 ' + estimate.cellLabel;
        if (cellTypeBanner) {
            cellTypeBanner.className = 'cell-type-banner cell-type-' + estimate.cellType.toLowerCase();
            cellTypeBanner.style.display = 'flex';
        }

        // Weekly price
        if (resultWeekly) resultWeekly.textContent = '\u00A3' + estimate.weeklyPrice.toLocaleString('en-GB');

        // Monthly approximation
        if (resultMonthly) resultMonthly.textContent = '\u00A3' + estimate.monthlyPrice.toLocaleString('en-GB');

        // Hours summary
        if (resultHoursSummary) resultHoursSummary.textContent = estimate.weeklyHours + ' hours per week';

        // Detail breakdown
        if (resultHours) resultHours.textContent = selectedHours + (selectedHours === 1 ? ' hour' : ' hours');
        if (resultFrequency) resultFrequency.textContent = selectedFrequency + 'x per week';
        if (resultWeeklyHours) resultWeeklyHours.textContent = estimate.weeklyHours + ' hours';

        // Show disclaimer on all results
        if (estimateDisclaimer) estimateDisclaimer.style.display = 'flex';

        // Show site visit banner for 30+ hours
        if (estimate.siteVisitRecommended && siteVisitBanner) {
            siteVisitBanner.style.display = 'flex';
        } else if (siteVisitBanner) {
            siteVisitBanner.style.display = 'none';
        }

        // Make sure we're on step 3
        if (currentCalcStep !== 3) goToCalcStep(3);
    }

    // ========================================
    // FORM SUCCESS STATE
    // ========================================

    function showFormSuccess() {
        var formCard = document.querySelector('.form-panel-card');
        if (!formCard) return;

        var userName = gateName ? gateName.value.trim().split(' ')[0] : '';

        formCard.innerHTML =
            '<div style="text-align:center;padding:20px 0;">' +
                '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="margin-bottom:16px;"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
                '<h3 style="font-size:1.25rem;font-weight:700;margin-bottom:8px;">Thank you' + (userName ? ', ' + userName : '') + '!</h3>' +
                '<p style="color:#86868b;font-size:0.9375rem;line-height:1.6;margin-bottom:20px;">Your estimate is ready. One of our team will review your requirements and be in touch within 24 hours.</p>' +
                '<div style="background:#f5f5f7;border-radius:12px;padding:16px;text-align:left;margin-bottom:16px;">' +
                    '<p style="font-size:0.8125rem;color:#86868b;margin-bottom:4px;">Need to speak to someone now?</p>' +
                    '<a href="tel:01392931035" style="font-size:1.125rem;font-weight:700;color:#1d1d1f;text-decoration:none;">01392 931035</a>' +
                '</div>' +
                '<p style="font-size:0.75rem;color:#86868b;">We\'ve also sent a confirmation to your email.</p>' +
            '</div>';
    }

});
