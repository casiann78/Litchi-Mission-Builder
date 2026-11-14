// Kleine Animationshelfer (Ein- und Ausklappen, Verschieben von Listenzeilen).
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";

export function prefersReducedMotion() {
  return (
    typeof matchMedia == "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const canAnimate = (e) =>
  !!(
    e &&
    typeof e.animate == "function" &&
    e.isConnected &&
    !prefersReducedMotion()
  );

export function collapseOut(e, { duration = 280 } = {}) {
  if (!canAnimate(e))
    return {
      done: Promise.resolve(),
      cancel() {},
    };
  let n = getComputedStyle(e),
    r = {
      height: `${e.offsetHeight}px`,
      paddingTop: n.paddingTop,
      paddingBottom: n.paddingBottom,
      marginTop: n.marginTop,
      marginBottom: n.marginBottom,
      borderTopWidth: n.borderTopWidth,
      borderBottomWidth: n.borderBottomWidth,
    },
    i = {
      height: "0px",
      paddingTop: "0px",
      paddingBottom: "0px",
      marginTop: "0px",
      marginBottom: "0px",
      borderTopWidth: "0px",
      borderBottomWidth: "0px",
    },
    a = {
      overflow: e.style.overflow,
      pointerEvents: e.style.pointerEvents,
    };
  e.style.overflow = "hidden";
  e.style.pointerEvents = "none";
  let o = e.animate(
      [
        {
          ...r,
          opacity: 1,
          transform: "translateX(0)",
          easing: EASE_OUT,
        },
        {
          ...r,
          opacity: 0,
          transform: "translateX(-20px)",
          offset: 0.42,
          easing: EASE_IN_OUT,
        },
        {
          ...i,
          opacity: 0,
          transform: "translateX(-20px)",
        },
      ],
      {
        duration: duration,
        fill: "forwards",
      },
    ),
    s = false;
  return {
    done: new Promise((e) => {
      let n = () => {
        s || ((s = true), e());
      };
      o.onfinish = n;
      o.oncancel = n;
      setTimeout(n, duration + 400);
    }),
    cancel() {
      o.cancel();
      e.style.overflow = a.overflow;
      e.style.pointerEvents = a.pointerEvents;
    },
  };
}

const EASE_FOLD = "cubic-bezier(0.45, 0, 0.2, 1)";

const FOLD_MS = 520;

function measureFold(e) {
  e.getAnimations().forEach((e) => e.cancel());
  let t = getComputedStyle(e),
    n = {
      height: `${e.offsetHeight}px`,
      paddingTop: t.paddingTop,
      paddingBottom: t.paddingBottom,
      marginTop: t.marginTop,
      marginBottom: t.marginBottom,
      borderTopWidth: t.borderTopWidth,
      borderBottomWidth: t.borderBottomWidth,
    };
  return {
    full: n,
    gone: Object.fromEntries(Object.keys(n).map((e) => [e, "0px"])),
  };
}

export function foldOut(e, { duration = FOLD_MS } = {}) {
  if (!canAnimate(e))
    return {
      done: Promise.resolve(),
    };
  let { full, gone } = measureFold(e);
  e.style.overflow = "hidden";
  e.style.pointerEvents = "none";
  let i = e.animate(
    [
      {
        ...full,
        opacity: 1,
      },
      {
        ...gone,
        opacity: 0,
        offset: 1,
        easing: EASE_FOLD,
      },
    ],
    {
      duration: duration,
      easing: EASE_FOLD,
      fill: "forwards",
    },
  );
  return {
    done: new Promise((e) => {
      i.onfinish = e;
      i.oncancel = e;
      setTimeout(e, duration + 400);
    }),
  };
}

export function foldIn(e, { duration = FOLD_MS } = {}) {
  if (!canAnimate(e)) return;
  let { full, gone } = measureFold(e),
    i = parseFloat(getComputedStyle(e.parentElement || e).rowGap);
  i > 0 && (gone.marginBottom = `${-i}px`);
  let a = e.style.overflow;
  e.style.overflow = "hidden";
  let o = e.animate(
      [
        {
          ...gone,
          opacity: 0,
        },
        {
          ...full,
          opacity: 1,
        },
      ],
      {
        duration: duration,
        easing: EASE_FOLD,
        fill: "backwards",
      },
    ),
    s = () => {
      e.style.overflow = a;
    };
  o.onfinish = s;
  o.oncancel = s;
}

export function captureTops(e) {
  let t = new Map();
  e.forEach((e, n) => {
    e && t.set(n, e.offsetTop);
  });
  return t;
}

export function flipMove(e, t, { duration = 320 } = {}) {
  e &&
    !prefersReducedMotion() &&
    t.forEach((t, r) => {
      let i = e.get(r);
      if (i === undefined || !canAnimate(t)) return;
      let a = i - t.offsetTop;
      Math.abs(a) < 1 ||
        t.animate(
          [
            {
              transform: `translateY(${a}px)`,
            },
            {
              transform: "translateY(0)",
            },
          ],
          {
            duration: duration,
            easing: EASE_OUT,
          },
        );
    });
}

export function clearRowEnter(e) {
  e.target === e.currentTarget &&
    e.animationName === "settle" &&
    e.currentTarget.classList.remove("row-enter");
}

export function leaveThenRemove(e, t) {
  if (!e || e.dataset.leaving) return;
  e.dataset.leaving = "true";
  let n =
      (e.parentElement?.childElementCount === 1 && e.closest(".found")) || e,
    r = collapseOut(n);
  r.done.then(() => {
    t();
    n !== e && setTimeout(() => n.isConnected && r.cancel(), 80);
  });
}
