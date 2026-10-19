import React from 'react';

interface PixelAvatarProps {
  className?: string;
  size?: number;
  color?: string;
}

/**
 * 8-bit retro pixel character avatar matching the orange crab/invader
 * in BridgeMind agent terminal tiles (Emma, James, Olivia, Michael, Grace, Daniel).
 */
export const PixelAvatar: React.FC<PixelAvatarProps> = ({
  className = '',
  size = 40,
  color = '#e07a5f'
}) => {
  // 12x10 pixel grid representation of the retro alien/crab character
  const grid = [
    [0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1],
    [0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
    [0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0],
  ];

  const cols = 12;
  const rows = 10;
  const pixelSize = size / cols;

  return (
    <svg
      width={size}
      height={size * (rows / cols)}
      viewBox={`0 0 ${cols} ${rows}`}
      className={`shrink-0 drop-shadow-[0_2px_8px_rgba(224,122,95,0.35)] ${className}`}
      shapeRendering="crispEdges"
    >
      {grid.map((row, y) =>
        row.map((cell, x) => {
          if (cell === 1) {
            return (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y}
                width={1}
                height={1}
                fill={color}
              />
            );
          }
          return null;
        })
      )}
    </svg>
  );
};
