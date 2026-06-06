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
  const arm = config.armScale;
  const leg = config.legScale;
  const patientLeftArmX = 58 * arm;
  const patientRightArmX = -116 * arm;
  const patientLeftLegX = 15 * leg;
  const patientRightLegX = -70 * leg;
  const genitalRegions = sex === 'female'
    ? [ellipseRegion('vulva', 'common', c, config.pelvisY + 42, 28, 28, COLORS.pelvis)]
    : [
        rectRegion('penis', 'common', c - 12, config.pelvisY + 14, 24, 62, COLORS.pelvis),
        ellipseRegion('scrotum', 'common', c, config.pelvisY + 74, 32, 26, COLORS.pelvis),
      ];

  return [
    rectRegion('trunk', 'common', c - 70, config.chestY - 10, 140, 330, COLORS.trunk),
    rectRegion('leg', 'left', c + patientLeftLegX, config.thighY, 58, 500, COLORS.leg),
    rectRegion('leg', 'right', c + patientRightLegX, config.thighY, 58, 500, COLORS.leg),
    rectRegion('arm', 'left', c + patientLeftArmX, config.shoulderY + 64, 52, 470, COLORS.arm),
    rectRegion('arm', 'right', c + patientRightArmX, config.shoulderY + 64, 52, 470, COLORS.arm),

    ellipseRegion('head', 'common', c, config.headY + 34, 60, 42, COLORS.head),
    ellipseRegion('hair', 'common', c, config.headY + 54, 66, 54, COLORS.head),
    ellipseRegion('face', 'common', c, config.headY + 112, 48, 63, COLORS.face),
    rectRegion('forehead', 'common', c - 32, config.headY + 76, 64, 26, COLORS.face),
    sideRect('eyebrow', 'left', c, 8, config.headY + 106, 27, 12, COLORS.face),
    sideRect('eyebrow', 'right', c, -35, config.headY + 106, 27, 12, COLORS.face),
    sideRect('eye', 'left', c, 8, config.headY + 121, 27, 18, COLORS.face),
    sideRect('eye', 'right', c, -35, config.headY + 121, 27, 18, COLORS.face),
    rectRegion('nose', 'common', c - 13, config.headY + 128, 26, 35, COLORS.face),
    sideRect('ear', 'left', c, 47, config.headY + 115, 22, 48, COLORS.face),
    sideRect('ear', 'right', c, -69, config.headY + 115, 22, 48, COLORS.face),
    sideRect('cheek', 'left', c, 15, config.headY + 146, 32, 29, COLORS.face),
    sideRect('cheek', 'right', c, -47, config.headY + 146, 32, 29, COLORS.face),
    rectRegion('lips', 'common', c - 21, config.headY + 170, 42, 20, COLORS.face),
    rectRegion('chin', 'common', c - 25, config.headY + 191, 50, 28, COLORS.face),
    rectRegion('neck', 'common', c - 32, config.neckY, 64, 64, COLORS.neutral),

    rectRegion('thorax', 'common', c - 70, config.chestY, 140, 145, COLORS.trunk),
    sideRect('breast', 'left', c, 5, config.chestY + 30, 58, 66, COLORS.trunk),
    sideRect('breast', 'right', c, -63, config.chestY + 30, 58, 66, COLORS.trunk),
    rectRegion('abdomen', 'common', c - 62, config.abdomenY, 124, 155, COLORS.trunk),
    ellipseRegion('umbilicus', 'common', c, config.abdomenY + 70, 24, 24, COLORS.trunk),
    rectRegion('pubis', 'common', c - 42, config.pelvisY, 84, 56, COLORS.pelvis),
    sideRect('groin', 'left', c, 16, config.pelvisY + 46, 52, 58, COLORS.pelvis),
    sideRect('groin', 'right', c, -68, config.pelvisY + 46, 52, 58, COLORS.pelvis),
    ...genitalRegions,
    sideRect('hip', 'left', c, 35, config.hipY, 55, 90, COLORS.pelvis),
    sideRect('hip', 'right', c, -90, config.hipY, 55, 90, COLORS.pelvis),

    sideRect('shoulder', 'left', c, 54 * arm, config.shoulderY, 70, 78, COLORS.arm),
    sideRect('shoulder', 'right', c, -124 * arm, config.shoulderY, 70, 78, COLORS.arm),
    sideRect('armpit', 'left', c, 48 * arm, config.shoulderY + 78, 48, 54, COLORS.arm),
    sideRect('armpit', 'right', c, -96 * arm, config.shoulderY + 78, 48, 54, COLORS.arm),
    sideRect('elbow', 'left', c, 80 * arm, config.shoulderY + 230, 45, 58, COLORS.arm),
    sideRect('elbow', 'right', c, -125 * arm, config.shoulderY + 230, 45, 58, COLORS.arm),
    sideRect('forearm', 'left', c, 78 * arm, config.shoulderY + 282, 48, 150, COLORS.arm),
    sideRect('forearm', 'right', c, -126 * arm, config.shoulderY + 282, 48, 150, COLORS.arm),
    sideRect('wrist', 'left', c, 78 * arm, config.shoulderY + 430, 42, 32, COLORS.arm),
    sideRect('wrist', 'right', c, -120 * arm, config.shoulderY + 430, 42, 32, COLORS.arm),
    sideRect('hand', 'left', c, 73 * arm, config.shoulderY + 460, 52, 88, COLORS.arm),
    sideRect('hand', 'right', c, -125 * arm, config.shoulderY + 460, 52, 88, COLORS.arm),
    sideRect('fingers', 'left', c, 76 * arm, config.shoulderY + 530, 48, 48, COLORS.arm),
    sideRect('fingers', 'right', c, -124 * arm, config.shoulderY + 530, 48, 48, COLORS.arm),

    sideRect('thigh', 'left', c, patientLeftLegX, config.thighY, 62, 200, COLORS.leg),
    sideRect('thigh', 'right', c, patientRightLegX, config.thighY, 62, 200, COLORS.leg),
    sideRect('knee', 'left', c, patientLeftLegX + 4, config.kneeY, 54, 70, COLORS.leg),
    sideRect('knee', 'right', c, patientRightLegX + 4, config.kneeY, 54, 70, COLORS.leg),
    sideRect('calf', 'left', c, patientLeftLegX + 4, config.legY, 54, 210, COLORS.leg),
    sideRect('calf', 'right', c, patientRightLegX + 4, config.legY, 54, 210, COLORS.leg),
    sideRect('ankle', 'left', c, patientLeftLegX + 8, config.ankleY, 46, 54, COLORS.leg),
    sideRect('ankle', 'right', c, patientRightLegX + 8, config.ankleY, 46, 54, COLORS.leg),
    sideRect('foot', 'left', c, patientLeftLegX - 2, config.footY, 68, 80, COLORS.leg),
    sideRect('foot', 'right', c, patientRightLegX - 8, config.footY, 68, 80, COLORS.leg),
  ];
}

function backRegions(config: BackRegionConfig): BodyRegionDefinition[] {
  const c = config.cx;
  const arm = config.armScale;
  const leg = config.legScale;
  const patientLeftArmX = -124 * arm;
  const patientRightArmX = 72 * arm;
  const patientLeftLegX = -70 * leg;
  const patientRightLegX = 12 * leg;

  return [
    rectRegion('back', 'common', c - 78, config.upperBackY, 156, 270, COLORS.back),
    rectRegion('leg', 'left', c + patientLeftLegX, config.thighY, 58, 500, COLORS.leg),
    rectRegion('leg', 'right', c + patientRightLegX, config.thighY, 58, 500, COLORS.leg),
    rectRegion('arm', 'left', c + patientLeftArmX, config.shoulderY + 70, 52, 430, COLORS.arm),
    rectRegion('arm', 'right', c + patientRightArmX, config.shoulderY + 70, 52, 430, COLORS.arm),

    ellipseRegion('rearHead', 'common', c, config.headY + 72, 60, 70, COLORS.head),
    ellipseRegion('hair', 'common', c, config.headY + 62, 70, 66, COLORS.head),
    rectRegion('nape', 'common', c - 38, config.neckY, 76, 70, COLORS.neutral),
    rectRegion('neck', 'common', c - 32, config.neckY + 14, 64, 54, COLORS.neutral),
    rectRegion('upper-back', 'common', c - 80, config.upperBackY, 160, 150, COLORS.back),
    rectRegion('lower-back', 'common', c - 72, config.lowerBackY, 144, 150, COLORS.back),
    sideRect('shoulder', 'left', c, -132 * arm, config.shoulderY, 82, 85, COLORS.arm),
    sideRect('shoulder', 'right', c, 50 * arm, config.shoulderY, 82, 85, COLORS.arm),
    sideRect('elbow', 'left', c, -132 * arm, config.shoulderY + 230, 45, 58, COLORS.arm),
    sideRect('elbow', 'right', c, 86 * arm, config.shoulderY + 230, 45, 58, COLORS.arm),
    sideRect('forearm', 'left', c, -132 * arm, config.shoulderY + 282, 48, 150, COLORS.arm),
    sideRect('forearm', 'right', c, 86 * arm, config.shoulderY + 282, 48, 150, COLORS.arm),
    sideRect('wrist', 'left', c, -126 * arm, config.shoulderY + 430, 42, 32, COLORS.arm),
    sideRect('wrist', 'right', c, 86 * arm, config.shoulderY + 430, 42, 32, COLORS.arm),
    sideRect('hand', 'left', c, -131 * arm, config.shoulderY + 460, 52, 82, COLORS.arm),
    sideRect('hand', 'right', c, 81 * arm, config.shoulderY + 460, 52, 82, COLORS.arm),
    sideRect('fingers', 'left', c, -130 * arm, config.shoulderY + 526, 48, 42, COLORS.arm),
    sideRect('fingers', 'right', c, 84 * arm, config.shoulderY + 526, 48, 42, COLORS.arm),

    sideRect('buttock', 'left', c, -60, config.buttockY, 62, 105, COLORS.pelvis),
    sideRect('buttock', 'right', c, 0, config.buttockY, 62, 105, COLORS.pelvis),
    sideRect('thigh', 'left', c, patientLeftLegX, config.thighY, 62, 205, COLORS.leg),
    sideRect('thigh', 'right', c, patientRightLegX, config.thighY, 62, 205, COLORS.leg),
    sideRect('knee', 'left', c, patientLeftLegX + 4, config.kneeY, 54, 66, COLORS.leg),
    sideRect('knee', 'right', c, patientRightLegX + 4, config.kneeY, 54, 66, COLORS.leg),
    sideRect('calf', 'left', c, patientLeftLegX + 4, config.calfY, 54, 230, COLORS.leg),
    sideRect('calf', 'right', c, patientRightLegX + 4, config.calfY, 54, 230, COLORS.leg),
    sideRect('ankle', 'left', c, patientLeftLegX + 8, config.ankleY, 46, 52, COLORS.leg),
    sideRect('ankle', 'right', c, patientRightLegX + 8, config.ankleY, 46, 52, COLORS.leg),
    sideRect('heel', 'left', c, patientLeftLegX + 7, config.footY, 46, 48, COLORS.leg),
    sideRect('heel', 'right', c, patientRightLegX + 9, config.footY, 46, 48, COLORS.leg),
    sideRect('foot', 'left', c, patientLeftLegX - 4, config.footY + 34, 66, 62, COLORS.leg),
    sideRect('foot', 'right', c, patientRightLegX - 4, config.footY + 34, 66, 62, COLORS.leg),
  ];
}

export const BODY_REGION_DEFINITIONS: Record<BodyRegionGender, Record<BodyRegionView, BodyRegionDefinition[]>> = {
  male: {
    front: frontRegions({
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
    }, 'male'),
    back: backRegions({
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
    front: frontRegions({
      cx: 320,
      headY: 0,
      neckY: 255,
      shoulderY: 305,
      chestY: 335,
      abdomenY: 465,
      pelvisY: 630,
      hipY: 690,
      thighY: 735,
      kneeY: 930,
      legY: 1005,
      ankleY: 1248,
      footY: 1305,
      armScale: 1.1,
      legScale: 1.02,
    }, 'female'),
    back: backRegions({
      cx: 1098,
      headY: 0,
      neckY: 240,
      shoulderY: 300,
      upperBackY: 355,
      lowerBackY: 520,
      buttockY: 690,
      thighY: 770,
      kneeY: 970,
      calfY: 1040,
      ankleY: 1272,
      footY: 1320,
      armScale: 1.08,
      legScale: 1.02,
    }),
  },
};
