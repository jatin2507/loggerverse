/**
 * Login Page Client-Side JavaScript
 */
(function() {
  'use strict';

  /**
   * Handle login form submission
   */
  async function handleLogin(event) {
    event.preventDefault();

    const form = event.target;
    const username = form.username.value;
    const password = form.password.value;
    const errorDiv = document.getElementById('error');

    // Clear previous errors
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    // Validate inputs
    if (!username || !password) {
      showError('Please enter both username and password');
      return;
    }

    try {
      // Disable form during submission
      setFormDisabled(true);

      const response = await fetch(`${window.LOGIN_CONFIG.apiPath}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        // Successful login
        window.location.href = data.redirect;
      } else {
        // Login failed
        let errorMessage = data.error || 'Login failed';

        // Add remaining attempts if provided
        if (data.attemptsRemaining) {
          errorMessage += ` (${data.attemptsRemaining} attempts remaining)`;
        }

        showError(errorMessage);

        // Add shake animation
        const container = document.querySelector('.login-container');
        container.style.animation = 'shake 0.5s';
        setTimeout(() => {
          container.style.animation = '';
        }, 500);

        // Clear password field on error
        form.password.value = '';
      }
    } catch (error) {
      console.error('Login error:', error);
      showError('Network error. Please try again.');
    } finally {
      setFormDisabled(false);
    }
  }

  /**
   * Show error message
   */
  function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  /**
   * Enable/disable form inputs
   */
  function setFormDisabled(disabled) {
    const form = document.getElementById('loginForm');
    const inputs = form.querySelectorAll('input, button');

    inputs.forEach(input => {
      input.disabled = disabled;
    });

    // Update button text
    const button = form.querySelector('button[type="submit"]');
    if (button) {
      button.textContent = disabled ? 'Logging in...' : 'Login';
    }
  }

  /**
   * Initialize login page
   */
  function init() {
    const form = document.getElementById('loginForm');

    if (form) {
      form.addEventListener('submit', handleLogin);

      // Auto-focus username field
      const usernameField = document.getElementById('username');
      if (usernameField) {
        usernameField.focus();
      }
    }

    // Handle enter key in form fields
    const inputs = form.querySelectorAll('input');
    inputs.forEach((input, index) => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (index < inputs.length - 1) {
            inputs[index + 1].focus();
          } else {
            form.requestSubmit();
          }
        }
      });
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();