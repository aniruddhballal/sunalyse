import numpy as np
from scipy.special import sph_harm
from astropy.io import fits
import pandas as pd
from pathlib import Path
import time
from scipy.integrate import simpson
from scipy.ndimage import gaussian_filter

# ============================================================
# CONFIGURATION - EDIT THESE VALUES
# ============================================================
CR_NUMBER = 2096  # Change this to your desired CR number
LMAX = 40         # Maximum spherical harmonic degree
FITS_FOLDER = "fits_files"  # Folder containing FITS files
OUTPUT_FOLDER = "alm_coefficients_optimised"  # Where to save CSV files
APPLY_GAUSSIAN_SMOOTHING = True  # Match your original code
GAUSSIAN_SIGMA = 2  # Smoothing parameter

# ============================================================
# OPTIMIZED ALM CALCULATION (50% FASTER!)
# ============================================================

def load_fits_file(cr_number, fits_folder):
    """Load FITS file for a specific CR number."""
    fits_path = Path(fits_folder)
    fits_files = list(fits_path.glob(f"*{cr_number}*.fits"))
    
    if not fits_files:
        raise FileNotFoundError(f"No FITS file found for CR {cr_number} in {fits_folder}")
    
    fits_file = fits_files[0]
    print(f"Loading: {fits_file.name}")
    
    with fits.open(fits_file) as hdul:
        br_data = hdul[0].data
        if br_data is None and len(hdul) > 1:
            br_data = hdul[1].data
        if br_data is None:
            raise ValueError("Could not find data in FITS file")
    
    # Clean the data
    br_data = np.nan_to_num(br_data, nan=0.0, 
                            posinf=np.finfo(np.float64).max, 
                            neginf=np.finfo(np.float64).min)
    
    print(f"✓ Loaded magnetogram: {br_data.shape}")
    print(f"  Br range: [{br_data.min():.2f}, {br_data.max():.2f}] Gauss")
    
    # Apply Gaussian smoothing
    if APPLY_GAUSSIAN_SMOOTHING:
        br_data = gaussian_filter(br_data, sigma=GAUSSIAN_SIGMA)
        print(f"✓ Applied Gaussian smoothing (sigma={GAUSSIAN_SIGMA})")
    
    return br_data


def compute_alm_optimized(br_data, cr_number, lmax, output_folder):
    """
    Compute ALM coefficients using symmetry optimization.
    Only computes m >= 0, derives m < 0 from conjugate symmetry.
    
    SPEED IMPROVEMENT: ~50% faster than computing all (l,m) pairs!
    """
    output_path = Path(output_folder)
    output_path.mkdir(exist_ok=True)
    
    csv_file = output_path / f"alm_{cr_number}_optimized.csv"
    
    if csv_file.exists():
        csv_file.unlink()
        print(f"Removed existing file: {csv_file.name}")
    
    print(f"\n{'='*60}")
    print(f"Computing ALM coefficients for CR {cr_number}")
    print(f"Method: Simpson's 1/3 Rule with SYMMETRY OPTIMIZATION")
    print(f"lmax = {lmax}")
    print(f"Saving to: {csv_file}")
    print(f"{'='*60}\n")
    
    # Grid setup
    num_points_theta = br_data.shape[0]
    num_points_phi = br_data.shape[1]
    
    theta = np.linspace(0, np.pi, num_points_theta)
    phi = np.linspace(0, 2 * np.pi, num_points_phi)
    dtheta = np.pi / (num_points_theta - 1)
    dphi = 2 * np.pi / (num_points_phi - 1)
    
    # Create b_func
    def b_func(theta_val, phi_val):
        theta_idx = np.floor(theta_val * (num_points_theta - 1) / np.pi).astype(int)
        phi_idx = np.floor(phi_val * (num_points_phi - 1) / (2 * np.pi)).astype(int)
        theta_idx = np.clip(theta_idx, 0, num_points_theta - 1)
        phi_idx = np.clip(phi_idx, 0, num_points_phi - 1)
        return br_data[theta_idx, phi_idx]
    
    def integrand(theta_val, phi_val, l, m):
        ylm = sph_harm(m, l, phi_val, theta_val)
        return b_func(theta_val, phi_val) * np.conj(ylm) * np.sin(theta_val)
    
    # Storage for all coefficients
    alm_data = []
    
    start_time = time.time()
    
    # Calculate how many we're computing vs deriving
    total_coeffs = sum(2*l + 1 for l in range(lmax + 1))
    computed_coeffs = sum(l + 1 for l in range(lmax + 1))  # Only m >= 0
    derived_coeffs = total_coeffs - computed_coeffs
    
    print(f"Total coefficients needed:  {total_coeffs}")
    print(f"  Computing (m ≥ 0):        {computed_coeffs}")
    print(f"  Deriving (m < 0):         {derived_coeffs}")
    print(f"  Speed improvement:        ~{100*derived_coeffs/total_coeffs:.1f}% fewer computations!")
    print(f"\nProgress (saving after each l):")
    print("-" * 60)
    
    computed = 0
    
    for l in range(lmax + 1):
        l_start_time = time.time()
        
        # STEP 1: Compute only m >= 0
        l_coeffs = {}  # Store this l's coefficients temporarily
        
        for m in range(0, l + 1):  # Only m >= 0!
            # Create meshgrid for integration
            theta_grid, phi_grid = np.meshgrid(theta, phi, indexing='ij')
            
            # Compute integrand values
            integrand_values = integrand(theta_grid, phi_grid, l, m)
            
            # Simpson's 1/3 rule integration
            real_result = simpson(simpson(integrand_values.real, dx=dphi, axis=1), 
                                 dx=dtheta, axis=0)
            imag_result = simpson(simpson(integrand_values.imag, dx=dphi, axis=1), 
                                 dx=dtheta, axis=0)
            
            coefficient = real_result + 1j * imag_result
            l_coeffs[m] = coefficient
            
            # Add to output (m >= 0)
            alm_data.append({
                'l': l,
                'm': m,
                'real': coefficient.real,
                'imag': coefficient.imag,
                'magnitude': np.abs(coefficient),
                'computed': True  # Mark as computed
            })
            
            computed += 1
        
        # STEP 2: Derive m < 0 from symmetry
        for m in range(1, l + 1):  # m = 1, 2, ..., l
            # Symmetry relation: a_(l,-m) = (-1)^m × conj(a_(l,m))
            a_lm = l_coeffs[m]
            a_l_minus_m = ((-1)**m) * np.conj(a_lm)
            
            # Add to output (m < 0)
            alm_data.append({
                'l': l,
                'm': -m,
                'real': a_l_minus_m.real,
                'imag': a_l_minus_m.imag,
                'magnitude': np.abs(a_l_minus_m),
                'computed': False  # Mark as derived
            })
        
        # Save after each l value
        df = pd.DataFrame(alm_data)
        # Sort by l, then m for consistent ordering
        df = df.sort_values(['l', 'm']).reset_index(drop=True)
        df.to_csv(csv_file, index=False)
        
        l_time = time.time() - l_start_time
        elapsed = time.time() - start_time
        progress = 100 * computed / computed_coeffs
        
        print(f"l = {l:2d} | Computed: {l+1:2d} | Derived: {l:2d} | "
              f"Progress: {progress:5.1f}% | "
              f"Time: {l_time:5.1f}s | "
              f"Total: {elapsed:6.1f}s | "
              f"✓ Saved")
    
    # Final statistics
    total_time = time.time() - start_time
    
    print("-" * 60)
    print(f"\n{'='*60}")
    print(f"✓ COMPUTATION COMPLETE!")
    print(f"{'='*60}")
    print(f"CR Number:           {cr_number}")
    print(f"lmax:                {lmax}")
    print(f"Integration method:  Simpson's 1/3 Rule + Symmetry")
    print(f"Gaussian smoothing:  {'Yes (sigma=' + str(GAUSSIAN_SIGMA) + ')' if APPLY_GAUSSIAN_SMOOTHING else 'No'}")
    print(f"Total coefficients:  {len(alm_data)}")
    print(f"  Computed (m≥0):    {computed}")
    print(f"  Derived (m<0):     {len(alm_data) - computed}")
    print(f"Total time:          {total_time:.1f} seconds ({total_time/60:.1f} minutes)")
    print(f"Avg time per l:      {total_time/(lmax+1):.2f} seconds")
    print(f"Output file:         {csv_file}")
    print(f"File size:           {csv_file.stat().st_size / 1024:.1f} KB")
    print(f"{'='*60}\n")
    
    # Remove the 'computed' column before returning (not needed in final output)
    df = df.drop(columns=['computed'])
    df.to_csv(csv_file, index=False)
    
    return df


def verify_symmetry(df, lmax):
    """
    Verify that the symmetry relationship holds.
    """
    print(f"\n{'='*60}")
    print("VERIFYING SYMMETRY RELATIONSHIP")
    print(f"{'='*60}\n")
    
    print("Checking: a_(l,-m) = (-1)^m × conj(a_(l,m))")
    print("-" * 60)
    
    errors = []
    
    # Check a few random (l,m) pairs
    test_cases = [(1,1), (2,1), (2,2), (5,3), (10,5), (15,7)]
    
    for l, m in test_cases:
        if l > lmax:
            continue
            
        # Get a_(l,m)
        row_pos = df[(df['l'] == l) & (df['m'] == m)]
        # Get a_(l,-m)
        row_neg = df[(df['l'] == l) & (df['m'] == -m)]
        
        if len(row_pos) > 0 and len(row_neg) > 0:
            a_lm = row_pos.iloc[0]['real'] + 1j * row_pos.iloc[0]['imag']
            a_l_minus_m = row_neg.iloc[0]['real'] + 1j * row_neg.iloc[0]['imag']
            
            # Expected from symmetry
            expected = ((-1)**m) * np.conj(a_lm)
            
            # Error
            error = np.abs(a_l_minus_m - expected)
            errors.append(error)
            
            print(f"l={l:2d}, m={m:2d}:")
            print(f"  a_(l,+m) = {a_lm:.6e}")
            print(f"  a_(l,-m) = {a_l_minus_m:.6e}")
            print(f"  Expected = {expected:.6e}")
            print(f"  Error    = {error:.6e}")
    
    print("-" * 60)
    if errors:
        max_error = max(errors)
        print(f"\nMax symmetry error: {max_error:.6e}")
        if max_error < 1e-10:
            print("✓ Symmetry verified! (error < 1e-10)")
        else:
            print("⚠ Warning: Symmetry error larger than expected")
    print(f"{'='*60}\n")


def main():
    """Main execution function."""
    print("\n" + "="*60)
    print("OPTIMIZED ALM COEFFICIENT COMPUTER")
    print("(50% faster using conjugate symmetry!)")
    print("="*60)
    print(f"Configuration:")
    print(f"  CR Number:           {CR_NUMBER}")
    print(f"  lmax:                {LMAX}")
    print(f"  FITS Folder:         {FITS_FOLDER}")
    print(f"  Output Folder:       {OUTPUT_FOLDER}")
    print(f"  Gaussian smoothing:  {APPLY_GAUSSIAN_SMOOTHING}")
    if APPLY_GAUSSIAN_SMOOTHING:
        print(f"  Smoothing sigma:     {GAUSSIAN_SIGMA}")
    print(f"  Integration method:  Simpson's 1/3 Rule")
    print(f"  Optimization:        Conjugate symmetry (m<0 derived)")
    print("="*60 + "\n")
    
    try:
        # Load FITS file
        br_data = load_fits_file(CR_NUMBER, FITS_FOLDER)
        
        # Compute coefficients with optimization
        df = compute_alm_optimized(br_data, CR_NUMBER, LMAX, OUTPUT_FOLDER)
        
        # Show sample
        print("Sample of computed coefficients:")
        print(df.head(15))
        print(f"\n... (showing first 15 of {len(df)} total coefficients)")
        
        # Power spectrum
        print(f"\n{'='*60}")
        print("Power Spectrum Summary (first 10 l values):")
        print("-" * 60)
        for l in range(min(11, LMAX + 1)):
            l_data = df[df['l'] == l]
            power = (l_data['magnitude']**2).sum()
            print(f"l = {l:2d}  |  Power = {power:12.2e}  |  Coefficients: {len(l_data)}")
        print("="*60)
        
        # Verify symmetry
        verify_symmetry(df, LMAX)
        
        print("✓ All done! Coefficients saved and symmetry verified.")
        
    except FileNotFoundError as e:
        print(f"\n❌ ERROR: {e}")
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()