import { BodyView } from '../../../../../../core/models/exam.models';

export type ExamRegionSegment = 'common' | 'left' | 'right';

export function buildExamRegionId(
  view: BodyView,
  slug: string | undefined,
  segment: ExamRegionSegment,
  pathIndex: number,
): string {
  const safeView = view === 'back' ? 'back' : 'front';
  return `${safeView}|${slug ?? 'unknown'}|${segment}|${pathIndex}`;
}

export function formatExamRegionLabel(
  regionId: string,
  translate: (key: string) => string,
): string {
  const [viewValue, slugValue, segmentValue, pathIndexValue] = regionId.split('|');
  const view: BodyView = viewValue === 'back' ? 'back' : 'front';
  const segment: ExamRegionSegment =
    segmentValue === 'left' || segmentValue === 'right' ? segmentValue : 'common';
  const slug = (slugValue ?? 'unknown').trim() || 'unknown';
  const pathIndex = Number(pathIndexValue);
  const suffixParts: string[] = [];

  const viewKey =
    view === 'front'
      ? 'consultation.page.exam.bodyMap.front'
      : 'consultation.page.exam.bodyMap.back';
  const viewLabel = translateOrFallback(translate, viewKey, toTitleCase(view));
  const partLabel = translateOrFallback(
    translate,
    `consultation.page.exam.bodyMap.parts.${slug}`,
    toTitleCase(String(slug).replace(/-/g, ' ')),
  );

  if (viewLabel) {
    suffixParts.push(viewLabel);
  }

  if (segment !== 'common') {
    suffixParts.push(
      translateOrFallback(
        translate,
        `consultation.page.exam.bodyMap.side.${segment}`,
        toTitleCase(segment),
      ),
    );
  }

  if (Number.isFinite(pathIndex) && pathIndex > 0) {
    suffixParts.push(String(pathIndex + 1));
  }

  return suffixParts.length > 0 ? `${partLabel} (${suffixParts.join(' ')})` : partLabel;
}

function translateOrFallback(
  translate: (key: string) => string,
  key: string,
  fallback: string,
): string {
  const translated = translate(key);
  return translated !== key ? translated : fallback;
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
