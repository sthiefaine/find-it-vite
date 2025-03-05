import React, { useState, useEffect, useRef } from 'react';
import './ScoreDisplay.css';
import NumberFlow from '@number-flow/react';

interface ScoreDisplayProps {
  score: number;
}

const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ score }) => {
  const [previousScore, setPreviousScore] = useState(score);
  const [isIncreasing, setIsIncreasing] = useState(false);
  const [isDecreasing, setIsDecreasing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Détecter les changements de score
    if (score > previousScore) {
      setIsIncreasing(true);
      setIsDecreasing(false);

    } else if (score < previousScore) {
      setIsIncreasing(false);
      setIsDecreasing(true);
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsIncreasing(false);
      setIsDecreasing(false);
      setPreviousScore(score);
    }, 1000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [score, previousScore]);

  const getScoreClass = () => {
    if (isIncreasing) return 'score-increasing';
    if (isDecreasing) return 'score-decreasing';
    return '';
  };

  const getScoreColor = () => {
    if (score < 0) return 'negative-score';
    if (score >= 10) return 'high-score';
    if (score >= 5) return 'mid-score';
    return '';
  };

  return (
    <div className="score-container">
      <div className={`score-badge ${getScoreColor()}`}>
        <div className="score-label">SCORE</div>
        <div className={`score-value ${getScoreClass()}`}>
          <NumberFlow value={score} />
        </div>
      </div>
    </div>
  );
};

export default ScoreDisplay;