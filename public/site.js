(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const storedTheme = () => localStorage.getItem("theme");
  const systemTheme = () =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  const applyTheme = (theme) => {
    root.setAttribute("data-theme", theme);
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-pressed", String(theme === "dark"));
      button.textContent = theme === "dark" ? "Light" : "Dark";
    });
  };

  applyTheme(storedTheme() === "light" || storedTheme() === "dark" ? storedTheme() : systemTheme());

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      applyTheme(next);
    });
  });

  const toggle = document.querySelector(".nav-toggle");
  const header = document.querySelector(".site-header");
  toggle?.addEventListener("click", () => {
    const open = header.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  if (!reduceMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
  } else {
    document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-visible"));
  }

  const bindShot = (img) => {
    const shot = img.closest(".shot");
    const mark = () => {
      if (img.naturalWidth > 0) shot?.classList.add("has-image");
      else shot?.classList.remove("has-image");
    };
    img.addEventListener("load", mark);
    img.addEventListener("error", () => shot?.classList.remove("has-image"));
    if (img.complete) mark();
  };

  document.querySelectorAll(".shot img").forEach(bindShot);

  const carousel = document.querySelector("[data-hero-carousel]");
  const track = carousel?.querySelector("[data-hero-track]");
  const originals = track ? [...track.querySelectorAll(".hero-slide")] : [];
  const dots = carousel ? [...carousel.querySelectorAll(".hero-dot")] : [];
  const prev = carousel?.querySelector("[data-hero-prev]");
  const next = carousel?.querySelector("[data-hero-next]");

  if (carousel && track && originals.length > 1) {
    const count = originals.length;
    const cloneSlide = (slide) => {
      const clone = slide.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.setAttribute("inert", "");
      clone.removeAttribute("aria-label");
      clone.querySelectorAll(".shot img").forEach(bindShot);
      return clone;
    };

    track.insertBefore(cloneSlide(originals[count - 1]), originals[0]);
    track.appendChild(cloneSlide(originals[0]));

    let logical = 0;
    let physical = 1;
    let timer = 0;
    let dragging = false;
    let jumping = false;
    let settling = false;
    let settleFrame = 0;
    let startX = 0;
    let startScroll = 0;
    let settleTimer = 0;

    const width = () => track.clientWidth;
    const maxPhysical = count + 1;
    const logicalOf = (p) => {
      if (p <= 0) return count - 1;
      if (p >= maxPhysical) return 0;
      return p - 1;
    };

    const setDots = () => {
      dots.forEach((dot, i) => {
        dot.classList.toggle("is-active", i === logical);
        if (i === logical) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      });
    };

    const jumpTo = (p) => {
      jumping = true;
      track.classList.add("is-jumping");
      physical = p;
      logical = logicalOf(p);
      track.scrollTo({ left: p * width(), behavior: "auto" });
      requestAnimationFrame(() => {
        track.scrollTo({ left: p * width(), behavior: "auto" });
        track.classList.remove("is-jumping");
        jumping = false;
      });
    };

    const settleClones = () => {
      if (physical === 0) jumpTo(count);
      else if (physical === maxPhysical) jumpTo(1);
    };

    const stopSettle = () => {
      if (settleFrame) cancelAnimationFrame(settleFrame);
      settleFrame = 0;
      settling = false;
      track.classList.remove("is-settling");
    };

    const settleTo = (p) => {
      if (settleFrame) cancelAnimationFrame(settleFrame);
      settleFrame = 0;

      const w = width();
      const from = track.scrollLeft;
      const to = p * w;
      physical = p;
      logical = logicalOf(p);
      setDots();
      settling = true;
      track.classList.add("is-settling");

      if (reduceMotion || Math.abs(to - from) < 1) {
        track.scrollTo({ left: to, behavior: "auto" });
        stopSettle();
        settleClones();
        return;
      }

      const duration = Math.min(480, Math.max(220, Math.abs(to - from) * 0.45));
      const started = performance.now();
      const ease = (t) => 1 - (1 - t) ** 3;

      const step = (now) => {
        const t = Math.min(1, (now - started) / duration);
        track.scrollLeft = from + (to - from) * ease(t);
        if (t < 1) {
          settleFrame = requestAnimationFrame(step);
          return;
        }
        track.scrollLeft = to;
        stopSettle();
        settleClones();
      };

      settleFrame = requestAnimationFrame(step);
    };

    const goPhysical = (p, instant = false) => {
      if (p > maxPhysical) {
        jumpTo(1);
        p = 2;
        instant = false;
      } else if (p < 0) {
        jumpTo(count);
        p = count - 1;
        instant = false;
      }
      physical = p;
      logical = logicalOf(p);
      setDots();
      track.scrollTo({ left: p * width(), behavior: instant ? "auto" : "smooth" });
    };

    const restart = () => {
      window.clearInterval(timer);
      if (reduceMotion) return;
      timer = window.setInterval(() => goPhysical(physical + 1), 7000);
    };

    const sync = () => {
      if (dragging || jumping || settling || !width()) return;
      physical = Math.round(track.scrollLeft / width());
      logical = logicalOf(physical);
      setDots();
    };

    prev?.addEventListener("click", () => {
      goPhysical(physical - 1);
      restart();
    });
    next?.addEventListener("click", () => {
      goPhysical(physical + 1);
      restart();
    });
    dots.forEach((dot, i) =>
      dot.addEventListener("click", () => {
        goPhysical(i + 1);
        restart();
      }),
    );

    track.addEventListener(
      "scroll",
      () => {
        requestAnimationFrame(sync);
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          if (!dragging && !jumping && !settling) settleClones();
        }, 80);
      },
      { passive: true },
    );
    track.addEventListener("scrollend", () => {
      if (!dragging && !jumping && !settling) settleClones();
    });

    track.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch") return;
      stopSettle();
      dragging = true;
      startX = event.clientX;
      startScroll = track.scrollLeft;
      track.classList.add("is-dragging");
      track.setPointerCapture(event.pointerId);
      window.clearInterval(timer);
    });

    track.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      track.scrollLeft = startScroll - (event.clientX - startX);
    });

    const endDrag = (event) => {
      if (!dragging) return;
      dragging = false;
      track.classList.add("is-settling");
      track.classList.remove("is-dragging");
      const w = width();
      const delta = event.clientX - startX;
      const from = Math.round(startScroll / w);
      const nearest = Math.round(track.scrollLeft / w);
      const target = Math.max(
        0,
        Math.min(maxPhysical, Math.abs(delta) > w * 0.15 ? from + (delta < 0 ? 1 : -1) : nearest),
      );
      settleTo(target);
      restart();
    };

    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    window.addEventListener("resize", () => jumpTo(logical + 1));
    carousel.addEventListener("mouseenter", () => window.clearInterval(timer));
    carousel.addEventListener("mouseleave", restart);
    carousel.addEventListener("focusin", () => window.clearInterval(timer));
    carousel.addEventListener("focusout", restart);

    jumpTo(1);
    setDots();
    restart();
  }
})();
