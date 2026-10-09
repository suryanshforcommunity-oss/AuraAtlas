import React, { useState, useEffect, useRef } from 'react';

interface CipherRevealProps {
  text: string;
  className?: string;
  highlightText?: string;
  highlightClassName?: string;
  scrambleChars?: string;
  speed?: number; // Speed of character cycling in ms
  revealDuration?: number; // Total duration or speed of reveal per char
  delay?: number; // Delay before starting reveal in ms
  autoPlay?: boolean;
}

const DEFAULT_CHARSET = '!@#$%^&*()_+-=[]{}|;:,.<>?/0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const CipherReveal: React.FC<CipherRevealProps> = ({
  text,
  className = '',
  highlightText = '',
  highlightClassName = 'text-cyan-300 underline decoration-cyan-500/50 underline-offset-8',
  scrambleChars = DEFAULT_CHARSET,
  speed = 40,
  delay = 200,
  autoPlay = true,
}) => {
  const [revealedLength, setRevealedLength] = useState<number>(0);
  const [scrambledText, setScrambledText] = useState<string>('');
  const [isDone, setIsDone] = useState<boolean>(false);
  const frameRef = useRef<number | null>(null);

  // Split text into normal and highlighted parts for proper styling during and after decode
  const highlightIndex = highlightText ? text.indexOf(highlightText) : -1;

  useEffect(() => {
    if (!autoPlay) return;

    let timeoutId: NodeJS.Timeout;
    let frameId: number;
    let currentStep = 0;
    const totalChars = text.length;

    // Start delay
    timeoutId = setTimeout(() => {
      const interval = setInterval(() => {
        currentStep += 1;
        setRevealedLength(prev => {
          if (prev >= totalChars) {
            clearInterval(interval);
            setIsDone(true);
            return totalChars;
          }
          return prev + 1;
        });
      }, speed);

      // Continuous character scrambler frame loop
      const scrambleLoop = () => {
        setScrambledText(() => {
          let res = '';
          for (let i = 0; i < totalChars; i++) {
            if (text[i] === ' ') {
              res += ' ';
            } else {
              const randChar = scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
              res += randChar;
            }
          }
          return res;
        });
        frameId = requestAnimationFrame(scrambleLoop);
      };

      scrambleLoop();

      return () => {
        clearInterval(interval);
        cancelAnimationFrame(frameId);
      };
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [text, speed, delay, autoPlay, scrambleChars]);

  // Render character by character so styling applies seamlessly
  const renderCharacters = () => {
    return text.split('').map((char, index) => {
      const isRevealed = index < revealedLength;
      const displayChar = isRevealed ? char : (scrambledText[index] || char);
      const isHighlighted =
        highlightIndex !== -1 &&
        index >= highlightIndex &&
        index < highlightIndex + highlightText.length;

      const charClass = isHighlighted
        ? highlightClassName
        : isRevealed
        ? 'text-white'
        : 'text-cyan-400/70 font-mono opacity-80';

      return (
        <span
          key={index}
          className={`transition-colors duration-150 inline-block ${charClass}`}
        >
          {displayChar === ' ' ? '\u00A0' : displayChar}
        </span>
      );
    });
  };

  return (
    <span className={`inline-block ${className}`}>
      {renderCharacters()}
    </span>
  );
};

export default CipherReveal;
