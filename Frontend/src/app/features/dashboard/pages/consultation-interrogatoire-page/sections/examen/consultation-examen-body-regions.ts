export type BodyRegionGender = 'male' | 'female';
export type BodyRegionView = 'front' | 'back';
export type BodyRegionSegment = 'common' | 'left' | 'right';

export interface BodyRegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BodyRegionDefinition {
  slug: string;
  segment: BodyRegionSegment;
  pathIndex: number;
  path: string;
  bounds: BodyRegionBounds;
  color: string;
}

type FrontRegionConfig = {
  cx: number;
  headY: number;
  neckY: number;
  shoulderY: number;
  chestY: number;
  abdomenY: number;
  pelvisY: number;
  hipY: number;
  thighY: number;
  kneeY: number;
  legY: number;
  ankleY: number;
  footY: number;
  armScale: number;
  legScale: number;
  footScale?: number;
  hipScale?: number;
  thoraxTopY?: number;
  abdomenTopOffset?: number;
  abdomenBottomOffset?: number;
  abdomenTopHalfWidth?: number;
  abdomenBottomHalfWidth?: number;
  hipTopOffset?: number;
  hipYOffset?: number;
  hipExtraWidth?: number;
  smoothHip?: boolean;
  thighBottomOffset?: number;
  hairCxOffset?: number;
  hairRx?: number;
  hairRy?: number;
  hairCyOffset?: number;
  hairBehindHead?: boolean;
  armYOffset?: number;
};

type BackRegionConfig = {
  cx: number;
  headY: number;
  neckY: number;
  shoulderY: number;
  upperBackY: number;
  lowerBackY: number;
  buttockY: number;
  thighY: number;
  kneeY: number;
  calfY: number;
  ankleY: number;
  footY: number;
  armScale: number;
  legScale: number;
  footScale?: number;
  hairCxOffset?: number;
  hairRx?: number;
  hairRy?: number;
  hairCyOffset?: number;
  hairBehindHead?: boolean;
  armYOffset?: number;
  torsoTopScale?: number;
  torsoMidScale?: number;
  torsoBottomScale?: number;
  upperBackTopOffset?: number;
  upperBackBottomOffset?: number;
  lowerBackTopOffset?: number;
  lowerBackBottomOffset?: number;
  buttockYOffset?: number;
  buttockScale?: number;
};

const COLORS = {
  head: '#9ed7e3',
  face: '#bfe9f0',
  trunk: '#f5df77',
  arm: '#b9ee99',
  pelvis: '#f3b2c4',
  leg: '#f0c7a6',
  back: '#ead86a',
  neutral: '#d8c7ff',
};

function roundedRectPath(x: number, y: number, width: number, height: number): string {
  const radius = Math.min(width, height) * 0.34;
  const r = Math.min(radius, 42);
  const right = x + width;
  const bottom = y + height;

  return [
    `M ${x + r} ${y}`,
    `H ${right - r}`,
    `Q ${right} ${y} ${right} ${y + r}`,
    `V ${bottom - r}`,
    `Q ${right} ${bottom} ${right - r} ${bottom}`,
    `H ${x + r}`,
    `Q ${x} ${bottom} ${x} ${bottom - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    'Z',
  ].join(' ');
}

function rectRegion(
  slug: string,
  segment: BodyRegionSegment,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  pathIndex = 0,
): BodyRegionDefinition {
  return {
    slug,
    segment,
    pathIndex,
    bounds: { x, y, width, height },
    path: roundedRectPath(x, y, width, height),
    color,
  };
}

function ellipseRegion(
  slug: string,
  segment: BodyRegionSegment,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  pathIndex = 0,
): BodyRegionDefinition {
  return {
    slug,
    segment,
    pathIndex,
    bounds: { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 },
    path: `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`,
    color,
  };
}

function polygonRegion(
  slug: string,
  segment: BodyRegionSegment,
  points: Array<[number, number]>,
  color: string,
  pathIndex = 0,
): BodyRegionDefinition {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [firstX, firstY] = points[0] ?? [0, 0];
  const path = [
    `M ${firstX} ${firstY}`,
    ...points.slice(1).map(([x, y]) => `L ${x} ${y}`),
    'Z',
  ].join(' ');

  return {
    slug,
    segment,
    pathIndex,
    bounds: {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    },
    path,
    color,
  };
}

function pathRegion(
  slug: string,
  segment: BodyRegionSegment,
  path: string,
  bounds: BodyRegionBounds,
  color: string,
  pathIndex = 0,
): BodyRegionDefinition {
  return {
    slug,
    segment,
    pathIndex,
    bounds,
    path,
    color,
  };
}

function sideRect(
  slug: string,
  side: BodyRegionSegment,
  cx: number,
  offset: number,
  y: number,
  width: number,
  height: number,
  color: string,
  pathIndex = 0,
): BodyRegionDefinition {
  return rectRegion(slug, side, cx + offset, y, width, height, color, pathIndex);
}

function frontRegions(config: FrontRegionConfig, sex: BodyRegionGender): BodyRegionDefinition[] {
  const c = config.cx;
  const leg = config.legScale;
  const patientLeftLegX = 12 * leg;
  const patientRightLegX = -66 * leg;
  const leftUpperArm = polygonRegion('arm', 'left', [
    [c + 54, config.shoulderY + 18],
    [c + 112, config.shoulderY + 6],
    [c + 160, config.shoulderY + 62],
    [c + 172, config.shoulderY + 204],
    [c + 142, config.shoulderY + 296],
    [c + 92, config.shoulderY + 272],
    [c + 58, config.shoulderY + 122],
  ], COLORS.arm);
  const rightUpperArm = polygonRegion('arm', 'right', [
    [c - 54, config.shoulderY + 18],
    [c - 112, config.shoulderY + 6],
    [c - 160, config.shoulderY + 62],
    [c - 172, config.shoulderY + 204],
    [c - 142, config.shoulderY + 296],
    [c - 92, config.shoulderY + 272],
    [c - 58, config.shoulderY + 122],
  ], COLORS.arm);
  const leftForearm = polygonRegion('forearm', 'left', [
    [c + 90, config.shoulderY + 262],
    [c + 142, config.shoulderY + 298],
    [c + 162, config.shoulderY + 440],
    [c + 132, config.shoulderY + 508],
    [c + 86, config.shoulderY + 474],
    [c + 76, config.shoulderY + 314],
  ], COLORS.arm);
  const rightForearm = polygonRegion('forearm', 'right', [
    [c - 90, config.shoulderY + 262],
    [c - 142, config.shoulderY + 298],
    [c - 162, config.shoulderY + 440],
    [c - 132, config.shoulderY + 508],
    [c - 86, config.shoulderY + 474],
    [c - 76, config.shoulderY + 314],
  ], COLORS.arm);
  const leftHand = polygonRegion('hand', 'left', [
    [c + 96, config.shoulderY + 470],
    [c + 154, config.shoulderY + 492],
    [c + 162, config.shoulderY + 580],
    [c + 130, config.shoulderY + 620],
    [c + 86, config.shoulderY + 586],
    [c + 84, config.shoulderY + 500],
  ], COLORS.arm);
  const rightHand = polygonRegion('hand', 'right', [
    [c - 96, config.shoulderY + 470],
    [c - 154, config.shoulderY + 492],
    [c - 162, config.shoulderY + 580],
    [c - 130, config.shoulderY + 620],
    [c - 86, config.shoulderY + 586],
    [c - 84, config.shoulderY + 500],
  ], COLORS.arm);
  const leftFoot = polygonRegion('foot', 'left', [
    [c + patientLeftLegX - 6, config.footY + 20],
    [c + patientLeftLegX + 30, config.footY + 6],
    [c + patientLeftLegX + 78, config.footY + 18],
    [c + patientLeftLegX + 86, config.footY + 48],
    [c + patientLeftLegX + 56, config.footY + 80],
    [c + patientLeftLegX + 2, config.footY + 82],
    [c + patientLeftLegX - 16, config.footY + 54],
  ], COLORS.leg);
  const rightFoot = polygonRegion('foot', 'right', [
    [c + patientRightLegX - 6, config.footY + 20],
    [c + patientRightLegX + 30, config.footY + 6],
    [c + patientRightLegX + 78, config.footY + 18],
    [c + patientRightLegX + 86, config.footY + 48],
    [c + patientRightLegX + 56, config.footY + 80],
    [c + patientRightLegX + 2, config.footY + 82],
    [c + patientRightLegX - 16, config.footY + 54],
  ], COLORS.leg);
  const genitalRegions = sex === 'female'
    ? [ellipseRegion('vulva', 'common', c, config.pelvisY + 42, 28, 28, COLORS.pelvis)]
    : [
        rectRegion('penis', 'common', c - 12, config.pelvisY + 14, 24, 62, COLORS.pelvis),
        ellipseRegion('scrotum', 'common', c, config.pelvisY + 74, 32, 26, COLORS.pelvis),
      ];

  return [
    polygonRegion('trunk', 'common', [
      [c - 88, config.chestY - 12],
      [c + 88, config.chestY - 12],
      [c + 82, config.abdomenY + 34],
      [c + 104, config.pelvisY + 58],
      [c + 78, config.thighY + 10],
      [c - 78, config.thighY + 10],
      [c - 104, config.pelvisY + 58],
      [c - 82, config.abdomenY + 34],
    ], COLORS.trunk),
    rectRegion('leg', 'left', c + patientLeftLegX, config.thighY, 62, 510, COLORS.leg),
    rectRegion('leg', 'right', c + patientRightLegX, config.thighY, 62, 510, COLORS.leg),
    leftUpperArm,
    rightUpperArm,

    ellipseRegion('head', 'common', c, config.headY + 110, 66, 94, COLORS.head),
    ellipseRegion('hair', 'common', c, config.headY + 48, 72, 54, COLORS.head),
    ellipseRegion('face', 'common', c, config.headY + 118, 54, 70, COLORS.face),
    polygonRegion('neck', 'common', [
      [c - 30, config.neckY],
      [c + 30, config.neckY],
      [c + 42, config.chestY - 18],
      [c - 42, config.chestY - 18],
    ], COLORS.neutral),

    polygonRegion('thorax', 'common', [
      [c - 96, config.chestY - 8],
      [c + 96, config.chestY - 8],
      [c + 82, config.abdomenY - 18],
      [c - 82, config.abdomenY - 18],
    ], COLORS.trunk),
    polygonRegion('breast', 'left', [
      [c + 8, config.chestY + 24],
      [c + 78, config.chestY + 28],
      [c + 88, config.chestY + 104],
      [c + 22, config.chestY + 118],
    ], COLORS.trunk),
    polygonRegion('breast', 'right', [
      [c - 8, config.chestY + 24],
      [c - 78, config.chestY + 28],
      [c - 88, config.chestY + 104],
      [c - 22, config.chestY + 118],
    ], COLORS.trunk),
    polygonRegion('abdomen', 'common', [
      [c - 78, config.abdomenY - 16],
      [c + 78, config.abdomenY - 16],
      [c + 60, config.pelvisY + 8],
      [c - 60, config.pelvisY + 8],
    ], COLORS.trunk),
    ellipseRegion('umbilicus', 'common', c, config.abdomenY + 74, 24, 24, COLORS.trunk),
    polygonRegion('pubis', 'common', [
      [c - 48, config.pelvisY + 2],
      [c + 48, config.pelvisY + 2],
      [c + 40, config.pelvisY + 82],
      [c - 40, config.pelvisY + 82],
    ], COLORS.pelvis),
    polygonRegion('groin', 'left', [
      [c + 18, config.pelvisY + 40],
      [c + 86, config.pelvisY + 54],
      [c + 76, config.thighY + 18],
      [c + 30, config.thighY + 6],
    ], COLORS.pelvis),
    polygonRegion('groin', 'right', [
      [c - 18, config.pelvisY + 40],
      [c - 86, config.pelvisY + 54],
      [c - 76, config.thighY + 18],
      [c - 30, config.thighY + 6],
    ], COLORS.pelvis),
    ...genitalRegions,
    polygonRegion('hip', 'left', [
      [c + 48, config.pelvisY + 8],
      [c + 132, config.pelvisY + 68],
      [c + 120, config.thighY + 30],
      [c + 52, config.thighY],
    ], COLORS.pelvis),
    polygonRegion('hip', 'right', [
      [c - 48, config.pelvisY + 8],
      [c - 132, config.pelvisY + 68],
      [c - 120, config.thighY + 30],
      [c - 52, config.thighY],
    ], COLORS.pelvis),

    leftForearm,
    rightForearm,
    leftHand,
    rightHand,

    polygonRegion('thigh', 'left', [
      [c + 2, config.thighY - 10],
      [c + 120, config.thighY + 8],
      [c + 110, config.kneeY - 12],
      [c + 64, config.kneeY + 20],
      [c + 20, config.kneeY + 6],
      [c - 2, config.thighY + 82],
    ], COLORS.leg),
    polygonRegion('thigh', 'right', [
      [c - 2, config.thighY - 10],
      [c - 120, config.thighY + 8],
      [c - 110, config.kneeY - 12],
      [c - 64, config.kneeY + 20],
      [c - 20, config.kneeY + 6],
      [c + 2, config.thighY + 82],
    ], COLORS.leg),
    polygonRegion('knee', 'left', [
      [c + 16, config.kneeY - 8],
      [c + 92, config.kneeY - 6],
      [c + 88, config.kneeY + 70],
      [c + 24, config.kneeY + 72],
    ], COLORS.leg),
    polygonRegion('knee', 'right', [
      [c - 16, config.kneeY - 8],
      [c - 92, config.kneeY - 6],
      [c - 88, config.kneeY + 70],
      [c - 24, config.kneeY + 72],
    ], COLORS.leg),
    polygonRegion('calf', 'left', [
      [c + 18, config.legY - 10],
      [c + 102, config.legY - 8],
      [c + 92, config.ankleY - 6],
      [c + 56, config.ankleY + 18],
      [c + 20, config.ankleY - 2],
      [c + 8, config.legY + 90],
    ], COLORS.leg),
    polygonRegion('calf', 'right', [
      [c - 18, config.legY - 10],
      [c - 102, config.legY - 8],
      [c - 92, config.ankleY - 6],
      [c - 56, config.ankleY + 18],
      [c - 20, config.ankleY - 2],
      [c - 8, config.legY + 90],
    ], COLORS.leg),
    polygonRegion('ankle', 'left', [
      [c + 18, config.ankleY],
      [c + 86, config.ankleY + 2],
      [c + 82, config.footY],
      [c + 22, config.footY + 2],
    ], COLORS.leg),
    polygonRegion('ankle', 'right', [
      [c - 18, config.ankleY],
      [c - 86, config.ankleY + 2],
      [c - 82, config.footY],
      [c - 22, config.footY + 2],
    ], COLORS.leg),
    leftFoot,
    rightFoot,
  ];
}

function backRegions(config: BackRegionConfig): BodyRegionDefinition[] {
  const c = config.cx;
  const leg = config.legScale;
  const patientLeftLegX = -66 * leg;
  const patientRightLegX = 10 * leg;
  const leftUpperArm = polygonRegion('arm', 'left', [
    [c - 54, config.shoulderY + 18],
    [c - 114, config.shoulderY + 8],
    [c - 164, config.shoulderY + 70],
    [c - 174, config.shoulderY + 214],
    [c - 142, config.shoulderY + 304],
    [c - 92, config.shoulderY + 274],
    [c - 58, config.shoulderY + 126],
  ], COLORS.arm);
  const rightUpperArm = polygonRegion('arm', 'right', [
    [c + 54, config.shoulderY + 18],
    [c + 114, config.shoulderY + 8],
    [c + 164, config.shoulderY + 70],
    [c + 174, config.shoulderY + 214],
    [c + 142, config.shoulderY + 304],
    [c + 92, config.shoulderY + 274],
    [c + 58, config.shoulderY + 126],
  ], COLORS.arm);
  const leftForearm = polygonRegion('forearm', 'left', [
    [c - 88, config.shoulderY + 268],
    [c - 144, config.shoulderY + 304],
    [c - 164, config.shoulderY + 442],
    [c - 132, config.shoulderY + 508],
    [c - 86, config.shoulderY + 476],
    [c - 74, config.shoulderY + 318],
  ], COLORS.arm);
  const rightForearm = polygonRegion('forearm', 'right', [
    [c + 88, config.shoulderY + 268],
    [c + 144, config.shoulderY + 304],
    [c + 164, config.shoulderY + 442],
    [c + 132, config.shoulderY + 508],
    [c + 86, config.shoulderY + 476],
    [c + 74, config.shoulderY + 318],
  ], COLORS.arm);
  const leftHand = polygonRegion('hand', 'left', [
    [c - 96, config.shoulderY + 472],
    [c - 154, config.shoulderY + 496],
    [c - 160, config.shoulderY + 580],
    [c - 128, config.shoulderY + 618],
    [c - 88, config.shoulderY + 586],
    [c - 84, config.shoulderY + 504],
  ], COLORS.arm);
  const rightHand = polygonRegion('hand', 'right', [
    [c + 96, config.shoulderY + 472],
    [c + 154, config.shoulderY + 496],
    [c + 160, config.shoulderY + 580],
    [c + 128, config.shoulderY + 618],
    [c + 88, config.shoulderY + 586],
    [c + 84, config.shoulderY + 504],
  ], COLORS.arm);
  const leftFoot = polygonRegion('foot', 'left', [
    [c + patientLeftLegX - 10, config.footY + 16],
    [c + patientLeftLegX + 18, config.footY + 4],
    [c + patientLeftLegX + 52, config.footY + 10],
    [c + patientLeftLegX + 68, config.footY + 40],
    [c + patientLeftLegX + 44, config.footY + 74],
    [c + patientLeftLegX - 4, config.footY + 80],
    [c + patientLeftLegX - 22, config.footY + 48],
  ], COLORS.leg);
  const rightFoot = polygonRegion('foot', 'right', [
    [c + patientRightLegX - 10, config.footY + 16],
    [c + patientRightLegX + 18, config.footY + 4],
    [c + patientRightLegX + 52, config.footY + 10],
    [c + patientRightLegX + 68, config.footY + 40],
    [c + patientRightLegX + 44, config.footY + 74],
    [c + patientRightLegX - 4, config.footY + 80],
    [c + patientRightLegX - 22, config.footY + 48],
  ], COLORS.leg);

  return [
    polygonRegion('back', 'common', [
      [c - 88, config.upperBackY - 18],
      [c + 88, config.upperBackY - 18],
      [c + 106, config.lowerBackY + 28],
      [c + 90, config.buttockY + 12],
      [c - 90, config.buttockY + 12],
      [c - 106, config.lowerBackY + 28],
    ], COLORS.back),
    rectRegion('leg', 'left', c + patientLeftLegX, config.thighY, 62, 510, COLORS.leg),
    rectRegion('leg', 'right', c + patientRightLegX, config.thighY, 62, 510, COLORS.leg),
    leftUpperArm,
    rightUpperArm,

    ellipseRegion('rearHead', 'common', c, config.headY + 112, 66, 94, COLORS.head),
    ellipseRegion('hair', 'common', c, config.headY + 56, 74, 58, COLORS.head),
    polygonRegion('nape', 'common', [
      [c - 38, config.neckY],
      [c + 38, config.neckY],
      [c + 52, config.upperBackY - 10],
      [c - 52, config.upperBackY - 10],
    ], COLORS.neutral),
    polygonRegion('neck', 'common', [
      [c - 30, config.neckY + 18],
      [c + 30, config.neckY + 18],
      [c + 40, config.upperBackY - 18],
      [c - 40, config.upperBackY - 18],
    ], COLORS.neutral),
    polygonRegion('upper-back', 'common', [
      [c - 100, config.upperBackY - 12],
      [c + 100, config.upperBackY - 12],
      [c + 90, config.lowerBackY - 24],
      [c - 90, config.lowerBackY - 24],
    ], COLORS.back),
    polygonRegion('lower-back', 'common', [
      [c - 114, config.lowerBackY - 18],
      [c + 114, config.lowerBackY - 18],
      [c + 94, config.buttockY + 8],
      [c - 94, config.buttockY + 8],
    ], COLORS.back),
    leftForearm,
    rightForearm,
    leftHand,
    rightHand,

    polygonRegion('buttock', 'left', [
      [c - 92, config.buttockY - 8],
      [c - 2, config.buttockY - 4],
      [c - 8, config.thighY + 44],
      [c - 82, config.thighY + 46],
      [c - 126, config.buttockY + 66],
    ], COLORS.pelvis),
    polygonRegion('buttock', 'right', [
      [c + 92, config.buttockY - 8],
      [c + 2, config.buttockY - 4],
      [c + 8, config.thighY + 44],
      [c + 82, config.thighY + 46],
      [c + 126, config.buttockY + 66],
    ], COLORS.pelvis),
    polygonRegion('thigh', 'left', [
      [c - 118, config.thighY + 8],
      [c - 4, config.thighY - 10],
      [c - 16, config.kneeY + 4],
      [c - 66, config.kneeY + 22],
      [c - 108, config.kneeY - 16],
    ], COLORS.leg),
    polygonRegion('thigh', 'right', [
      [c + 118, config.thighY + 8],
      [c + 4, config.thighY - 10],
      [c + 16, config.kneeY + 4],
      [c + 66, config.kneeY + 22],
      [c + 108, config.kneeY - 16],
    ], COLORS.leg),
    polygonRegion('knee', 'left', [
      [c - 94, config.kneeY - 8],
      [c - 16, config.kneeY - 10],
      [c - 22, config.kneeY + 68],
      [c - 88, config.kneeY + 68],
    ], COLORS.leg),
    polygonRegion('knee', 'right', [
      [c + 94, config.kneeY - 8],
      [c + 16, config.kneeY - 10],
      [c + 22, config.kneeY + 68],
      [c + 88, config.kneeY + 68],
    ], COLORS.leg),
    polygonRegion('calf', 'left', [
      [c - 102, config.calfY - 6],
      [c - 18, config.calfY - 8],
      [c - 10, config.ankleY - 4],
      [c - 54, config.ankleY + 18],
      [c - 90, config.ankleY - 2],
    ], COLORS.leg),
    polygonRegion('calf', 'right', [
      [c + 102, config.calfY - 6],
      [c + 18, config.calfY - 8],
      [c + 10, config.ankleY - 4],
      [c + 54, config.ankleY + 18],
      [c + 90, config.ankleY - 2],
    ], COLORS.leg),
    polygonRegion('ankle', 'left', [
      [c - 90, config.ankleY],
      [c - 18, config.ankleY],
      [c - 20, config.footY + 2],
      [c - 84, config.footY + 4],
    ], COLORS.leg),
    polygonRegion('ankle', 'right', [
      [c + 90, config.ankleY],
      [c + 18, config.ankleY],
      [c + 20, config.footY + 2],
      [c + 84, config.footY + 4],
    ], COLORS.leg),
    polygonRegion('heel', 'left', [
      [c - 84, config.footY + 4],
      [c - 40, config.footY],
      [c - 34, config.footY + 42],
      [c - 80, config.footY + 46],
    ], COLORS.leg),
    polygonRegion('heel', 'right', [
      [c + 84, config.footY + 4],
      [c + 40, config.footY],
      [c + 34, config.footY + 42],
      [c + 80, config.footY + 46],
    ], COLORS.leg),
    leftFoot,
    rightFoot,
  ];
}

function maleFrontRegions(config: FrontRegionConfig): BodyRegionDefinition[] {
  const c = config.cx;
  const armYScale = config.armScale || 1;
  const armYOffset = config.armYOffset ?? 0;
  const bodyScale = config.legScale || 1;
  const footScale = config.footScale ?? 1;
  const hipScale = config.hipScale ?? bodyScale;
  const thoraxTopY = config.thoraxTopY ?? config.chestY - 8;
  const abdomenTopY = config.abdomenY + (config.abdomenTopOffset ?? -18);
  const abdomenBottomY = config.pelvisY + (config.abdomenBottomOffset ?? 0);
  const abdomenTopHalfWidth = config.abdomenTopHalfWidth ?? 92;
  const abdomenBottomHalfWidth = config.abdomenBottomHalfWidth ?? 74;
  const hipTopY = config.pelvisY + (config.hipTopOffset ?? 0);
  const hipY = config.hipYOffset ?? 0;
  const hipExtraWidth = config.hipExtraWidth ?? 0;
  const thighBottomOffset = config.thighBottomOffset ?? 0;
  const armPoint = (x: number, y: number): [number, number] => [c + x, config.shoulderY + y * armYScale + armYOffset];
  const bodyPoint = (x: number, y: number): [number, number] => [c + x * bodyScale, y];
  const footPoint = (x: number, y: number): [number, number] => [c + x * footScale, y];
  const hipPoint = (x: number, y: number): [number, number] => [c + x * hipScale, y];
  const smoothHipRegion = (segment: BodyRegionSegment, side: 1 | -1): BodyRegionDefinition => {
    const innerTop = hipPoint(side * 48, hipTopY + hipY);
    const upperOuter = hipPoint(side * (112 + hipExtraWidth), hipTopY + 28 + hipY);
    const widest = hipPoint(side * (142 + hipExtraWidth), config.pelvisY + 78 + hipY);
    const lowerOuter = hipPoint(side * (126 + hipExtraWidth), config.thighY + 50 + hipY);
    const innerBottom = hipPoint(side * 52, config.thighY + 8 + hipY);
    const innerMid = hipPoint(side * 72, config.pelvisY + 36 + hipY);
    const points = [innerTop, upperOuter, widest, lowerOuter, innerBottom, innerMid];
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const path = [
      `M ${innerTop[0]} ${innerTop[1]}`,
      `C ${upperOuter[0]} ${upperOuter[1]} ${widest[0]} ${widest[1] - 38} ${widest[0]} ${widest[1]}`,
      `C ${widest[0]} ${widest[1] + 24} ${lowerOuter[0]} ${lowerOuter[1] - 12} ${lowerOuter[0]} ${lowerOuter[1]}`,
      `C ${innerBottom[0] + side * 18} ${lowerOuter[1] + 8} ${innerBottom[0]} ${innerBottom[1] + 10} ${innerBottom[0]} ${innerBottom[1]}`,
      `C ${innerMid[0]} ${innerMid[1]} ${innerTop[0] + side * 10} ${innerTop[1] + 36} ${innerTop[0]} ${innerTop[1]}`,
      'Z',
    ].join(' ');

    return pathRegion('hip', segment, path, {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    }, COLORS.pelvis);
  };

  const leftArm = polygonRegion('arm', 'left', [
    armPoint(78, 40),
    armPoint(150, 54),
    armPoint(204, 238),
    armPoint(188, 326),
    armPoint(112, 304),
    armPoint(82, 112),
  ], COLORS.arm);
  const rightArm = polygonRegion('arm', 'right', [
    armPoint(-78, 40),
    armPoint(-150, 54),
    armPoint(-204, 238),
    armPoint(-188, 326),
    armPoint(-112, 304),
    armPoint(-82, 112),
  ], COLORS.arm);
  const leftForearm = polygonRegion('forearm', 'left', [
    armPoint(142, 278),
    armPoint(214, 300),
    armPoint(274, 442),
    armPoint(252, 500),
    armPoint(184, 462),
    armPoint(128, 320),
  ], COLORS.arm);
  const rightForearm = polygonRegion('forearm', 'right', [
    armPoint(-142, 278),
    armPoint(-214, 300),
    armPoint(-274, 442),
    armPoint(-252, 500),
    armPoint(-184, 462),
    armPoint(-128, 320),
  ], COLORS.arm);
  const leftHand = polygonRegion('hand', 'left', [
    armPoint(194, 456),
    armPoint(292, 466),
    armPoint(326, 550),
    armPoint(266, 612),
    armPoint(184, 552),
  ], COLORS.arm);
  const rightHand = polygonRegion('hand', 'right', [
    armPoint(-194, 456),
    armPoint(-292, 466),
    armPoint(-326, 550),
    armPoint(-266, 612),
    armPoint(-184, 552),
  ], COLORS.arm);

  const leftThigh = polygonRegion('thigh', 'left', [
    bodyPoint(4, config.thighY - 12),
    bodyPoint(126, config.thighY + 6),
    bodyPoint(116, config.kneeY - 18 + thighBottomOffset),
    bodyPoint(72, config.kneeY + 22 + thighBottomOffset),
    bodyPoint(24, config.kneeY + 2 + thighBottomOffset),
    bodyPoint(-2, config.thighY + 80),
  ], COLORS.leg);
  const rightThigh = polygonRegion('thigh', 'right', [
    bodyPoint(-4, config.thighY - 12),
    bodyPoint(-126, config.thighY + 6),
    bodyPoint(-116, config.kneeY - 18 + thighBottomOffset),
    bodyPoint(-72, config.kneeY + 22 + thighBottomOffset),
    bodyPoint(-24, config.kneeY + 2 + thighBottomOffset),
    bodyPoint(2, config.thighY + 80),
  ], COLORS.leg);
  const leftKnee = polygonRegion('knee', 'left', [
    bodyPoint(18, config.kneeY - 12),
    bodyPoint(98, config.kneeY - 10),
    bodyPoint(94, config.kneeY + 66),
    bodyPoint(24, config.kneeY + 68),
  ], COLORS.leg);
  const rightKnee = polygonRegion('knee', 'right', [
    bodyPoint(-18, config.kneeY - 12),
    bodyPoint(-98, config.kneeY - 10),
    bodyPoint(-94, config.kneeY + 66),
    bodyPoint(-24, config.kneeY + 68),
  ], COLORS.leg);
  const leftCalf = polygonRegion('calf', 'left', [
    bodyPoint(18, config.legY - 10),
    bodyPoint(112, config.legY - 4),
    bodyPoint(98, config.ankleY - 8),
    bodyPoint(62, config.ankleY + 18),
    bodyPoint(20, config.ankleY - 4),
    bodyPoint(8, config.legY + 88),
  ], COLORS.leg);
  const rightCalf = polygonRegion('calf', 'right', [
    bodyPoint(-18, config.legY - 10),
    bodyPoint(-112, config.legY - 4),
    bodyPoint(-98, config.ankleY - 8),
    bodyPoint(-62, config.ankleY + 18),
    bodyPoint(-20, config.ankleY - 4),
    bodyPoint(-8, config.legY + 88),
  ], COLORS.leg);
  const leftAnkle = polygonRegion('ankle', 'left', [
    bodyPoint(20, config.ankleY),
    bodyPoint(96, config.ankleY + 2),
    bodyPoint(90, config.footY),
    bodyPoint(22, config.footY + 2),
  ], COLORS.leg);
  const rightAnkle = polygonRegion('ankle', 'right', [
    bodyPoint(-20, config.ankleY),
    bodyPoint(-96, config.ankleY + 2),
    bodyPoint(-90, config.footY),
    bodyPoint(-22, config.footY + 2),
  ], COLORS.leg);
  const leftFoot = polygonRegion('foot', 'left', [
    footPoint(46, config.footY + 2),
    footPoint(108, config.footY - 4),
    footPoint(152, config.footY + 32),
    footPoint(126, config.footY + 80),
    footPoint(54, config.footY + 72),
    footPoint(24, config.footY + 42),
  ], COLORS.leg);
  const rightFoot = polygonRegion('foot', 'right', [
    footPoint(-46, config.footY + 2),
    footPoint(-108, config.footY - 4),
    footPoint(-152, config.footY + 32),
    footPoint(-126, config.footY + 80),
    footPoint(-54, config.footY + 72),
    footPoint(-24, config.footY + 42),
  ], COLORS.leg);
  const head = ellipseRegion('head', 'common', c, config.headY + 104, 58, 92, COLORS.head);
  const hair = ellipseRegion(
    'hair',
    'common',
    c + (config.hairCxOffset ?? 0),
    config.headY + (config.hairCyOffset ?? 48),
    config.hairRx ?? 62,
    config.hairRy ?? 52,
    COLORS.head,
  );
  const headRegions = config.hairBehindHead ? [hair, head] : [head, hair];
  const hipRegions = config.smoothHip
    ? [smoothHipRegion('left', 1), smoothHipRegion('right', -1)]
    : [
        polygonRegion('hip', 'left', [
          hipPoint(48, hipTopY + hipY),
          hipPoint(132, config.pelvisY + 62 + hipY),
          hipPoint(120, config.thighY + 22 + hipY),
          hipPoint(54, config.thighY + hipY),
        ], COLORS.pelvis),
        polygonRegion('hip', 'right', [
          hipPoint(-48, hipTopY + hipY),
          hipPoint(-132, config.pelvisY + 62 + hipY),
          hipPoint(-120, config.thighY + 22 + hipY),
          hipPoint(-54, config.thighY + hipY),
        ], COLORS.pelvis),
      ];

  return [
    ...headRegions,

    polygonRegion('thorax', 'common', [
      bodyPoint(-102, thoraxTopY),
      bodyPoint(102, thoraxTopY),
      bodyPoint(88, config.abdomenY - 12),
      bodyPoint(-88, config.abdomenY - 12),
    ], COLORS.trunk),
    polygonRegion('abdomen', 'common', [
      bodyPoint(-abdomenTopHalfWidth, abdomenTopY),
      bodyPoint(abdomenTopHalfWidth, abdomenTopY),
      bodyPoint(abdomenBottomHalfWidth, abdomenBottomY),
      bodyPoint(-abdomenBottomHalfWidth, abdomenBottomY),
    ], COLORS.trunk),
    polygonRegion('pubis', 'common', [
      bodyPoint(-58, config.pelvisY - 10),
      bodyPoint(58, config.pelvisY - 10),
      bodyPoint(48, config.pelvisY + 82),
      bodyPoint(-48, config.pelvisY + 82),
    ], COLORS.pelvis),
    ...hipRegions,

    leftForearm,
    rightForearm,
    leftArm,
    rightArm,
    leftHand,
    rightHand,
    leftThigh,
    rightThigh,
    leftKnee,
    rightKnee,
    leftCalf,
    rightCalf,
    leftAnkle,
    rightAnkle,
    leftFoot,
    rightFoot,
  ];
}

function maleBackRegions(config: BackRegionConfig): BodyRegionDefinition[] {
  const c = config.cx;
  const armYScale = config.armScale || 1;
  const bodyScale = config.legScale || 1;
  const torsoTopScale = config.torsoTopScale ?? bodyScale;
  const torsoMidScale = config.torsoMidScale ?? bodyScale;
  const torsoBottomScale = config.torsoBottomScale ?? bodyScale;
  const buttockYOffset = config.buttockYOffset ?? 0;
  const buttockScale = config.buttockScale ?? bodyScale;
  const armYOffset = config.armYOffset ?? 0;
  const footScale = config.footScale ?? bodyScale;
  const armPoint = (x: number, y: number): [number, number] => [c + x, config.shoulderY + y * armYScale + armYOffset];
  const bodyPoint = (x: number, y: number): [number, number] => [c + x * bodyScale, y];
  const footPoint = (x: number, y: number): [number, number] => [c + x * footScale, y];
  const torsoPoint = (x: number, y: number, scale = torsoMidScale): [number, number] => [c + x * scale, y];
  const buttockPoint = (x: number, y: number): [number, number] => [c + x * buttockScale, y + buttockYOffset];

  const leftArm = polygonRegion('arm', 'left', [
    armPoint(-78, 44),
    armPoint(-152, 56),
    armPoint(-212, 240),
    armPoint(-190, 326),
    armPoint(-116, 304),
    armPoint(-84, 116),
  ], COLORS.arm);
  const rightArm = polygonRegion('arm', 'right', [
    armPoint(78, 44),
    armPoint(152, 56),
    armPoint(212, 240),
    armPoint(190, 326),
    armPoint(116, 304),
    armPoint(84, 116),
  ], COLORS.arm);
  const leftForearm = polygonRegion('forearm', 'left', [
    armPoint(-142, 278),
    armPoint(-216, 300),
    armPoint(-276, 442),
    armPoint(-254, 500),
    armPoint(-186, 462),
    armPoint(-128, 320),
  ], COLORS.arm);
  const rightForearm = polygonRegion('forearm', 'right', [
    armPoint(142, 278),
    armPoint(216, 300),
    armPoint(276, 442),
    armPoint(254, 500),
    armPoint(186, 462),
    armPoint(128, 320),
  ], COLORS.arm);
  const leftHand = polygonRegion('hand', 'left', [
    armPoint(-198, 456),
    armPoint(-298, 466),
    armPoint(-332, 550),
    armPoint(-272, 612),
    armPoint(-188, 552),
  ], COLORS.arm);
  const rightHand = polygonRegion('hand', 'right', [
    armPoint(198, 456),
    armPoint(298, 466),
    armPoint(332, 550),
    armPoint(272, 612),
    armPoint(188, 552),
  ], COLORS.arm);

  const leftThigh = polygonRegion('thigh', 'left', [
    bodyPoint(-126, config.thighY + 8),
    bodyPoint(-4, config.thighY - 12),
    bodyPoint(-18, config.kneeY + 2),
    bodyPoint(-68, config.kneeY + 24),
    bodyPoint(-116, config.kneeY - 18),
  ], COLORS.leg);
  const rightThigh = polygonRegion('thigh', 'right', [
    bodyPoint(126, config.thighY + 8),
    bodyPoint(4, config.thighY - 12),
    bodyPoint(18, config.kneeY + 2),
    bodyPoint(68, config.kneeY + 24),
    bodyPoint(116, config.kneeY - 18),
  ], COLORS.leg);
  const leftKnee = polygonRegion('knee', 'left', [
    bodyPoint(-100, config.kneeY - 10),
    bodyPoint(-18, config.kneeY - 12),
    bodyPoint(-24, config.kneeY + 66),
    bodyPoint(-94, config.kneeY + 66),
  ], COLORS.leg);
  const rightKnee = polygonRegion('knee', 'right', [
    bodyPoint(100, config.kneeY - 10),
    bodyPoint(18, config.kneeY - 12),
    bodyPoint(24, config.kneeY + 66),
    bodyPoint(94, config.kneeY + 66),
  ], COLORS.leg);
  const leftCalf = polygonRegion('calf', 'left', [
    bodyPoint(-112, config.calfY - 6),
    bodyPoint(-18, config.calfY - 10),
    bodyPoint(-10, config.ankleY - 6),
    bodyPoint(-58, config.ankleY + 16),
    bodyPoint(-98, config.ankleY - 4),
  ], COLORS.leg);
  const rightCalf = polygonRegion('calf', 'right', [
    bodyPoint(112, config.calfY - 6),
    bodyPoint(18, config.calfY - 10),
    bodyPoint(10, config.ankleY - 6),
    bodyPoint(58, config.ankleY + 16),
    bodyPoint(98, config.ankleY - 4),
  ], COLORS.leg);
  const leftAnkle = polygonRegion('ankle', 'left', [
    bodyPoint(-98, config.ankleY),
    bodyPoint(-20, config.ankleY),
    bodyPoint(-24, config.footY),
    bodyPoint(-92, config.footY + 2),
  ], COLORS.leg);
  const rightAnkle = polygonRegion('ankle', 'right', [
    bodyPoint(98, config.ankleY),
    bodyPoint(20, config.ankleY),
    bodyPoint(24, config.footY),
    bodyPoint(92, config.footY + 2),
  ], COLORS.leg);
  const leftFoot = polygonRegion('foot', 'left', [
    footPoint(-112, config.footY + 2),
    footPoint(-46, config.footY),
    footPoint(-20, config.footY + 42),
    footPoint(-54, config.footY + 80),
    footPoint(-126, config.footY + 72),
    footPoint(-154, config.footY + 32),
  ], COLORS.leg);
  const rightFoot = polygonRegion('foot', 'right', [
    footPoint(112, config.footY + 2),
    footPoint(46, config.footY),
    footPoint(20, config.footY + 42),
    footPoint(54, config.footY + 80),
    footPoint(126, config.footY + 72),
    footPoint(154, config.footY + 32),
  ], COLORS.leg);
  const rearHead = ellipseRegion('rearHead', 'common', c, config.headY + 104, 58, 92, COLORS.head);
  const hair = ellipseRegion(
    'hair',
    'common',
    c + (config.hairCxOffset ?? 0),
    config.headY + (config.hairCyOffset ?? 50),
    config.hairRx ?? 64,
    config.hairRy ?? 54,
    COLORS.head,
  );
  const headRegions = config.hairBehindHead ? [hair, rearHead] : [rearHead, hair];

  return [
    ...headRegions,
    polygonRegion('upper-back', 'common', [
      torsoPoint(-104, config.upperBackY + (config.upperBackTopOffset ?? -8), torsoTopScale),
      torsoPoint(104, config.upperBackY + (config.upperBackTopOffset ?? -8), torsoTopScale),
      torsoPoint(90, config.lowerBackY + (config.upperBackBottomOffset ?? -10), torsoMidScale),
      torsoPoint(-90, config.lowerBackY + (config.upperBackBottomOffset ?? -10), torsoMidScale),
    ], COLORS.back),
    polygonRegion('lower-back', 'common', [
      torsoPoint(-118, config.lowerBackY + (config.lowerBackTopOffset ?? -16), torsoMidScale),
      torsoPoint(118, config.lowerBackY + (config.lowerBackTopOffset ?? -16), torsoMidScale),
      torsoPoint(98, config.buttockY + (config.lowerBackBottomOffset ?? 0), torsoBottomScale),
      torsoPoint(-98, config.buttockY + (config.lowerBackBottomOffset ?? 0), torsoBottomScale),
    ], COLORS.back),
    polygonRegion('buttock', 'left', [
      buttockPoint(-94, config.buttockY - 10),
      buttockPoint(-2, config.buttockY - 4),
      buttockPoint(-8, config.thighY + 38),
      buttockPoint(-86, config.thighY + 42),
      buttockPoint(-128, config.buttockY + 62),
    ], COLORS.pelvis),
    polygonRegion('buttock', 'right', [
      buttockPoint(94, config.buttockY - 10),
      buttockPoint(2, config.buttockY - 4),
      buttockPoint(8, config.thighY + 38),
      buttockPoint(86, config.thighY + 42),
      buttockPoint(128, config.buttockY + 62),
    ], COLORS.pelvis),

    leftForearm,
    rightForearm,
    leftArm,
    rightArm,
    leftHand,
    rightHand,
    leftThigh,
    rightThigh,
    leftKnee,
    rightKnee,
    leftCalf,
    rightCalf,
    leftAnkle,
    rightAnkle,
    leftFoot,
    rightFoot,
  ];
}

export const BODY_REGION_DEFINITIONS: Record<BodyRegionGender, Record<BodyRegionView, BodyRegionDefinition[]>> = {
  male: {
    front: maleFrontRegions({
      cx: 365,
      headY: 92,
      neckY: 228,
      shoulderY: 270,
      chestY: 315,
      abdomenY: 470,
      pelvisY: 635,
      hipY: 690,
      thighY: 735,
      kneeY: 930,
      legY: 1000,
      ankleY: 1220,
      footY: 1285,
      armScale: 1,
      legScale: 1,
      abdomenTopHalfWidth: 104,
      abdomenBottomHalfWidth: 88,
      smoothHip: true,
      hipExtraWidth: 0,
    }),
    back: maleBackRegions({
      cx: 1085,
      headY: 92,
      neckY: 210,
      shoulderY: 260,
      upperBackY: 315,
      lowerBackY: 485,
      buttockY: 650,
      thighY: 740,
      kneeY: 930,
      calfY: 1000,
      ankleY: 1225,
      footY: 1288,
      armScale: 1,
      legScale: 1,
    }),
  },
  female: {
    front: maleFrontRegions({
      cx: 320,
      headY: 76,
    neckY: 224,
    shoulderY: 270,
    chestY: 326,
    thoraxTopY: 270,
    abdomenY: 516,
    pelvisY: 676,
      hipY: 704,
      thighY: 730,
      kneeY: 972,
      legY: 1048,
      ankleY: 1288,
      footY: 1348,
      armScale: 0.9,
    legScale: 1.12,
    footScale: 0.68,
    hipScale: 1.24,
    abdomenTopOffset: -104,
    abdomenBottomOffset: -10,
    abdomenTopHalfWidth: 108,
    abdomenBottomHalfWidth: 108,
    hipTopOffset: -64,
    hipYOffset: -32,
    hipExtraWidth: 12,
    smoothHip: true,
    thighBottomOffset: 32,
    armYOffset: -24,
    hairCxOffset: -24,
    hairRx: 112,
    hairRy: 126,
    hairCyOffset: 74,
      hairBehindHead: true,
    }),
    back: maleBackRegions({
      cx: 1136,
      headY: 76,
      neckY: 224,
      shoulderY: 270,
      upperBackY: 336,
      lowerBackY: 516,
      buttockY: 676,
      thighY: 758,
      kneeY: 972,
      calfY: 1048,
      ankleY: 1288,
      footY: 1348,
      armScale: 0.9,
      legScale: 1.12,
      footScale: 0.68,
    hairCxOffset: -24,
    hairRx: 112,
    hairRy: 126,
    hairCyOffset: 74,
      hairBehindHead: true,
      armYOffset: -24,
      torsoTopScale: 0.86,
      torsoMidScale: 0.82,
      torsoBottomScale: 1.05,
      upperBackTopOffset: -50,
      upperBackBottomOffset: 44,
      lowerBackTopOffset: -2,
      lowerBackBottomOffset: -16,
      buttockYOffset: -24,
      buttockScale: 1.24,
    }),
  },
};
