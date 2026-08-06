export const calculatePositionsHelper = (
  site: number,
  positions: any[],
  side1: number,
  side2: number,
  side3: number,
  side4: number
) => {
  positions[site] = {
    right: side1,
    bottom: side2,
    left: side3,
    top: side4,
    site: site,
  };
  positions[site + 10] = {
    bottom: side1,
    left: side2,
    top: side3,
    right: side4,
    site: site + 10,
  };
  positions[site + 20] = {
    left: side1,
    top: side2,
    right: side3,
    bottom: side4,
    site: site + 20,
  };
  positions[site + 30] = {
    top: side1,
    right: side2,
    bottom: side3,
    left: side4,
    site: site + 30,
  };
};

export const calculatePositions = (board: any) => {
  const { side: boardSide, rowWidth: rawRowWidth } = board;
  const rowWidth = rawRowWidth || Math.max(50, Math.floor(boardSide * 0.21));
  const cornerLength = rowWidth;
  const innerLength = boardSide - 2 * cornerLength;
  const siteLength = innerLength / 9;
  const playerSize = Math.max(18, Math.floor(rowWidth * 0.35));

  const side2 = Math.floor(rowWidth / 2 - playerSize / 2);
  const side4 = boardSide - side2 - playerSize;
  const positions = new Array(41);

  for (let site = 0; site < 10; site++) {
    let centerPos = 0;
    if (site === 0) {
      centerPos = cornerLength / 2;
    } else {
      centerPos = cornerLength + siteLength * (site - 1) + siteLength / 2;
    }

    const side1 = Math.floor(centerPos - playerSize / 2);
    const side3 = boardSide - side1 - playerSize;

    calculatePositionsHelper(site, positions, side1, side2, side3, side4);
  }

  return positions;
};
