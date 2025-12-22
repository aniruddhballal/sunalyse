import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
from tqdm import tqdm
import json

# ============================================================
# CONFIGURATION
# ============================================================
ALM_FOLDER = "alm values"  # Folder with values_xxxx.csv files
OUTPUT_FOLDER = "lmax_analysis_results"  # Where to save plots
TEST_CRS = [2096, 2120, 2150, 2180, 2210, 2240, 2270]  # Representative CRs
LMAX_VALUES = [10, 20, 30, 40, 50, 60, 70, 80, 85]  # Test points
FULL_LMAX = 85  # Maximum lmax you have computed

# ============================================================
# ANALYSIS CODE
# ============================================================

def load_alm_from_csv(cr_number, alm_folder):
    """
    Load pre-computed ALM coefficients from CSV.
    """
    csv_file = Path(alm_folder) / f"values_{cr_number}.csv"
    
    if not csv_file.exists():
        raise FileNotFoundError(f"ALM file not found: {csv_file}")
    
    alm = {}
    with open(csv_file, 'r') as f:
        import csv
        reader = csv.DictReader(f)
        for row in reader:
            l = int(row['l'])
            m = int(row['m'])
            # Parse complex number from string
            alm_str = row['alm'].strip('()')
            alm[(l, m)] = complex(alm_str)
    
    return alm


def get_power_spectrum(alm, lmax):
    """
    Compute power spectrum P(l) = sum_m |a_lm|^2
    """
    power = np.zeros(lmax + 1)
    for l in range(lmax + 1):
        for m in range(-l, l + 1):
            if (l, m) in alm:
                power[l] += np.abs(alm[(l, m)])**2
    return power


def truncate_alm(alm, lmax):
    """
    Truncate ALM coefficients to a given lmax.
    """
    return {(l, m): v for (l, m), v in alm.items() if l <= lmax}


def compute_total_power(alm, lmax):
    """
    Compute total power up to lmax.
    """
    power_spectrum = get_power_spectrum(alm, lmax)
    return np.sum(power_spectrum)


def analyze_single_cr(cr_number, alm_folder, lmax_values):
    """
    Analyze convergence for a single CR.
    """
    print(f"\nAnalyzing CR {cr_number}...")
    
    # Load full ALM coefficients
    alm_full = load_alm_from_csv(cr_number, alm_folder)
    
    # Get actual maximum l in the data
    max_l = max(l for l, m in alm_full.keys())
    print(f"  Loaded {len(alm_full)} coefficients (lmax={max_l})")
    
    results = {
        'cr': cr_number,
        'lmax_values': [],
        'power_captured': [],
        'power_fraction': [],
        'power_remaining': [],
        'convergence_rate': [],
        'power_spectra': []
    }
    
    # Compute full power
    full_power = compute_total_power(alm_full, max_l)
    print(f"  Total power (lmax={max_l}): {full_power:.6e}")
    
    # Analyze for each lmax
    for lmax in lmax_values:
        if lmax > max_l:
            continue
        
        # Truncate to this lmax
        alm_truncated = truncate_alm(alm_full, lmax)
        
        # Compute power
        power = compute_total_power(alm_truncated, lmax)
        power_fraction = power / full_power
        power_remaining = 1.0 - power_fraction
        
        # Power spectrum
        power_spectrum = get_power_spectrum(alm_full, lmax)
        
        results['lmax_values'].append(lmax)
        results['power_captured'].append(power)
        results['power_fraction'].append(power_fraction)
        results['power_remaining'].append(power_remaining)
        results['power_spectra'].append(power_spectrum)
        
        print(f"  lmax={lmax:2d}: {100*power_fraction:6.2f}% of total power captured")
    
    # Compute convergence rates
    for i in range(1, len(results['power_fraction'])):
        prev_frac = results['power_fraction'][i-1]
        curr_frac = results['power_fraction'][i]
        improvement = curr_frac - prev_frac
        results['convergence_rate'].append(improvement)
    
    return results


def analyze_all_crs(test_crs, alm_folder, lmax_values):
    """
    Analyze convergence across multiple CRs.
    """
    print(f"\n{'='*70}")
    print(f"ANALYZING PRE-COMPUTED ALM VALUES")
    print(f"{'='*70}")
    print(f"Test CRs: {test_crs}")
    print(f"lmax values to test: {lmax_values}")
    print(f"ALM folder: {alm_folder}")
    print(f"{'='*70}")
    
    all_results = []
    
    for cr in test_crs:
        try:
            results = analyze_single_cr(cr, alm_folder, lmax_values)
            all_results.append(results)
        except FileNotFoundError as e:
            print(f"⚠ Warning: {e}")
            continue
        except Exception as e:
            print(f"❌ Error processing CR {cr}: {e}")
            continue
    
    return all_results


def plot_convergence_analysis(all_results, output_folder):
    """
    Create comprehensive convergence plots.
    """
    output_path = Path(output_folder)
    output_path.mkdir(exist_ok=True)
    
    sns.set_style("whitegrid")
    sns.set_palette("husl")
    
    # =====================================================
    # FIGURE 1: Power Convergence
    # =====================================================
    fig, axes = plt.subplots(2, 2, figsize=(16, 12))
    
    # Panel A: Power fraction captured
    ax = axes[0, 0]
    for result in all_results:
        lmax_vals = result['lmax_values']
        power_fracs = [100 * f for f in result['power_fraction']]
        ax.plot(lmax_vals, power_fracs, marker='o', linewidth=2, 
               label=f"CR {result['cr']}")
    
    ax.axhline(y=95, color='r', linestyle='--', linewidth=2, label='95% threshold')
    ax.axhline(y=99, color='orange', linestyle='--', linewidth=2, label='99% threshold')
    ax.set_xlabel('lmax', fontsize=12, fontweight='bold')
    ax.set_ylabel('Power Captured (%)', fontsize=12, fontweight='bold')
    ax.set_title('A. Power Convergence vs lmax', fontsize=14, fontweight='bold')
    ax.legend(fontsize=9)
    ax.grid(True, alpha=0.3)
    ax.set_ylim([85, 100.5])
    
    # Panel B: Remaining power (log scale)
    ax = axes[0, 1]
    for result in all_results:
        lmax_vals = result['lmax_values']
        remaining = [100 * r for r in result['power_remaining']]
        ax.plot(lmax_vals, remaining, marker='s', linewidth=2, 
               label=f"CR {result['cr']}")
    
    ax.set_xlabel('lmax', fontsize=12, fontweight='bold')
    ax.set_ylabel('Remaining Power (%)', fontsize=12, fontweight='bold')
    ax.set_title('B. Uncaptured Power vs lmax', fontsize=14, fontweight='bold')
    ax.legend(fontsize=9)
    ax.grid(True, alpha=0.3)
    ax.set_yscale('log')
    
    # Panel C: Average power spectrum
    ax = axes[1, 0]
    # Compute average power spectrum
    max_lmax = max(max(r['lmax_values']) for r in all_results)
    avg_power_spectrum = np.zeros(max_lmax + 1)
    count_spectrum = np.zeros(max_lmax + 1)
    
    for result in all_results:
        for i, lmax in enumerate(result['lmax_values']):
            spectrum = result['power_spectra'][i]
            avg_power_spectrum[:len(spectrum)] += spectrum
            count_spectrum[:len(spectrum)] += 1
    
    avg_power_spectrum /= np.maximum(count_spectrum, 1)
    
    # Normalize
    norm_power = avg_power_spectrum / np.max(avg_power_spectrum)
    
    l_values = np.arange(len(norm_power))
    ax.plot(l_values, norm_power, linewidth=2, color='navy')
    ax.set_xlabel('Spherical Harmonic Degree (l)', fontsize=12, fontweight='bold')
    ax.set_ylabel('Normalized Power', fontsize=12, fontweight='bold')
    ax.set_title('C. Average Power Spectrum', fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3)
    ax.set_yscale('log')
    ax.set_xlim([0, max_lmax])
    
    # Panel D: Marginal power improvement
    ax = axes[1, 1]
    
    # Average convergence rate
    max_len = max(len(r['convergence_rate']) for r in all_results if len(r['convergence_rate']) > 0)
    avg_improvements = []
    
    for i in range(max_len):
        improvements = [r['convergence_rate'][i] * 100 
                       for r in all_results if i < len(r['convergence_rate'])]
        if improvements:
            avg_improvements.append(np.mean(improvements))
    
    if avg_improvements:
        lmax_labels = [all_results[0]['lmax_values'][i+1] 
                      for i in range(len(avg_improvements))]
        ax.bar(lmax_labels, avg_improvements, width=3, alpha=0.7, edgecolor='black')
        ax.axhline(y=1.0, color='r', linestyle='--', linewidth=2, label='1% threshold')
        ax.set_xlabel('lmax', fontsize=12, fontweight='bold')
        ax.set_ylabel('Additional Power Captured (%)', fontsize=12, fontweight='bold')
        ax.set_title('D. Marginal Improvement per lmax Increase', fontsize=14, fontweight='bold')
        ax.legend(fontsize=10)
        ax.grid(True, alpha=0.3, axis='y')
        ax.set_yscale('log')
    
    plt.tight_layout()
    plt.savefig(output_path / "power_convergence.png", dpi=300, bbox_inches='tight')
    print(f"\n✓ Saved: power_convergence.png")
    plt.close()
    
    # =====================================================
    # FIGURE 2: Individual CR Analysis
    # =====================================================
    n_crs = len(all_results)
    fig, axes = plt.subplots(n_crs, 2, figsize=(14, 4*n_crs))
    if n_crs == 1:
        axes = axes.reshape(1, -1)
    
    for i, result in enumerate(all_results):
        # Left: Power spectrum
        ax = axes[i, 0]
        for j, lmax in enumerate(result['lmax_values']):
            spectrum = result['power_spectra'][j]
            l_vals = np.arange(len(spectrum))
            ax.plot(l_vals, spectrum, linewidth=1.5, alpha=0.7, label=f"lmax={lmax}")
        
        ax.set_xlabel('l', fontsize=11, fontweight='bold')
        ax.set_ylabel('Power P(l)', fontsize=11, fontweight='bold')
        ax.set_title(f"CR {result['cr']}: Power Spectrum", fontsize=12, fontweight='bold')
        ax.legend(fontsize=8, ncol=2)
        ax.grid(True, alpha=0.3)
        ax.set_yscale('log')
        
        # Right: Convergence curve
        ax = axes[i, 1]
        lmax_vals = result['lmax_values']
        power_fracs = [100 * f for f in result['power_fraction']]
        ax.plot(lmax_vals, power_fracs, marker='o', linewidth=3, markersize=8)
        ax.axhline(y=95, color='r', linestyle='--', linewidth=2, alpha=0.5)
        ax.axhline(y=99, color='orange', linestyle='--', linewidth=2, alpha=0.5)
        
        ax.set_xlabel('lmax', fontsize=11, fontweight='bold')
        ax.set_ylabel('Power Captured (%)', fontsize=11, fontweight='bold')
        ax.set_title(f"CR {result['cr']}: Convergence", fontsize=12, fontweight='bold')
        ax.grid(True, alpha=0.3)
        ax.set_ylim([85, 100.5])
        
        # Annotate convergence points
        for j, (lmax, frac) in enumerate(zip(lmax_vals, power_fracs)):
            if frac >= 95 and (j == 0 or power_fracs[j-1] < 95):
                ax.annotate(f'{lmax}→95%', xy=(lmax, frac), 
                           xytext=(10, -10), textcoords='offset points',
                           fontsize=9, fontweight='bold',
                           bbox=dict(boxstyle='round,pad=0.3', facecolor='yellow', alpha=0.7))
    
    plt.tight_layout()
    plt.savefig(output_path / "individual_cr_analysis.png", dpi=300, bbox_inches='tight')
    print(f"✓ Saved: individual_cr_analysis.png")
    plt.close()


def generate_recommendation_report(all_results, output_folder):
    """
    Generate detailed recommendation report.
    """
    output_path = Path(output_folder)
    
    # Compute statistics
    avg_power_fractions = {}
    for lmax in all_results[0]['lmax_values']:
        fractions = [r['power_fraction'][r['lmax_values'].index(lmax)] 
                    for r in all_results if lmax in r['lmax_values']]
        avg_power_fractions[lmax] = np.mean(fractions)
    
    # Find lmax for different thresholds
    lmax_95 = None
    lmax_99 = None
    
    for lmax in sorted(avg_power_fractions.keys()):
        if avg_power_fractions[lmax] >= 0.95 and lmax_95 is None:
            lmax_95 = lmax
        if avg_power_fractions[lmax] >= 0.99 and lmax_99 is None:
            lmax_99 = lmax
    
    # Generate report
    report = f"""
{'='*80}
LMAX CONVERGENCE ANALYSIS REPORT
Pre-computed ALM Values (lmax up to {FULL_LMAX})
{'='*80}

ANALYSIS SUMMARY:
-----------------
• Analyzed {len(all_results)} Carrington Rotations: {[r['cr'] for r in all_results]}
• Tested lmax values: {all_results[0]['lmax_values']}
• Method: Power spectrum analysis

POWER CONVERGENCE BY LMAX:
---------------------------
"""
    
    for lmax in sorted(avg_power_fractions.keys()):
        frac = avg_power_fractions[lmax]
        remaining = (1 - frac) * 100
        report += f"lmax = {lmax:2d}  |  Power captured: {100*frac:6.2f}%  |  Remaining: {remaining:6.3f}%\n"
    
    report += f"""

KEY FINDINGS:
-------------
• To capture 95% of magnetic field power: lmax ≥ {lmax_95 if lmax_95 else 'N/A'}
• To capture 99% of magnetic field power: lmax ≥ {lmax_99 if lmax_99 else 'N/A'}

"""
    
    # Analyze marginal improvements
    if len(all_results[0]['convergence_rate']) > 0:
        report += f"""
MARGINAL IMPROVEMENTS:
----------------------
"""
        for i, lmax in enumerate(all_results[0]['lmax_values'][1:]):
            improvements = [r['convergence_rate'][i] * 100 
                           for r in all_results if i < len(r['convergence_rate'])]
            avg_improvement = np.mean(improvements)
            report += f"{all_results[0]['lmax_values'][i]:2d} → {lmax:2d}:  +{avg_improvement:5.3f}% additional power\n"
    
    report += f"""

{'='*80}
RECOMMENDATION:
{'='*80}

Based on power spectrum analysis of your pre-computed lmax={FULL_LMAX} coefficients:

"""
    
    if lmax_95 and lmax_99:
        report += f"""
1. MINIMAL ACCURACY (95% power):
   • Recommended lmax: {lmax_95}
   • Use case: Quick prototyping, visualization
   • Speed: Fastest
   
2. HIGH ACCURACY (99% power):
   • Recommended lmax: {lmax_99}
   • Use case: Scientific analysis, publications
   • Speed: Moderate
   
3. MAXIMUM ACCURACY:
   • Recommended lmax: {FULL_LMAX}
   • Use case: Highest precision required
   • Speed: Slowest
   • Captures {100*avg_power_fractions[FULL_LMAX]:.4f}% of total power
"""
    
    # Analyze if going beyond lmax=85 is worth it
    final_improvement = all_results[0]['convergence_rate'][-1] * 100 if all_results[0]['convergence_rate'] else 0
    
    report += f"""

IS GOING BEYOND lmax={FULL_LMAX} WORTH IT?
{'-'*40}
• Last marginal improvement: {final_improvement:.4f}%
• Power remaining at lmax={FULL_LMAX}: {(1-avg_power_fractions[FULL_LMAX])*100:.4f}%

"""
    
    if final_improvement < 0.1:
        report += f"""✓ CONCLUSION: You've reached excellent convergence!
  Going beyond lmax={FULL_LMAX} would add < 0.1% power.
  NOT RECOMMENDED unless extreme precision needed.
"""
    elif final_improvement < 0.5:
        report += f"""⚠ CONCLUSION: Diminishing returns setting in.
  Going beyond lmax={FULL_LMAX} adds < 0.5% power.
  Consider cost-benefit for your application.
"""
    else:
        report += f"""⚠ CONCLUSION: Still some power in higher modes.
  Consider computing up to lmax=100-120 if precision critical.
"""
    
    report += f"""
{'='*80}
"""
    
    # Save report
    report_path = output_path / "lmax_recommendation.txt"
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print("\n" + report)
    print(f"✓ Saved report to: {report_path}")
    
    # Save numerical data
    data = {
        'lmax_values': list(avg_power_fractions.keys()),
        'avg_power_fractions': [avg_power_fractions[l] for l in avg_power_fractions.keys()],
        'lmax_95_percent': lmax_95,
        'lmax_99_percent': lmax_99,
        'recommendation': 'See full report'
    }
    
    json_path = output_path / "convergence_data.json"
    with open(json_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"✓ Saved data to: {json_path}")


def main():
    """
    Main execution function.
    """
    print("\n" + "="*70)
    print("LMAX CONVERGENCE ANALYZER")
    print("Analyzing Pre-computed ALM Values")
    print("="*70 + "\n")
    
    # Verify folder exists
    alm_path = Path(ALM_FOLDER)
    if not alm_path.exists():
        print(f"❌ ERROR: ALM folder not found: {ALM_FOLDER}")
        return
    
    # Count available files
    csv_files = list(alm_path.glob("values_*.csv"))
    print(f"Found {len(csv_files)} ALM files in '{ALM_FOLDER}'")
    
    # Analyze
    all_results = analyze_all_crs(TEST_CRS, ALM_FOLDER, LMAX_VALUES)
    
    if not all_results:
        print("❌ No results obtained. Check your ALM files.")
        return
    
    # Generate visualizations
    print(f"\n{'='*70}")
    print("GENERATING VISUALIZATIONS")
    print(f"{'='*70}")
    
    plot_convergence_analysis(all_results, OUTPUT_FOLDER)
    
    # Generate report
    generate_recommendation_report(all_results, OUTPUT_FOLDER)
    
    print(f"\n{'='*70}")
    print("✓ ANALYSIS COMPLETE!")
    print(f"{'='*70}")
    print(f"\nOutput saved to: {OUTPUT_FOLDER}/")
    print("  • power_convergence.png")
    print("  • individual_cr_analysis.png")
    print("  • lmax_recommendation.txt")
    print("  • convergence_data.json")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    main()