/**
 * Signature Cleans - Quote Form Handler
 * Handles form validation and submission to backend API
 */

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('quote-form');
    if (!form) return;

    const serviceTypeField = document.getElementById('serviceType');
    const frequencyGroup = document.getElementById('frequency-group');
    const submitBtn = form.querySelector('button[type="submit"]');
    const formMessages = document.getElementById('form-messages');

    // Show/hide frequency field based on service type
    if (serviceTypeField && frequencyGroup) {
        serviceTypeField.addEventListener('change', function() {
            if (this.value === 'contract') {
                frequencyGroup.style.display = 'block';
                frequencyGroup.querySelector('select').required = true;
            } else {
                frequencyGroup.style.display = 'none';
                frequencyGroup.querySelector('select').required = false;
            }
        });
    }

    // Format phone number as user types
    const phoneField = document.getElementById('phone');
    if (phoneField) {
        phoneField.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);
            
            // Format UK phone numbers
            if (value.startsWith('07') && value.length > 5) {
                value = value.slice(0, 5) + ' ' + value.slice(5);
            } else if (value.startsWith('01') && value.length > 4) {
                value = value.slice(0, 4) + ' ' + value.slice(4);
            }
            
            e.target.value = value;
        });
    }

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Clear previous messages
        if (formMessages) {
            formMessages.innerHTML = '';
            formMessages.className = 'form-messages';
        }

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        // Gather form data
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/quote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                // Redirect to thank you page
                window.location.href = 'thank-you.html';
            } else {
                // Show errors
                showError(result.errors ? result.errors.join('<br>') : result.error || 'Something went wrong. Please try again.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Request Quote';
            }
        } catch (error) {
            console.error('Form submission error:', error);
            showError('Unable to submit form. Please check your connection and try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Request Quote';
        }
    });

    function showError(message) {
        if (formMessages) {
            formMessages.innerHTML = message;
            formMessages.className = 'form-messages error';
            formMessages.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
});
