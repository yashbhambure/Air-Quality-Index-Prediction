"use client";

import React, { useEffect, useRef, useMemo } from "react";
import type { AQICategory } from "@/types/aqi";

export interface InfiniteGridProps {
  /** Current AQI value (0-500+) or null if uncomputed */
  aqi?: number | null;
  /** AQI category label (e.g. "Good", "Moderate", "Poor", etc.) */
  category?: AQICategory | string | null;
  /**
   * Unique inference key, timestamp, or inference count.
   * Changing this value triggers a dynamic localized atmospheric wave pulse.
   */
  inferenceKey?: string | number | null;
  /** API backend connection status */
  status?: "connected" | "connecting" | "offline";
  /** Optional custom styling classes */
  className?: string;
  /** Animation speed multiplier (default: 32) */
  speedSeconds?: number;
}

interface GridThemeColors {
  r: number;
  g: number;
  b: number;
  hex: string;
  glowRgba: string;
}

function getGridTheme(
  status: "connected" | "connecting" | "offline" | undefined,
  category?: string | null,
  aqi?: number | null
): GridThemeColors {
  if (status === "offline") {
    return {
      r: 240,
      g: 91,
      b: 91,
      hex: "#F05B5B",
      glowRgba: "rgba(240, 91, 91, 0.35)",
    };
  }

  const effectiveAqi = aqi ?? (category ? categoryToAqiEstimate(category) : null);

  if (effectiveAqi == null) {
    // Standard cyber cyan / telemetry blue
    return {
      r: 53,
      g: 208,
      b: 197,
      hex: "#35D0C5",
      glowRgba: "rgba(53, 208, 197, 0.35)",
    };
  }

  if (effectiveAqi <= 50) {
    // Good (Emerald / Vibrant Cyan)
    return {
      r: 60,
      g: 203,
      b: 142,
      hex: "#3CCB8E",
      glowRgba: "rgba(60, 203, 142, 0.35)",
    };
  }

  if (effectiveAqi <= 100) {
    // Satisfactory (Lime / Cyan-Teal)
    return {
      r: 168,
      g: 216,
      b: 90,
      hex: "#A8D85A",
      glowRgba: "rgba(168, 216, 90, 0.35)",
    };
  }

  if (effectiveAqi <= 200) {
    // Moderate (Golden Amber)
    return {
      r: 243,
      g: 201,
      b: 105,
      hex: "#F3C969",
      glowRgba: "rgba(243, 201, 105, 0.35)",
    };
  }

  if (effectiveAqi <= 300) {
    // Poor (Orange)
    return {
      r: 243,
      g: 154,
      b: 74,
      hex: "#F39A4A",
      glowRgba: "rgba(243, 154, 74, 0.38)",
    };
  }

  if (effectiveAqi <= 400) {
    // Very Poor (Coral Crimson)
    return {
      r: 240,
      g: 91,
      b: 91,
      hex: "#F05B5B",
      glowRgba: "rgba(240, 91, 91, 0.40)",
    };
  }

  // Severe (> 400 Deep Ruby)
  return {
    r: 184,
    g: 59,
    b: 94,
    hex: "#B83B5E",
    glowRgba: "rgba(184, 59, 94, 0.42)",
  };
}

function categoryToAqiEstimate(category: string): number {
  const norm = category.toLowerCase();
  if (norm.includes("severe")) return 450;
  if (norm.includes("very poor")) return 350;
  if (norm.includes("poor")) return 250;
  if (norm.includes("moderate")) return 150;
  if (norm.includes("satisfactory")) return 75;
  if (norm.includes("good") || norm.includes("excellent")) return 35;
  return 100;
}

interface DataPulse {
  isVertical: boolean;
  coord: number;
  pos: number;
  speed: number;
  length: number;
  alpha: number;
}

export function InfiniteGrid({
  aqi,
  category,
  inferenceKey,
  status = "connected",
  className = "",
  speedSeconds = 32,
}: InfiniteGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const theme = useMemo(() => getGridTheme(status, category, aqi), [status, category, aqi]);

  const targetThemeRef = useRef<GridThemeColors>(theme);
  const currentThemeRef = useRef<GridThemeColors>(theme);

  useEffect(() => {
    targetThemeRef.current = theme;
  }, [theme]);

  // Inference ripple trigger state
  const rippleRef = useRef<{ active: boolean; startTime: number; duration: number }>({
    active: false,
    startTime: 0,
    duration: 1600,
  });

  const prevInferenceKeyRef = useRef<string | number | null | undefined>(undefined);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevInferenceKeyRef.current = inferenceKey;
      return;
    }

    if (
      inferenceKey !== undefined &&
      inferenceKey !== null &&
      inferenceKey !== prevInferenceKeyRef.current &&
      status !== "offline"
    ) {
      prevInferenceKeyRef.current = inferenceKey;
      rippleRef.current = {
        active: true,
        startTime: performance.now(),
        duration: 1600,
      };
    }
  }, [inferenceKey, status]);

  // Main 2D Orthogonal Technical Grid Engine with Cursor Directional Kinetics
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let isRunning = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    const handleVisibilityChange = () => {
      isRunning = !document.hidden;
      if (isRunning) {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastTime = performance.now();

    // Grid size (cell dimension in px)
    const gridSize = 56;

    // Continuous drift coordinates (infinite modulo displacement)
    let driftX = 0;
    let driftY = 0;

    // Subtle parallax depth offset (smooth elastic lag)
    let parallaxX = 0;
    let parallaxY = 0;

    // Interactive cursor kinetics state
    const mouse = {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.38,
      targetX: window.innerWidth * 0.5,
      targetY: window.innerHeight * 0.38,
      prevX: window.innerWidth * 0.5,
      prevY: window.innerHeight * 0.38,
      // Kinetic velocity imparted by mouse movement direction
      velX: 0,
      velY: 0,
      targetVelX: 0,
      targetVelY: 0,
      lastMoveTime: performance.now(),
      hasInteracted: false,
    };

    // Smooth laser scanning focal crosshair coordinates
    let scanX = mouse.x;
    let scanY = mouse.y;

    // High-precision pointer tracking across the entire viewport
    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      const dt = Math.max((now - mouse.lastMoveTime) / 1000, 0.008);
      mouse.lastMoveTime = now;

      const currentX = e.clientX;
      const currentY = e.clientY;

      if (!mouse.hasInteracted) {
        mouse.hasInteracted = true;
        mouse.prevX = currentX;
        mouse.prevY = currentY;
        mouse.targetX = currentX;
        mouse.targetY = currentY;
        scanX = currentX;
        scanY = currentY;
        return;
      }

      // Displacement delta in px
      const dx = currentX - mouse.prevX;
      const dy = currentY - mouse.prevY;
      mouse.prevX = currentX;
      mouse.prevY = currentY;

      mouse.targetX = currentX;
      mouse.targetY = currentY;

      // Realistic directional impulse:
      // Moving cursor in direction (dx, dy) accelerates the grid's drift in that exact direction!
      // Sensitivity scale factor calibrated for natural physical momentum
      const impulseScale = 2.4;
      mouse.targetVelX = Math.max(-500, Math.min(500, mouse.targetVelX + dx * impulseScale));
      mouse.targetVelY = Math.max(-500, Math.min(500, mouse.targetVelY + dy * impulseScale));
    };

    const handlePointerLeave = () => {
      // Allow gentle decay to ambient sweep when pointer leaves window
      mouse.hasInteracted = false;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    // High-speed cyber data pulses travelling along grid lines
    const pulses: DataPulse[] = [];
    for (let i = 0; i < 7; i++) {
      pulses.push({
        isVertical: Math.random() > 0.5,
        coord: Math.floor(Math.random() * 32) * gridSize,
        pos: Math.random() * 1200,
        speed: 140 + Math.random() * 220,
        length: 70 + Math.random() * 110,
        alpha: 0.6 + Math.random() * 0.4,
      });
    }

    const render = (now: number) => {
      if (!isRunning) return;

      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const width = window.innerWidth;
      const height = window.innerHeight;

      // Color lerping for smooth atmospheric state transitions
      const curr = currentThemeRef.current;
      const targ = targetThemeRef.current;
      curr.r += (targ.r - curr.r) * 0.08;
      curr.g += (targ.g - curr.g) * 0.08;
      curr.b += (targ.b - curr.b) * 0.08;

      // ── Directional Physics & Momentum Integration ──
      // Smoothly approach target velocity with spring inertia
      mouse.velX += (mouse.targetVelX - mouse.velX) * Math.min(1, delta * 12);
      mouse.velY += (mouse.targetVelY - mouse.velY) * Math.min(1, delta * 12);

      // Realistic viscous fluid friction damping
      const damping = Math.pow(0.88, delta * 60);
      mouse.targetVelX *= damping;
      mouse.targetVelY *= damping;

      // Base steady cyber drift (keeps grid subtly alive even when mouse is still)
      const baseSpeed = reducedMotion ? 0 : 20 / Math.max(speedSeconds / 32, 0.5);
      const baseDriftX = baseSpeed * 0.55;
      const baseDriftY = baseSpeed * 0.35;

      // Total directional displacement: Base Drift + Cursor Directional Kinetic Velocity
      const effectiveVelX = baseDriftX + mouse.velX * 0.85;
      const effectiveVelY = baseDriftY + mouse.velY * 0.85;

      driftX = (driftX + effectiveVelX * delta) % gridSize;
      if (driftX < 0) driftX += gridSize;

      driftY = (driftY + effectiveVelY * delta) % gridSize;
      if (driftY < 0) driftY += gridSize;

      // Smooth subtle parallax displacement from screen center
      const normCenterX = (mouse.targetX - width * 0.5) / (width * 0.5 || 1);
      const normCenterY = (mouse.targetY - height * 0.5) / (height * 0.5 || 1);
      const targetParallaxX = normCenterX * 18;
      const targetParallaxY = normCenterY * 14;

      parallaxX += (targetParallaxX - parallaxX) * Math.min(1, delta * 6);
      parallaxY += (targetParallaxY - parallaxY) * Math.min(1, delta * 6);

      // ── Laser Scanning Coordinate Axes (Image 1 Cyber Crosshairs) ──
      // When user is interacting, the laser scanning axis tracks the cursor with physical damping.
      // If idle for over 4.5 seconds, it gently blends into an ambient telemetry scan.
      const timeSinceMoved = now - mouse.lastMoveTime;
      const isActivelyTracking = mouse.hasInteracted && timeSinceMoved < 4500;

      let targetCrossX: number;
      let targetCrossY: number;

      if (isActivelyTracking) {
        targetCrossX = mouse.targetX;
        targetCrossY = mouse.targetY;
      } else {
        // Ambient sine-wave sweep across the display
        const scanPeriodX = 24.0;
        const scanPeriodY = 17.0;
        const scanProgX = 0.5 - 0.5 * Math.cos(((now * 0.001) / scanPeriodX) * Math.PI * 2);
        const scanProgY = 0.5 - 0.5 * Math.cos(((now * 0.001) / scanPeriodY) * Math.PI * 2);
        targetCrossX = 100 + scanProgX * (width - 200);
        targetCrossY = 80 + scanProgY * (height - 160);
      }

      // Smooth pursuit filter (spring lerp)
      const trackSpeed = isActivelyTracking ? 8.5 : 3.0;
      scanX += (targetCrossX - scanX) * Math.min(1, delta * trackSpeed);
      scanY += (targetCrossY - scanY) * Math.min(1, delta * trackSpeed);

      // Total grid phase offset
      const totalOffsetX = (driftX + parallaxX) % gridSize;
      const totalOffsetY = (driftY + parallaxY) % gridSize;

      // Razor-sharp snapping of the bright laser line to the nearest physical grid intersection
      const snapColX = Math.round((scanX - totalOffsetX) / gridSize) * gridSize + totalOffsetX;
      const snapRowY = Math.round((scanY - totalOffsetY) / gridSize) * gridSize + totalOffsetY;

      // Inference ripple pulse wave
      let rippleRadius = 0;
      let rippleIntensity = 0;
      if (rippleRef.current.active) {
        const elapsed = now - rippleRef.current.startTime;
        const prog = elapsed / rippleRef.current.duration;
        if (prog >= 1) {
          rippleRef.current.active = false;
        } else {
          rippleRadius = prog * Math.max(width, height) * 0.95;
          rippleIntensity = 1 - prog;
        }
      }

      ctx.clearRect(0, 0, width, height);

      // ── Layer 1: Ambient Focal Radiance (Image 1 Style) ──
      // Dynamic atmospheric glow anchored to the focal crosshair
      const glowRadius = Math.max(width * 0.52, 460);
      const ambientGlow = ctx.createRadialGradient(
        snapColX,
        snapRowY,
        0,
        snapColX,
        snapRowY,
        glowRadius
      );
      ambientGlow.addColorStop(0, `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, 0.18)`);
      ambientGlow.addColorStop(0.3, `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, 0.06)`);
      ambientGlow.addColorStop(1, "rgba(11, 15, 20, 0)");

      ctx.fillStyle = ambientGlow;
      ctx.fillRect(0, 0, width, height);

      // ── Layer 2: 2D Orthogonal Technical Grid Lines ──
      // Crisp 1px lines aligned to sub-pixel centers (Math.round + 0.5)
      const startX = -gridSize + totalOffsetX;
      const startY = -gridSize + totalOffsetY;

      // Vertical grid lines
      for (let x = startX; x <= width + gridSize; x += gridSize) {
        const distFromScan = Math.abs(x - snapColX);
        const isScanLine = distFromScan < 3.0;

        if (isScanLine) {
          // Prominent bright laser axis (as shown in Image 1!)
          ctx.strokeStyle = `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, 0.88)`;
          ctx.lineWidth = 1.8;
          ctx.shadowColor = `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, 0.95)`;
          ctx.shadowBlur = 10;
        } else {
          ctx.strokeStyle = "rgba(38, 70, 95, 0.36)";
          ctx.lineWidth = 1.0;
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, height);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Horizontal grid lines
      for (let y = startY; y <= height + gridSize; y += gridSize) {
        const distFromScan = Math.abs(y - snapRowY);
        const isScanLine = distFromScan < 3.0;

        if (isScanLine) {
          // Prominent bright laser axis (as shown in Image 1!)
          ctx.strokeStyle = `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, 0.88)`;
          ctx.lineWidth = 1.8;
          ctx.shadowColor = `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, 0.95)`;
          ctx.shadowBlur = 10;
        } else {
          ctx.strokeStyle = "rgba(38, 70, 95, 0.36)";
          ctx.lineWidth = 1.0;
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(width, Math.round(y) + 0.5);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // ── Layer 3: Dynamic Data Pulses Travelling along Grid Lines ──
      if (!reducedMotion) {
        const currentSpeedBoost = 1 + Math.min(1.5, (Math.abs(mouse.velX) + Math.abs(mouse.velY)) / 180);

        for (let i = 0; i < pulses.length; i++) {
          const p = pulses[i];
          p.pos += p.speed * currentSpeedBoost * delta;

          const maxDist = p.isVertical ? height + 200 : width + 200;
          if (p.pos > maxDist) {
            p.pos = -p.length;
            p.coord = p.isVertical
              ? Math.floor(Math.random() * (width / gridSize)) * gridSize + totalOffsetX
              : Math.floor(Math.random() * (height / gridSize)) * gridSize + totalOffsetY;
          }

          const grad = p.isVertical
            ? ctx.createLinearGradient(0, p.pos - p.length, 0, p.pos)
            : ctx.createLinearGradient(p.pos - p.length, 0, p.pos, 0);

          grad.addColorStop(0, `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, 0)`);
          grad.addColorStop(0.8, `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, ${p.alpha * 0.75})`);
          grad.addColorStop(1, `rgba(255, 255, 255, ${p.alpha * 0.95})`);

          ctx.strokeStyle = grad;
          ctx.lineWidth = 2.0;
          ctx.shadowColor = `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, 0.8)`;
          ctx.shadowBlur = 8;

          ctx.beginPath();
          if (p.isVertical) {
            ctx.moveTo(Math.round(p.coord) + 0.5, p.pos - p.length);
            ctx.lineTo(Math.round(p.coord) + 0.5, p.pos);
          } else {
            ctx.moveTo(p.pos - p.length, Math.round(p.coord) + 0.5);
            ctx.lineTo(p.pos, Math.round(p.coord) + 0.5);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // ── Layer 4: Intersection Dots / Nodes (EXACT Image 1 Style!) ──
      // Circular cyan dots at every intersection, with elevated brightness along laser axes
      // and proximity luminance near the user's cursor
      const timeSec = now * 0.001;

      for (let x = startX; x <= width + gridSize; x += gridSize) {
        const isNearScanCol = Math.abs(x - snapColX) < 3.0;

        for (let y = startY; y <= height + gridSize; y += gridSize) {
          const isNearScanRow = Math.abs(y - snapRowY) < 3.0;

          // Proximity to cursor focal point
          const distToCursor = Math.hypot(x - snapColX, y - snapRowY);
          const cursorProximity = Math.max(0, 1 - distToCursor / 220);

          // Compute ripple distance if inference pulse is active
          let rippleBoost = 0;
          if (rippleIntensity > 0) {
            const dx = x - width / 2;
            const dy = y - height / 2;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const rDiff = Math.abs(dist - rippleRadius);
            if (rDiff < 80) {
              rippleBoost = (1 - rDiff / 80) * rippleIntensity;
            }
          }

          // Node styling
          if (isNearScanCol && isNearScanRow) {
            // THE FOCAL CROSSHAIR INTERSECTION: Double ring + bright core (Image 1!)
            ctx.beginPath();
            ctx.arc(x, y, 8.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, 0.38)`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x, y, 4.4, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
            ctx.shadowColor = `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, 1.0)`;
            ctx.shadowBlur = 14;
            ctx.fill();
            ctx.shadowBlur = 0;
          } else if (isNearScanCol || isNearScanRow) {
            // Nodes along the bright laser axis (prominently lit in Image 1!)
            const pulseSine = Math.sin(timeSec * 2.5 + (x + y) * 0.01) * 0.25;
            const dotR = 3.2 + cursorProximity * 0.6;

            ctx.beginPath();
            ctx.arc(x, y, dotR, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.98, 0.78 + pulseSine + cursorProximity * 0.2)})`;
            ctx.shadowColor = `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, 0.85)`;
            ctx.shadowBlur = 7;
            ctx.fill();
            ctx.shadowBlur = 0;
          } else {
            // Standard grid intersection node (Image 1 cyan dots!)
            const baseDotAlpha = Math.min(0.95, 0.52 + rippleBoost * 0.45 + cursorProximity * 0.38);
            const dotR = 2.4 + rippleBoost * 1.5 + cursorProximity * 0.8;

            ctx.beginPath();
            ctx.arc(x, y, dotR, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, ${baseDotAlpha})`;

            if (rippleBoost > 0.1 || cursorProximity > 0.3) {
              ctx.shadowColor = `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, 0.75)`;
              ctx.shadowBlur = 6;
            }
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      // ── Layer 5: Professional Aerospace Reticle & Telemetry Readout ──
      // Rendered around the focal crosshair intersection for realistic high-tech fidelity
      const reticleGap = 9;
      const bracketLen = 6;

      ctx.strokeStyle = `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, 0.75)`;
      ctx.lineWidth = 1.2;

      // Top-Left corner bracket
      ctx.beginPath();
      ctx.moveTo(snapColX - reticleGap - bracketLen, snapRowY - reticleGap);
      ctx.lineTo(snapColX - reticleGap, snapRowY - reticleGap);
      ctx.lineTo(snapColX - reticleGap, snapRowY - reticleGap - bracketLen);
      ctx.stroke();

      // Top-Right corner bracket
      ctx.beginPath();
      ctx.moveTo(snapColX + reticleGap + bracketLen, snapRowY - reticleGap);
      ctx.lineTo(snapColX + reticleGap, snapRowY - reticleGap);
      ctx.lineTo(snapColX + reticleGap, snapRowY - reticleGap - bracketLen);
      ctx.stroke();

      // Bottom-Left corner bracket
      ctx.beginPath();
      ctx.moveTo(snapColX - reticleGap - bracketLen, snapRowY + reticleGap);
      ctx.lineTo(snapColX - reticleGap, snapRowY + reticleGap);
      ctx.lineTo(snapColX - reticleGap, snapRowY + reticleGap + bracketLen);
      ctx.stroke();

      // Bottom-Right corner bracket
      ctx.beginPath();
      ctx.moveTo(snapColX + reticleGap + bracketLen, snapRowY + reticleGap);
      ctx.lineTo(snapColX + reticleGap, snapRowY + reticleGap);
      ctx.lineTo(snapColX + reticleGap, snapRowY + reticleGap + bracketLen);
      ctx.stroke();

      // Sleek micro-telemetry coordinates readout
      const kineticSpeed = Math.round(Math.hypot(effectiveVelX, effectiveVelY));
      ctx.font = "500 9px 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = `rgba(${Math.round(curr.r)}, ${Math.round(curr.g)}, ${Math.round(curr.b)}, 0.8)`;
      ctx.fillText(`LOC [${Math.round(snapColX)}, ${Math.round(snapRowY)}]`, snapColX + 16, snapRowY - 8);

      ctx.font = "400 8.5px 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "rgba(180, 205, 225, 0.55)";
      ctx.fillText(`KINETIC ${kineticSpeed} PX/S`, snapColX + 16, snapRowY + 5);

      // ── Layer 6: Edge Fade / Cinematic Vignette ──
      // Subtle gradient so boundary edges softly dissolve into dark background
      const vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.45,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.95
      );
      vignette.addColorStop(0, "rgba(11, 15, 20, 0)");
      vignette.addColorStop(0.7, "rgba(11, 15, 20, 0.45)");
      vignette.addColorStop(1, "rgba(11, 15, 20, 0.88)");

      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [speedSeconds]);

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none overflow-hidden select-none z-0 ${className}`}
      style={{ backgroundColor: "#0B0F14" }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block pointer-events-none"
      />
    </div>
  );
}

// Re-export as DynamicGrid for full backward compatibility
export { InfiniteGrid as DynamicGrid };
export type { InfiniteGridProps as DynamicGridProps };
