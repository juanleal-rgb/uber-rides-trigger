"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

// Import SVGs as React components (SVGR)
import HappyRobotLogo from "@public/happyrobot/Footer-logo-white.svg";
import UberLogo from "@public/uber/Uber_logo_2018_white.svg";

interface LogoAnimationProps {
  onComplete?: () => void;
}

export function LogoAnimation({ onComplete }: LogoAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const happyrobotWrapperRef = useRef<HTMLDivElement>(null);
  const happyrobotRef = useRef<SVGSVGElement>(null);
  const uberVisibleRef = useRef<SVGSVGElement>(null);

  const textRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  // Uber SVG is very wide (viewBox 926.906 × 321.777)
  const HAPPYROBOT_WIDTH = 150;
  const HAPPYROBOT_HEIGHT = 118;
  const UBER_ASPECT = 926.906 / 321.777;

  // Full Uber logo (wordmark)
  const UBER_DISPLAY_SCALE = 1.4;
  const uberDisplayWidth = HAPPYROBOT_WIDTH * UBER_DISPLAY_SCALE;
  const uberDisplayHeight = uberDisplayWidth / UBER_ASPECT;

  useEffect(() => {
    if (
      !happyrobotRef.current ||
      !happyrobotWrapperRef.current
    )
      return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          setTimeout(() => onComplete?.(), 800);
        },
      });

      // Initial state
      gsap.set(happyrobotRef.current, {
        opacity: 0,
        scale: 0.94,
        filter: "blur(6px)",
      });
      if (uberVisibleRef.current) {
        gsap.set(uberVisibleRef.current, {
          opacity: 0,
          scale: 0.98,
          filter: "blur(8px)",
        });
      }
      gsap.set(textRef.current, { y: 30, opacity: 0 });
      gsap.set(glowRef.current, { scale: 0, opacity: 0 });
      gsap.set(happyrobotWrapperRef.current, { scale: 1, x: 0, y: 0, opacity: 1 });

      tl
        // Fade in HappyRobot logo
        .to(happyrobotRef.current, {
          opacity: 1,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.55,
          ease: "power2.out",
        })
        // Pause to show HappyRobot
        .to({}, { duration: 0.25 })
        // Glow pulse
        .to(glowRef.current, {
          scale: 1.15,
          opacity: 0.7,
          duration: 0.45,
          ease: "power2.inOut",
        })
        // Crossfade to full Uber logo (wordmark)
        .to(
          uberVisibleRef.current,
          {
            opacity: 1,
            scale: 1,
            filter: "blur(0px)",
            duration: 0.6,
            ease: "power2.inOut",
          },
          "-=0.25",
        )
        .to(
          happyrobotWrapperRef.current,
          {
            opacity: 0,
            duration: 0.6,
            ease: "power2.inOut",
          },
          "-=0.6",
        )
        // Fade out glow
        .to(
          glowRef.current,
          {
            scale: 2,
            opacity: 0,
            duration: 0.6,
            ease: "power2.inOut",
          },
          "-=0.8",
        )
        // Show combined text
        .to(
          textRef.current,
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            ease: "power2.out",
          },
          "-=0.3",
        );
    }, containerRef);

    return () => ctx.revert();
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 overflow-visible bg-black"
    >
      {/* Glow effect - absolutely centered */}
      <div
        ref={glowRef}
        className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/30 blur-3xl"
      />

      {/* HappyRobot Logo - visible, will morph */}
      <div
        ref={happyrobotWrapperRef}
        className="absolute left-1/2 top-1/2"
        style={{ transform: "translate(-50%, -50%)" }}
      >
        <HappyRobotLogo
          ref={happyrobotRef}
          className="overflow-visible"
          width={HAPPYROBOT_WIDTH}
          height={HAPPYROBOT_HEIGHT}
        />
      </div>

      {/* Uber Logo - visible (wordmark), faded in after morph */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{ transform: "translate(-50%, -50%)" }}
      >
        <UberLogo
          ref={uberVisibleRef}
          className="overflow-visible opacity-0"
          width={uberDisplayWidth}
          height={uberDisplayHeight}
        />
      </div>

      {/* Text - absolutely centered below logo */}
      <div
        ref={textRef}
        className="absolute left-1/2 top-1/2 mt-24 -translate-x-1/2 text-center text-sm tracking-widest text-white/60"
      >
        HAPPYROBOT × UBER
      </div>
    </div>
  );
}
