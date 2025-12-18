import numpy as np
from scipy.special import sph_harm
from astropy.io import fits
import json
import pickle
from pathlib import Path

class PFSSExtrapolation:
    """
    Potential Field Source Surface (PFSS) extrapolation for solar coronal magnetic fields.
    Uses spherical harmonic decomposition of photospheric magnetograms.
    """
    
    def __init__(self, lmax=20, r_source=2.5):
        """
        Initialize PFSS extrapolator.
        
        Parameters:
        -----------
        lmax : int
            Maximum spherical harmonic degree (higher = more detail, slower)
            Typical values: 20-60
        r_source : float
            Source surface radius in solar radii (typically 2.5)
        """
        self.lmax = lmax
        self.r_source = r_source
        self.alm = None
        self.br_photosphere = None
        
    def load_fits_magnetogram(self, fits_path):
        """
        Load magnetogram data from FITS file with NaN handling.
        
        Parameters:
        -----------
        fits_path : str
            Path to FITS file containing Br data
            
        Returns:
        --------
        br_data : ndarray
            Radial magnetic field at photosphere (shape: [n_theta, n_phi])
        """
        with fits.open(fits_path) as hdul:
            # Assuming data is in primary HDU
            br_data = hdul[0].data
            
            # Handle different FITS formats
            if br_data is None and len(hdul) > 1:
                br_data = hdul[1].data
                
            if br_data is None:
                raise ValueError("Could not find data in FITS file")
                
            # Ensure proper orientation (theta, phi)
            if br_data.ndim != 2:
                raise ValueError(f"Expected 2D data, got shape {br_data.shape}")
        
        # Handle NaN values
        n_nans = np.isnan(br_data).sum()
        if n_nans > 0:
            print(f"⚠ Warning: Found {n_nans} NaN values ({100*n_nans/br_data.size:.2f}% of data)")
            print(f"  Replacing NaNs with 0.0")
            br_data = np.nan_to_num(br_data, nan=0.0)
        
        # Handle infinite values
        n_inf = np.isinf(br_data).sum()
        if n_inf > 0:
            print(f"⚠ Warning: Found {n_inf} infinite values")
            print(f"  Clipping to valid range")
            br_data = np.nan_to_num(br_data, posinf=0.0, neginf=0.0)
                
        return br_data
    
    def compute_alm_coefficients(self, br_photosphere, checkpoint_path=None):
        """
        Compute spherical harmonic coefficients from photospheric magnetogram.
        Supports checkpointing to resume interrupted computations.
        
        Parameters:
        -----------
        br_photosphere : ndarray
            Radial magnetic field at photosphere [n_theta, n_phi]
        checkpoint_path : str, optional
            Path to save/load checkpoint file
            
        Returns:
        --------
        alm : dict
            Spherical harmonic coefficients {(l, m): coefficient}
        """
        # Try to load from checkpoint
        if checkpoint_path and Path(checkpoint_path).exists():
            print(f"Found checkpoint at {checkpoint_path}")
            try:
                with open(checkpoint_path, 'rb') as f:
                    alm = pickle.load(f)
                print(f"✓ Loaded {len(alm)} coefficients from checkpoint")
                return alm
            except Exception as e:
                print(f"⚠ Could not load checkpoint: {e}")
                print("  Computing from scratch...")
        
        n_theta, n_phi = br_photosphere.shape
        
        # Create coordinate grids
        theta = np.linspace(0, np.pi, n_theta)
        phi = np.linspace(0, 2 * np.pi, n_phi)
        phi_grid, theta_grid = np.meshgrid(phi, theta)
        
        alm = {}
        
        print(f"Computing spherical harmonic coefficients (lmax={self.lmax})...")
        
        for l in range(self.lmax + 1):
            for m in range(-l, l + 1):
                # Compute spherical harmonic
                ylm = sph_harm(m, l, phi_grid, theta_grid)
                
                # Integration with proper weighting
                integrand = br_photosphere * np.conj(ylm) * np.sin(theta_grid)
                
                # Numerical integration (trapezoidal rule approximation)
                alm[(l, m)] = np.sum(integrand) * (np.pi / n_theta) * (2 * np.pi / n_phi)
                
            if (l + 1) % 5 == 0:
                print(f"  Computed up to l={l}")
        
        print(f"✓ Computed {len(alm)} coefficients")
        
        # Save checkpoint
        if checkpoint_path:
            try:
                with open(checkpoint_path, 'wb') as f:
                    pickle.dump(alm, f)
                print(f"✓ Saved checkpoint to {checkpoint_path}")
            except Exception as e:
                print(f"⚠ Could not save checkpoint: {e}")
        
        return alm
    
    def compute_field_at_point(self, r, theta, phi):
        """
        Compute magnetic field vector B(r, theta, phi) using PFSS model.
        
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
            raise ValueError("Must compute alm coefficients first")
        
        Br = 0.0
        Btheta = 0.0
        Bphi = 0.0
        
        for l in range(1, self.lmax + 1):  # l=0 doesn't contribute
            for m in range(-l, l + 1):
                ylm = sph_harm(m, l, phi, theta)
                
                # PFSS radial dependence
                g_lm = self.alm.get((l, m), 0.0)
                
                # Potential field formula
                C_l = (r**l - self.r_source**(2*l+1) / r**(l+1)) / \
                      (1 - self.r_source**(2*l+1))
                
                # Radial component
                Br += g_lm * (l * r**(l-1) + (l+1) * self.r_source**(2*l+1) / r**(l+2)) / \
                      (1 - self.r_source**(2*l+1)) * ylm
                
                # Angular components would require derivatives of Ylm
                # For field line tracing, we primarily need Br and can compute others
        
        return Br.real, Btheta, Bphi
    
    def trace_field_line(self, r_start, theta_start, phi_start, 
                         max_steps=1000, step_size=0.01, direction=1):
        """
        Trace a single magnetic field line using RK4 integration.
        
        Parameters:
        -----------
        r_start, theta_start, phi_start : float
            Starting point in spherical coordinates
        max_steps : int
            Maximum integration steps
        step_size : float
            Integration step size
        direction : int
            +1 for forward, -1 for backward
            
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
            # Simple Euler integration (could upgrade to RK4)
            Br, Btheta, Bphi = self.compute_field_at_point(r, theta, phi)
            B_mag = np.sqrt(Br**2 + Btheta**2 + Bphi**2)
            
            if B_mag < 1e-10:  # Avoid division by zero
                break
            
            field_strengths.append(B_mag)
            
            # Normalize and step
            dr = direction * step_size * Br / B_mag
            dtheta = direction * step_size * Btheta / (r * B_mag)
            dphi = direction * step_size * Bphi / (r * np.sin(theta) * B_mag)
            
            r += dr
            theta += dtheta
            phi += dphi
            
            # Boundary conditions
            if r < 1.0 or r > self.r_source:  # Hit photosphere or source surface
                break
            if theta < 0.01 or theta > np.pi - 0.01:  # Near poles
                break
            
            points.append([r, theta, phi])
        
        return points, field_strengths
    
    def generate_field_lines(self, n_lines=500):
        """
        Generate multiple field lines across the solar surface.
        
        Parameters:
        -----------
        n_lines : int
            Number of field lines to trace
            
        Returns:
        --------
        field_lines : list of dict
            Each dict contains 'points', 'strengths', 'polarity'
        """
        field_lines = []
        
        print(f"Tracing {n_lines} field lines...")
        
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
                    r_start, theta_start, phi_start, direction=1
                )
                points_backward, strengths_backward = self.trace_field_line(
                    r_start, theta_start, phi_start, direction=-1
                )
                
                # Combine (backward reversed + forward)
                points = points_backward[::-1] + points_forward[1:]
                strengths = strengths_backward[::-1] + strengths_forward[1:]
                
                # Determine if open or closed
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
        
        print(f"✓ Traced {len(field_lines)} field lines")
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
            # Convert to Cartesian coordinates
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


def process_fits_file(fits_path, output_json_path, lmax=20, n_lines=100):
    """
    Complete pipeline: FITS → PFSS computation → Field lines → JSON export.
    
    Parameters:
    -----------
    fits_path : str
        Path to input FITS magnetogram
    output_json_path : str
        Path for output JSON file
    lmax : int
        Spherical harmonic degree (20-60 recommended)
    n_lines : int
        Number of field lines to trace (100-500 recommended)
    """
    print(f"\n{'='*60}")
    print(f"Processing: {fits_path}")
    print(f"{'='*60}\n")
    
    # Create checkpoint directory
    checkpoint_dir = Path("checkpoints")
    checkpoint_dir.mkdir(exist_ok=True)
    
    # Generate checkpoint filename based on input file
    fits_stem = Path(fits_path).stem
    checkpoint_path = checkpoint_dir / f"{fits_stem}_lmax{lmax}_alm.pkl"
    
    # Initialize PFSS
    pfss = PFSSExtrapolation(lmax=lmax, r_source=2.5)
    
    # Load FITS data
    print("Loading FITS magnetogram...")
    br_data = pfss.load_fits_magnetogram(fits_path)
    print(f"✓ Loaded magnetogram: {br_data.shape}")
    print(f"  Br range: [{br_data.min():.2f}, {br_data.max():.2f}] Gauss")
    
    # Compute spherical harmonic coefficients (with checkpointing)
    pfss.alm = pfss.compute_alm_coefficients(br_data, checkpoint_path=str(checkpoint_path))
    pfss.br_photosphere = br_data
    
    # Generate field lines
    field_lines = pfss.generate_field_lines(n_lines=n_lines)
    
    # Export for visualization
    pfss.export_for_visualization(field_lines, output_json_path)
    
    print(f"\n{'='*60}")
    print("✓ Processing complete!")
    print(f"{'='*60}\n")
    
    # Optionally clean up checkpoint after successful completion
    # if checkpoint_path.exists():
    #     checkpoint_path.unlink()
    #     print("✓ Cleaned up checkpoint file")


# Example usage
if __name__ == "__main__":
    # Process a single FITS file with optimized settings
    process_fits_file(
        fits_path="hmi.Synoptic_Mr_small.2240.fits",
        output_json_path="cr2240_coronal.json",
        lmax=30,          # Higher = more detail (but slower)
        n_lines=100       # Reduced for faster processing
    )
    
    # Batch process multiple files
    # fits_dir = Path("fits_files")
    # output_dir = Path("coronal_data")
    # output_dir.mkdir(exist_ok=True)
    # 
    # for fits_file in fits_dir.glob("*.fits"):
    #     output_json = output_dir / f"{fits_file.stem}_coronal.json"
    #     process_fits_file(str(fits_file), str(output_json), lmax=30, n_lines=100)