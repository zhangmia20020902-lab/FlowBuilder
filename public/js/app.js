// Debounce function for search inputs
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Auto-submit search forms with debouncing
document.addEventListener("DOMContentLoaded", function () {
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  // Toggle sidebar on mobile
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", function () {
      if (sidebar) {
        sidebar.classList.toggle("show");
        sidebarOverlay.classList.toggle("show");
      }
    });
  }

  // Close sidebar when clicking overlay
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", function () {
      sidebar.classList.remove("show");
      sidebarOverlay.classList.remove("show");
    });
  }

  // Highlight active navigation link
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll(".sidebar .nav-link");

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (href && href !== "#" && currentPath.startsWith(href) && href !== "/") {
      link.classList.add("active");

      // Expand parent collapse if link is in submenu
      const parentCollapse = link.closest(".collapse");
      if (parentCollapse) {
        parentCollapse.classList.add("show");
        const toggleLink = document.querySelector(
          `[href="#${parentCollapse.id}"]`
        );
        if (toggleLink) {
          toggleLink.classList.remove("collapsed");
          toggleLink.setAttribute("aria-expanded", "true");
        }
      }
    } else if (href === "/" && currentPath === "/") {
      link.classList.add("active");
    }
  });

  // Close sidebar on link click (mobile only)
  if (sidebar && window.innerWidth < 992) {
    navLinks.forEach((link) => {
      link.addEventListener("click", function () {
        if (!this.classList.contains("collapsed")) {
          sidebar.classList.remove("show");
          sidebarOverlay.classList.remove("show");
        }
      });
    });
  }

  // Search input debouncing for Projects and RFQs
  const searchInputs = document.querySelectorAll('input[name="search"]');

  searchInputs.forEach((input) => {
    const form = input.closest("form");
    if (!form) return;

    const debouncedSubmit = debounce(() => {
      // Only auto-submit if there's actual search text or if clearing
      if (input.value.trim().length >= 2 || input.value.trim().length === 0) {
        form.submit();
      }
    }, 500);

    input.addEventListener("input", debouncedSubmit);
  });

  // Client-side validation for RFQ creation
  const rfqForms = document.querySelectorAll('form[action*="/rfqs"]');

  rfqForms.forEach((form) => {
    form.addEventListener("submit", function (e) {
      // Check if at least one material is selected
      const materialCheckboxes = form.querySelectorAll(
        'input[name*="materials"][type="checkbox"]'
      );
      const hasSelectedMaterial = Array.from(materialCheckboxes).some(
        (cb) => cb.checked
      );

      if (materialCheckboxes.length > 0 && !hasSelectedMaterial) {
        e.preventDefault();
        alert("Please select at least one material for this RFQ.");
        return false;
      }

      // Check if at least one supplier is selected
      const supplierCheckboxes = form.querySelectorAll(
        'input[name="suppliers[]"][type="checkbox"]'
      );
      const hasSelectedSupplier = Array.from(supplierCheckboxes).some(
        (cb) => cb.checked
      );

      if (supplierCheckboxes.length > 0 && !hasSelectedSupplier) {
        e.preventDefault();
        alert("Please select at least one supplier for this RFQ.");
        return false;
      }

      // Validate quantities for selected materials
      if (hasSelectedMaterial) {
        let invalidQuantities = false;
        materialCheckboxes.forEach((cb) => {
          if (cb.checked) {
            const materialId = cb.value || cb.name.match(/\[(\d+)\]/)?.[1];
            const quantityInput = form.querySelector(
              `input[name*="[${materialId}][quantity]"]`
            );
            if (quantityInput) {
              const quantity = parseInt(quantityInput.value);
              if (isNaN(quantity) || quantity <= 0) {
                invalidQuantities = true;
              }
            }
          }
        });

        if (invalidQuantities) {
          e.preventDefault();
          alert(
            "Please enter valid quantities (greater than 0) for all selected materials."
          );
          return false;
        }
      }
    });
  });

  // Real-time total calculation for quote submission (backup if inline script fails)
  const quotePriceInputs = document.querySelectorAll(".price-input");
  if (quotePriceInputs.length > 0) {
    quotePriceInputs.forEach((input) => {
      input.addEventListener("input", function () {
        const row = this.closest("tr");
        if (!row) return;

        const totalCell = row.querySelector(".item-total");
        if (!totalCell) return;

        const price = parseFloat(this.value) || 0;
        const quantity = parseFloat(this.dataset.quantity) || 0;
        const total = price * quantity;

        totalCell.textContent = "$" + total.toFixed(2);

        // Update grand total
        let grandTotal = 0;
        document.querySelectorAll(".price-input").forEach((inp) => {
          const p = parseFloat(inp.value) || 0;
          const q = parseFloat(inp.dataset.quantity) || 0;
          grandTotal += p * q;
        });

        const grandTotalElement = document.getElementById("grand-total");
        if (grandTotalElement) {
          grandTotalElement.textContent = "$" + grandTotal.toFixed(2);
        }
      });
    });
  }

  // Update URL parameters for bookmarkable filters
  const filterForms = document.querySelectorAll('form[method="GET"]');
  filterForms.forEach((form) => {
    const selects = form.querySelectorAll("select");
    selects.forEach((select) => {
      select.addEventListener("change", function () {
        // Auto-submit filter forms when selection changes
        if (
          this.name === "sortBy" ||
          this.name === "status" ||
          this.name === "rfq_id"
        ) {
          form.submit();
        }
      });
    });
  });

  // Add loading indicators during form submissions
  const allForms = document.querySelectorAll("form");
  allForms.forEach((form) => {
    form.addEventListener("submit", function () {
      const submitButtons = this.querySelectorAll('button[type="submit"]');
      submitButtons.forEach((btn) => {
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML =
          '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Loading...';

        // Re-enable after 5 seconds as fallback
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }, 5000);
      });
    });
  });

  // Enhance delete modal confirmation
  const deleteModal = document.getElementById("deleteModal");
  if (deleteModal) {
    deleteModal.addEventListener("show.bs.modal", function (event) {
      const button = event.relatedTarget;
      const itemName = button.getAttribute("data-item-name");
      const deleteUrl = button.getAttribute("data-delete-url");
      const warning = button.getAttribute("data-warning");

      const modal = this;
      modal.querySelector("#deleteItemName").textContent = itemName;
      modal.querySelector("#deleteForm").action = deleteUrl;

      const warningElement = modal.querySelector("#deleteWarning");
      if (warning && warningElement) {
        warningElement.textContent = warning;
        warningElement.style.display = "block";
      } else if (warningElement) {
        warningElement.style.display = "none";
      }
    });
  }

  // Accessibility improvements: keyboard navigation
  const cards = document.querySelectorAll(".card");
  cards.forEach((card, index) => {
    const links = card.querySelectorAll("a, button");
    links.forEach((link, linkIndex) => {
      link.setAttribute("tabindex", index * 100 + linkIndex);
    });
  });

  // Add focus styles
  const focusableElements = document.querySelectorAll(
    "a, button, input, select, textarea"
  );
  focusableElements.forEach((element) => {
    element.addEventListener("focus", function () {
      this.classList.add("focused");
    });
    element.addEventListener("blur", function () {
      this.classList.remove("focused");
    });
  });
});

// Export for potential module usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = { debounce };
}
