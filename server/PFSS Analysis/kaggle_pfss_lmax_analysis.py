"""
PFSS lmax Convergence Analysis
Designed to run on Kaggle notebooks.
Requires: astropy, scipy, matplotlib, seaborn, tqdm, IPython
"""

import numpy as np
from scipy.special import sph_harm
from astropy.io import fits
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import pickle
from tqdm import tqdm
import json

class PFSSConvergenceAnalyzer:
    """
    Analyze convergence of PFSS reconstructions as a function of lmax.
    Tests multiple convergence metrics to determine optimal truncation.
    """
    
    def __init__(self, r_source=2.5):
        self.r_source = r_source
        self.test_crs = [2096, 2120, 2150, 2180, 2210, 2240, 2270]  # 7 representative CRs
        self.lmax_values = [10, 20, 30, 40, 50, 60]
        
    def load_fits_magnetogram(self, fits_path):
        """Load and clean magnetogram data."""
        with fits.open(fits_path) as hdul:
            br_data = hdul[0].data
            if br_data is None and len(hdul) > 1:
                br_data = hdul[1].data
            if br_data is None:
                raise ValueError("Could not find data in FITS file")
        
        # Clean data
        br_data = np.nan_to_num(br_data, nan=0.0, posinf=0.0, neginf=0.0)
        return br_data
    
    def compute_alm_coefficients(self, br_photosphere, lmax):
        """
        Compute spherical harmonic coefficients up to lmax.
        """
        n_theta, n_phi = br_photosphere.shape
        
        # Create coordinate grids
        theta = np.linspace(0, np.pi, n_theta)
        phi = np.linspace(0, 2 * np.pi, n_phi)
        phi_grid, theta_grid = np.meshgrid(phi, theta)
        
        alm = {}
        
        for l in range(lmax + 1):
            for m in range(-l, l + 1):
                ylm = sph_harm(m, l, phi_grid, theta_grid)
                integrand = br_photosphere * np.conj(ylm) * np.sin(theta_grid)
                alm[(l, m)] = np.sum(integrand) * (np.pi / n_theta) * (2 * np.pi / n_phi)
        
        return alm
    
    def reconstruct_br(self, alm, lmax, n_theta, n_phi):
        """
        Reconstruct Br at photosphere from spherical harmonic coefficients.
        """
        theta = np.linspace(0, np.pi, n_theta)
        phi = np.linspace(0, 2 * np.pi, n_phi)
        phi_grid, theta_grid = np.meshgrid(phi, theta)
        
        br_reconstructed = np.zeros((n_theta, n_phi), dtype=complex)
        
        for l in range(lmax + 1):
            for m in range(-l, l + 1):
                if (l, m) in alm:
                    ylm = sph_harm(m, l, phi_grid, theta_grid)
                    br_reconstructed += alm[(l, m)] * ylm
        
        return br_reconstructed.real
    
    def compute_power_spectrum(self, alm, lmax):
        """
        Compute power spectrum P(l) = sum_m |a_lm|^2
        """
        power = np.zeros(lmax + 1)
        for l in range(lmax + 1):
            for m in range(-l, l + 1):
                if (l, m) in alm:
                    power[l] += np.abs(alm[(l, m)])**2
        return power
    
    def analyze_single_cr(self, fits_path, cr_number):
        """
        Analyze convergence for a single Carrington rotation.
        
        Returns:
        --------
        results : dict containing all convergence metrics
        """
        print(f"\n{'='*60}")
        print(f"Analyzing CR {cr_number}")
        print(f"{'='*60}")
        
        # Load original data
        br_original = self.load_fits_magnetogram(fits_path)
        n_theta, n_phi = br_original.shape
        
        print(f"Data shape: {br_original.shape}")
        print(f"Br range: [{br_original.min():.2f}, {br_original.max():.2f}] Gauss")
        
        results = {
            'cr': cr_number,
            'lmax_values': self.lmax_values,
            'reconstruction_errors': [],
            'relative_errors': [],
            'power_spectra': [],
            'coefficient_norms': [],
            'convergence_rates': [],
            'br_original': br_original
        }
        
        # Compute coefficients for maximum lmax first
        print(f"\nComputing coefficients for lmax_max={max(self.lmax_values)}...")
        alm_full = self.compute_alm_coefficients(br_original, max(self.lmax_values))
        
        print("\nAnalyzing different lmax values:")
        for lmax in tqdm(self.lmax_values, desc="lmax values"):
            # Extract subset of coefficients
            alm_subset = {k: v for k, v in alm_full.items() if k[0] <= lmax}
            
            # 1. Reconstruction error
            br_reconstructed = self.reconstruct_br(alm_subset, lmax, n_theta, n_phi)
            
            # L2 norm of difference
            reconstruction_error = np.sqrt(np.mean((br_original - br_reconstructed)**2))
            results['reconstruction_errors'].append(reconstruction_error)
            
            # Relative error
            original_norm = np.sqrt(np.mean(br_original**2))
            relative_error = reconstruction_error / original_norm if original_norm > 0 else 0
            results['relative_errors'].append(relative_error)
            
            # 2. Power spectrum
            power_spectrum = self.compute_power_spectrum(alm_subset, lmax)
            results['power_spectra'].append(power_spectrum)
            
            # 3. Coefficient norm
            coeff_norm = np.sqrt(sum(np.abs(v)**2 for v in alm_subset.values()))
            results['coefficient_norms'].append(coeff_norm)
        
        # 4. Compute convergence rates (how fast error decreases)
        errors = np.array(results['relative_errors'])
        for i in range(1, len(errors)):
            if errors[i] > 0 and errors[i-1] > 0:
                rate = np.log(errors[i-1] / errors[i]) / np.log(self.lmax_values[i] / self.lmax_values[i-1])
                results['convergence_rates'].append(rate)
            else:
                results['convergence_rates'].append(0)
        
        return results
    
    def analyze_all_crs(self, fits_dir="fits_files"):
        """
        Analyze convergence across multiple Carrington rotations.
        """
        fits_path = Path(fits_dir)
        all_results = []
        
        print(f"\n{'='*70}")
        print(f"PFSS LMAX CONVERGENCE ANALYSIS")
        print(f"{'='*70}")
        print(f"Test CRs: {self.test_crs}")
        print(f"lmax values: {self.lmax_values}")
        print(f"{'='*70}\n")
        
        for cr in self.test_crs:
            # Find FITS file for this CR
            fits_files = list(fits_path.glob(f"*{cr}*.fits"))
            
            if not fits_files:
                print(f"⚠ Warning: No FITS file found for CR {cr}")
                continue
            
            fits_file = fits_files[0]
            
            try:
                results = self.analyze_single_cr(str(fits_file), cr)
                all_results.append(results)
            except Exception as e:
                print(f"❌ Error processing CR {cr}: {e}")
                continue
        
        return all_results
    
    def plot_convergence_analysis(self, all_results, output_dir="lmax_analysis"):
        """
        Create comprehensive visualization of convergence analysis.
        """
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        sns.set_style("whitegrid")
        sns.set_palette("husl")
        
        # =====================================================
        # FIGURE 1: Reconstruction Error vs lmax
        # =====================================================
        fig, axes = plt.subplots(2, 2, figsize=(16, 12))
        
        # Panel A: Absolute reconstruction error
        ax = axes[0, 0]
        for result in all_results:
            ax.plot(result['lmax_values'], result['reconstruction_errors'], 
                   marker='o', linewidth=2, label=f"CR {result['cr']}")
        ax.set_xlabel('lmax', fontsize=12, fontweight='bold')
        ax.set_ylabel('RMS Reconstruction Error (Gauss)', fontsize=12, fontweight='bold')
        ax.set_title('A. Absolute Reconstruction Error', fontsize=14, fontweight='bold')
        ax.legend(fontsize=9)
        ax.grid(True, alpha=0.3)
        ax.set_yscale('log')
        
        # Panel B: Relative error (%)
        ax = axes[0, 1]
        for result in all_results:
            relative_error_pct = [100 * e for e in result['relative_errors']]
            ax.plot(result['lmax_values'], relative_error_pct, 
                   marker='s', linewidth=2, label=f"CR {result['cr']}")
        ax.set_xlabel('lmax', fontsize=12, fontweight='bold')
        ax.set_ylabel('Relative Error (%)', fontsize=12, fontweight='bold')
        ax.set_title('B. Relative Reconstruction Error', fontsize=14, fontweight='bold')
        ax.legend(fontsize=9)
        ax.grid(True, alpha=0.3)
        ax.set_yscale('log')
        
        # Panel C: Average power spectrum
        ax = axes[1, 0]
        avg_power_spectra = {}
        for lmax in self.lmax_values:
            powers = []
            for result in all_results:
                idx = result['lmax_values'].index(lmax)
                powers.append(result['power_spectra'][idx])
            # Average and normalize
            avg_power = np.mean([p / np.max(p) for p in powers], axis=0)
            avg_power_spectra[lmax] = avg_power
            l_values = np.arange(len(avg_power))
            ax.plot(l_values, avg_power, linewidth=2, label=f"lmax={lmax}")
        ax.set_xlabel('Spherical Harmonic Degree (l)', fontsize=12, fontweight='bold')
        ax.set_ylabel('Normalized Power', fontsize=12, fontweight='bold')
        ax.set_title('C. Average Power Spectrum', fontsize=14, fontweight='bold')
        ax.legend(fontsize=9)
        ax.grid(True, alpha=0.3)
        ax.set_yscale('log')
        ax.set_xlim([0, max(self.lmax_values)])
        
        # Panel D: Error improvement rate
        ax = axes[1, 1]
        avg_errors = np.mean([r['relative_errors'] for r in all_results], axis=0)
        error_reduction = [100 * (avg_errors[i-1] - avg_errors[i]) / avg_errors[i-1] 
                          for i in range(1, len(avg_errors))]
        ax.bar(self.lmax_values[1:], error_reduction, width=4, alpha=0.7, edgecolor='black')
        ax.set_xlabel('lmax', fontsize=12, fontweight='bold')
        ax.set_ylabel('Error Reduction from Previous (%)', fontsize=12, fontweight='bold')
        ax.set_title('D. Marginal Error Improvement', fontsize=14, fontweight='bold')
        ax.axhline(y=5, color='r', linestyle='--', linewidth=2, label='5% threshold')
        ax.legend(fontsize=10)
        ax.grid(True, alpha=0.3, axis='y')
        
        plt.tight_layout()
        plt.savefig(output_path / "convergence_overview.png", dpi=300, bbox_inches='tight')
        print(f"✓ Saved: convergence_overview.png")
        plt.close()
        
        # =====================================================
        # FIGURE 2: Individual CR Reconstructions
        # =====================================================
        n_crs = len(all_results)
        fig, axes = plt.subplots(n_crs, 4, figsize=(20, 4*n_crs))
        if n_crs == 1:
            axes = axes.reshape(1, -1)
        
        for i, result in enumerate(all_results):
            br_original = result['br_original']
            vmax = np.max(np.abs(br_original))
            
            # Original
            im = axes[i, 0].imshow(br_original, cmap='RdBu_r', vmin=-vmax, vmax=vmax, aspect='auto')
            axes[i, 0].set_title(f"CR {result['cr']}: Original", fontweight='bold')
            axes[i, 0].set_ylabel('Latitude', fontweight='bold')
            plt.colorbar(im, ax=axes[i, 0], label='Br (Gauss)')
            
            # Reconstructions at different lmax
            for j, lmax_idx in enumerate([1, 3, 5]):  # lmax = 20, 40, 60
                lmax = self.lmax_values[lmax_idx]
                
                # Need to reconstruct
                alm_full = self.compute_alm_coefficients(br_original, max(self.lmax_values))
                alm_subset = {k: v for k, v in alm_full.items() if k[0] <= lmax}
                br_recon = self.reconstruct_br(alm_subset, lmax, *br_original.shape)
                
                im = axes[i, j+1].imshow(br_recon, cmap='RdBu_r', vmin=-vmax, vmax=vmax, aspect='auto')
                rel_err = result['relative_errors'][lmax_idx]
                axes[i, j+1].set_title(f"lmax={lmax} (err={100*rel_err:.2f}%)", fontweight='bold')
                plt.colorbar(im, ax=axes[i, j+1], label='Br (Gauss)')
            
            if i == n_crs - 1:
                for ax in axes[i, :]:
                    ax.set_xlabel('Longitude', fontweight='bold')
        
        plt.tight_layout()
        plt.savefig(output_path / "reconstruction_comparison.png", dpi=300, bbox_inches='tight')
        print(f"✓ Saved: reconstruction_comparison.png")
        plt.close()
        
        # =====================================================
        # FIGURE 3: Summary Statistics
        # =====================================================
        fig, axes = plt.subplots(1, 2, figsize=(16, 6))
        
        # Average metrics across all CRs
        avg_rel_errors = np.mean([r['relative_errors'] for r in all_results], axis=0)
        std_rel_errors = np.std([r['relative_errors'] for r in all_results], axis=0)
        
        ax = axes[0]
        ax.errorbar(self.lmax_values, 100*avg_rel_errors, yerr=100*std_rel_errors,
                   marker='o', linewidth=3, markersize=10, capsize=8, capthick=2)
        ax.set_xlabel('lmax', fontsize=14, fontweight='bold')
        ax.set_ylabel('Average Relative Error (%)', fontsize=14, fontweight='bold')
        ax.set_title('Average Reconstruction Error ± Std Dev', fontsize=15, fontweight='bold')
        ax.grid(True, alpha=0.3)
        ax.set_yscale('log')
        
        # Add annotations for key points
        for i, lmax in enumerate(self.lmax_values):
            err_val = 100*avg_rel_errors[i]
            ax.annotate(f'{err_val:.2f}%', 
                       xy=(lmax, err_val), 
                       xytext=(5, 5), 
                       textcoords='offset points',
                       fontsize=9, fontweight='bold')
        
        # Cost-benefit analysis (error vs computational cost)
        ax = axes[1]
        # Computational cost scales roughly as O(lmax^3)
        comp_cost = np.array(self.lmax_values)**3
        comp_cost_normalized = comp_cost / comp_cost[0]
        
        ax2 = ax.twinx()
        line1 = ax.plot(self.lmax_values, 100*avg_rel_errors, 
                       marker='o', linewidth=3, markersize=10, color='tab:blue', label='Error')
        line2 = ax2.plot(self.lmax_values, comp_cost_normalized, 
                        marker='s', linewidth=3, markersize=10, color='tab:orange', label='Relative Cost')
        
        ax.set_xlabel('lmax', fontsize=14, fontweight='bold')
        ax.set_ylabel('Relative Error (%)', fontsize=14, fontweight='bold', color='tab:blue')
        ax2.set_ylabel('Relative Computational Cost', fontsize=14, fontweight='bold', color='tab:orange')
        ax.set_title('Cost-Benefit Trade-off', fontsize=15, fontweight='bold')
        ax.tick_params(axis='y', labelcolor='tab:blue')
        ax2.tick_params(axis='y', labelcolor='tab:orange')
        ax.grid(True, alpha=0.3)
        ax.set_yscale('log')
        ax2.set_yscale('log')
        
        # Combined legend
        lines = line1 + line2
        labels = [l.get_label() for l in lines]
        ax.legend(lines, labels, loc='upper right', fontsize=12)
        
        plt.tight_layout()
        plt.savefig(output_path / "summary_statistics.png", dpi=300, bbox_inches='tight')
        print(f"✓ Saved: summary_statistics.png")
        plt.close()
    
    def generate_recommendation_report(self, all_results, output_dir="lmax_analysis"):
        """
        Generate a text report with recommendations.
        """
        output_path = Path(output_dir)
        
        # Calculate statistics
        avg_rel_errors = np.mean([r['relative_errors'] for r in all_results], axis=0)
        std_rel_errors = np.std([r['relative_errors'] for r in all_results], axis=0)
        
        # Find where error improvement becomes < 5%
        error_improvements = []
        for i in range(1, len(avg_rel_errors)):
            improvement = 100 * (avg_rel_errors[i-1] - avg_rel_errors[i]) / avg_rel_errors[i-1]
            error_improvements.append(improvement)
        
        # Find optimal lmax (diminishing returns threshold)
        optimal_idx = None
        for i, improvement in enumerate(error_improvements):
            if improvement < 5.0:  # Less than 5% improvement
                optimal_idx = i
                break
        
        if optimal_idx is None:
            optimal_idx = len(self.lmax_values) - 2
        
        optimal_lmax = self.lmax_values[optimal_idx]
        
        report = f"""
{'='*80}
PFSS LMAX CONVERGENCE ANALYSIS - RECOMMENDATION REPORT
{'='*80}

ANALYSIS SUMMARY:
-----------------
- Analyzed {len(all_results)} Carrington Rotations: {[r['cr'] for r in all_results]}
- Tested lmax values: {self.lmax_values}
- Metrics: Reconstruction error, power spectra, convergence rates

RECONSTRUCTION ERROR BY LMAX:
------------------------------
"""
        
        for i, lmax in enumerate(self.lmax_values):
            comp_cost = (lmax/self.lmax_values[0])**3
            report += f"lmax = {lmax:2d}  |  Error: {100*avg_rel_errors[i]:6.3f}% ± {100*std_rel_errors[i]:5.3f}%  |  Rel. Cost: {comp_cost:6.1f}x\n"
        
        report += f"""
ERROR IMPROVEMENT RATE:
-----------------------
"""
        for i, lmax in enumerate(self.lmax_values[1:], 1):
            report += f"{self.lmax_values[i-1]:2d} → {lmax:2d}:  {error_improvements[i-1]:6.2f}% improvement\n"
        
        report += f"""

{'='*80}
RECOMMENDATION:
{'='*80}

Based on the convergence analysis, the OPTIMAL lmax is: {optimal_lmax}

JUSTIFICATION:
--------------
1. Error Performance:
   • At lmax={optimal_lmax}: {100*avg_rel_errors[optimal_idx]:.3f}% ± {100*std_rel_errors[optimal_idx]:.3f}% error
   • Further increases show < 5% marginal improvement
   
2. Computational Efficiency:
   • lmax={optimal_lmax} provides {(optimal_lmax/self.lmax_values[0])**3:.1f}x cost vs lmax={self.lmax_values[0]}
   • lmax={max(self.lmax_values)} would be {(max(self.lmax_values)/optimal_lmax)**3:.1f}x more expensive

3. Power Spectrum:
   • Most magnetic field power captured by l < {optimal_lmax}
   • Higher modes contribute primarily noise and small-scale features

ALTERNATIVES:
-------------
- For FAST processing (low detail):     lmax = {self.lmax_values[1]} ({100*avg_rel_errors[1]:.2f}% error)
- For BALANCED performance (recommended): lmax = {optimal_lmax} ({100*avg_rel_errors[optimal_idx]:.2f}% error)
- For HIGH ACCURACY (slow):              lmax = {self.lmax_values[-2]} ({100*avg_rel_errors[-2]:.2f}% error)

{'='*80}
"""
        
        # Save report
        report_path = output_path / "lmax_recommendation.txt"
        with open(report_path, 'w') as f:
            f.write(report)
        
        print("\n" + report)
        print(f"✓ Saved report to: {report_path}")
        
        # Also save raw data
        data_path = output_path / "convergence_data.json"
        json_data = {
            'lmax_values': self.lmax_values,
            'avg_errors': avg_rel_errors.tolist(),
            'std_errors': std_rel_errors.tolist(),
            'optimal_lmax': optimal_lmax,
            'cr_data': [
                {
                    'cr': r['cr'],
                    'errors': r['relative_errors']
                }
                for r in all_results
            ]
        }
        
        with open(data_path, 'w') as f:
            json.dump(json_data, f, indent=2)
        
        print(f"✓ Saved data to: {data_path}")


# ===================================================================
# MAIN FUNCTION - MODIFIED FOR KAGGLE
# ===================================================================
def main():
    """
    Main execution for Kaggle with aniruddhballal/fits-files dataset
    """
    import os
    
    print("\n" + "="*80)
    print("PFSS LMAX CONVERGENCE ANALYZER - KAGGLE")
    print("="*80 + "\n")
    
    # Kaggle dataset path
    fits_dir = "/kaggle/input/alms-and-fits/fits files"
    
    # Verify files exist
    if os.path.exists(fits_dir):
        fits_files = [f for f in os.listdir(fits_dir) if f.endswith('.fits')]
        print(f"✓ Found {len(fits_files)} FITS files in {fits_dir}")
        print(f"  Sample files: {fits_files[:3]}\n")
    else:
        print(f"❌ ERROR: Directory not found: {fits_dir}")
        print("   Make sure you've added the 'fits-files' dataset to your notebook!")
        return
    
    # Initialize analyzer
    analyzer = PFSSConvergenceAnalyzer(r_source=2.5)
    
    # Run analysis
    all_results = analyzer.analyze_all_crs(fits_dir=fits_dir)
    
    if not all_results:
        print("❌ No results obtained. Check your FITS files.")
        return
    
    # Generate visualizations (Kaggle output directory)
    output_dir = "/kaggle/working/lmax_analysis"
    os.makedirs(output_dir, exist_ok=True)
    
    print("\n" + "="*80)
    print("GENERATING VISUALIZATIONS")
    print("="*80 + "\n")
    
    analyzer.plot_convergence_analysis(all_results, output_dir=output_dir)
    analyzer.generate_recommendation_report(all_results, output_dir=output_dir)
    
    print("\n" + "="*80)
    print("✓ ANALYSIS COMPLETE!")
    print("="*80)
    print(f"\nOutput files saved in: {output_dir}/")
    print("  • convergence_overview.png")
    print("  • reconstruction_comparison.png")
    print("  • summary_statistics.png")
    print("  • lmax_recommendation.txt")
    print("  • convergence_data.json")
    print("="*80 + "\n")
    

    # This code is meant for Kaggle - IPython is available there

    # Display results inline
    from IPython.display import Image, display
    print("="*80)
    print("RESULTS PREVIEW")
    print("="*80 + "\n")
    
    for img in ['convergence_overview.png', 'reconstruction_comparison.png', 
                'summary_statistics.png']:
        img_path = f"{output_dir}/{img}"
        if os.path.exists(img_path):
            print(f"\n{img}:")
            display(Image(filename=img_path, width=1200))


if __name__ == "__main__":
    main()