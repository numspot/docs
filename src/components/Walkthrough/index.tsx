import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { translate } from '@docusaurus/Translate';
import styles from './styles.module.css';

export type Hotspot = { x: number; y: number; w: number; h: number };
export type WalkStep = {
  img: string;
  text: string;
  alt?: string;
  hotspot?: Hotspot;
};

type Props = {
  steps: WalkStep[];
  /** intrinsic width/height of the captures, used for the stage aspect ratio */
  width?: number;
  height?: number;
};

type TipPos = { top: number; left: number };
/** Rectangle actually occupied by the image in the stage (object-fit: contain). */
type ImgRect = { left: number; top: number; width: number; height: number };

// useLayoutEffect on the client, useEffect on the server (avoids the SSR warning).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChevronRight = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ExpandIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CompressIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const RestartIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M3 3v5h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.5 8a9 9 0 1 1-1.1 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Walkthrough({ steps, width = 1440, height = 810 }: Props): React.ReactElement {
  const [i, setI] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [tip, setTip] = useState<TipPos | null>(null);
  const [rect, setRect] = useState<ImgRect | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const clamp = (n: number) => Math.min(steps.length - 1, Math.max(0, n));
  const go = useCallback((n: number) => setI(clamp(n)), [steps.length]);
  const prev = () => go(i - 1);
  const next = () => go(i + 1);
  const restart = () => setI(0);

  const step = steps[i];
  const h = step.hotspot;

  // The stage does NOT necessarily match the image ratio (fullscreen, flex-shrink,
  // narrow viewport…). With object-fit:contain the image is then centered with
  // letterboxing: measure its actual rectangle to anchor the spot and the tip on it.
  // Without this, the markers drift as soon as stage ≠ image.
  const measure = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const iw = img.naturalWidth || width;
    const ih = img.naturalHeight || height;
    // Start from the actual box of the <img> (not the stage's): nothing
    // guarantees the image fills the stage, and a wrong assumption
    // here shifts every marker. offsetLeft/Top are relative to the stage
    // (position:relative), i.e. the same coordinate system as spot and tip.
    const box = img.getBoundingClientRect();
    if (!box.width || !box.height || !iw || !ih) return;
    const scale = Math.min(box.width / iw, box.height / ih); // object-fit: contain
    const dw = iw * scale;
    const dh = ih * scale;
    setRect({
      left: img.offsetLeft + (box.width - dw) / 2,
      top: img.offsetTop + (box.height - dh) / 2,
      width: dw,
      height: dh,
    });
  }, [width, height]);

  // Place the tip near the spot while keeping it ENTIRELY inside the
  // stage (overflow:hidden → any overflowing tip would be clipped).
  const placeTip = useCallback(() => {
    const stage = stageRef.current;
    const el = tipRef.current;
    if (!stage || !el || !h || !rect) {
      setTip(null);
      return;
    }
    const SW = stage.clientWidth;
    const SH = stage.clientHeight;
    const TW = el.offsetWidth;
    const TH = el.offsetHeight;
    const pad = 10;
    const gap = 12;

    // Spot geometry in the coordinate system of the displayed image.
    const spotLeft = rect.left + h.x * rect.width;
    const spotTop = rect.top + h.y * rect.height;
    const spotBottom = spotTop + h.h * rect.height;

    // Horizontal: centered on the spot, clamped inside the stage.
    const cx = spotLeft + (h.w * rect.width) / 2;
    let left = cx - TW / 2;
    left = Math.min(Math.max(left, pad), Math.max(pad, SW - TW - pad));

    // Vertical: below the spot if it fits, otherwise above, otherwise clamped.
    let top: number;
    if (spotBottom + gap + TH <= SH - pad) {
      top = spotBottom + gap; // below the spot
    } else if (spotTop - gap - TH >= pad) {
      top = spotTop - gap - TH; // above the spot
    } else {
      top = Math.min(Math.max(spotBottom + gap, pad), Math.max(pad, SH - TH - pad));
    }
    setTip({ top, left });
  }, [h, rect]);

  // Measure on every step change / fullscreen toggle, then place the tip.
  useIsoLayoutEffect(() => {
    measure();
  }, [measure, i, isFs]);

  useIsoLayoutEffect(() => {
    placeTip();
  }, [placeTip, i, isFs, step.text]);

  // A ResizeObserver on the stage covers everything: window resize, entering/exiting
  // fullscreen, control height change, zoom…
  useEffect(() => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (typeof ResizeObserver === 'undefined') {
      const onResize = () => measure();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
    const ro = new ResizeObserver(() => measure());
    if (stage) ro.observe(stage);
    if (img) ro.observe(img); // the image box can move on its own
    return () => ro.disconnect();
  }, [measure]);

  // Keyboard navigation (left/right arrows)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((x) => Math.min(steps.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps.length]);

  // Sync the fullscreen state (button, Esc, native F11…)
  useEffect(() => {
    const onFsChange = () => setIsFs(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFs = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.();
    }
  }, []);

  const imgSrc = useBaseUrl(step.img);

  return (
    <div ref={wrapRef} className={clsx(styles.wrap, isFs && styles.wrapFs)}>
      <div
        ref={stageRef}
        className={styles.stage}
        /* Outside fullscreen the stage enforces the captures' aspect ratio; in
           fullscreen it takes the available space and the image is measured. */
        style={isFs ? undefined : { aspectRatio: `${width} / ${height}` }}
      >
        <img
          ref={imgRef}
          src={imgSrc}
          alt={step.alt || step.text}
          className={styles.img}
          draggable={false}
          onLoad={measure}
        />
        {h && rect && (
          <div
            className={styles.spot}
            style={{
              left: `${rect.left + h.x * rect.width}px`,
              top: `${rect.top + h.y * rect.height}px`,
              width: `${h.w * rect.width}px`,
              height: `${h.h * rect.height}px`,
            }}
          />
        )}
        {step.text && (
          <div
            ref={tipRef}
            className={styles.tip}
            style={tip ? { top: `${tip.top}px`, left: `${tip.left}px`, visibility: 'visible' } : { top: 0, left: 0, visibility: 'hidden' }}
          >
            <span className={styles.badge}>
              {i + 1} / {steps.length}
            </span>
            <span>{step.text}</span>
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <div className={styles.navGroup}>
          <button className={styles.iconBtn} onClick={prev} disabled={i === 0} aria-label={translate({ id: 'walkthrough.prev', message: "Previous step" })}>
            <ChevronLeft />
          </button>
          <span className={styles.counter}>
            {i + 1} / {steps.length}
          </span>
          <button className={styles.iconBtn} onClick={next} disabled={i === steps.length - 1} aria-label={translate({ id: 'walkthrough.next', message: "Next step" })}>
            <ChevronRight />
          </button>
        </div>

        <div className={styles.dots} role="tablist" aria-label={translate({ id: 'walkthrough.steps', message: "Steps" })}>
          {steps.map((_, k) => (
            <button
              key={k}
              className={k === i ? styles.dotOn : styles.dot}
              onClick={() => go(k)}
              aria-label={translate({ id: 'walkthrough.goToStep', message: 'Go to step {n}' }, { n: k + 1 })}
              aria-selected={k === i}
            />
          ))}
        </div>

        <div className={styles.rightGroup}>
          <button
            className={styles.iconBtn}
            onClick={restart}
            disabled={i === 0}
            aria-label={translate({ id: 'walkthrough.restart', message: "Restart from the beginning" })}
            title={translate({ id: 'walkthrough.restart', message: "Restart from the beginning" })}
          >
            <RestartIcon />
          </button>
          <button
            className={styles.fsBtn}
            onClick={toggleFs}
            aria-label={isFs
              ? translate({ id: 'walkthrough.exitFullscreen', message: "Exit full screen" })
              : translate({ id: 'walkthrough.enterFullscreen', message: "Show in full screen" })}
          >
            {isFs ? <CompressIcon /> : <ExpandIcon />}
            <span className={styles.fsLabel}>{isFs
              ? translate({ id: 'walkthrough.reduce', message: "Exit full screen" })
              : translate({ id: 'walkthrough.fullscreen', message: "Full screen" })}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
