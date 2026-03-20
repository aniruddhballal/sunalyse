// Raw shapes coming off the wire — coordinates may be null where Python's
// json.dumps serialized numpy NaN values near the poles.

export type RawPoint = [number, number, number] | [null, null, null];

export interface RawFieldLine {
  points: RawPoint[];
  strengths: (number | null)[];
  polarity: 'open' | 'closed';
  apexR?: number | null;
  footpoints?: [[number | null, number | null], [number | null, number | null]];
}

export interface RawCoronalData {
  metadata: {
    lmax: number;
    r_source: number;
    n_field_lines: number;
  };
  fieldLines: RawFieldLine[];
  polarityGrid?: {
    data: (number | null)[];
    n_theta: number;
    n_phi: number;
  };
}