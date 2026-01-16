"use client";

import { useState, useRef, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoAnimation } from "@/components/logo-animation";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransition, setShowTransition] = useState(false);

  // Refs for animations
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isLoggingInRef = useRef(false);

  // Redirect if already authenticated (but not if logging in or transition is playing)
  useEffect(() => {
    if (
      status === "authenticated" &&
      !isLoggingInRef.current &&
      !showTransition
    ) {
      router.replace("/trigger");
    }
  }, [status, router, showTransition]);

  // Entry animation
  useEffect(() => {
    if (!cardRef.current || !logoRef.current || !formRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      gsap.set(cardRef.current, { opacity: 0, y: 20 });
      gsap.set(logoRef.current, { opacity: 0, y: -10 });
      gsap.set(formRef.current?.children || [], { opacity: 0, y: 15 });

      tl.to(cardRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power2.out",
      })
        .to(
          logoRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            ease: "power2.out",
          },
          "-=0.3",
        )
        .to(
          formRef.current?.children || [],
          {
            opacity: 1,
            y: 0,
            duration: 0.3,
            stagger: 0.08,
            ease: "power2.out",
          },
          "-=0.2",
        );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Fade out card when transition starts
  useEffect(() => {
    if (!showTransition || !cardRef.current) return;

    gsap.to(cardRef.current, {
      opacity: 0,
      y: -20,
      duration: 0.3,
      ease: "power2.in",
    });
  }, [showTransition]);

  const handleTransitionComplete = () => {
    router.push("/trigger");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    isLoggingInRef.current = true;

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Credenciales incorrectas. Por favor, intenta de nuevo.");
        setIsLoading(false);
        isLoggingInRef.current = false;
      } else {
        setShowTransition(true);
      }
    } catch {
      setError("Error de conexion. Por favor, intenta de nuevo.");
      setIsLoading(false);
      isLoggingInRef.current = false;
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Image
          src="/happyrobot/Footer-logo-white.svg"
          alt="Cargando"
          width={60}
          height={47}
          className="animate-pulse opacity-30"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black"
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Gradient orbs - Blue only for consistency */}
      <div className="animate-bluepulse absolute -left-40 top-1/4 h-80 w-80 rounded-full bg-blue-600/25 blur-[120px]" />
      <div className="animate-bluepulse-delayed absolute -right-40 bottom-1/4 h-80 w-80 rounded-full bg-blue-500/20 blur-[120px]" />
      <style jsx global>{`
        @keyframes bluepulse {
          0%,
          100% {
            background-color: rgba(37, 99, 235, 0.2);
          }
          50% {
            background-color: rgba(37, 99, 235, 0.1);
          }
        }
        .animate-bluepulse {
          animation: bluepulse 5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-bluepulse-delayed {
          animation: bluepulse 5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          animation-delay: 2.5s;
        }
      `}</style>

      {/* Login card */}
      <div
        ref={cardRef}
        className={cn(
          "relative z-10 mx-4 w-full max-w-[400px]",
          "rounded-xl border border-white/10",
          "bg-white/[0.03] backdrop-blur-xl",
          "p-8 sm:p-10",
          showTransition && "pointer-events-none",
        )}
      >
        {/* Logo */}
        <div ref={logoRef} className="mb-10 flex flex-col items-center">
          <Image
            src="/uber/Uber_logo_2018_white.svg"
            alt="Uber"
            width={160}
            height={53}
            priority
          />
          <p className="mt-4 text-[13px] font-medium tracking-wide text-white/40">
            Sistema de Llamadas
          </p>
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span className="text-[13px] text-red-400">{error}</span>
            </div>
          )}

          {/* Email field */}
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-[13px] font-medium text-white/70"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoComplete="email"
              className="linear-input"
            />
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-[13px] font-medium text-white/70"
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Introduce tu contraseña"
                required
                autoComplete="current-password"
                className="linear-input pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="hover-gradient-subtle absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-fg-muted transition-all hover:text-fg-primary"
              >
                {showPassword ? (
                  <EyeOff className="relative z-10 h-[18px] w-[18px]" />
                ) : (
                  <Eye className="relative z-10 h-[18px] w-[18px]" />
                )}
              </button>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "group relative w-full overflow-hidden rounded-lg py-3",
              "bg-white text-[15px] font-semibold text-black",
              "transition-all duration-300",
              "disabled:opacity-70",
              "flex items-center justify-center gap-2",
            )}
          >
            {/* Subtle gradient overlay on hover */}
            <div
              className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)",
              }}
            />
            {isLoading ? (
              <>
                <Loader2 className="relative z-10 h-[18px] w-[18px] animate-spin" />
                <span className="relative z-10">Iniciando sesión...</span>
              </>
            ) : (
              <>
                <span className="relative z-10">Iniciar sesión</span>
                <ArrowRight className="relative z-10 h-[18px] w-[18px] transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
          </div>

          {/* Register link */}
          <p className="text-center text-[13px] text-white/50">
            ¿No tienes cuenta?{" "}
            <Link
              href="/register"
              className="text-white/80 underline-offset-4 hover:underline"
            >
              Registrarse
            </Link>
          </p>

          {/* Forgot password */}
          <p className="text-center text-[12px] text-white/40">
            ¿Olvidaste tu contraseña? Escribe un mail a{" "}
            <a
              href="mailto:juan.leal@happyrobot.ai"
              className="text-blue-400/80 underline-offset-4 hover:underline"
            >
              juan.leal@happyrobot.ai
            </a>
          </p>
        </form>
      </div>

      {/* Logo morph animation */}
      {showTransition && (
        <LogoAnimation onComplete={handleTransitionComplete} />
      )}

      {/* Powered by footer */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="flex flex-col items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/25">
            Desarrollado por
          </span>
          <Image
            src="/happyrobot/Footer-expand-happyrobot_white.png"
            alt="HappyRobot AI"
            width={140}
            height={30}
            className="opacity-40 transition-opacity hover:opacity-60"
          />
        </div>
      </div>
    </div>
  );
}
