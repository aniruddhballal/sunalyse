# %% [markdown]
# # Adaptive Seed Generation from HMI Synoptic FITS Maps
#
# For each Carrington rotation, this notebook:
# 1. Loads the HMI synoptic Br FITS file
# 2. Finds the top N pixels by |Br| magnitude
# 3. Clusters them so seeds are spread across distinct active regions
#    (prevents 50 seeds piling onto one sunspot group)
# 4. Saves seeds_xxxx.csv with columns: theta, phi, br_strength, polarity_sign
#
# **Coordinate convention:** theta is colatitude in radians [0, pi], computed
# from uniform linspace — matching the convention used in alm_calc.py so that
# seeds align correctly with the spherical harmonic grid.
#
# **Output:** /kaggle/working/seed_data/seeds_xxxx.csv
#            /kaggle/working/seed_data.zip

# %% [markdown]
# ## Cell 1: Check Input Files

# %%
from pathlib import Path

print("=" * 60)
print("CHECKING INPUT FILES")
print("=" * 60)

kaggle_input = Path("/kaggle/input")

# Use glob to find all .fits files recursively — handles spaces and
# unexpected nesting in Kaggle dataset paths robustly
fits_dir   = None
fits_files = []

all_fits = sorted(kaggle_input.glob("**/*.fits"))
if all_fits:
    fits_dir   = all_fits[0].parent   # directory containing the fits files
    fits_files = all_fits
    print(f"\n✓ Found {len(fits_files)} FITS files via recursive scan")
    print(f"   Directory: {fits_dir}")
else:
    fits_dir = kaggle_input / "fits-data"   # fallback for error message
    print("\n❌ No .fits files found anywhere under /kaggle/input")

print(f"\n📁 FITS directory: {fits_dir}")
print(f"   Exists: {fits_dir.exists()}")

if fits_files:
    print(f"\n✓ Found {len(fits_files)} FITS files")
    if fits_files:
        print(f"   First: {fits_files[0].name}")
        print(f"   Last:  {fits_files[-1].name}")

        # Extract CR range
        import re
        cr_numbers = []
        for f in fits_files:
            match = re.search(r'(\d{4})', f.stem)
            if match:
                cr_numbers.append(int(match.group(1)))
        if cr_numbers:
            print(f"\n   CR range: {min(cr_numbers)} – {max(cr_numbers)}")
            print(f"   Total:    {len(cr_numbers)} CRs")
else:
    print("\n❌ ERROR: fits-data directory not found!")
    print("   Attach your HF fits-data dataset to this notebook.")

DETECTED_FITS_DIR = str(fits_dir)
print(f"\n💾 Detected path saved: {DETECTED_FITS_DIR}")
print("\n" + "=" * 60)


# %% [markdown]
# ## Cell 2: Imports and Configuration

# %%
import numpy as np
import pandas as pd
from astropy.io import fits
from pathlib import Path
import re

print("✓ All packages imported successfully")


# ============================================================
# CONFIGURATION
# ============================================================

N_SEEDS      = 500    # Seeds per CR (top |Br| pixels after clustering)
MIN_BR       = 10.0   # Minimum |Br| in Gauss to consider as a seed
              #        (filters out noise in quiet Sun regions)
CLUSTER_SEP  = 0.08   # Minimum angular separation between seeds in radians
              #        (~4.6 degrees — prevents piling up on one active region)
START_CR     = 2096
END_CR       = 2285

print(f"\nConfiguration:")
print(f"  N_SEEDS:     {N_SEEDS}  (seeds per CR)")
print(f"  MIN_BR:      {MIN_BR} Gauss  (|Br| threshold)")
print(f"  CLUSTER_SEP: {CLUSTER_SEP} rad  ({np.degrees(CLUSTER_SEP):.1f}°  min separation)")
print(f"  CR range:    {START_CR} – {END_CR}")


# %% [markdown]
# ## Cell 3: Core Functions

# %%
def load_fits_br(fits_path):
    """
    Load Br data from a HMI synoptic FITS file.
    Returns (br_data, n_theta, n_phi) where br_data is a 2D float array.
    NaN and Inf values are replaced with 0.
    """
    with fits.open(fits_path) as hdul:
        br_data = hdul[0].data
        if br_data is None and len(hdul) > 1:
            br_data = hdul[1].data
        if br_data is None:
            raise ValueError(f"No data found in {fits_path.name}")

    br_data = np.array(br_data, dtype=np.float64)
    br_data = np.nan_to_num(br_data, nan=0.0, posinf=0.0, neginf=0.0)
    return br_data


def pixels_to_coords(br_data):
    """
    Convert FITS pixel indices to (theta, phi) spherical coordinates.

    Convention matches alm_calc.py:
      - theta: colatitude, uniform linspace(0, pi, n_theta)   [rows]
      - phi:   longitude,  uniform linspace(0, 2pi, n_phi)    [cols]

    Returns theta_grid, phi_grid — both shape (n_theta, n_phi).
    """
    n_theta, n_phi = br_data.shape
    theta_vals = np.linspace(0.0, np.pi, n_theta)
    phi_vals   = np.linspace(0.0, 2.0 * np.pi, n_phi)
    phi_grid, theta_grid = np.meshgrid(phi_vals, theta_vals)
    return theta_grid, phi_grid


def cluster_seeds(candidates, cluster_sep):
    """
    Greedy angular clustering: iterate through candidates sorted by |Br|
    (strongest first) and keep a seed only if it is at least cluster_sep
    radians away from all already-kept seeds.

    Parameters
    ----------
    candidates : list of (theta, phi, br_strength, polarity_sign)
        Sorted strongest-first.
    cluster_sep : float
        Minimum angular separation in radians.

    Returns
    -------
    kept : list of (theta, phi, br_strength, polarity_sign)
    """
    kept = []
    for cand in candidates:
        theta_c, phi_c = cand[0], cand[1]
        too_close = False
        for k in kept:
            # Great-circle angular separation (haversine)
            dtheta = theta_c - k[0]
            dphi   = phi_c   - k[1]
            a = (np.sin(dtheta / 2) ** 2
                 + np.sin(theta_c) * np.sin(k[0]) * np.sin(dphi / 2) ** 2)
            sep = 2.0 * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0)))
            if sep < cluster_sep:
                too_close = True
                break
        if not too_close:
            kept.append(cand)
    return kept


def generate_seeds_for_cr(br_data, n_seeds, min_br, cluster_sep):
    """
    Generate adaptive seed points for one Carrington rotation.

    Steps:
      1. Build (theta, phi) coordinate grids from pixel indices
      2. Flatten and filter pixels with |Br| >= min_br
      3. Sort by |Br| descending
      4. Greedy cluster to enforce minimum angular separation
      5. Take top n_seeds

    Returns a list of dicts: {theta, phi, br_strength, polarity_sign}
    """
    theta_grid, phi_grid = pixels_to_coords(br_data)

    # Flatten everything
    br_flat    = br_data.flatten()
    theta_flat = theta_grid.flatten()
    phi_flat   = phi_grid.flatten()
    absbr_flat = np.abs(br_flat)

    # Filter by minimum |Br|
    mask = absbr_flat >= min_br
    if mask.sum() == 0:
        print(f"  ⚠️  No pixels above {min_br} Gauss — lowering threshold to 1 Gauss")
        mask = absbr_flat >= 1.0

    br_f    = br_flat[mask]
    theta_f = theta_flat[mask]
    phi_f   = phi_flat[mask]
    absbr_f = absbr_flat[mask]

    # Sort by |Br| descending
    order      = np.argsort(absbr_f)[::-1]
    candidates = [
        (float(theta_f[i]), float(phi_f[i]),
         float(absbr_f[i]), int(np.sign(br_f[i])))
        for i in order
    ]

    # Cluster
    kept = cluster_seeds(candidates, cluster_sep)

    # Take top n_seeds
    kept = kept[:n_seeds]

    return [
        {'theta': s[0], 'phi': s[1], 'br_strength': s[2], 'polarity_sign': s[3]}
        for s in kept
    ]


print("✓ Seed generation functions defined")


# %% [markdown]
# ## Cell 4: Batch Seed Generation

# %%
import time

def batch_generate_seeds(fits_dir, output_dir, n_seeds=500, min_br=10.0,
                         cluster_sep=0.08, start_cr=2096, end_cr=2285):
    """
    Generate adaptive seed CSVs for all Carrington rotations.

    Parameters
    ----------
    fits_dir : str or Path
        Directory containing HMI FITS files (hmi.Synoptic_Mr_small.xxxx.fits)
    output_dir : str or Path
        Directory to save seeds_xxxx.csv files
    n_seeds : int
        Maximum seeds per CR after clustering
    min_br : float
        Minimum |Br| in Gauss to consider
    cluster_sep : float
        Minimum angular separation between seeds (radians)
    start_cr, end_cr : int
        CR range to process
    """
    fits_path   = Path(fits_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    fits_files = sorted(fits_path.glob("*.fits"))
    if not fits_files:
        print(f"❌ No FITS files found in {fits_dir}")
        return

    print(f"\n{'='*60}")
    print(f"BATCH SEED GENERATION")
    print(f"{'='*60}")
    print(f"  FITS files found: {len(fits_files)}")
    print(f"  n_seeds:          {n_seeds}")
    print(f"  min_br:           {min_br} Gauss")
    print(f"  cluster_sep:      {cluster_sep} rad ({np.degrees(cluster_sep):.1f}°)")
    print(f"  CR range:         {start_cr} – {end_cr}")
    print(f"  Output:           {output_path}\n")

    total     = len(fits_files)
    processed = 0
    skipped   = 0
    failed    = 0
    batch_start = time.time()

    for idx, fits_file in enumerate(fits_files, 1):
        # Extract CR number from filename
        match = re.search(r'(\d{4})', fits_file.stem)
        if not match:
            print(f"[{idx}/{total}] ⚠️  Skipping {fits_file.name} (no CR number found)")
            skipped += 1
            continue

        cr_number = int(match.group(1))

        if cr_number < start_cr or cr_number > end_cr:
            skipped += 1
            continue

        output_csv = output_path / f"seeds_{cr_number}.csv"
        if output_csv.exists():
            print(f"[{idx}/{total}] ✓ Already exists: {output_csv.name}")
            processed += 1
            continue

        try:
            t0 = time.time()
            print(f"[{idx}/{total}] Processing CR {cr_number}...", end=" ", flush=True)

            br_data = load_fits_br(fits_file)
            seeds   = generate_seeds_for_cr(br_data, n_seeds, min_br, cluster_sep)

            # Save CSV
            df = pd.DataFrame(seeds)
            df.to_csv(output_csv, index=False)

            elapsed   = time.time() - t0
            n_open    = sum(1 for s in seeds if s['polarity_sign'] > 0)
            n_neg     = len(seeds) - n_open
            br_max    = df['br_strength'].max()
            br_median = df['br_strength'].median()

            print(f"✓  {len(seeds)} seeds  "
                  f"(+{n_open} / -{n_neg})  "
                  f"|Br| max={br_max:.0f}G median={br_median:.0f}G  "
                  f"{elapsed:.1f}s")

            processed += 1

        except Exception as e:
            import traceback
            print(f"\n❌ Failed: {e}")
            traceback.print_exc()
            failed += 1
            continue

    total_time = time.time() - batch_start
    print(f"\n{'='*60}")
    print(f"BATCH COMPLETE")
    print(f"{'='*60}")
    print(f"  Processed: {processed}")
    print(f"  Skipped:   {skipped}")
    print(f"  Failed:    {failed}")
    print(f"  Time:      {total_time:.1f}s ({total_time/60:.1f} min)")
    print(f"  Output:    {output_path}")

    output_files = sorted(output_path.glob("seeds_*.csv"))
    if output_files:
        total_size_kb = sum(f.stat().st_size for f in output_files) / 1024
        print(f"  Files:     {len(output_files)} CSVs ({total_size_kb:.1f} KB total)")
    print(f"{'='*60}\n")

    return output_path

print("✓ Batch function defined")


# %% [markdown]
# ## Cell 5: Run Batch Seed Generation

# %%
FITS_INPUT_DIR = DETECTED_FITS_DIR
OUTPUT_DIR     = "/kaggle/working/seed_data"
N_SEEDS        = 500    # Seeds per CR
MIN_BR         = 10.0   # Gauss threshold
CLUSTER_SEP    = 0.08   # Radians (~4.6°)
START_CR       = 2096
END_CR         = 2285

if not fits_files:
    print(f"❌ ERROR: No FITS files found under /kaggle/input")
    print("\nAttached datasets:")
    for item in Path("/kaggle/input").iterdir():
        print(f"   - {item}")
else:
    output_path = batch_generate_seeds(
        fits_dir    = FITS_INPUT_DIR,
        output_dir  = OUTPUT_DIR,
        n_seeds     = N_SEEDS,
        min_br      = MIN_BR,
        cluster_sep = CLUSTER_SEP,
        start_cr    = START_CR,
        end_cr      = END_CR
    )


# %% [markdown]
# ## Cell 6: Sanity Check — Inspect One CR

# %%
# Quick sanity check on one output file before zipping
import os

sample_csv = Path(OUTPUT_DIR) / "seeds_2097.csv"
if sample_csv.exists():
    df = pd.read_csv(sample_csv)
    print(f"Sample: seeds_2097.csv")
    print(f"  Rows:             {len(df)}")
    print(f"  Columns:          {list(df.columns)}")
    print(f"  theta range:      [{df['theta'].min():.3f}, {df['theta'].max():.3f}] rad")
    print(f"  phi range:        [{df['phi'].min():.3f}, {df['phi'].max():.3f}] rad")
    print(f"  |Br| range:       [{df['br_strength'].min():.1f}, {df['br_strength'].max():.1f}] Gauss")
    print(f"  Positive polarity: {(df['polarity_sign'] > 0).sum()}")
    print(f"  Negative polarity: {(df['polarity_sign'] < 0).sum()}")
    print(f"\nFirst 5 seeds:")
    print(df.head().to_string(index=False))
else:
    print(f"seeds_2097.csv not found — check batch ran successfully")


# %% [markdown]
# ## Cell 7: Zip for Download

# %%
import shutil

output_dir = Path(OUTPUT_DIR)
if output_dir.exists() and any(output_dir.glob("seeds_*.csv")):
    zip_path = "/kaggle/working/seed_data"
    print("Creating zip archive...")
    shutil.make_archive(zip_path, 'zip', output_dir)
    zip_file = Path(f"{zip_path}.zip")
    if zip_file.exists():
        size_mb = zip_file.stat().st_size / (1024 * 1024)
        print(f"✓ Created seed_data.zip ({size_mb:.2f} MB)")
        print(f"  Download from: /kaggle/working/seed_data.zip")
        print(f"\nUpload to HuggingFace as: aniruddhballal/seed-data")
        print(f"Each file named:          seeds_xxxx.csv")
else:
    print("No seed CSVs found to zip")