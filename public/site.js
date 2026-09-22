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

  const drawer = document.querySelector("[data-nav-drawer]");
  const openBtn = document.querySelector("[data-nav-open]");
  const header = document.querySelector(".site-header");
  const syncHeaderHeight = () => {
    if (!header) return;
    document.documentElement.style.setProperty(
      "--header-h",
      `${Math.round(header.getBoundingClientRect().height)}px`,
    );
  };
  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);

  const setMenuOpen = (open) => {
    openBtn?.setAttribute("aria-expanded", String(open));
    openBtn?.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("nav-open", open);
    syncHeaderHeight();
  };

  openBtn?.addEventListener("click", () => {
    if (!drawer) return;
    if (drawer.open) drawer.hide();
    else drawer.show();
  });
  drawer?.addEventListener("sl-show", () => setMenuOpen(true));
  drawer?.addEventListener("sl-hide", () => setMenuOpen(false));
  drawer?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => drawer.hide());
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
    let autoplayTimer = 0;
    let idleTimer = 0;
    let dragging = false;
    let jumping = false;
    let settling = false;
    let touching = false;
    let axis = null;
    let settleFrame = 0;
    let startX = 0;
    let startY = 0;
    let startScroll = 0;
    const AUTOPLAY_MS = 7000;
    const canHover = window.matchMedia("(hover: hover)").matches;
    const isPhone = () =>
      window.matchMedia("(hover: none) and (pointer: coarse)").matches;

    const width = () => track.clientWidth;
    const maxPhysical = count + 1;
    const busy = () => dragging || jumping || settling || touching;
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

    const stopAutoplay = () => {
      window.clearTimeout(autoplayTimer);
      autoplayTimer = 0;
    };

    const armAutoplay = () => {
      stopAutoplay();
      if (reduceMotion || document.hidden) return;
      autoplayTimer = window.setTimeout(() => {
        if (busy()) {
          autoplayTimer = 0;
          return;
        }
        goPhysical(physical + 1);
      }, AUTOPLAY_MS);
    };

    const syncFromScroll = () => {
      const w = width();
      if (!w || jumping || settling) return;
      physical = Math.round(track.scrollLeft / w);
      logical = logicalOf(physical);
      setDots();
    };

    const jumpTo = (p) => {
      jumping = true;
      track.classList.add("is-jumping");
      physical = p;
      logical = logicalOf(p);
      setDots();
      const x = p * width();
      const apply = () => track.scrollTo({ left: x, behavior: "auto" });
      apply();
      requestAnimationFrame(() => {
        apply();
        requestAnimationFrame(() => {
          apply();
          track.classList.remove("is-jumping");
          jumping = false;
        });
      });
    };

    const finishOnClone = () => {
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

      p = Math.max(0, Math.min(maxPhysical, p));
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
        finishOnClone();
        return;
      }

      const distance = Math.abs(to - from);
      const duration = isPhone()
        ? Math.min(920, Math.max(560, distance * 0.8))
        : Math.min(480, Math.max(220, distance * 0.45));
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
        finishOnClone();
      };

      settleFrame = requestAnimationFrame(step);
    };

    const goPhysical = (p, instant = false) => {
      armAutoplay();
      p = Math.max(0, Math.min(maxPhysical, p));
      if (instant) jumpTo(p);
      else settleTo(p);
    };

    const onIdle = () => {
      if (busy()) return;
      syncFromScroll();
      finishOnClone();
      if (!autoplayTimer) armAutoplay();
    };

    const queueIdle = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(onIdle, 140);
    };

    const settleFromGesture = (delta, originScroll) => {
      const w = width();
      const from = Math.round(originScroll / w);
      const nearest = Math.round(track.scrollLeft / w);
      const target = Math.max(
        0,
        Math.min(maxPhysical, Math.abs(delta) > w * 0.15 ? from + (delta < 0 ? 1 : -1) : nearest),
      );
      settleTo(target);
    };

    prev?.addEventListener("click", () => goPhysical(physical - 1));
    next?.addEventListener("click", () => goPhysical(physical + 1));
    dots.forEach((dot, i) => dot.addEventListener("click", () => goPhysical(i + 1)));

    track.addEventListener(
      "scroll",
      () => {
        requestAnimationFrame(syncFromScroll);
        if (!busy()) queueIdle();
      },
      { passive: true },
    );
    track.addEventListener("scrollend", () => {
      if (!busy()) onIdle();
    });

    track.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch") return;
      armAutoplay();
      stopSettle();
      dragging = true;
      startX = event.clientX;
      startScroll = track.scrollLeft;
      track.classList.add("is-dragging");
      track.setPointerCapture(event.pointerId);
    });

    track.addEventListener(
      "touchstart",
      (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        touching = true;
        axis = null;
        startX = touch.clientX;
        startY = touch.clientY;
        startScroll = track.scrollLeft;
        stopSettle();
        armAutoplay();
      },
      { passive: true },
    );

    track.addEventListener(
      "touchmove",
      (event) => {
        if (!touching || event.touches.length !== 1) return;
        const touch = event.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (!axis) {
          if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
          axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
          if (axis === "x") {
            dragging = true;
            track.classList.add("is-dragging");
          }
        }
        if (axis !== "x") return;
        event.preventDefault();
        track.scrollLeft = startScroll - dx;
      },
      { passive: false },
    );

    const endTouch = (event) => {
      if (!touching) return;
      const wasX = axis === "x";
      const touch = event.changedTouches?.[0];
      const delta = touch ? touch.clientX - startX : 0;
      touching = false;
      axis = null;
      if (!wasX) {
        queueIdle();
        return;
      }
      dragging = false;
      track.classList.add("is-settling");
      track.classList.remove("is-dragging");
      settleFromGesture(delta, startScroll);
    };

    window.addEventListener("touchend", endTouch, { passive: true });
    window.addEventListener("touchcancel", endTouch, { passive: true });

    track.addEventListener("pointermove", (event) => {
      if (!dragging || touching) return;
      track.scrollLeft = startScroll - (event.clientX - startX);
    });

    const endDrag = (event) => {
      if (!dragging || touching) return;
      dragging = false;
      track.classList.add("is-settling");
      track.classList.remove("is-dragging");
      settleFromGesture(event.clientX - startX, startScroll);
    };

    const endPointer = (event) => {
      if (event.pointerType === "touch") return;
      endDrag(event);
    };

    window.addEventListener("pointerup", endPointer);
    window.addEventListener("pointercancel", endPointer);
    window.addEventListener("resize", () => jumpTo(logical + 1));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAutoplay();
      else if (!busy()) armAutoplay();
    });

    if (canHover) {
      carousel.addEventListener("mouseenter", stopAutoplay);
      carousel.addEventListener("mouseleave", () => {
        if (!busy()) armAutoplay();
      });
    }

    jumpTo(1);
    armAutoplay();
  }
})();
