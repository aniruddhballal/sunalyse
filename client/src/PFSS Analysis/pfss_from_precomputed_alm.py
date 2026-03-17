import numpy as np
from scipy.special import sph_harm
import json
import pandas as pd
from pathlib import Path
import multiprocessing as mp


# ============================================================
# MODULE-LEVEL WORKER STATE
# These globals are set once per worker process via Pool initializer
# so each worker has its own copy of the alm arrays without
# re-pickling them on every task.
# ============================================================

_worker_ls     = None
_worker_ms     = None
_worker_g_lms  = None
_worker_r_src  = None
_worker_step   = None
_worker_steps  = None


def _worker_init(ls, ms, g_lms, r_source, step_size, max_steps):
    """Initialise per-worker globals. Called once when each worker process starts."""
    global _worker_ls, _worker_ms, _worker_g_lms, _worker_r_src, _worker_step, _worker_steps
    _worker_ls    = ls
    _worker_ms    = ms
    _worker_g_lms = g_lms
    _worker_r_src = r_source
    _worker_step  = step_size
    _worker_steps = max_steps


def _compute_field(r, theta, phi):
    """
    Standalone (picklable) version of compute_field_at_point using worker globals.
    Identical math to the class method — vectorised NumPy sph_harm call.
    """
    ls    = _worker_ls
    ms    = _worker_ms
    g_lms = _worker_g_lms
    rs    = _worker_r_src

    eps = 1e-5
    sin_theta = np.sin(theta)
    if abs(sin_theta) < 1e-10:
        sin_theta = 1e-10

    denom    = 1.0 - rs ** (2 * ls + 1)
    dR_dr    = (ls * r**(ls-1) + (ls+1) * rs**(2*ls+1) / r**(ls+2)) / denom
    R_over_r = (r**ls - rs**(2*ls+1) / r**(ls+1)) / (denom * r)

    ylm         = sph_harm(ms, ls, phi, theta)
    theta_p     = min(theta + eps, np.pi - eps)
    theta_m_val = max(theta - eps, eps)
    ylm_p       = sph_harm(ms, ls, phi, theta_p)
    ylm_m       = sph_harm(ms, ls, phi, theta_m_val)
    dYlm_dtheta = (ylm_p - ylm_m) / (theta_p - theta_m_val)
    dYlm_dphi   = 1j * ms * ylm

    Br     = np.sum(g_lms * dR_dr    * ylm)
    Btheta = np.sum(g_lms * R_over_r * dYlm_dtheta)
    Bphi   = np.sum(g_lms * R_over_r * dYlm_dphi / sin_theta)

    return (-Br).real, (-Btheta).real, (-Bphi).real


def _trace_one(r_start, theta_start, phi_start):
    """
    Trace a single field line (both directions) in a worker process.
    Returns a dict with points, strengths, polarity — same format as
    the class method, ready to be collected by the main process.
    """
    step_size = _worker_step
    max_steps = _worker_steps
    r_source  = _worker_r_src

    def trace_direction(direction):
        points, strengths = [[r_start, theta_start, phi_start]], []
        r, theta, phi = r_start, theta_start, phi_start
        for _ in range(max_steps):
            Br, Btheta, Bphi = _compute_field(r, theta, phi)
            B_mag = np.sqrt(Br**2 + Btheta**2 + Bphi**2)
            if B_mag < 1e-10:
                break
            strengths.append(B_mag)
            dr     = direction * step_size * Br / B_mag
            dtheta = direction * step_size * Btheta / (r * B_mag)
            dphi   = direction * step_size * Bphi / (r * np.sin(max(abs(theta), 1e-10)) * B_mag)
            r += dr; theta += dtheta; phi = (phi + dphi) % (2 * np.pi)
            if r < 1.0 or r > r_source:
                break
            if theta < 0.01 or theta > np.pi - 0.01:
                break
            points.append([r, theta, phi])
        return points, strengths

    pts_fwd, str_fwd = trace_direction(1)
    pts_bwd, str_bwd = trace_direction(-1)

    points    = pts_bwd[::-1] + pts_fwd[1:]
    strengths = str_bwd[::-1] + str_fwd[1:]

    r_end    = points[-1][0] if points else r_start
    polarity = 'open' if r_end > r_source - 0.1 else 'closed'

    # Apex height: maximum radial distance reached (in solar radii)
    apex_r = max((p[0] for p in points), default=r_start)

    # Footpoints: first and last point as [theta, phi] pairs
    fp1 = [points[0][1],  points[0][2]]
    fp2 = [points[-1][1], points[-1][2]]

    return {
        'points':     points,
        'strengths':  strengths,
        'polarity':   polarity,
        'apexR':      round(float(apex_r), 4),
        'footpoints': [fp1, fp2]
    }



class PFSSExtrapolationFromALM:
    """
    Potential Field Source Surface (PFSS) extrapolation using precomputed
    spherical harmonic coefficients (alm values).
    """
    
    def __init__(self, lmax=85, r_source=2.5):
        """
        Initialize PFSS extrapolator with precomputed alm coefficients.
        
        Parameters:
        -----------
        lmax : int
            Maximum spherical harmonic degree from precomputed data
        r_source : float
            Source surface radius in solar radii (typically 2.5)
        """
        self.lmax = lmax
        self.r_source = r_source
        self.alm = None
        
    def load_alm_from_csv(self, csv_path):
        """
        Load precomputed spherical harmonic coefficients from CSV file.
        
        The CSV format is:
        l,m,alm
        0,0,(0.15952343275779984+0j)
        1,-1,(0.31592717672123205+0.3123543086243965j)
        ...
        
        Parameters:
        -----------
        csv_path : str
            Path to CSV file containing alm values
            
        Returns:
        --------
        alm : dict
            Spherical harmonic coefficients {(l, m): complex coefficient}
        """
        print(f"Loading alm coefficients from {csv_path}...")
        
        # Read CSV file
        df = pd.read_csv(csv_path)
        
        # Parse the alm values (they're stored as string representations of complex numbers)
        alm = {}
        for _, row in df.iterrows():
            l = int(row['l'])
            m = int(row['m'])
            
            # Convert string representation to complex number
            # The format is like "(0.15952343275779984+0j)"
            alm_str = str(row['alm'])
            alm_value = complex(alm_str)
            
            alm[(l, m)] = alm_value
        
        # Update lmax based on actual data
        actual_lmax = max(l for l, m in alm.keys())
        self.lmax = actual_lmax
        
        print(f"✓ Loaded {len(alm)} coefficients")
        print(f"  lmax = {self.lmax}")
        print(f"  Coefficient range: l ∈ [0, {actual_lmax}], m ∈ [-l, l]")
        
        return alm
    
    def prepare_arrays(self):
        """
        Convert the alm dict into flat NumPy arrays for vectorised computation.
        Call this once after load_alm_from_csv — it pre-builds the arrays so
        compute_field_at_point can do a single batched sph_harm call instead of
        7396 sequential ones.

        Builds:
          self.ls      — array of l values, shape (N,)
          self.ms      — array of m values, shape (N,)
          self.g_lms   — array of complex coefficients, shape (N,)

        where N = total number of (l,m) pairs with l >= 1.
        """
        ls, ms, g_lms = [], [], []
        for (l, m), g in self.alm.items():
            if l >= 1:  # l=0 doesn't contribute to B
                ls.append(l)
                ms.append(m)
                g_lms.append(g)
        self.ls    = np.array(ls,    dtype=np.int32)
        self.ms    = np.array(ms,    dtype=np.int32)
        self.g_lms = np.array(g_lms, dtype=np.complex128)
        print(f"  Prepared {len(self.ls)} (l,m) pairs as NumPy arrays for vectorised computation")

    def compute_field_at_point(self, r, theta, phi):
        """
        Compute magnetic field vector B(r, theta, phi) using PFSS model.

        Previously only Br was computed (Btheta and Bphi were hardcoded to 0),
        which caused all field lines to go straight radially outward with no
        curvature. All three components are now computed correctly.

        This version is fully vectorised — all (l,m) pairs are processed in a
        single batched sph_harm call instead of a Python loop over 7396 pairs.
        Requires prepare_arrays() to have been called after load_alm_from_csv.

        The magnetic field is B = -grad(Φ), where the PFSS scalar potential is:
          Φ = Σ_lm  g_lm * R_l(r) * Y_lm(theta, phi)

        The radial function enforcing the source surface boundary condition is:
          R_l(r) = (r^l - r_s^(2l+1) / r^(l+1)) / (1 - r_s^(2l+1))

        This gives three field components:

          Br     = -dΦ/dr
                 = -Σ_lm g_lm * dR_l/dr * Y_lm
            where dR_l/dr = (l r^(l-1) + (l+1) r_s^(2l+1) / r^(l+2)) / (1 - r_s^(2l+1))

          Btheta = -(1/r) dΦ/dtheta
                 = -Σ_lm g_lm * (R_l/r) * dY_lm/dtheta
            dY_lm/dtheta computed via central finite difference (eps=1e-5)

          Bphi   = -(1/(r sinθ)) dΦ/dphi
                 = -Σ_lm g_lm * (R_l/r) * (1/sinθ) * dY_lm/dphi
            dY_lm/dphi = i*m * Y_lm  (exact analytic derivative)

        Parameters:
        -----------
        r : float
            Radius in solar radii (1.0 = photosphere)
        theta : float
            Colatitude in radians [0, π]
        phi : float
            Longitude in radians [0, 2π]
            
        Returns:
        --------
        Br, Btheta, Bphi : float
            Magnetic field components in spherical coordinates
        """
        if self.alm is None:
            raise ValueError("Must load alm coefficients first")

        ls    = self.ls      # shape (N,)
        ms    = self.ms      # shape (N,)
        g_lms = self.g_lms   # shape (N,)
        rs    = self.r_source

        eps = 1e-5  # step size for central finite difference on dY/dtheta

        # Clamp sin(theta) away from zero to avoid division by zero near poles
        sin_theta = np.sin(theta)
        if abs(sin_theta) < 1e-10:
            sin_theta = 1e-10

        # --- Radial factors, vectorised over all l values ---
        denom   = 1.0 - rs ** (2 * ls + 1)                                            # shape (N,)
        dR_dr   = (ls * r**(ls-1) + (ls+1) * rs**(2*ls+1) / r**(ls+2)) / denom       # shape (N,)
        R_over_r = (r**ls - rs**(2*ls+1) / r**(ls+1)) / (denom * r)                  # shape (N,)

        # --- Spherical harmonics, single batched call for all (l,m) pairs ---
        ylm        = sph_harm(ms, ls, phi, theta)                                      # shape (N,)
        theta_p    = min(theta + eps, np.pi - eps)
        theta_m    = max(theta - eps, eps)
        ylm_p      = sph_harm(ms, ls, phi, theta_p)                                   # shape (N,)
        ylm_m      = sph_harm(ms, ls, phi, theta_m)                                   # shape (N,)
        dYlm_dtheta = (ylm_p - ylm_m) / (theta_p - theta_m)                          # shape (N,)
        dYlm_dphi   = 1j * ms * ylm                                                   # shape (N,), analytic

        # --- Sum contributions from all (l,m) pairs ---
        Br     = np.sum(g_lms * dR_dr    * ylm)
        Btheta = np.sum(g_lms * R_over_r * dYlm_dtheta)
        Bphi   = np.sum(g_lms * R_over_r * dYlm_dphi / sin_theta)

        # Apply B = -grad(Φ) sign and take real part
        return (-Br).real, (-Btheta).real, (-Bphi).real
    
    def trace_field_line(self, r_start, theta_start, phi_start,
                         max_steps=1000, step_size=0.01, direction=1):
        """
        Trace a single magnetic field line using Euler integration.

        Now uses all three field components (Br, Btheta, Bphi) so lines
        curve correctly instead of going straight radially outward.
        
        Parameters:
        -----------
        r_start, theta_start, phi_start : float
            Starting point in spherical coordinates
        max_steps : int
            Maximum integration steps
        step_size : float
            Integration step size
        direction : int
            +1 for forward (along B), -1 for backward (against B)
            
        Returns:
        --------
        points : list of [r, theta, phi]
            Field line coordinates
        field_strengths : list of float
            |B| at each point
        """
        points = [[r_start, theta_start, phi_start]]
        field_strengths = []
        
        r, theta, phi = r_start, theta_start, phi_start
        
        for step in range(max_steps):
            # Compute field at current point
            Br, Btheta, Bphi = self.compute_field_at_point(r, theta, phi)
            B_mag = np.sqrt(Br**2 + Btheta**2 + Bphi**2)
            
            if B_mag < 1e-10:  # Avoid division by zero in null field regions
                break
            
            field_strengths.append(B_mag)
            
            # Normalised Euler step in spherical coordinates
            dr     = direction * step_size * Br / B_mag
            dtheta = direction * step_size * Btheta / (r * B_mag)
            dphi   = direction * step_size * Bphi / (r * np.sin(max(abs(theta), 1e-10)) * B_mag)
            
            r     += dr
            theta += dtheta
            phi   += dphi

            # Keep phi wrapped in [0, 2π]
            phi = phi % (2 * np.pi)
            
            # Boundary conditions
            if r < 1.0 or r > self.r_source:  # Hit photosphere or source surface
                break
            if theta < 0.01 or theta > np.pi - 0.01:  # Near poles
                break
            
            points.append([r, theta, phi])
        
        return points, field_strengths
    
    def generate_field_lines(self, n_lines=100, step_size=0.01, max_steps=1000,
                             adaptive_seeds=None):
        """
        Generate multiple field lines across the solar surface.

        Seeds n_lines starting points on a uniform grid across the photosphere
        (sqrt(n_lines) points in theta × sqrt(n_lines) in phi), then traces
        each one in both directions and classifies open vs closed.
        
        Parameters:
        -----------
        n_lines : int
            Number of field lines to trace
        step_size : float
            Integration step size — smaller = smoother, longer traces (default 0.01)
        max_steps : int
            Maximum steps per field line — increase alongside smaller step_size (default 1000)
            
        Returns:
        --------
        field_lines : list of dict
            Each dict contains 'points', 'strengths', 'polarity'
        """
        if adaptive_seeds is not None:
            seeds = [(1.0, float(th), float(ph)) for th, ph in adaptive_seeds]
            print(f"Using {len(seeds)} adaptive seeds from seed CSV")
        else:
            n_theta = int(np.sqrt(n_lines))
            n_phi   = int(n_lines / n_theta)
            theta_starts = np.linspace(0.1, np.pi - 0.1, n_theta)
            phi_starts   = np.linspace(0, 2 * np.pi, n_phi, endpoint=False)
            seeds = [
                (1.0, float(th), float(ph))
                for th in theta_starts
                for ph in phi_starts
            ]
            print(f"Using {len(seeds)} uniform grid seeds (no seed CSV provided)")

        n_workers = mp.cpu_count()
        print(f"Tracing {len(seeds)} field lines across {n_workers} CPU cores "
              f"(step_size={step_size}, max_steps={max_steps})...")

        # Each worker process is initialised with the alm arrays and tracing
        # parameters as globals — avoids re-pickling them on every task
        with mp.Pool(
            processes=n_workers,
            initializer=_worker_init,
            initargs=(self.ls, self.ms, self.g_lms, self.r_source, step_size, max_steps)
        ) as pool:
            field_lines = pool.starmap(_trace_one, seeds)

        open_count   = sum(1 for fl in field_lines if fl['polarity'] == 'open')
        closed_count = len(field_lines) - open_count
        print(f"✓ Traced {len(field_lines)} field lines "
              f"({open_count} open, {closed_count} closed)")
        
        return field_lines
    
    def compute_source_surface_br(self, n_theta=60, n_phi=120):
        """
        Compute Br on a (n_theta x n_phi) grid at the source surface (r = r_source).

        Used to build the polarity surface texture in the frontend — positive Br
        regions shown warm (red/orange), negative shown cool (green). The zero
        crossing of Br is the heliospheric current sheet boundary, visible as the
        colour transition on the rendered surface.

        Parameters:
        -----------
        n_theta : int
            Number of colatitude steps (default 60)
        n_phi : int
            Number of longitude steps (default 120)

        Returns:
        --------
        br_grid : ndarray, shape (n_theta, n_phi)
            Radial magnetic field at source surface
        """
        r  = self.r_source
        ls = self.ls
        ms = self.ms
        gs = self.g_lms
        rs = r

        theta_vals = np.linspace(0.05, np.pi - 0.05, n_theta)
        phi_vals   = np.linspace(0.0, 2.0 * np.pi, n_phi, endpoint=False)

        denom   = 1.0 - rs ** (2 * ls + 1)
        dR_dr   = (ls * r**(ls-1) + (ls+1) * rs**(2*ls+1) / r**(ls+2)) / denom
        weights = gs * dR_dr

        br_grid = np.zeros((n_theta, n_phi))
        for i, theta in enumerate(theta_vals):
            ylm_row = sph_harm(ms[None, :], ls[None, :],
                               phi_vals[:, None],
                               np.full(n_phi, theta)[:, None])
            br_grid[i] = -np.real(ylm_row @ weights)

        print(f"  Source surface Br grid: {n_theta}x{n_phi}")
        return br_grid

    def spherical_to_cartesian(self, r, theta, phi):
        """Convert spherical to Cartesian coordinates."""
        x = r * np.sin(theta) * np.cos(phi)
        y = r * np.sin(theta) * np.sin(phi)
        z = r * np.cos(theta)
        return [x, y, z]
    
    def export_for_visualization(self, field_lines, output_path,
                                  hcs_br_grid=None, hcs_n_theta=60, hcs_n_phi=120):
        """
        Export field lines in format suitable for Three.js visualization.

        Parameters:
        -----------
        field_lines : list
            Field line data from generate_field_lines()
        output_path : str
            Path to save JSON file
        hcs_br_grid : ndarray or None
            60x120 Br grid at source surface for polarity texture
        hcs_n_theta, hcs_n_phi : int
            Grid dimensions
        """
        # Flatten br_grid for JSON
        polarity_flat = []
        if hcs_br_grid is not None:
            polarity_flat = [round(float(v), 4)
                             for row in hcs_br_grid for v in row]

        export_data = {
            'metadata': {
                'lmax': self.lmax,
                'r_source': self.r_source,
                'n_field_lines': len(field_lines)
            },
            'fieldLines': [],
            'polarityGrid': {
                'data': polarity_flat,
                'n_theta': hcs_n_theta,
                'n_phi': hcs_n_phi
            }
        }

        for fl in field_lines:
            points_cartesian = [
                self.spherical_to_cartesian(r, theta, phi)
                for r, theta, phi in fl['points']
            ]
            export_data['fieldLines'].append({
                'points':     points_cartesian,
                'strengths':  fl['strengths'],
                'polarity':   fl['polarity'],
                'apexR':      fl.get('apexR', 1.0),
                'footpoints': fl.get('footpoints', [])
            })

        def round_nested(obj, dp=6):
            if isinstance(obj, float):
                return round(obj, dp)
            if isinstance(obj, list):
                return [round_nested(v, dp) for v in obj]
            if isinstance(obj, dict):
                return {k: round_nested(v, dp) for k, v in obj.items()}
            return obj

        json_str = json.dumps(round_nested(export_data), separators=(',', ':'))
        with open(output_path, 'w') as f:
            f.write(json_str)

        print(f"✓ Exported to {output_path}")
        print(f"  File size: {Path(output_path).stat().st_size / 1024:.1f} KB")


def process_single_cr(alm_csv_path, output_json_path, n_lines=100, step_size=0.01,
                      max_steps=1000, seed_dir=None):
    """
    Process a single Carrington rotation using precomputed alm coefficients.

    Parameters:
    -----------
    alm_csv_path : str
        Path to CSV file with precomputed alm values
    output_json_path : str
        Path for output JSON file
    n_lines : int
        Number of field lines when falling back to uniform grid
    step_size : float
        Integration step size (default 0.01)
    max_steps : int
        Maximum steps per field line (default 1000)
    seed_dir : str or Path or None
        Directory containing seeds_xxxx.csv files. If provided and the matching
        file exists, adaptive seeds are used instead of the uniform grid.
    """
    import time
    import re as _re

    print(f"\n{chr(61)*60}")
    print(f"Processing: {alm_csv_path}")
    print(f"{chr(61)*60}\n")

    total_start = time.time()

    pfss = PFSSExtrapolationFromALM(lmax=85, r_source=2.5)

    t0 = time.time()
    pfss.alm = pfss.load_alm_from_csv(alm_csv_path)
    pfss.prepare_arrays()
    print(f"  Load time:    {time.time() - t0:.1f}s")

    # Load adaptive seeds if available
    adaptive_seeds = None
    if seed_dir is not None:
        match = _re.search(r'(\d{4})', Path(alm_csv_path).stem)
        if match:
            cr_num   = match.group(1)
            seed_csv = Path(seed_dir) / f"seeds_{cr_num}.csv"
            if seed_csv.exists():
                seed_df        = pd.read_csv(seed_csv)
                adaptive_seeds = list(zip(seed_df['theta'], seed_df['phi']))
                print(f"  Seeds:        {len(adaptive_seeds)} adaptive (from {seed_csv.name})")
            else:
                print(f"  Seeds:        uniform grid (no seed CSV for CR {cr_num})")

    # Compute source surface Br grid before spawning pool
    t0 = time.time()
    print("  Computing source surface Br grid...")
    hcs_br_grid = pfss.compute_source_surface_br()
    print(f"  HCS time:     {time.time() - t0:.1f}s")

    # Generate field lines
    t0 = time.time()
    field_lines = pfss.generate_field_lines(
        n_lines=n_lines, step_size=step_size, max_steps=max_steps,
        adaptive_seeds=adaptive_seeds
    )
    tracing_time = time.time() - t0
    print(f"  Tracing time: {tracing_time:.1f}s  ({tracing_time/max(len(field_lines),1):.2f}s per line)")

    # Export for visualization
    t0 = time.time()
    pfss.export_for_visualization(field_lines, output_json_path,
                                  hcs_br_grid=hcs_br_grid,
                                  hcs_n_theta=60,
                                  hcs_n_phi=120)
    print(f"  Export time:  {time.time() - t0:.1f}s")

    total_time = time.time() - total_start
    print(f"\n{chr(61)*60}")
    print(f"✓ Processing complete!  Total: {total_time:.1f}s ({total_time/60:.1f} min)")
    print(f"{chr(61)*60}\n")


def batch_process_all_crs(alm_dir="alm values", output_dir="coronal_data_lmax85",
                          n_lines=100, step_size=0.01, max_steps=1000,
                          start_cr=2096, end_cr=2285, seed_dir=None):
    """
    Batch process all Carrington rotations using precomputed alm coefficients.
    
    Parameters:
    -----------
    alm_dir : str
        Directory containing CSV files with alm values (format: values_xxxx.csv)
    output_dir : str
        Directory to save coronal JSON files
    n_lines : int
        Number of field lines to trace
    step_size : float
        Integration step size — smaller = smoother, longer traces (default 0.01)
    max_steps : int
        Maximum steps per field line (default 1000)
    start_cr : int
        Starting Carrington rotation number
    end_cr : int
        Ending Carrington rotation number
    seed_dir : str or Path or None
        Directory containing seeds_xxxx.csv files for adaptive seeding
    """
    alm_path = Path(alm_dir)
    output_path = Path(output_dir)
    
    # Create output directory
    output_path.mkdir(exist_ok=True)
    
    # Find all CSV files with alm values
    alm_files = sorted(alm_path.glob("values_*.csv"))
    
    if not alm_files:
        print(f"❌ No alm CSV files found in {alm_dir}")
        print(f"   Expected format: values_xxxx.csv")
        return
    
    print(f"\n{'='*60}")
    print(f"BATCH PROCESSING: Found {len(alm_files)} alm CSV files")
    print(f"{'='*60}\n")
    
    # Track progress
    total_files = len(alm_files)
    processed = 0
    skipped = 0
    failed = 0
    
    for idx, alm_file in enumerate(alm_files, 1):
        # Extract CR number from filename (e.g., values_2240.csv)
        try:
            filename = alm_file.stem  # 'values_2240'
            parts = filename.split('_')
            
            if len(parts) < 2 or not parts[1].isdigit():
                print(f"[{idx}/{total_files}] ⚠️  Skipping {alm_file.name} (invalid filename format)")
                skipped += 1
                continue
            
            cr_number = int(parts[1])
            
            if cr_number < start_cr or cr_number > end_cr:
                print(f"[{idx}/{total_files}] ⏭️  Skipping CR {cr_number} (out of range)")
                skipped += 1
                continue
            
            output_json = output_path / f"cr{cr_number}_coronal.json"
            
            # Skip if already processed
            if output_json.exists():
                print(f"[{idx}/{total_files}] ✓ Already exists: {output_json.name}")
                processed += 1
                continue
            
            print(f"\n[{idx}/{total_files}] Processing CR {cr_number}...")
            print(f"Input:  {alm_file}")
            print(f"Output: {output_json}")
            
            # Process the file
            process_single_cr(
                alm_csv_path=str(alm_file),
                output_json_path=str(output_json),
                n_lines=n_lines,
                step_size=step_size,
                max_steps=max_steps,
                seed_dir=seed_dir
            )
            
            processed += 1
            print(f"✓ Successfully processed CR {cr_number} ({processed}/{total_files})")
            
        except Exception as e:
            print(f"❌ Failed to process {alm_file.name}: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
            continue
    
    # Summary
    print(f"\n{'='*60}")
    print(f"BATCH PROCESSING COMPLETE")
    print(f"{'='*60}")
    print(f"Total files found:      {total_files}")
    print(f"Successfully processed: {processed}")
    print(f"Skipped:                {skipped}")
    print(f"Failed:                 {failed}")
    print(f"{'='*60}\n")


# Example usage
if __name__ == "__main__":
    # ============================================================
    # SINGLE CR TEST
    # ============================================================
    process_single_cr(
        alm_csv_path="alm_values/values_2097.csv",
        output_json_path="coronal_data_lmax85/cr2097_coronal.json",
        n_lines=100,
        step_size=0.01,
        max_steps=1000,
        seed_dir="seed_data"   # folder containing seeds_xxxx.csv files
    )

    # ============================================================
    # BATCH PROCESS ALL CRs
    # ============================================================
    # batch_process_all_crs(
    #     alm_dir="alm_values",
    #     output_dir="coronal_data_lmax85",
    #     n_lines=100,
    #     step_size=0.01,
    #     max_steps=1000,
    #     start_cr=2096,
    #     end_cr=2285,
    #     seed_dir="seed_data"
    # )