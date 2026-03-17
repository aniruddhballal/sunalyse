import numpy as np
from scipy.special import sph_harm
from astropy.io import fits
import pandas as pd
from pathlib import Path
import time

# ============================================================
# CONFIGURATION - EDIT THESE VALUES
# ============================================================
CR_NUMBER = 2096  # Change this to your desired CR number
LMAX = 40         # Maximum spherical harmonic degree
FITS_FOLDER = "fits_files"  # Folder containing FITS files
OUTPUT_FOLDER = "alm_coefficients"  # Where to save CSV files

# ============================================================
# SIMPLE ALM COEFFICIENT COMPUTER
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
    
    # Clean the data
    br_data = np.nan_to_num(br_data, nan=0.0, posinf=0.0, neginf=0.0)
    
    print(f"✓ Loaded magnetogram: {br_data.shape}")
    print(f"  Br range: [{br_data.min():.2f}, {br_data.max():.2f}] Gauss")
    
    return br_data


def compute_and_save_alm_coefficients(br_data, cr_number, lmax, output_folder):
    """
    Compute spherical harmonic coefficients and save continuously to CSV.
    
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
    print(f"lmax = {lmax}")
    print(f"Saving to: {csv_file}")
    print(f"{'='*60}\n")
    
    # Create coordinate grids
    n_theta, n_phi = br_data.shape
    theta = np.linspace(0, np.pi, n_theta)
    phi = np.linspace(0, 2 * np.pi, n_phi)
    phi_grid, theta_grid = np.meshgrid(phi, theta)
    
    # List to collect coefficients before saving
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
            # Compute spherical harmonic
            ylm = sph_harm(m, l, phi_grid, theta_grid)
            
            # Integration with proper weighting
            integrand = br_data * np.conj(ylm) * np.sin(theta_grid)
            
            # Numerical integration
            coefficient = np.sum(integrand) * (np.pi / n_theta) * (2 * np.pi / n_phi)
            
            # Store coefficient (real and imaginary parts)
            alm_data.append({
                'l': l,
                'm': m,
                'real': coefficient.real,
                'imag': coefficient.imag,
                'magnitude': np.abs(coefficient)
            })
            
            computed += 1
        
        # Save after each l value (incremental save)
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
    print(f"Total coefficients:  {len(alm_data)}")
    print(f"Total time:          {total_time:.1f} seconds ({total_time/60:.1f} minutes)")
    print(f"Avg time per l:      {total_time/(lmax+1):.2f} seconds")
    print(f"Output file:         {csv_file}")
    print(f"File size:           {csv_file.stat().st_size / 1024:.1f} KB")
    print(f"{'='*60}\n")
    
    return df


def main():
    """
    Main execution function.
    """
    print("\n" + "="*60)
    print("SIMPLE ALM COEFFICIENT COMPUTER")
    print("="*60)
    print(f"Configuration:")
    print(f"  CR Number:      {CR_NUMBER}")
    print(f"  lmax:           {LMAX}")
    print(f"  FITS Folder:    {FITS_FOLDER}")
    print(f"  Output Folder:  {OUTPUT_FOLDER}")
    print("="*60 + "\n")
    
    try:
        # Step 1: Load FITS file
        br_data = load_fits_file(CR_NUMBER, FITS_FOLDER)
        
        # Step 2: Compute and save coefficients
        df = compute_and_save_alm_coefficients(
            br_data, 
            CR_NUMBER, 
            LMAX, 
            OUTPUT_FOLDER
        )
        
        # Step 3: Show sample of results
        print("Sample of computed coefficients:")
        print(df.head(10))
        print(f"\n... (showing first 10 of {len(df)} total coefficients)")
        
        # Step 4: Show power spectrum summary
        print(f"\n{'='*60}")
        print("Power Spectrum Summary (first 10 l values):")
        print("-" * 60)
        for l in range(min(11, LMAX + 1)):
            l_data = df[df['l'] == l]
            power = (l_data['magnitude']**2).sum()
            print(f"l = {l:2d}  |  Power = {power:12.2e}  |  Coefficients: {len(l_data)}")
        print("="*60 + "\n")
        
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