// HTMX event listeners
document.body.addEventListener("htmx:configRequest", (event) => {
  event.detail.headers["X-Requested-With"] = "XMLHttpRequest";
});

document.body.addEventListener("htmx:afterSwap", (event) => {
  initializeTooltips();
});

document.body.addEventListener("htmx:responseError", (event) => {
  console.error("HTMX Error:", event.detail);
  showAlert("An error occurred. Please try again.", "danger");
});

// Initialize Bootstrap tooltips
function initializeTooltips() {
  const tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
}

function showAlert(message, type = "info") {
  const alertContainer = document.getElementById("alert-container");
  if (alertContainer) {
    const alert = document.createElement("div");
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = "alert";
    alert.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    alertContainer.appendChild(alert);

    setTimeout(() => {
      alert.classList.remove("show");
      setTimeout(() => alert.remove(), 150);
    }, 5000);
  }
}

function confirmDelete(message = "Are you sure you want to delete this item?") {
  return confirm(message);
}

function autoDismissFlashMessages() {
  const alerts = document.querySelectorAll("#alert-container .alert");
  alerts.forEach((alert) => {
    setTimeout(() => {
      const bsAlert =
        bootstrap.Alert.getInstance(alert) || new bootstrap.Alert(alert);
      bsAlert.close();
    }, 5000);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  initializeTooltips();
  autoDismissFlashMessages();

  document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", function (e) {
      if (!confirm(this.dataset.confirm)) {
        e.preventDefault();
      }
    });
  });
});
