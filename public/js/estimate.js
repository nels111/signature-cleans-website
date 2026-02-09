/**
 * Signature Cleans - Instant Quote Estimator
 */

document.addEventListener('DOMContentLoaded', function () {
    var _r = [25, 27];
    var _d = 500;

    var placeholder = document.getElementById('results-placeholder');
    var resultsCard = document.getElementById('results-card');

    function getSelected(name) {
        var el = document.querySelector('input[name="' + name + '"]:checked');
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

        var s = parseInt(sizeVal, 10);
        var f = parseInt(freqVal, 10);
        var h = Math.max(1, s / _d);
        var b = h * f;
        var m = scopeVal === 'heavy' ? 1.25 : scopeVal === 'enhanced' ? 1.125 : 1;
        var t = Math.round(b * m * 2) / 2;

        var wL = Math.round(t * _r[0]);
        var wH = Math.round(t * _r[1]);
        var mL = Math.round(wL * 4.33);
        var mH = Math.round(wH * 4.33);

        placeholder.style.display = 'none';
        resultsCard.style.display = '';

        document.getElementById('results-weekly-range').innerHTML =
            '\u00A3' + wL.toLocaleString() + ' \u2013 \u00A3' + wH.toLocaleString();
        document.getElementById('results-monthly-range').innerHTML =
            '\u00A3' + mL.toLocaleString() + ' \u2013 \u00A3' + mH.toLocaleString();
    }

    document.querySelectorAll('input[type="radio"]').forEach(function (input) {
        input.addEventListener('change', calculate);
    });
});
