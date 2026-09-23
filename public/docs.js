(() => {
  const input = document.querySelector("[data-docs-search]");
  const groups = [...document.querySelectorAll("[data-docs-group]")];
  const empty = document.querySelector("[data-docs-empty]");
  const menuBtn = document.querySelector("[data-docs-menu]");
  const nav = document.querySelector("[data-docs-nav]");

  const fold = (value) => value.toLowerCase().trim();

  input?.addEventListener("input", () => {
    const query = fold(input.value);
    let visible = 0;
    groups.forEach((group) => {
      let groupVisible = 0;
      group.querySelectorAll("a").forEach((link) => {
        const haystack = fold(`${link.textContent} ${link.dataset.search || ""}`);
        const show = !query || haystack.includes(query);
        link.classList.toggle("is-hidden", !show);
        if (show) groupVisible += 1;
      });
      group.classList.toggle("is-hidden", groupVisible === 0);
      visible += groupVisible;
    });
    empty?.classList.toggle("is-visible", Boolean(query) && visible === 0);
  });

  menuBtn?.addEventListener("click", () => {
    const open = nav?.classList.toggle("is-open");
    menuBtn.setAttribute("aria-expanded", String(Boolean(open)));
  });

  nav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => nav.classList.remove("is-open"));
  });
})();
