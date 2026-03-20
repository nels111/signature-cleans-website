/**
 * Signature Cleans - Quote Estimator
 * 4-step flow: Contact Gate → Site Type → Hours + Frequency → Estimate
 * Contact details required before estimator is accessible.
 * Pricing at £27/hr calculated server-side.
 */

document.addEventListener('DOMContentLoaded', function() {

    // ========================================
    // STATE
    // ========================================

    var contactDetails = { name: '', email: '', phone: '', company: '', postcode: '' };
    var selectedSiteType = null;
    var selectedHours = null;
    var selectedFrequency = null;
    var currentStep = 1;

    // ========================================
    // DOM ELEMENTS
    // ========================================

    var steps = {
        1: document.getElementById('step-1'),
        2: document.getElementById('step-2'),
        3: document.getElementById('step-3'),
        4: document.getElementById('step-4')
    };

    var progressSteps = document.querySelectorAll('.progress-step');
    var progressLines = {
        1: document.getElementById('progress-line-1'),
        2: document.getElementById('progress-line-2'),
        3: document.getElementById('progress-line-3')
    };

    // Step 1: Gate elements
    var gateName = document.getElementById('gate-name');
    var gateEmail = document.getElementById('gate-email');
    var gatePhone = document.getElementById('gate-phone');
    var gateCompany = document.getElementById('gate-company');
    var gatePostcode = document.getElementById('gate-postcode');
    var gateContinue = document.getElementById('gate-continue');
    var gateErrors = document.getElementById('gate-errors');

    // Step 2: Site type
    var siteTypeCards = document.querySelectorAll('.site-type-card');

    // Step 3: Hours & Frequency
    var hoursOptions = document.querySelectorAll('.hours-option');
    var freqOptions = document.querySelectorAll('.freq-option');
    var calcBtn = document.getElementById('calc-estimate');

    // Navigation
    var backTo1 = document.getElementById('back-to-1');
    var backTo2 = document.getElementById('back-to-2');
    var backTo3 = document.getElementById('back-to-3');

    // Result elements
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

        if (progressLines[1]) progressLines[1].style.width = step >= 2 ? '100%' : '0%';
        if (progressLines[2]) progressLines[2].style.width = step >= 3 ? '100%' : '0%';
        if (progressLines[3]) progressLines[3].style.width = step >= 4 ? '100%' : '0%';

        var estimator = document.querySelector('.estimator-container');
        if (estimator) {
            estimator.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // ========================================
    // STEP 1: CONTACT DETAILS GATE
    // ========================================

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
        });
    }

    if (gateContinue) {
        gateContinue.addEventListener('click', function() {
            if (gateErrors) {
                gateErrors.innerHTML = '';
                gateErrors.className = 'form-messages';
            }

            var errors = [];
            var name = gateName ? gateName.value.trim() : '';
            var email = gateEmail ? gateEmail.value.trim() : '';
            var phone = gatePhone ? gatePhone.value.trim() : '';

            if (!name || name.length < 2) errors.push('Please enter your name');
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Please enter a valid email address');
            if (!phone || phone.replace(/\D/g, '').length < 10) errors.push('Please enter a valid phone number');

            if (errors.length > 0) {
                if (gateErrors) {
                    gateErrors.innerHTML = errors.join('<br>');
                    gateErrors.className = 'form-messages error';
                }
                return;
            }

            // Store contact details
            contactDetails.name = name;
            contactDetails.email = email;
            contactDetails.phone = phone;
            contactDetails.company = gateCompany ? gateCompany.value.trim() : '';
            contactDetails.postcode = gatePostcode ? gatePostcode.value.trim() : '';

            goToStep(2);
        });
    }

    // Allow Enter key to submit gate form
    [gateName, gateEmail, gatePhone, gateCompany, gatePostcode].forEach(function(field) {
        if (field) {
            field.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (gateContinue) gateContinue.click();
                }
            });
        }
    });

    // ========================================
    // STEP 2: SITE TYPE SELECTION
    // ========================================

    siteTypeCards.forEach(function(card) {
        card.addEventListener('click', function() {
            siteTypeCards.forEach(function(c) { c.classList.remove('selected'); });
            card.classList.add('selected');
            selectedSiteType = card.dataset.type;

            setTimeout(function() {
                goToStep(3);
            }, 300);
        });
    });

    // ========================================
    // STEP 3: HOURS & FREQUENCY
    // ========================================

    hoursOptions.forEach(function(opt) {
        opt.addEventListener('click', function() {
            hoursOptions.forEach(function(o) { o.classList.remove('selected'); });
            opt.classList.add('selected');
            selectedHours = parseFloat(opt.dataset.hours);
            checkStep3Ready();
        });
    });

    freqOptions.forEach(function(opt) {
        opt.addEventListener('click', function() {
            freqOptions.forEach(function(o) { o.classList.remove('selected'); });
            opt.classList.add('selected');
            selectedFrequency = parseInt(opt.dataset.freq);
            checkStep3Ready();
        });
    });

    function checkStep3Ready() {
        if (calcBtn) {
            calcBtn.disabled = !(selectedHours && selectedFrequency);
        }
    }

    // ========================================
    // NAVIGATION BUTTONS
    // ========================================

    if (backTo1) backTo1.addEventListener('click', function() { goToStep(1); });
    if (backTo2) backTo2.addEventListener('click', function() { goToStep(2); });
    if (backTo3) backTo3.addEventListener('click', function() { goToStep(3); });

    if (calcBtn) {
        calcBtn.addEventListener('click', function() { fetchEstimate(); });
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
                    hours: selectedHours,
                    frequency: selectedFrequency,
                    name: contactDetails.name,
                    email: contactDetails.email,
                    phone: contactDetails.phone,
                    company: contactDetails.company,
                    postcode: contactDetails.postcode,
                    website: document.getElementById('website') ? document.getElementById('website').value : ''
                })
            });

            var data = await response.json();

            if (data.success) {
                showEstimate(data.estimate);
            } else {
                alert(data.errors ? data.errors.join('\n') : data.error || 'Unable to calculate estimate. Please try again.');
            }
        } catch (err) {
            alert('Something went wrong. Please try again.');
        }

        calcBtn.disabled = false;
        calcBtn.innerHTML = 'Get My Estimate <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14m-7-7l7 7-7 7"/></svg>';
    }

    function showEstimate(estimate) {
        if (resultSiteType) resultSiteType.textContent = selectedSiteType + ' Cleaning';

        // Cell Type classification
        if (cellTypeBadge) cellTypeBadge.textContent = 'Cell Type ' + estimate.cellType;
        if (cellTypeLabel) cellTypeLabel.textContent = 'Cell Type ' + estimate.cellType + ' \u2014 ' + estimate.cellLabel;
        if (cellTypeBanner) cellTypeBanner.className = 'cell-type-banner cell-type-' + estimate.cellType.toLowerCase();

        // Weekly price
        if (resultWeekly) resultWeekly.textContent = '\u00A3' + estimate.weeklyPrice.toLocaleString('en-GB');

        // Monthly approximation
        if (resultMonthly) resultMonthly.textContent = '\u00A3' + estimate.monthlyPrice.toLocaleString('en-GB');

        // Hours summary
        if (resultHoursSummary) resultHoursSummary.textContent = estimate.weeklyHours + ' hours per week at \u00A327/hr';

        // Detail breakdown
        if (resultHours) resultHours.textContent = selectedHours + (selectedHours === 1 ? ' hour' : ' hours');
        if (resultFrequency) resultFrequency.textContent = selectedFrequency + 'x per week';
        if (resultWeeklyHours) resultWeeklyHours.textContent = estimate.weeklyHours + ' hours';

        goToStep(4);
    }

});
