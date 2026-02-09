/**
 * Signature Cleans - Quote Estimator
 * Pricing logic adapted from internal quote calculator.
 * Provides instant guide estimates for website visitors.
 */

document.addEventListener('DOMContentLoaded', function() {

    // ========================================
    // PRICING CONFIGURATION
    // (Aligned with internal quote calculator)
    // ========================================

    const HOURLY_RATE = 17;
    const WEEKS_PER_MONTH = 4.33;
    const DEFAULT_MARGIN = 0.40;

    // Hours per day mapped by site size
    const SIZE_TO_HOURS = {
        'small':      1.5,
        'medium':     3,
        'large':      6,
        'very-large': 10
    };

    // Site type multipliers - some environments need more intensive cleaning
    const SITE_TYPE_MULTIPLIERS = {
        'Office/Commercial':      1.0,
        'Welfare/Construction':   1.15,
        'Hospitality/Venue':      1.2,
        'Education/Institutional': 1.0,
        'Specialist/Industrial':  1.1,
        'Dental/Medical':         1.3
    };

    // Estimated weekly product + overhead costs by site type
    const SITE_TYPE_EXTRAS = {
        'Office/Commercial':      15,
        'Welfare/Construction':   25,
        'Hospitality/Venue':      20,
        'Education/Institutional': 15,
        'Specialist/Industrial':  20,
        'Dental/Medical':         30
    };

    // Display labels
    const SIZE_LABELS = {
        'small':      'Small (under 2,000 sq ft)',
        'medium':     'Medium (2,000 - 10,000 sq ft)',
        'large':      'Large (10,000 - 50,000 sq ft)',
        'very-large': 'Very Large (50,000+ sq ft)'
    };

    // ========================================
    // STATE
    // ========================================

    let selectedSiteType = null;
    let selectedSize = null;
    let selectedFrequency = null;
    let currentStep = 1;

    // ========================================
    // DOM ELEMENTS
    // ========================================

    const steps = {
        1: document.getElementById('step-1'),
        2: document.getElementById('step-2'),
        3: document.getElementById('step-3')
    };

    const progressSteps = document.querySelectorAll('.progress-step');
    const progressLines = {
        1: document.getElementById('progress-line-1'),
        2: document.getElementById('progress-line-2')
    };

    const siteTypeCards = document.querySelectorAll('.site-type-card');
    const sizeOptions = document.querySelectorAll('.size-option');
    const freqOptions = document.querySelectorAll('.freq-option');
    const calcBtn = document.getElementById('calc-estimate');
    const backTo1 = document.getElementById('back-to-1');
    const backTo2 = document.getElementById('back-to-2');

    // Result elements
    const resultSiteType = document.getElementById('result-site-type');
    const resultAmount = document.getElementById('result-amount');
    const resultSize = document.getElementById('result-size');
    const resultFrequency = document.getElementById('result-frequency');
    const resultHours = document.getElementById('result-hours');

    // Hidden form fields
    const estSiteType = document.getElementById('est-site-type');
    const estSize = document.getElementById('est-size');
    const estFrequency = document.getElementById('est-frequency');
    const estEstimate = document.getElementById('est-estimate');
    const estHours = document.getElementById('est-hours');

    // Form elements
    const form = document.getElementById('quote-form');
    const formMessages = document.getElementById('form-messages');

    // ========================================
    // STEP NAVIGATION
    // ========================================

    function goToStep(step) {
        // Hide current step
        if (steps[currentStep]) {
            steps[currentStep].classList.remove('active');
        }

        // Show target step
        currentStep = step;
        if (steps[currentStep]) {
            steps[currentStep].classList.add('active');
        }

        // Update progress bar
        progressSteps.forEach(function(el) {
            var s = parseInt(el.dataset.step);
            el.classList.toggle('active', s <= step);
            el.classList.toggle('completed', s < step);
        });

        // Animate progress lines
        if (progressLines[1]) {
            progressLines[1].style.width = step >= 2 ? '100%' : '0%';
        }
        if (progressLines[2]) {
            progressLines[2].style.width = step >= 3 ? '100%' : '0%';
        }

        // Scroll to top of estimator
        var estimator = document.querySelector('.estimator-container');
        if (estimator) {
            estimator.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // ========================================
    // STEP 1: SITE TYPE SELECTION
    // ========================================

    siteTypeCards.forEach(function(card) {
        card.addEventListener('click', function() {
            // Deselect others
            siteTypeCards.forEach(function(c) { c.classList.remove('selected'); });

            // Select this one
            card.classList.add('selected');
            selectedSiteType = card.dataset.type;

            // Auto-advance to step 2 after a short delay
            setTimeout(function() {
                goToStep(2);
            }, 300);
        });
    });

    // ========================================
    // STEP 2: SIZE & FREQUENCY
    // ========================================

    sizeOptions.forEach(function(opt) {
        opt.addEventListener('click', function() {
            sizeOptions.forEach(function(o) { o.classList.remove('selected'); });
            opt.classList.add('selected');
            selectedSize = opt.dataset.size;
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
        if (calcBtn) {
            calcBtn.disabled = !(selectedSize && selectedFrequency);
        }
    }

    // Back button
    if (backTo1) {
        backTo1.addEventListener('click', function() {
            goToStep(1);
        });
    }

    // Calculate button
    if (calcBtn) {
        calcBtn.addEventListener('click', function() {
            calculateAndShowEstimate();
        });
    }

    // Back to step 2 from results
    if (backTo2) {
        backTo2.addEventListener('click', function() {
            goToStep(2);
        });
    }

    // ========================================
    // CALCULATION ENGINE
    // (Same formula as internal n8n workflow)
    // ========================================

    function calculateEstimate() {
        var baseHours = SIZE_TO_HOURS[selectedSize] || 3;
        var multiplier = SITE_TYPE_MULTIPLIERS[selectedSiteType] || 1.0;
        var extras = SITE_TYPE_EXTRAS[selectedSiteType] || 15;

        // Apply site type multiplier to hours
        var hoursPerDay = baseHours * multiplier;

        // Core formula from n8n Quote Calculator:
        // weeklyLabourCost = hoursPerDay * hourlyRate * frequency
        var weeklyLabourCost = hoursPerDay * HOURLY_RATE * selectedFrequency;

        // totalWeeklySpend = weeklyLabourCost + productCost + overheadCost
        var totalWeeklySpend = weeklyLabourCost + extras;

        // weeklyCharge = totalWeeklySpend / (1 - marginPercent)
        var weeklyCharge = totalWeeklySpend / (1 - DEFAULT_MARGIN);

        // monthlyTotal = round(weeklyCharge * weeksPerMonth)
        var monthlyTotal = Math.round(weeklyCharge * WEEKS_PER_MONTH);

        return {
            monthlyTotal: monthlyTotal,
            hoursPerDay: Math.round(hoursPerDay * 10) / 10,
            hoursPerWeek: Math.round(hoursPerDay * selectedFrequency * 10) / 10
        };
    }

    function calculateAndShowEstimate() {
        var result = calculateEstimate();

        // Populate results
        resultSiteType.textContent = selectedSiteType + ' Cleaning';
        resultAmount.textContent = '\u00A3' + result.monthlyTotal.toLocaleString('en-GB');
        resultSize.textContent = SIZE_LABELS[selectedSize] || selectedSize;
        resultFrequency.textContent = selectedFrequency + 'x per week';
        resultHours.textContent = result.hoursPerDay + ' hrs/day (' + result.hoursPerWeek + ' hrs/week)';

        // Populate hidden form fields
        estSiteType.value = selectedSiteType;
        estSize.value = selectedSize;
        estFrequency.value = selectedFrequency;
        estEstimate.value = result.monthlyTotal;
        estHours.value = result.hoursPerDay;

        // Go to results step
        goToStep(3);
    }

    // ========================================
    // FORM SUBMISSION
    // ========================================

    // Format phone number as user types
    var phoneField = document.getElementById('phone');
    if (phoneField) {
        phoneField.addEventListener('input', function(e) {
            var value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);

            if (value.startsWith('07') && value.length > 5) {
                value = value.slice(0, 5) + ' ' + value.slice(5);
            } else if (value.startsWith('01') && value.length > 4) {
                value = value.slice(0, 4) + ' ' + value.slice(4);
            }

            e.target.value = value;
        });
    }

    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (formMessages) {
                formMessages.innerHTML = '';
                formMessages.className = 'form-messages';
            }

            var submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';

            var formData = new FormData(form);
            var data = Object.fromEntries(formData.entries());

            // Map sector from site type for backend compatibility
            var siteTypeToSector = {
                'Office/Commercial': 'office',
                'Dental/Medical': 'medical',
                'Hospitality/Venue': 'hospitality',
                'Education/Institutional': 'education',
                'Welfare/Construction': 'construction',
                'Specialist/Industrial': 'other'
            };
            data.sector = siteTypeToSector[data.siteType] || 'other';
            data.serviceType = 'contract';

            try {
                var response = await fetch('/api/quote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                var result = await response.json();

                if (result.success) {
                    window.location.href = 'thank-you.html';
                } else {
                    showError(result.errors ? result.errors.join('<br>') : result.error || 'Something went wrong. Please try again.');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Get My Full Quote';
                }
            } catch (error) {
                showError('Unable to submit form. Please check your connection and try again.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Get My Full Quote';
            }
        });
    }

    function showError(message) {
        if (formMessages) {
            formMessages.innerHTML = message;
            formMessages.className = 'form-messages error';
            formMessages.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

});
