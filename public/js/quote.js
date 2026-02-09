/**
 * Signature Cleans - Quote Estimator
 * Collects visitor inputs and calls server-side API for pricing.
 * No pricing logic in the browser.
 */

document.addEventListener('DOMContentLoaded', function() {

    // ========================================
    // DISPLAY LABELS
    // ========================================

    var SIZE_LABELS = {
        'small':      'Small (under 200 m\u00B2)',
        'medium':     'Medium (200 - 1,000 m\u00B2)',
        'large':      'Large (1,000 - 5,000 m\u00B2)',
        'very-large': 'Very Large (5,000+ m\u00B2)'
    };

    // ========================================
    // STATE
    // ========================================

    var selectedSiteType = null;
    var selectedSize = null;
    var selectedFrequency = null;
    var currentStep = 1;

    // ========================================
    // DOM ELEMENTS
    // ========================================

    var steps = {
        1: document.getElementById('step-1'),
        2: document.getElementById('step-2'),
        3: document.getElementById('step-3')
    };

    var progressSteps = document.querySelectorAll('.progress-step');
    var progressLines = {
        1: document.getElementById('progress-line-1'),
        2: document.getElementById('progress-line-2')
    };

    var siteTypeCards = document.querySelectorAll('.site-type-card');
    var sizeOptions = document.querySelectorAll('.size-option');
    var freqOptions = document.querySelectorAll('.freq-option');
    var calcBtn = document.getElementById('calc-estimate');
    var backTo1 = document.getElementById('back-to-1');
    var backTo2 = document.getElementById('back-to-2');

    // Result elements
    var resultSiteType = document.getElementById('result-site-type');
    var cellTypeBanner = document.getElementById('cell-type-banner');
    var cellTypeBadge = document.getElementById('cell-type-badge');
    var cellTypeLabel = document.getElementById('cell-type-label');
    var resultWeekly = document.getElementById('result-weekly');
    var resultMonthly = document.getElementById('result-monthly');
    var resultSize = document.getElementById('result-size');
    var resultFrequency = document.getElementById('result-frequency');
    var resultHours = document.getElementById('result-hours');

    // Hidden form fields
    var estSiteType = document.getElementById('est-site-type');
    var estSize = document.getElementById('est-size');
    var estFrequency = document.getElementById('est-frequency');
    var estEstimate = document.getElementById('est-estimate');
    var estHours = document.getElementById('est-hours');

    // Form elements
    var form = document.getElementById('quote-form');
    var formMessages = document.getElementById('form-messages');

    // ========================================
    // STEP NAVIGATION
    // ========================================

    function goToStep(step) {
        if (steps[currentStep]) {
            steps[currentStep].classList.remove('active');
        }

        currentStep = step;
        if (steps[currentStep]) {
            steps[currentStep].classList.add('active');
        }

        progressSteps.forEach(function(el) {
            var s = parseInt(el.dataset.step);
            el.classList.toggle('active', s <= step);
            el.classList.toggle('completed', s < step);
        });

        if (progressLines[1]) {
            progressLines[1].style.width = step >= 2 ? '100%' : '0%';
        }
        if (progressLines[2]) {
            progressLines[2].style.width = step >= 3 ? '100%' : '0%';
        }

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
            siteTypeCards.forEach(function(c) { c.classList.remove('selected'); });
            card.classList.add('selected');
            selectedSiteType = card.dataset.type;

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

    if (backTo1) {
        backTo1.addEventListener('click', function() { goToStep(1); });
    }

    if (calcBtn) {
        calcBtn.addEventListener('click', function() { fetchEstimate(); });
    }

    if (backTo2) {
        backTo2.addEventListener('click', function() { goToStep(2); });
    }

    // ========================================
    // SERVER-SIDE ESTIMATE
    // ========================================

    async function fetchEstimate() {
        calcBtn.disabled = true;
        calcBtn.textContent = 'Calculating...';

        try {
            var response = await fetch('/api/estimate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteType: selectedSiteType,
                    size: selectedSize,
                    frequency: selectedFrequency
                })
            });

            var data = await response.json();

            if (data.success) {
                showEstimate(data.estimate);
            } else {
                alert('Unable to calculate estimate. Please try again.');
            }
        } catch (err) {
            alert('Something went wrong. Please try again.');
        }

        calcBtn.disabled = false;
        calcBtn.textContent = 'Calculate Estimate';
    }

    function showEstimate(estimate) {
        resultSiteType.textContent = selectedSiteType + ' Cleaning';

        // Cell Type classification
        cellTypeBadge.textContent = 'Cell Type ' + estimate.cellType;
        cellTypeLabel.textContent = 'Cell Type ' + estimate.cellType + ' \u2014 ' + estimate.cellLabel;
        cellTypeBanner.className = 'cell-type-banner cell-type-' + estimate.cellType.toLowerCase();

        // Weekly price range (primary)
        resultWeekly.textContent = '\u00A3' + estimate.weeklyLow.toLocaleString('en-GB') + ' \u2013 \u00A3' + estimate.weeklyHigh.toLocaleString('en-GB');

        // Monthly approximation
        resultMonthly.textContent = '\u00A3' + estimate.monthlyLow.toLocaleString('en-GB') + ' \u2013 \u00A3' + estimate.monthlyHigh.toLocaleString('en-GB');

        resultSize.textContent = SIZE_LABELS[selectedSize] || selectedSize;
        resultFrequency.textContent = selectedFrequency + 'x per week';
        resultHours.textContent = estimate.hoursPerDay + ' hrs/day (' + estimate.hoursPerWeek + ' hrs/week)';

        // Hidden form fields
        estSiteType.value = selectedSiteType;
        estSize.value = selectedSize;
        estFrequency.value = selectedFrequency;
        estEstimate.value = estimate.weeklyLow + '-' + estimate.weeklyHigh + '/wk';
        estHours.value = estimate.hoursPerDay;

        goToStep(3);
    }

    // ========================================
    // FORM SUBMISSION
    // ========================================

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
            data.leadSource = 'website-estimator';

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
