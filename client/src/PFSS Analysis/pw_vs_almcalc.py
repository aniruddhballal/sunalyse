#compares old alm values to new ones

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
LMAX = 30         # Maximum spherical harmonic degree
FITS_FOLDER = "fits_files"  # Folder containing FITS files (underscore, not space!)
OUTPUT_FOLDER = "alm_coefficients"  # Where to save CSV files
APPLY_GAUSSIAN_SMOOTHING = True  # Match your original code
GAUSSIAN_SIGMA = 2  # Smoothing parameter (same as your code)

# ============================================================
# EXACT REPLICA OF YOUR ALM CALCULATION METHOD
# ============================================================

def load_fits_file(cr_number, fits_folder):
    """
    Load FITS file for a specific CR number.
    """
    fits_path = Path(fits_folder)
    
    # Find the FITS file matching the CR number
    fits_files = list(fits_path.glob(f"*{cr_number}*.fits"))
    
    if not fits_files:
        raise FileNotFoundError(f"No FITS file found for CR {cr_number} in {fits_folder}")
    
    fits_file = fits_files[0]
    print(f"Loading: {fits_file.name}")
    
    # Load the data
    with fits.open(fits_file) as hdul:
        br_data = hdul[0].data
        if br_data is None and len(hdul) > 1:
            br_data = hdul[1].data
        if br_data is None:
            raise ValueError("Could not find data in FITS file")
    
    # Clean the data (exactly like your code)
    br_data = np.nan_to_num(br_data, nan=0.0, 
                            posinf=np.finfo(np.float64).max, 
                            neginf=np.finfo(np.float64).min)
    
    print(f"✓ Loaded magnetogram: {br_data.shape}")
    print(f"  Br range: [{br_data.min():.2f}, {br_data.max():.2f}] Gauss")
    
    # Apply Gaussian smoothing (exactly like your code)
    if APPLY_GAUSSIAN_SMOOTHING:
        br_data = gaussian_filter(br_data, sigma=GAUSSIAN_SIGMA)
        print(f"✓ Applied Gaussian smoothing (sigma={GAUSSIAN_SIGMA})")
    
    return br_data


def compute_alm_with_simpson(br_data, cr_number, lmax, output_folder):
    """
    Compute ALM coefficients using Simpson's 1/3 Rule.
    This exactly matches your original integration method.
    
    Parameters:
    -----------
    br_data : ndarray
        Magnetogram data (2D array)
    cr_number : int
        Carrington rotation number
    lmax : int
        Maximum spherical harmonic degree
    output_folder : str
        Directory to save CSV file
    """
    # Create output directory
    output_path = Path(output_folder)
    output_path.mkdir(exist_ok=True)
    
    # Output CSV filename
    csv_file = output_path / f"alm_{cr_number}.csv"
    
    # If file exists, delete it (fresh start)
    if csv_file.exists():
        csv_file.unlink()
        print(f"Removed existing file: {csv_file.name}")
    
    print(f"\n{'='*60}")
    print(f"Computing ALM coefficients for CR {cr_number}")
    print(f"Method: Simpson's 1/3 Rule (exact match to your code)")
    print(f"lmax = {lmax}")
    print(f"Saving to: {csv_file}")
    print(f"{'='*60}\n")
    
    # Grid setup (exactly like your code)
    num_points_theta = br_data.shape[0]
    num_points_phi = br_data.shape[1]
    
    theta = np.linspace(0, np.pi, num_points_theta)
    phi = np.linspace(0, 2 * np.pi, num_points_phi)
    dtheta = np.pi / (num_points_theta - 1)
    dphi = 2 * np.pi / (num_points_phi - 1)
    
    # Create b_func exactly like your code (with floor indexing)
    def b_func(theta_val, phi_val):
        """Interpolation function matching your original code."""
        theta_idx = np.floor(theta_val * (num_points_theta - 1) / np.pi).astype(int)
        phi_idx = np.floor(phi_val * (num_points_phi - 1) / (2 * np.pi)).astype(int)
        
        # Handle boundary cases
        theta_idx = np.clip(theta_idx, 0, num_points_theta - 1)
        phi_idx = np.clip(phi_idx, 0, num_points_phi - 1)
        
        return br_data[theta_idx, phi_idx]
    
    # Integrand function (exactly like your code)
    def integrand(theta_val, phi_val, l, m):
        """Compute integrand: B(θ,φ) × Y*_lm(θ,φ) × sin(θ)"""
        ylm = sph_harm(m, l, phi_val, theta_val)
        return b_func(theta_val, phi_val) * np.conj(ylm) * np.sin(theta_val)
    
    # List to collect coefficients
    alm_data = []
    
    start_time = time.time()
    
    # Compute coefficients
    total_coeffs = sum(2*l + 1 for l in range(lmax + 1))
    computed = 0
    
    print(f"Total coefficients to compute: {total_coeffs}")
    print(f"Progress (saving after each l):")
    print("-" * 60)
    
    for l in range(lmax + 1):
        l_start_time = time.time()
        
        for m in range(-l, l + 1):
            # Create meshgrid for integration
            theta_grid, phi_grid = np.meshgrid(theta, phi, indexing='ij')
            
            # Compute integrand values
            integrand_values = integrand(theta_grid, phi_grid, l, m)
            
            # Simpson's 1/3 rule integration (EXACTLY like your code)
            real_result = simpson(simpson(integrand_values.real, dx=dphi, axis=1), 
                                 dx=dtheta, axis=0)
            imag_result = simpson(simpson(integrand_values.imag, dx=dphi, axis=1), 
                                 dx=dtheta, axis=0)
            
            coefficient = real_result + 1j * imag_result
            
            # Store coefficient
            alm_data.append({
                'l': l,
                'm': m,
                'real': coefficient.real,
                'imag': coefficient.imag,
                'magnitude': np.abs(coefficient)
            })
            
            computed += 1
        
        # Save after each l value
        df = pd.DataFrame(alm_data)
        df.to_csv(csv_file, index=False)
        
        l_time = time.time() - l_start_time
        elapsed = time.time() - start_time
        progress = 100 * computed / total_coeffs
        
        print(f"l = {l:2d} | Coeffs: {2*l+1:3d} | "
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
    print(f"Integration method:  Simpson's 1/3 Rule")
    print(f"Gaussian smoothing:  {'Yes (sigma=' + str(GAUSSIAN_SIGMA) + ')' if APPLY_GAUSSIAN_SMOOTHING else 'No'}")
    print(f"Total coefficients:  {len(alm_data)}")
    print(f"Total time:          {total_time:.1f} seconds ({total_time/60:.1f} minutes)")
    print(f"Avg time per l:      {total_time/(lmax+1):.2f} seconds")
    print(f"Output file:         {csv_file}")
    print(f"File size:           {csv_file.stat().st_size / 1024:.1f} KB")
    print(f"{'='*60}\n")
    
    return df


def compare_with_existing(cr_number, output_folder):
    """
    Compare newly computed coefficients with existing ones.
    """
    csv_file = Path(output_folder) / f"alm_{cr_number}.csv"
    
    # Check if there's an existing alm values file from your original code
    old_file = Path("alm values") / f"values_{cr_number}.csv"
    
    if not old_file.exists():
        print(f"\nNo existing alm file found at: {old_file}")
        print("Skipping comparison.")
        return
    
    print(f"\n{'='*60}")
    print("COMPARING WITH YOUR ORIGINAL ALM VALUES")
    print(f"{'='*60}")
    
    # Load both files
    new_df = pd.read_csv(csv_file)
    
    # Read old format (your CSV has 'alm' column as complex string)
    old_alm = {}
    with open(old_file, 'r') as f:
        import csv
        reader = csv.DictReader(f)
        for row in reader:
            l = int(row['l'])
            m = int(row['m'])
            # Parse complex number from string
            alm_str = row['alm'].strip('()')
            if 'j' in alm_str or '+' in alm_str or '-' in alm_str[1:]:
                old_alm[(l, m)] = complex(alm_str)
            else:
                old_alm[(l, m)] = float(alm_str)
    
    # Compare first few coefficients
    print("\nSample comparison (first 10 coefficients):")
    print("-" * 60)
    print(f"{'l':>3} {'m':>3} | {'Your Original':>15} | {'New (Simpson)':>15} | {'Diff %':>10}")
    print("-" * 60)
    
    for i in range(min(10, len(new_df))):
        row = new_df.iloc[i]
        l, m = int(row['l']), int(row['m'])
        new_val = row['magnitude']
        
        if (l, m) in old_alm:
            old_val = abs(old_alm[(l, m)])
            diff_pct = 100 * abs(new_val - old_val) / old_val if old_val != 0 else 0
            print(f"{l:3d} {m:3d} | {old_val:15.6e} | {new_val:15.6e} | {diff_pct:9.2f}%")
    
    # Overall statistics
    all_diffs = []
    for i, row in new_df.iterrows():
        l, m = int(row['l']), int(row['m'])
        new_val = row['magnitude']
        if (l, m) in old_alm:
            old_val = abs(old_alm[(l, m)])
            if old_val != 0:
                diff_pct = 100 * abs(new_val - old_val) / old_val
                all_diffs.append(diff_pct)
    
    if all_diffs:
        print("-" * 60)
        print(f"\nOverall difference statistics:")
        print(f"  Mean difference:   {np.mean(all_diffs):6.2f}%")
        print(f"  Median difference: {np.median(all_diffs):6.2f}%")
        print(f"  Max difference:    {np.max(all_diffs):6.2f}%")
        print(f"  Min difference:    {np.min(all_diffs):6.2f}%")
        
        if np.mean(all_diffs) < 1.0:
            print("\n✓ Excellent match! Differences < 1%")
        elif np.mean(all_diffs) < 5.0:
            print("\n✓ Good match! Differences < 5%")
        elif np.mean(all_diffs) < 10.0:
            print("\n⚠ Moderate differences (5-10%)")
        else:
            print("\n⚠ Large differences detected (>10%)")
            print("   This suggests different integration methods or data preprocessing")
    
    print(f"{'='*60}\n")


def main():
    """
    Main execution function.
    """
    print("\n" + "="*60)
    print("ALM COEFFICIENT COMPUTER")
    print("(Exact replica of your Simpson's 1/3 Rule method)")
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
    print("="*60 + "\n")
    
    try:
        # Step 1: Load FITS file
        br_data = load_fits_file(CR_NUMBER, FITS_FOLDER)
        
        # Step 2: Compute coefficients using Simpson's rule
        df = compute_alm_with_simpson(
            br_data, 
            CR_NUMBER, 
            LMAX, 
            OUTPUT_FOLDER
        )
        
        # Step 3: Show sample of results
        print("Sample of computed coefficients:")
        print(df.head(10))
        print(f"\n... (showing first 10 of {len(df)} total coefficients)")
        
        # Step 4: Power spectrum summary
        print(f"\n{'='*60}")
        print("Power Spectrum Summary (first 10 l values):")
        print("-" * 60)
        for l in range(min(11, LMAX + 1)):
            l_data = df[df['l'] == l]
            power = (l_data['magnitude']**2).sum()
            print(f"l = {l:2d}  |  Power = {power:12.2e}  |  Coefficients: {len(l_data)}")
        print("="*60 + "\n")
        
        # Step 5: Compare with your existing values (if available)
        compare_with_existing(CR_NUMBER, OUTPUT_FOLDER)
        
        print("✓ All done! Your coefficients are saved and ready to use.")
        
    except FileNotFoundError as e:
        print(f"\n❌ ERROR: {e}")
        print(f"\nMake sure:")
        print(f"  1. The '{FITS_FOLDER}' folder exists")
        print(f"  2. It contains a FITS file with '{CR_NUMBER}' in the name")
        print(f"  3. The file format is: hmi.Synoptic_Mr_small.{CR_NUMBER}.fits (or similar)")
        
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()