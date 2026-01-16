"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import Image from "next/image";

// Register plugin
if (typeof window !== "undefined") {
  gsap.registerPlugin(MorphSVGPlugin);
}

type MorphVariant =
  | "crossfade"
  | "morph-rotate"
  | "morph-linear"
  | "flip"
  | "flip-x"
  | "dissolve"
  | "scale-rotate"
  | "slide-up"
  | "bounce";

type LogoColor = "blue" | "white" | "black" | "adaptive";

interface PhoneHappyRobotMorphProps {
  className?: string;
  size?: number;
  /** External control - when true shows HappyRobot, when false shows Phone. If undefined, uses internal hover. */
  isActive?: boolean;
  /** Animation variant */
  variant?: MorphVariant;
  /** HappyRobot logo color variant */
  logoColor?: LogoColor;
}

/**
 * Animated icon that morphs from Phone to HappyRobot
 * Can be controlled externally via isActive prop, or self-managed via hover if not provided
 */
export function PhoneHappyRobotMorph({
  className,
  size = 16,
  isActive,
  variant = "flip",
  logoColor = "blue",
}: PhoneHappyRobotMorphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<SVGSVGElement>(null);
  const happyrobotRef = useRef<HTMLDivElement>(null);
  const internalHover = useRef(false);
  const timeline = useRef<gsap.core.Timeline | null>(null);

  // Determine if externally controlled
  const isControlled = isActive !== undefined;

  useEffect(() => {
    if (!phoneRef.current || !happyrobotRef.current) return;

    // Create timeline but pause it initially
    timeline.current = gsap.timeline({ paused: true });

    // Initial state - HappyRobot hidden
    gsap.set(happyrobotRef.current, { opacity: 0 });

    switch (variant) {
      case "flip":
        // 3D Y-axis flip transition (slower, more dramatic)
        gsap.set(containerRef.current, { perspective: 400 });
        timeline.current
          .to(phoneRef.current, {
            rotationY: 90,
            opacity: 0,
            duration: 0.35,
            ease: "power2.in",
          })
          .set(happyrobotRef.current, { rotationY: -90, opacity: 1 })
          .to(happyrobotRef.current, {
            rotationY: 0,
            duration: 0.35,
            ease: "power2.out",
          });
        break;

      case "flip-x":
        // 3D X-axis flip (like a coin flip)
        gsap.set(containerRef.current, { perspective: 400 });
        timeline.current
          .to(phoneRef.current, {
            rotationX: 90,
            opacity: 0,
            duration: 0.35,
            ease: "power2.in",
          })
          .set(happyrobotRef.current, { rotationX: -90, opacity: 1 })
          .to(happyrobotRef.current, {
            rotationX: 0,
            duration: 0.35,
            ease: "power2.out",
          });
        break;

      case "scale-rotate":
        // Scale down + rotate out, scale up + rotate in (0.75s total)
        timeline.current
          .to(phoneRef.current, {
            scale: 0,
            rotation: 180,
            opacity: 0,
            duration: 0.4,
            ease: "power2.in",
          })
          .fromTo(
            happyrobotRef.current,
            { scale: 0, rotation: -180, opacity: 0 },
            {
              scale: 1,
              rotation: 0,
              opacity: 1,
              duration: 0.45,
              ease: "back.out(1.4)",
            },
            "-=0.1",
          );
        break;

      case "slide-up":
        // Slide up and fade
        timeline.current
          .to(phoneRef.current, {
            y: -10,
            opacity: 0,
            duration: 0.3,
            ease: "power2.in",
          })
          .fromTo(
            happyrobotRef.current,
            { y: 10, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.3,
              ease: "power2.out",
            },
            "-=0.15",
          );
        break;

      case "bounce":
        // Bounce out and in
        timeline.current
          .to(phoneRef.current, {
            scale: 1.2,
            duration: 0.15,
            ease: "power2.out",
          })
          .to(phoneRef.current, {
            scale: 0,
            opacity: 0,
            duration: 0.2,
            ease: "power2.in",
          })
          .fromTo(
            happyrobotRef.current,
            { scale: 0, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
              duration: 0.4,
              ease: "elastic.out(1, 0.5)",
            },
            "-=0.1",
          );
        break;

      case "dissolve":
        // Particle-like dissolve effect using blur and scale
        timeline.current
          .to(phoneRef.current, {
            opacity: 0,
            scale: 1.3,
            filter: "blur(4px)",
            duration: 0.3,
            ease: "power2.in",
          })
          .fromTo(
            happyrobotRef.current,
            { opacity: 0, scale: 0.7, filter: "blur(4px)" },
            {
              opacity: 1,
              scale: 1,
              filter: "blur(0px)",
              duration: 0.3,
              ease: "power2.out",
            },
            "-=0.1",
          );
        break;

      case "crossfade":
      default:
        // Simple crossfade with slight scale
        timeline.current
          .to(phoneRef.current, {
            opacity: 0,
            scale: 0.8,
            duration: 0.25,
            ease: "power2.inOut",
          })
          .fromTo(
            happyrobotRef.current,
            { opacity: 0, scale: 1.2 },
            {
              opacity: 1,
              scale: 1,
              duration: 0.25,
              ease: "back.out(1.7)",
            },
            "-=0.15",
          );
        break;
    }

    return () => {
      timeline.current?.kill();
    };
  }, [variant, logoColor]);

  // Handle external control (isActive prop) with looping
  useEffect(() => {
    if (!isControlled) return;

    let loopInterval: NodeJS.Timeout | null = null;
    let isForward = true;

    if (isActive) {
      // Start the animation
      timeline.current?.play();

      // Set up looping: wait for animation to complete, pause, then reverse
      const animationDuration = 700; // ~0.7s for the animation
      const pauseDuration = 1000; // 1s pause at each end

      loopInterval = setInterval(() => {
        if (isForward) {
          // We're showing HappyRobot, now reverse back to phone
          timeline.current?.reverse();
        } else {
          // We're showing phone, now play to HappyRobot
          timeline.current?.play();
        }
        isForward = !isForward;
      }, animationDuration + pauseDuration);
    } else {
      timeline.current?.reverse();
    }

    return () => {
      if (loopInterval) clearInterval(loopInterval);
    };
  }, [isActive, isControlled]);

  // Internal hover handlers (only used when not externally controlled)
  const handleMouseEnter = () => {
    if (isControlled || internalHover.current) return;
    internalHover.current = true;
    timeline.current?.play();
  };

  const handleMouseLeave = () => {
    if (isControlled || !internalHover.current) return;
    internalHover.current = false;
    timeline.current?.reverse();
  };

  const logoSrc =
    logoColor === "blue"
      ? "/happyrobot/Footer-logo-blue.svg"
      : logoColor === "white"
        ? "/happyrobot/Footer-logo-white.svg"
        : "/happyrobot/Footer-logo-black.svg";

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseEnter={isControlled ? undefined : handleMouseEnter}
      onMouseLeave={isControlled ? undefined : handleMouseLeave}
      style={{ width: size, height: size, position: "relative" }}
    >
      {/* Phone Icon SVG - visible initially */}
      <svg
        ref={phoneRef}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>

      {/* HappyRobot Logo - hidden initially, shown after morph */}
      <div
        ref={happyrobotRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{ transformStyle: "preserve-3d" }}
      >
        {logoColor === "adaptive" ? (
          <>
            <Image
              src="/happyrobot/Footer-logo-black.svg"
              alt="HappyRobot"
              width={size}
              height={size * 0.79}
              className="block dark:hidden"
            />
            <Image
              src="/happyrobot/Footer-logo-white.svg"
              alt="HappyRobot"
              width={size}
              height={size * 0.79}
              className="hidden dark:block"
            />
          </>
        ) : (
          <Image
            src={logoSrc}
            alt="HappyRobot"
            width={size}
            height={size * 0.79}
          />
        )}
      </div>
    </div>
  );
}

export default PhoneHappyRobotMorph;
