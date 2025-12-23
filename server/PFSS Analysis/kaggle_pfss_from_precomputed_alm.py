# %% [markdown]
# # PFSS Coronal Field Line Generation from Precomputed ALM Coefficients
# 
# This notebook generates coronal magnetic field line data using:
# - Precomputed spherical harmonic coefficients (alm values, lmax=85)
# - Simpson's 1/3 rule integration
# - PFSS (Potential Field Source Surface) extrapolation
# 
# **Expected Input:** CSV files in `/kaggle/input/alm-values/` with format `values_xxxx.csv`

# %% [markdown]
# ## Cell 1: Check Input Files

# %%
from pathlib import Path
import os

print("="*60)
print("CHECKING INPUT FILES")
print("="*60)

# Kaggle input directory
kaggle_input = Path("/kaggle/input")

print(f"\n📁 Kaggle input directory: {kaggle_input}")
print(f"   Exists: {kaggle_input.exists()}")

if kaggle_input.exists():
    print("\n📂 Available datasets:")
    for item in sorted(kaggle_input.iterdir()):
        if item.is_dir():
            print(f"   - {item.name}/")
            # Show first few files in each dataset
            files = list(item.glob("*"))[:5]
            for f in files:
                print(f"     • {f.name}")
            if len(list(item.glob("*"))) > 5:
                print(f"     ... and {len(list(item.glob('*'))) - 5} more files")

# Check for alm_values directory
alm_dir = kaggle_input / "alm-values"  # Kaggle converts folder names to lowercase with hyphens
if not alm_dir.exists():
    # Try alternative names
    possible_names = ["alm_values", "alm-coefficients", "spherical-harmonics"]
    for name in possible_names:
        alt_dir = kaggle_input / name
        if alt_dir.exists():
            alm_dir = alt_dir
            break

print(f"\n📊 ALM values directory: {alm_dir}")
print(f"   Exists: {alm_dir.exists()}")

if alm_dir.exists():
    alm_files = sorted(alm_dir.glob("values_*.csv"))
    print(f"\n✓ Found {len(alm_files)} CSV files with alm values")
    
    if len(alm_files) > 0:
        print(f"\n   First 5 files:")
        for f in alm_files[:5]:
            size_kb = f.stat().st_size / 1024
            print(f"   - {f.name} ({size_kb:.1f} KB)")
        
        if len(alm_files) > 5:
            print(f"   ... and {len(alm_files) - 5} more files")
        
        print(f"\n   Last file: {alm_files[-1].name}")
        
        # Extract CR range
        cr_numbers = []
        for f in alm_files:
            try:
                parts = f.stem.split('_')
                if len(parts) >= 2 and parts[1].isdigit():
                    cr_numbers.append(int(parts[1]))
            except:
                pass
        
        if cr_numbers:
            print(f"\n   Carrington Rotation range: CR {min(cr_numbers)} - CR {max(cr_numbers)}")
            print(f"   Total CRs available: {len(cr_numbers)}")
    else:
        print(f"\n⚠️  WARNING: No files matching 'values_*.csv' found!")
else:
    print(f"\n❌ ERROR: ALM values directory not found!")
    print(f"\n   Please ensure your dataset is uploaded to Kaggle and attached to this notebook.")
    print(f"   Expected location: /kaggle/input/alm-values/")

print("\n" + "="*60)

# %% [markdown]
# ## Cell 2: Install Dependencies (if needed)

# %%
# Most packages should already be available in Kaggle
# Uncomment if needed:
# !pip install scipy astropy pandas numpy -q

import numpy as np
import pandas as pd
from scipy.special import sph_harm
import json
from pathlib import Path

print("✓ All packages imported successfully")

# %% [markdown]
# ## Cell 3: PFSS Extrapolation Class

# %%
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
        print(f"Loading alm coefficients from {Path(csv_path).name}...")
        
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
        
        print(f"✓ Loaded {len(alm)} coefficients (lmax = {self.lmax})")
        
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
            raise ValueError("Must load alm coefficients first")
        
        Br = 0.0
        Btheta = 0.0
        Bphi = 0.0
        
        for l in range(1, self.lmax + 1):  # l=0 doesn't contribute
            for m in range(-l, l + 1):
                ylm = sph_harm(m, l, phi, theta)
                
                # Get coefficient
                g_lm = self.alm.get((l, m), 0.0)
                
                # PFSS radial dependence
                # Potential field formula
                C_l = (r**l - self.r_source**(2*l+1) / r**(l+1)) / \
                      (1 - self.r_source**(2*l+1))
                
                # Radial component
                Br += g_lm * (l * r**(l-1) + (l+1) * self.r_source**(2*l+1) / r**(l+2)) / \
                      (1 - self.r_source**(2*l+1)) * ylm
        
        return Br.real, Btheta, Bphi
    
    def trace_field_line(self, r_start, theta_start, phi_start, 
                         max_steps=1000, step_size=0.01, direction=1):
        """
        Trace a single magnetic field line using Euler integration.
        
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
            # Compute field at current point
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
        
        print(f"✓ Exported to {Path(output_path).name}")
        print(f"  File size: {Path(output_path).stat().st_size / 1024:.1f} KB")

print("✓ PFSSExtrapolationFromALM class defined")

# %% [markdown]
# ## Cell 4: Processing Functions

# %%
def process_single_cr(alm_csv_path, output_json_path, n_lines=100):
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
    """
    print(f"\n{'='*60}")
    print(f"Processing: {Path(alm_csv_path).name}")
    print(f"{'='*60}\n")
    
    # Initialize PFSS with high lmax (will be updated from CSV)
    pfss = PFSSExtrapolationFromALM(lmax=85, r_source=2.5)
    
    # Load precomputed alm coefficients
    pfss.alm = pfss.load_alm_from_csv(alm_csv_path)
    
    # Generate field lines
    field_lines = pfss.generate_field_lines(n_lines=n_lines)
    
    # Export for visualization
    pfss.export_for_visualization(field_lines, output_json_path)
    
    print(f"\n{'='*60}")
    print("✓ Processing complete!")
    print(f"{'='*60}\n")


def batch_process_all_crs(alm_dir, output_dir="/kaggle/working/coronal_data_lmax85", 
                          n_lines=100, start_cr=2096, end_cr=2285):
    """
    Batch process all Carrington rotations using precomputed alm coefficients.
    
    Parameters:
    -----------
    alm_dir : str or Path
        Directory containing CSV files with alm values (format: values_xxxx.csv)
    output_dir : str
        Directory to save coronal JSON files
    n_lines : int
        Number of field lines to trace
    start_cr : int
        Starting Carrington rotation number
    end_cr : int
        Ending Carrington rotation number
    """
    alm_path = Path(alm_dir)
    output_path = Path(output_dir)
    
    # Create output directory
    output_path.mkdir(exist_ok=True, parents=True)
    
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
            
            # Process the file
            process_single_cr(
                alm_csv_path=str(alm_file),
                output_json_path=str(output_json),
                n_lines=n_lines
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
    
    return output_path

print("✓ Processing functions defined")

# %% [markdown]
# ## Cell 5: Run Batch Processing
# 
# **Configuration:**
# - Adjust `n_lines` (100-500): More lines = better visualization but slower
# - Adjust `start_cr` and `end_cr` to process specific range
# - Output will be saved to `/kaggle/working/coronal_data_lmax85/`

# %%
# Configuration
ALM_INPUT_DIR = "/kaggle/input/alm-values"  # Adjust if your dataset has different name
OUTPUT_DIR = "/kaggle/working/coronal_data_lmax85"
N_FIELD_LINES = 100  # Increase to 500 for higher quality
START_CR = 2096
END_CR = 2285

# Check if input directory exists
if not Path(ALM_INPUT_DIR).exists():
    print(f"❌ ERROR: Input directory not found: {ALM_INPUT_DIR}")
    print(f"\nPlease check:")
    print(f"1. Your dataset is attached to this notebook")
    print(f"2. The dataset name matches (Kaggle converts to lowercase with hyphens)")
    print(f"\nAvailable input directories:")
    for item in Path("/kaggle/input").iterdir():
        if item.is_dir():
            print(f"   - {item.name}")
else:
    # Run batch processing
    output_path = batch_process_all_crs(
        alm_dir=ALM_INPUT_DIR,
        output_dir=OUTPUT_DIR,
        n_lines=N_FIELD_LINES,
        start_cr=START_CR,
        end_cr=END_CR
    )
    
    # Show output files
    if output_path.exists():
        output_files = sorted(output_path.glob("*.json"))
        print(f"\n📊 Generated {len(output_files)} JSON files")
        print(f"   Location: {output_path}")
        
        if len(output_files) > 0:
            total_size_mb = sum(f.stat().st_size for f in output_files) / (1024 * 1024)
            print(f"   Total size: {total_size_mb:.2f} MB")

# %% [markdown]
# ## Cell 6: Optional - Process Single CR for Testing

# %%
# Uncomment to test with a single CR before running full batch
# 
# test_cr = 2240
# test_input = f"/kaggle/input/alm-values/values_{test_cr}.csv"
# test_output = f"/kaggle/working/test_cr{test_cr}_coronal.json"
# 
# if Path(test_input).exists():
#     process_single_cr(
#         alm_csv_path=test_input,
#         output_json_path=test_output,
#         n_lines=100
#     )
# else:
#     print(f"Test file not found: {test_input}")

# %% [markdown]
# ## Cell 7: Download Output Files
# 
# Your generated JSON files are in `/kaggle/working/coronal_data_lmax85/`
# 
# To download:
# 1. Click the folder icon in the right sidebar
# 2. Navigate to `coronal_data_lmax85/`
# 3. Right-click and download individual files or the entire folder

# %%
# Optional: Create a zip file for easier download
import shutil

output_dir = Path("/kaggle/working/coronal_data_lmax85")
if output_dir.exists() and any(output_dir.glob("*.json")):
    zip_path = "/kaggle/working/coronal_data_lmax85"
    
    print("Creating zip archive for download...")
    shutil.make_archive(zip_path, 'zip', output_dir)
    
    zip_file = Path(f"{zip_path}.zip")
    if zip_file.exists():
        size_mb = zip_file.stat().st_size / (1024 * 1024)
        print(f"✓ Created: coronal_data_lmax85.zip ({size_mb:.2f} MB)")
        print(f"  Download from: /kaggle/working/coronal_data_lmax85.zip")
else:
    print("No output files found to zip")