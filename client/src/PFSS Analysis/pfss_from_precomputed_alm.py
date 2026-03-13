import numpy as np
from scipy.special import sph_harm
import json
import pandas as pd
from pathlib import Path

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
    
    def compute_field_at_point(self, r, theta, phi):
        """
        Compute magnetic field vector B(r, theta, phi) using PFSS model.

        Previously only Br was computed (Btheta and Bphi were hardcoded to 0),
        which caused all field lines to go straight radially outward with no
        curvature. All three components are now computed correctly.

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
        
        Br = 0.0 + 0j
        Btheta = 0.0 + 0j
        Bphi = 0.0 + 0j

        eps = 1e-5  # step size for central finite difference on dY/dtheta

        # Clamp sin(theta) away from zero to avoid division by zero near poles
        sin_theta = np.sin(theta)
        if abs(sin_theta) < 1e-10:
            sin_theta = 1e-10
        
        for l in range(1, self.lmax + 1):  # l=0 doesn't contribute to B
            # Precompute radial factors for this l (shared across all m)
            rs = self.r_source
            denom = 1.0 - rs ** (2 * l + 1)

            # dR_l/dr — used for Br
            dR_dr = (l * r ** (l - 1) + (l + 1) * rs ** (2 * l + 1) / r ** (l + 2)) / denom

            # R_l(r) / r — used for Btheta and Bphi
            R_over_r = (r ** l - rs ** (2 * l + 1) / r ** (l + 1)) / (denom * r)

            for m in range(-l, l + 1):
                g_lm = self.alm.get((l, m), 0.0)
                if g_lm == 0.0:
                    continue

                ylm = sph_harm(m, l, phi, theta)

                # --- Br = -dΦ/dr ---
                Br += g_lm * dR_dr * ylm

                # --- Btheta = -(1/r) dΦ/dtheta ---
                # Central finite difference for dY_lm/dtheta
                theta_p = min(theta + eps, np.pi - eps)
                theta_m = max(theta - eps, eps)
                dYlm_dtheta = (sph_harm(m, l, phi, theta_p) - sph_harm(m, l, phi, theta_m)) / (theta_p - theta_m)
                Btheta += g_lm * R_over_r * dYlm_dtheta

                # --- Bphi = -(1/(r sinθ)) dΦ/dphi ---
                # Analytic derivative: dY_lm/dphi = i*m * Y_lm
                dYlm_dphi = 1j * m * ylm
                Bphi += g_lm * R_over_r * dYlm_dphi / sin_theta

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
    
    def generate_field_lines(self, n_lines=100, step_size=0.01, max_steps=1000):
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
        field_lines = []
        
        print(f"Tracing {n_lines} field lines (step_size={step_size}, max_steps={max_steps})...")
        
        # Create starting points distributed across photosphere
        n_theta = int(np.sqrt(n_lines))
        n_phi = int(n_lines / n_theta)
        
        theta_starts = np.linspace(0.1, np.pi - 0.1, n_theta)
        phi_starts = np.linspace(0, 2 * np.pi, n_phi, endpoint=False)
        
        count = 0
        for theta_start in theta_starts:
            for phi_start in phi_starts:
                r_start = 1.0  # Start at photosphere
                
                # Trace in both directions
                points_forward, strengths_forward = self.trace_field_line(
                    r_start, theta_start, phi_start, direction=1,
                    step_size=step_size, max_steps=max_steps
                )
                points_backward, strengths_backward = self.trace_field_line(
                    r_start, theta_start, phi_start, direction=-1,
                    step_size=step_size, max_steps=max_steps
                )
                
                # Combine (backward reversed + forward)
                points = points_backward[::-1] + points_forward[1:]
                strengths = strengths_backward[::-1] + strengths_forward[1:]
                
                # Open = reached source surface; closed = returned to photosphere
                r_end = points[-1][0] if len(points) > 0 else r_start
                polarity = 'open' if r_end > self.r_source - 0.1 else 'closed'
                
                field_lines.append({
                    'points': points,
                    'strengths': strengths,
                    'polarity': polarity
                })
                
                count += 1
                if count % 50 == 0:
                    print(f"  Traced {count}/{n_lines} field lines")

        open_count = sum(1 for fl in field_lines if fl['polarity'] == 'open')
        closed_count = len(field_lines) - open_count
        print(f"✓ Traced {len(field_lines)} field lines "
              f"({open_count} open, {closed_count} closed)")
        
        return field_lines
    
    def spherical_to_cartesian(self, r, theta, phi):
        """Convert spherical to Cartesian coordinates."""
        x = r * np.sin(theta) * np.cos(phi)
        y = r * np.sin(theta) * np.sin(phi)
        z = r * np.cos(theta)
        return [x, y, z]
    
    def export_for_visualization(self, field_lines, output_path):
        """
        Export field lines in format suitable for Three.js visualization.
        
        Parameters:
        -----------
        field_lines : list
            Field line data from generate_field_lines()
        output_path : str
            Path to save JSON file
        """
        export_data = {
            'metadata': {
                'lmax': self.lmax,
                'r_source': self.r_source,
                'n_field_lines': len(field_lines)
            },
            'fieldLines': []
        }
        
        for fl in field_lines:
            # Convert to Cartesian coordinates for Three.js
            points_cartesian = [
                self.spherical_to_cartesian(r, theta, phi)
                for r, theta, phi in fl['points']
            ]
            
            export_data['fieldLines'].append({
                'points': points_cartesian,
                'strengths': fl['strengths'],
                'polarity': fl['polarity']
            })
        
        with open(output_path, 'w') as f:
            json.dump(export_data, f)
        
        print(f"✓ Exported to {output_path}")
        print(f"  File size: {Path(output_path).stat().st_size / 1024:.1f} KB")


def process_single_cr(alm_csv_path, output_json_path, n_lines=100, step_size=0.01, max_steps=1000):
    """
    Process a single Carrington rotation using precomputed alm coefficients.
    
    Parameters:
    -----------
    alm_csv_path : str
        Path to CSV file with precomputed alm values
    output_json_path : str
        Path for output JSON file
    n_lines : int
        Number of field lines to trace (100-500 recommended)
    step_size : float
        Integration step size — smaller = smoother, longer traces (default 0.01)
    max_steps : int
        Maximum steps per field line (default 1000)
    """
    import time

    print(f"\n{chr(61)*60}")
    print(f"Processing: {alm_csv_path}")
    print(f"{chr(61)*60}\n")

    total_start = time.time()

    # Initialize PFSS with high lmax (will be updated from CSV)
    pfss = PFSSExtrapolationFromALM(lmax=85, r_source=2.5)

    # Load precomputed alm coefficients
    t0 = time.time()
    pfss.alm = pfss.load_alm_from_csv(alm_csv_path)
    print(f"  Load time:    {time.time() - t0:.1f}s")

    # Generate field lines
    t0 = time.time()
    field_lines = pfss.generate_field_lines(n_lines=n_lines, step_size=step_size, max_steps=max_steps)
    tracing_time = time.time() - t0
    print(f"  Tracing time: {tracing_time:.1f}s  ({tracing_time/n_lines:.2f}s per line)")

    # Export for visualization
    t0 = time.time()
    pfss.export_for_visualization(field_lines, output_json_path)
    print(f"  Export time:  {time.time() - t0:.1f}s")

    total_time = time.time() - total_start
    print(f"\n{chr(61)*60}")
    print(f"✓ Processing complete!  Total: {total_time:.1f}s ({total_time/60:.1f} min)")
    print(f"{chr(61)*60}\n")


def batch_process_all_crs(alm_dir="alm values", output_dir="coronal_data_lmax85", 
                          n_lines=100, step_size=0.01, max_steps=1000,
                          start_cr=2096, end_cr=2285):
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
                max_steps=max_steps
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
    # BATCH PROCESS ALL CARRINGTON ROTATIONS (CR 2096-2285)
    # Using precomputed alm coefficients (lmax=85)
    # ============================================================
    # batch_process_all_crs(
    #     alm_dir="alm values",              # Folder with values_xxxx.csv files
    #     output_dir="coronal_data_lmax85",  # Where to save JSON files
    #     n_lines=100,                       # Number of field lines (100-500)
    #     step_size=0.01,                    # Integration step size (smaller = smoother)
    #     max_steps=1000,                    # Max steps per line (increase with smaller step_size)
    #     start_cr=2096,                     # Starting Carrington rotation
    #     end_cr=2285                        # Ending Carrington rotation
    # )
    
    # ============================================================
    # OR PROCESS SINGLE CARRINGTON ROTATION
    # ============================================================
    process_single_cr(
        alm_csv_path="alm_values/values_2097.csv",
        output_json_path="coronal_data_lmax85/cr2097_coronal.json",
        n_lines=200,
        step_size=0.005,
        max_steps=2000
    )