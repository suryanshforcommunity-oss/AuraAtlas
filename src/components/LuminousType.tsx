import React, { useState, useEffect, useRef } from 'react';

interface LuminousTypeProps {
  text: string;
  highlightText?: string;
  className?: string;
  baseClassName?: string;
  luminousClassName?: string;
  spotlightRadius?: number;
  speed?: number; // Drift animation speed multiplier
  interactive?: boolean; // Follow mouse on hover
}

export const LuminousType: React.FC<LuminousTypeProps> = ({
  text,
  highlightText = 'Sub-Millisecond Precision',
  className = '',
  baseClassName = 'text-slate-600/60 transition-colors select-none',
  luminousClassName = 'text-white drop-shadow-[0_0_20px_rgba(34,211,238,0.75)]',
  spotlightRadius = 260,
  speed = 1.0,
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [spotlightPos, setSpotlightPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const isHoveredRef = useRef<boolean>(false);
  const animTimeRef = useRef<number>(0);

  useEffect(() => {
    let frameId: number;

    const animate = () => {
      if (!isHoveredRef.current) {
        animTimeRef.current += 0.015 * speed;
        const time = animTimeRef.current;
        // Smooth Lissajous curve / drifting spotlight across the text
        const x = 50 + 45 * Math.sin(time);
        const y = 50 + 35 * Math.sin(time * 0.8 + 1.2);
        setSpotlightPos({ x, y });
      }
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [speed]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setSpotlightPos({ x, y });
  };

  const handleMouseEnter = () => {
    if (interactive) isHoveredRef.current = true;
  };

  const handleMouseLeave = () => {
    if (interactive) isHoveredRef.current = false;
  };

  const renderContent = (isLuminous: boolean) => {
    if (!highlightText || !text.includes(highlightText)) {
      return <span>{text}</span>;
    }

    const parts = text.split(highlightText);
    return (
      <>
        <span>{parts[0]}</span>
        <span
          className={
            isLuminous
              ? 'text-cyan-300 underline decoration-cyan-400 underline-offset-8 drop-shadow-[0_0_25px_rgba(34,211,238,0.9)]'
              : 'text-cyan-950/70 underline decoration-cyan-900/40 underline-offset-8'
          }
        >
          {highlightText}
        </span>
        {parts[1] && <span>{parts[1]}</span>}
      </>
    );
  };

  const maskStyle: React.CSSProperties = {
    WebkitMaskImage: `radial-gradient(${spotlightRadius}px circle at ${spotlightPos.x}% ${spotlightPos.y}%, black 20%, transparent 100%)`,
    maskImage: `radial-gradient(${spotlightRadius}px circle at ${spotlightPos.x}% ${spotlightPos.y}%, black 20%, transparent 100%)`,
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-block select-none cursor-default ${className}`}
    >
      {/* Base Dimmed Layer */}
      <div className={`relative ${baseClassName} tracking-tight leading-[1.1]`}>
        {renderContent(false)}
      </div>

      {/* Luminous Spotlight Layer (Revealed through drifting radial mask) */}
      <div
        style={maskStyle}
        className={`absolute inset-0 pointer-events-none ${luminousClassName} tracking-tight leading-[1.1] transition-opacity duration-300`}
        aria-hidden="true"
      >
        {renderContent(true)}
      </div>
    </div>
  );
};

export default LuminousType;
