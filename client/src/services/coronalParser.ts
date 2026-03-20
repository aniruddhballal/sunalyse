import type { RawCoronalData } from './coronalTypes';

// Replace bare NaN/Infinity tokens before handing to JSON.parse.
// Python's json.dumps emits these for numpy NaN values near the poles —
// they are valid Python but illegal JSON, so JSON.parse rejects the file.
// Word-boundary anchors prevent matching characters inside quoted strings.
export function sanitizeNaNJSON(raw: string): string {
  return raw.replace(/\bNaN\b|-?Infinity\b/g, 'null');
}

// After parsing, drop any field line that has even one null coordinate —
// those points came from NaN in the Python output and carry no valid geometry.
// Null strengths are zeroed and null polarityGrid values are zeroed too.
export function cleanCoronalData(raw: RawCoronalData) {
  const cleanedLines = raw.fieldLines
    .filter(fl =>
      fl.points.every(p => p[0] !== null && p[1] !== null && p[2] !== null)
    )
    .map(fl => ({
      ...fl,
      points: fl.points as [number, number, number][],
      strengths: fl.strengths.map(s => s ?? 0),
      apexR: fl.apexR ?? undefined,
      footpoints: fl.footpoints
        ? [
            [fl.footpoints[0][0] ?? 0, fl.footpoints[0][1] ?? 0] as [number, number],
            [fl.footpoints[1][0] ?? 0, fl.footpoints[1][1] ?? 0] as [number, number],
          ] as [[number, number], [number, number]]
        : undefined,
    }));

  const removedCount = raw.fieldLines.length - cleanedLines.length;
  if (removedCount > 0) {
    console.warn(
      `[coronal] Dropped ${removedCount} field line(s) with NaN coordinates ` +
      `(${cleanedLines.length} remain). This is a known upstream data issue.`
    );
  }

  return {
    ...raw,
    metadata: {
      ...raw.metadata,
      n_field_lines: cleanedLines.length,
    },
    fieldLines: cleanedLines,
    polarityGrid: raw.polarityGrid
      ? {
          ...raw.polarityGrid,
          data: raw.polarityGrid.data.map(v => v ?? 0),
        }
      : undefined,
  };
}