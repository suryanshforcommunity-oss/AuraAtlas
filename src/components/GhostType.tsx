import React, { useState, useEffect, useRef } from 'react';

interface GhostTypeProps {
  phrases?: string[];
  text?: string;
  className?: string;
  ghostClassName?: string;
  cursorClassName?: string;
  highlightText?: string;
  highlightClassName?: string;
  typingSpeed?: number;
  pauseDuration?: number;
  loop?: boolean;
}

export const GhostType: React.FC<GhostTypeProps> = ({
  phrases,
  text = 'Autonomous AGV Swarm Coordination at Sub-Millisecond Precision',
  className = '',
  ghostClassName = 'text-cyan-400/40 font-mono italic select-none',
  cursorClassName = 'w-[3px] h-[1em] bg-cyan-400 inline-block animate-pulse ml-1 align-middle shadow-[0_0_8px_#22d3ee]',
  highlightText = 'Sub-Millisecond Precision',
  highlightClassName = 'text-cyan-300 underline decoration-cyan-500/50 underline-offset-8 glow-cyan',
  typingSpeed = 40,
  pauseDuration = 3000,
  loop = false,
}) => {
  const targetText = phrases && phrases.length > 0 ? phrases[0] : text;
  const [typedIndex, setTypedIndex] = useState<number>(0);
  const [isComplete, setIsComplete] = useState<boolean>(false);

  useEffect(() => {
    setTypedIndex(0);
    setIsComplete(false);

    let intervalId: NodeJS.Timeout;

    const startTyping = () => {
      intervalId = setInterval(() => {
        setTypedIndex(prev => {
          if (prev >= targetText.length) {
            clearInterval(intervalId);
            setIsComplete(true);
            return targetText.length;
          }
          return prev + 1;
        });
      }, typingSpeed);
    };

    const delayTimeout = setTimeout(startTyping, 200);

    return () => {
      clearTimeout(delayTimeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [targetText, typingSpeed]);

  const typedPart = targetText.slice(0, typedIndex);
  const ghostPart = targetText.slice(typedIndex);

  // Helper to render text with highlight styles applied where matching
  const renderStyledText = (content: string, isGhost: boolean) => {
    if (!highlightText) {
      return (
        <span className={isGhost ? ghostClassName : 'text-white'}>
          {content}
        </span>
      );
    }

    // Check overlap with highlightText
    const highlightStart = targetText.indexOf(highlightText);
    if (highlightStart === -1) {
      return (
        <span className={isGhost ? ghostClassName : 'text-white'}>
          {content}
        </span>
      );
    }

    const highlightEnd = highlightStart + highlightText.length;
    const currentOffset = isGhost ? typedIndex : 0;

    return content.split('').map((char, i) => {
      const globalIndex = currentOffset + i;
      const isHighlighted = globalIndex >= highlightStart && globalIndex < highlightEnd;

      let cls = isGhost ? ghostClassName : 'text-white';
      if (isHighlighted) {
        cls = isGhost
          ? 'text-cyan-400/35 underline decoration-cyan-500/20 underline-offset-8'
          : highlightClassName;
      }

      return (
        <span key={i} className={cls}>
          {char}
        </span>
      );
    });
  };

  return (
    <span className={`inline relative font-headline ${className}`}>
      {/* Typed Active Text */}
      {renderStyledText(typedPart, false)}

      {/* Blinking AI Cursor */}
      <span className={cursorClassName} />

      {/* Ghost AI Predictive Text Completion */}
      {!isComplete && renderStyledText(ghostPart, true)}
    </span>
  );
};

export default GhostType;
