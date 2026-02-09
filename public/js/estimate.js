/**
 * Signature Cleans - Instant Quote Estimator
 *
 * Pricing logic:
 * - Rate band: £25-£27/hr
 * - ~500 sq ft per hour for general office clean
 * - Cell A: ≤15 hrs/week | Cell B: 16-30 hrs/week | Cell C: ≥31 hrs/week
 * - Standard scope: base hours
 * - Enhanced scope: +12.5% hours (midpoint of 10-15%)
 * - Heavy scope: +25% hours (midpoint of 20-30%)
 */

document.addEventListener('DOMContentLoaded', function () {
    const RATE_LOW = 25;
    const RATE_HIGH = 27;
    const SQ_FT_PER_HOUR = 500;

    const placeholder = document.getElementById('results-placeholder');
    const resultsCard = document.getElementById('results-card');

    function getSelected(name) {
        const el = document.querySelector('input[name="' + name + '"]:checked');
        return el ? el.value : null;
    }

    function calculate() {
        var sizeVal = getSelected('size');
        var freqVal = getSelected('frequency');
        var scopeVal = getSelected('scope');

        if (!sizeVal || !freqVal || !scopeVal) {
            placeholder.style.display = '';
            resultsCard.style.display = 'none';
            return;
        }

        var sqft = parseInt(sizeVal, 10);
        var visitsPerWeek = parseInt(freqVal, 10);

        // Calculate hours per visit: sqft / 500 sq ft per hour, minimum 1 hour
        var hoursPerVisit = Math.max(1, sqft / SQ_FT_PER_HOUR);

        // Base weekly hours
        var baseHours = hoursPerVisit * visitsPerWeek;

        // Apply scope multiplier
        var scopeMultiplier = 1;
        var scopeLabel = 'None';
        if (scopeVal === 'enhanced') {
            scopeMultiplier = 1.125;
            scopeLabel = '+12.5%';
        } else if (scopeVal === 'heavy') {
            scopeMultiplier = 1.25;
            scopeLabel = '+25%';
        }

        var totalHours = baseHours * scopeMultiplier;

        // Round to nearest 0.5
        totalHours = Math.round(totalHours * 2) / 2;

        // Determine Cell Type
        var cellType, cellLabel;
        if (totalHours <= 15) {
            cellType = 'A';
            cellLabel = 'A (Small)';
        } else if (totalHours <= 30) {
            cellType = 'B';
            cellLabel = 'B (Medium)';
        } else {
            cellType = 'C';
            cellLabel = 'C (Large)';
        }

        // Calculate costs
        var weeklyLow = totalHours * RATE_LOW;
        var weeklyHigh = totalHours * RATE_HIGH;
        var monthlyLow = weeklyLow * 4.33;
        var monthlyHigh = weeklyHigh * 4.33;

        // Round to nearest pound
        weeklyLow = Math.round(weeklyLow);
        weeklyHigh = Math.round(weeklyHigh);
        monthlyLow = Math.round(monthlyLow);
        monthlyHigh = Math.round(monthlyHigh);

        // Update UI
        placeholder.style.display = 'none';
        resultsCard.style.display = '';

        document.getElementById('results-cell').textContent = 'Cell Type ' + cellType;
        document.getElementById('results-weekly-range').innerHTML = '&pound;' + weeklyLow.toLocaleString() + ' &ndash; &pound;' + weeklyHigh.toLocaleString();
        document.getElementById('results-monthly-range').innerHTML = '&pound;' + monthlyLow.toLocaleString() + ' &ndash; &pound;' + monthlyHigh.toLocaleString();

        // Round hours per visit for display
        var displayHoursPerVisit = Math.round(hoursPerVisit * 2) / 2;
        document.getElementById('hours-per-visit').textContent = displayHoursPerVisit + (displayHoursPerVisit === 1 ? ' hr' : ' hrs');
        document.getElementById('visits-per-week').textContent = visitsPerWeek;
        document.getElementById('total-hours').textContent = totalHours + (totalHours === 1 ? ' hr' : ' hrs');
        document.getElementById('scope-adjustment').textContent = scopeLabel;
        document.getElementById('cell-type').textContent = cellLabel;
    }

    // Listen for changes on all radio inputs
    document.querySelectorAll('input[type="radio"]').forEach(function (input) {
        input.addEventListener('change', calculate);
    });
});
