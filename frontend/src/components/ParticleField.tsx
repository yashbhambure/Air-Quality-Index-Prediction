"use client";

import { useEffect, useRef, useCallback } from "react";

interface ParticleFieldProps {
  /** 0–5 CPCB severity (null = no prediction yet → neutral baseline) */
  severity: number | null;
  /** Hex colour for the current severity band (null = neutral) */
  color: string | null;
}

/* ── Density / speed mapping ── */
const BASELINE_COUNT = 35;
const COUNT_BY_SEV = [40, 50, 65, 80, 95, 110]; // indexed by severity 0-5
const BASELINE_SPEED = 0.12; // px/frame
const SPEED_BY_SEV = [0.10, 0.14, 0.18, 0.24, 0.32, 0.40];
const NEUTRAL_COLOR = "#35D0C5"; // Cyan intelligence tint
const MOTE_OPACITY_MIN = 0.02;
const MOTE_OPACITY_MAX = 0.045;
const MOTE_SIZE_MIN = 0.8;
const MOTE_SIZE_MAX = 1.8;

interface Mote {
  x: number;
  y: number;
  r: number;
  opacity: number;
  vx: number;
  vy: number;
  phase: number;
}

function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16) || 53,
    parseInt(h.substring(2, 4), 16) || 208,
    parseInt(h.substring(4, 6), 16) || 197,
  ];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function ParticleField({ severity, color }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motesRef = useRef<Mote[]>([]);
  const rafRef = useRef<number>(0);
  const prevParamsRef = useRef<{ count: number; speed: number; color: string }>({
    count: BASELINE_COUNT,
    speed: BASELINE_SPEED,
    color: NEUTRAL_COLOR,
  });

  const targetCount =
    severity != null ? COUNT_BY_SEV[Math.min(severity, 5)] : BASELINE_COUNT;
  const targetSpeed =
    severity != null ? SPEED_BY_SEV[Math.min(severity, 5)] : BASELINE_SPEED;
  const targetColor = color ?? NEUTRAL_COLOR;

  const spawnMote = useCallback(
    (w: number, h: number, speed: number, startAtEdge = false): Mote => {
      const r = lerp(MOTE_SIZE_MIN, MOTE_SIZE_MAX, Math.random());
      return {
        x: startAtEdge ? -r : Math.random() * w,
        y: Math.random() * h,
        r,
        opacity: lerp(MOTE_OPACITY_MIN, MOTE_OPACITY_MAX, Math.random()),
        vx: speed * (0.5 + Math.random()),
        vy: (Math.random() - 0.5) * speed * 0.2,
        phase: Math.random() * Math.PI * 2,
      };
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      motesRef.current = [];
      for (let i = 0; i < targetCount; i++) {
        motesRef.current.push(spawnMote(canvas.width, canvas.height, targetSpeed));
      }
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    let currentCount = prevParamsRef.current.count;
    let currentSpeed = prevParamsRef.current.speed;
    let currentColor = prevParamsRef.current.color;

    if (reducedMotion) {
      const [r, g, b] = hexToRGB(targetColor);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const m of motesRef.current) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${m.opacity * 0.7})`;
        ctx.fill();
      }
      return () => window.removeEventListener("resize", resize);
    }

    let t = 0;
    const loop = () => {
      t += 0.01;
      currentCount = lerp(currentCount, targetCount, 0.05);
      currentSpeed = lerp(currentSpeed, targetSpeed, 0.05);
      currentColor = targetColor;

      prevParamsRef.current = {
        count: Math.round(currentCount),
        speed: currentSpeed,
        color: currentColor,
      };

      const desiredCount = Math.round(currentCount);
      while (motesRef.current.length < desiredCount) {
        motesRef.current.push(spawnMote(canvas.width, canvas.height, currentSpeed, true));
      }
      while (motesRef.current.length > desiredCount) {
        motesRef.current.pop();
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const [r, g, b] = hexToRGB(currentColor);

      for (let i = 0; i < motesRef.current.length; i++) {
        const m = motesRef.current[i];
        m.x += m.vx;
        m.y += m.vy + Math.sin(t + m.phase) * 0.15;

        if (m.x > canvas.width + m.r) {
          m.x = -m.r;
          m.y = Math.random() * canvas.height;
        }
        if (m.y < -m.r) m.y = canvas.height + m.r;
        if (m.y > canvas.height + m.r) m.y = -m.r;

        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${m.opacity})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [targetCount, targetSpeed, targetColor, spawnMote]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}
