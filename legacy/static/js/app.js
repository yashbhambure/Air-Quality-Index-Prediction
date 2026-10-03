// Theme toggle + light client-side validation.
(function () {
  const btn = document.getElementById("themeBtn");
  const root = document.documentElement;
  const saved = localStorage.getItem("aqi-theme");
  if (saved) root.setAttribute("data-bs-theme", saved);
  btn && btn.addEventListener("click", () => {
    const next = root.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-bs-theme", next);
    localStorage.setItem("aqi-theme", next);
  });

  const form = document.getElementById("predictForm");
  form && form.addEventListener("submit", (e) => {
    for (const el of form.querySelectorAll("input[type=number]")) {
      if (el.value === "" || isNaN(parseFloat(el.value))) {
        e.preventDefault();
        el.classList.add("is-invalid");
        el.focus();
        return;
      }
    }
  });
})();
