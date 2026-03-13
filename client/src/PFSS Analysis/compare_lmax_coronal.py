import json
import numpy as np
from pathlib import Path
import matplotlib.pyplot as plt
from scipy.spatial.distance import cdist

class CoronalFieldLineComparison:
    """
    Compare coronal field line data between different lmax resolutions.
    """
    
    def __init__(self, json_lmax30, json_lmax85):
        """
        Initialize comparison between two coronal JSON files.
        
        Parameters:
        -----------
        json_lmax30 : str
            Path to lmax=30 coronal JSON file
        json_lmax85 : str
            Path to lmax=85 coronal JSON file
        """
        self.json_lmax30 = json_lmax30
        self.json_lmax85 = json_lmax85
        
        # Load data
        with open(json_lmax30, 'r') as f:
            self.data_lmax30 = json.load(f)
        
        with open(json_lmax85, 'r') as f:
            self.data_lmax85 = json.load(f)
        
        self.metadata_lmax30 = self.data_lmax30['metadata']
        self.metadata_lmax85 = self.data_lmax85['metadata']
        
        self.field_lines_lmax30 = self.data_lmax30['fieldLines']
        self.field_lines_lmax85 = self.data_lmax85['fieldLines']
        
        print(f"Loaded lmax=30: {len(self.field_lines_lmax30)} field lines")
        print(f"Loaded lmax=85: {len(self.field_lines_lmax85)} field lines")
    
    def compute_field_line_length(self, points):
        """
        Compute total length of a field line.
        
        Parameters:
        -----------
        points : list of [x, y, z]
            Field line coordinates
            
        Returns:
        --------
        length : float
            Total arc length
        """
        if len(points) < 2:
            return 0.0
        
        points = np.array(points)
        segments = np.diff(points, axis=0)
        lengths = np.linalg.norm(segments, axis=1)
        return np.sum(lengths)
    
    def compare_field_line_lengths(self):
        """
        Compare the lengths of field lines between lmax=30 and lmax=85.
        
        Returns:
        --------
        stats : dict
            Statistics about length differences
        """
        lengths_30 = [self.compute_field_line_length(fl['points']) 
                      for fl in self.field_lines_lmax30]
        lengths_85 = [self.compute_field_line_length(fl['points']) 
                      for fl in self.field_lines_lmax85]
        
        lengths_30 = np.array(lengths_30)
        lengths_85 = np.array(lengths_85)
        
        # Compute differences (assuming same ordering/starting points)
        min_len = min(len(lengths_30), len(lengths_85))
        lengths_30 = lengths_30[:min_len]
        lengths_85 = lengths_85[:min_len]
        
        diff = lengths_85 - lengths_30
        rel_diff = 100 * diff / (lengths_30 + 1e-10)  # Relative difference in %
        
        stats = {
            'mean_length_lmax30': np.mean(lengths_30),
            'mean_length_lmax85': np.mean(lengths_85),
            'mean_absolute_diff': np.mean(np.abs(diff)),
            'mean_relative_diff_percent': np.mean(np.abs(rel_diff)),
            'max_absolute_diff': np.max(np.abs(diff)),
            'std_diff': np.std(diff),
            'median_diff': np.median(diff)
        }
        
        return stats, lengths_30, lengths_85, diff
    
    def compare_magnetic_field_strengths(self):
        """
        Compare magnetic field strengths along field lines.
        
        Returns:
        --------
        stats : dict
            Statistics about field strength differences
        """
        # Average field strength for each field line
        avg_strengths_30 = []
        avg_strengths_85 = []
        
        for fl in self.field_lines_lmax30:
            if len(fl['strengths']) > 0:
                avg_strengths_30.append(np.mean(fl['strengths']))
        
        for fl in self.field_lines_lmax85:
            if len(fl['strengths']) > 0:
                avg_strengths_85.append(np.mean(fl['strengths']))
        
        avg_strengths_30 = np.array(avg_strengths_30)
        avg_strengths_85 = np.array(avg_strengths_85)
        
        min_len = min(len(avg_strengths_30), len(avg_strengths_85))
        avg_strengths_30 = avg_strengths_30[:min_len]
        avg_strengths_85 = avg_strengths_85[:min_len]
        
        diff = avg_strengths_85 - avg_strengths_30
        rel_diff = 100 * diff / (avg_strengths_30 + 1e-10)
        
        stats = {
            'mean_strength_lmax30': np.mean(avg_strengths_30),
            'mean_strength_lmax85': np.mean(avg_strengths_85),
            'mean_absolute_diff': np.mean(np.abs(diff)),
            'mean_relative_diff_percent': np.mean(np.abs(rel_diff)),
            'max_absolute_diff': np.max(np.abs(diff)),
            'std_diff': np.std(diff)
        }
        
        return stats, avg_strengths_30, avg_strengths_85, diff
    
    def compare_polarity_distribution(self):
        """
        Compare open vs closed field line distributions.
        
        Returns:
        --------
        stats : dict
            Polarity statistics
        """
        polarities_30 = [fl['polarity'] for fl in self.field_lines_lmax30]
        polarities_85 = [fl['polarity'] for fl in self.field_lines_lmax85]
        
        open_30 = polarities_30.count('open')
        closed_30 = polarities_30.count('closed')
        open_85 = polarities_85.count('open')
        closed_85 = polarities_85.count('closed')
        
        total_30 = len(polarities_30)
        total_85 = len(polarities_85)
        
        stats = {
            'lmax30_open': open_30,
            'lmax30_closed': closed_30,
            'lmax30_open_percent': 100 * open_30 / total_30,
            'lmax30_closed_percent': 100 * closed_30 / total_30,
            'lmax85_open': open_85,
            'lmax85_closed': closed_85,
            'lmax85_open_percent': 100 * open_85 / total_85,
            'lmax85_closed_percent': 100 * closed_85 / total_85,
            'open_diff': open_85 - open_30,
            'closed_diff': closed_85 - closed_30
        }
        
        return stats
    
    def compare_field_line_geometry(self, sample_size=10):
        """
        Compare the actual 3D geometry of field lines by computing
        point-to-point distances.
        
        Parameters:
        -----------
        sample_size : int
            Number of field lines to compare in detail
            
        Returns:
        --------
        stats : dict
            Geometric difference statistics
        """
        geometric_diffs = []
        
        n_compare = min(sample_size, len(self.field_lines_lmax30), 
                       len(self.field_lines_lmax85))
        
        for i in range(n_compare):
            points_30 = np.array(self.field_lines_lmax30[i]['points'])
            points_85 = np.array(self.field_lines_lmax85[i]['points'])
            
            if len(points_30) == 0 or len(points_85) == 0:
                continue
            
            # Resample to same number of points for fair comparison
            n_points = min(len(points_30), len(points_85))
            
            if n_points < 2:
                continue
            
            # Simple resampling: take evenly spaced points
            idx_30 = np.linspace(0, len(points_30)-1, n_points, dtype=int)
            idx_85 = np.linspace(0, len(points_85)-1, n_points, dtype=int)
            
            points_30_resampled = points_30[idx_30]
            points_85_resampled = points_85[idx_85]
            
            # Point-to-point Euclidean distances
            distances = np.linalg.norm(points_85_resampled - points_30_resampled, axis=1)
            
            geometric_diffs.append({
                'mean_distance': np.mean(distances),
                'max_distance': np.max(distances),
                'std_distance': np.std(distances)
            })
        
        if len(geometric_diffs) == 0:
            return None
        
        stats = {
            'mean_point_distance': np.mean([gd['mean_distance'] for gd in geometric_diffs]),
            'max_point_distance': np.max([gd['max_distance'] for gd in geometric_diffs]),
            'avg_std_distance': np.mean([gd['std_distance'] for gd in geometric_diffs])
        }
        
        return stats
    
    def generate_comparison_report(self, output_file=None):
        """
        Generate a comprehensive comparison report.
        
        Parameters:
        -----------
        output_file : str, optional
            Path to save report as text file
            
        Returns:
        --------
        report : str
            Formatted comparison report
        """
        report_lines = []
        report_lines.append("="*70)
        report_lines.append("CORONAL FIELD LINE COMPARISON: lmax=30 vs lmax=85")
        report_lines.append("="*70)
        report_lines.append("")
        
        # Metadata
        report_lines.append("METADATA:")
        report_lines.append(f"  lmax=30: {self.metadata_lmax30['lmax']} (n_lines={self.metadata_lmax30['n_field_lines']})")
        report_lines.append(f"  lmax=85: {self.metadata_lmax85['lmax']} (n_lines={self.metadata_lmax85['n_field_lines']})")
        report_lines.append(f"  Spherical harmonic coefficients: {(30+1)**2} → {(85+1)**2}")
        report_lines.append(f"  Coefficient increase: {((85+1)**2 - (30+1)**2) / (30+1)**2 * 100:.1f}%")
        report_lines.append("")
        
        # Field line lengths
        report_lines.append("FIELD LINE LENGTHS:")
        length_stats, lengths_30, lengths_85, length_diff = self.compare_field_line_lengths()
        report_lines.append(f"  Mean length (lmax=30): {length_stats['mean_length_lmax30']:.4f} solar radii")
        report_lines.append(f"  Mean length (lmax=85): {length_stats['mean_length_lmax85']:.4f} solar radii")
        report_lines.append(f"  Mean absolute difference: {length_stats['mean_absolute_diff']:.4f} solar radii")
        report_lines.append(f"  Mean relative difference: {length_stats['mean_relative_diff_percent']:.2f}%")
        report_lines.append(f"  Max absolute difference: {length_stats['max_absolute_diff']:.4f} solar radii")
        report_lines.append(f"  Std deviation of diff: {length_stats['std_diff']:.4f}")
        report_lines.append("")
        
        # Magnetic field strengths
        report_lines.append("MAGNETIC FIELD STRENGTHS:")
        strength_stats, strengths_30, strengths_85, strength_diff = self.compare_magnetic_field_strengths()
        report_lines.append(f"  Mean strength (lmax=30): {strength_stats['mean_strength_lmax30']:.6f}")
        report_lines.append(f"  Mean strength (lmax=85): {strength_stats['mean_strength_lmax85']:.6f}")
        report_lines.append(f"  Mean absolute difference: {strength_stats['mean_absolute_diff']:.6f}")
        report_lines.append(f"  Mean relative difference: {strength_stats['mean_relative_diff_percent']:.2f}%")
        report_lines.append(f"  Max absolute difference: {strength_stats['max_absolute_diff']:.6f}")
        report_lines.append("")
        
        # Polarity distribution
        report_lines.append("POLARITY DISTRIBUTION:")
        polarity_stats = self.compare_polarity_distribution()
        report_lines.append(f"  lmax=30 - Open: {polarity_stats['lmax30_open']} ({polarity_stats['lmax30_open_percent']:.1f}%)")
        report_lines.append(f"  lmax=30 - Closed: {polarity_stats['lmax30_closed']} ({polarity_stats['lmax30_closed_percent']:.1f}%)")
        report_lines.append(f"  lmax=85 - Open: {polarity_stats['lmax85_open']} ({polarity_stats['lmax85_open_percent']:.1f}%)")
        report_lines.append(f"  lmax=85 - Closed: {polarity_stats['lmax85_closed']} ({polarity_stats['lmax85_closed_percent']:.1f}%)")
        report_lines.append(f"  Change in open field lines: {polarity_stats['open_diff']}")
        report_lines.append(f"  Change in closed field lines: {polarity_stats['closed_diff']}")
        report_lines.append("")
        
        # Geometric differences
        report_lines.append("GEOMETRIC DIFFERENCES (sample of 10 field lines):")
        geom_stats = self.compare_field_line_geometry(sample_size=10)
        if geom_stats:
            report_lines.append(f"  Mean point-to-point distance: {geom_stats['mean_point_distance']:.4f} solar radii")
            report_lines.append(f"  Max point-to-point distance: {geom_stats['max_point_distance']:.4f} solar radii")
            report_lines.append(f"  Avg std of distances: {geom_stats['avg_std_distance']:.4f} solar radii")
        else:
            report_lines.append("  Could not compute geometric differences")
        report_lines.append("")
        
        # Summary
        report_lines.append("SUMMARY:")
        report_lines.append(f"  Higher resolution (lmax=85) shows:")
        report_lines.append(f"    • {abs(length_stats['mean_relative_diff_percent']):.1f}% change in field line lengths")
        report_lines.append(f"    • {abs(strength_stats['mean_relative_diff_percent']):.1f}% change in magnetic field strengths")
        if geom_stats:
            report_lines.append(f"    • Average geometric deviation of {geom_stats['mean_point_distance']:.3f} solar radii")
        report_lines.append(f"    • {abs(polarity_stats['open_diff'])} change in open/closed field line classification")
        report_lines.append("")
        report_lines.append("="*70)
        
        report = "\n".join(report_lines)
        
        # Save to file if requested
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(report)
            print(f"✓ Report saved to {output_file}")
        
        return report
    
    def plot_comparison(self, output_file=None):
        """
        Create visualization plots comparing lmax=30 vs lmax=85.
        
        Parameters:
        -----------
        output_file : str, optional
            Path to save figure
        """
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        fig.suptitle('Coronal Field Line Comparison: lmax=30 vs lmax=85', 
                     fontsize=16, fontweight='bold')
        
        # 1. Field line lengths comparison
        length_stats, lengths_30, lengths_85, length_diff = self.compare_field_line_lengths()
        ax = axes[0, 0]
        ax.scatter(lengths_30, lengths_85, alpha=0.5, s=20)
        ax.plot([lengths_30.min(), lengths_30.max()], 
                [lengths_30.min(), lengths_30.max()], 
                'r--', label='Perfect agreement')
        ax.set_xlabel('Field line length - lmax=30 (solar radii)', fontsize=10)
        ax.set_ylabel('Field line length - lmax=85 (solar radii)', fontsize=10)
        ax.set_title('Field Line Lengths', fontsize=12, fontweight='bold')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        # 2. Length difference distribution
        ax = axes[0, 1]
        ax.hist(length_diff, bins=30, alpha=0.7, color='blue', edgecolor='black')
        ax.axvline(0, color='red', linestyle='--', linewidth=2, label='No difference')
        ax.set_xlabel('Length difference (lmax=85 - lmax=30)', fontsize=10)
        ax.set_ylabel('Frequency', fontsize=10)
        ax.set_title(f'Length Difference Distribution\nMean: {np.mean(length_diff):.3f} ± {np.std(length_diff):.3f}', 
                     fontsize=12, fontweight='bold')
        ax.legend()
        ax.grid(True, alpha=0.3, axis='y')
        
        # 3. Magnetic field strength comparison
        strength_stats, strengths_30, strengths_85, strength_diff = self.compare_magnetic_field_strengths()
        ax = axes[1, 0]
        ax.scatter(strengths_30, strengths_85, alpha=0.5, s=20, color='green')
        ax.plot([strengths_30.min(), strengths_30.max()], 
                [strengths_30.min(), strengths_30.max()], 
                'r--', label='Perfect agreement')
        ax.set_xlabel('Avg field strength - lmax=30', fontsize=10)
        ax.set_ylabel('Avg field strength - lmax=85', fontsize=10)
        ax.set_title('Magnetic Field Strengths', fontsize=12, fontweight='bold')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        # 4. Polarity comparison
        polarity_stats = self.compare_polarity_distribution()
        ax = axes[1, 1]
        categories = ['Open', 'Closed']
        lmax30_counts = [polarity_stats['lmax30_open'], polarity_stats['lmax30_closed']]
        lmax85_counts = [polarity_stats['lmax85_open'], polarity_stats['lmax85_closed']]
        
        x = np.arange(len(categories))
        width = 0.35
        
        bars1 = ax.bar(x - width/2, lmax30_counts, width, label='lmax=30', color='skyblue')
        bars2 = ax.bar(x + width/2, lmax85_counts, width, label='lmax=85', color='orange')
        
        ax.set_xlabel('Field Line Type', fontsize=10)
        ax.set_ylabel('Count', fontsize=10)
        ax.set_title('Polarity Distribution', fontsize=12, fontweight='bold')
        ax.set_xticks(x)
        ax.set_xticklabels(categories)
        ax.legend()
        ax.grid(True, alpha=0.3, axis='y')
        
        # Add value labels on bars
        for bars in [bars1, bars2]:
            for bar in bars:
                height = bar.get_height()
                ax.text(bar.get_x() + bar.get_width()/2., height,
                       f'{int(height)}',
                       ha='center', va='bottom', fontsize=9)
        
        plt.tight_layout()
        
        if output_file:
            plt.savefig(output_file, dpi=300, bbox_inches='tight')
            print(f"✓ Plots saved to {output_file}")
        
        plt.show()


def compare_single_cr(lmax30_path, lmax85_path, cr_number, output_dir=None):
    """
    Compare a single Carrington rotation between lmax=30 and lmax=85.
    
    Parameters:
    -----------
    lmax30_path : str
        Path to lmax=30 coronal JSON
    lmax85_path : str
        Path to lmax=85 coronal JSON
    cr_number : int
        Carrington rotation number
    output_dir : str, optional
        Directory to save output files
    """
    print(f"\n{'='*70}")
    print(f"COMPARING CR {cr_number}: lmax=30 vs lmax=85")
    print(f"{'='*70}\n")
    
    # Initialize comparison
    comparison = CoronalFieldLineComparison(lmax30_path, lmax85_path)
    
    # Generate report
    if output_dir:
        output_dir = Path(output_dir)
        output_dir.mkdir(exist_ok=True, parents=True)
        report_file = output_dir / f"cr{cr_number}_comparison_report.txt"
        plot_file = output_dir / f"cr{cr_number}_comparison_plots.png"
    else:
        report_file = f"cr{cr_number}_comparison_report.txt"
        plot_file = f"cr{cr_number}_comparison_plots.png"
    
    report = comparison.generate_comparison_report(output_file=report_file)
    print(report)
    
    # Generate plots
    comparison.plot_comparison(output_file=plot_file)
    
    print(f"\n✓ Comparison complete for CR {cr_number}")


def batch_compare_all_crs(lmax30_dir, lmax85_dir, output_dir="comparison_results", 
                          start_cr=2096, end_cr=2285):
    """
    Batch compare all available Carrington rotations.
    
    Parameters:
    -----------
    lmax30_dir : str
        Directory with lmax=30 coronal JSON files
    lmax85_dir : str
        Directory with lmax=85 coronal JSON files
    output_dir : str
        Directory to save comparison results
    start_cr : int
        Starting CR number
    end_cr : int
        Ending CR number
    """
    lmax30_path = Path(lmax30_dir)
    lmax85_path = Path(lmax85_dir)
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True, parents=True)
    
    print(f"\n{'='*70}")
    print(f"BATCH COMPARISON: CR {start_cr} - CR {end_cr}")
    print(f"{'='*70}\n")
    
    # Collect summary statistics
    summary_stats = []
    
    processed = 0
    skipped = 0
    
    for cr in range(start_cr, end_cr + 1):
        lmax30_file = lmax30_path / f"cr{cr}_coronal.json"
        lmax85_file = lmax85_path / f"cr{cr}_coronal.json"
        
        if not lmax30_file.exists() or not lmax85_file.exists():
            print(f"[CR {cr}] ⏭️  Skipping (missing file)")
            skipped += 1
            continue
        
        print(f"\n[CR {cr}] Comparing...")
        
        try:
            comparison = CoronalFieldLineComparison(str(lmax30_file), str(lmax85_file))
            
            # Get statistics
            length_stats, _, _, _ = comparison.compare_field_line_lengths()
            strength_stats, _, _, _ = comparison.compare_magnetic_field_strengths()
            polarity_stats = comparison.compare_polarity_distribution()
            geom_stats = comparison.compare_field_line_geometry(sample_size=5)
            
            summary_stats.append({
                'cr': cr,
                'length_rel_diff': length_stats['mean_relative_diff_percent'],
                'strength_rel_diff': strength_stats['mean_relative_diff_percent'],
                'open_diff': polarity_stats['open_diff'],
                'geom_distance': geom_stats['mean_point_distance'] if geom_stats else np.nan
            })
            
            processed += 1
            print(f"✓ CR {cr} compared")
            
        except Exception as e:
            print(f"❌ Failed to compare CR {cr}: {e}")
            continue
    
    # Save summary
    if len(summary_stats) > 0:
        summary_file = output_path / "batch_comparison_summary.txt"
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write("="*70 + "\n")
            f.write("BATCH COMPARISON SUMMARY\n")
            f.write("="*70 + "\n\n")
            f.write(f"Total CRs processed: {processed}\n")
            f.write(f"Total CRs skipped: {skipped}\n\n")
            
            f.write("AVERAGE DIFFERENCES ACROSS ALL CRs:\n")
            avg_length_diff = np.nanmean([s['length_rel_diff'] for s in summary_stats])
            avg_strength_diff = np.nanmean([s['strength_rel_diff'] for s in summary_stats])
            avg_geom_dist = np.nanmean([s['geom_distance'] for s in summary_stats])
            
            f.write(f"  Mean length difference: {avg_length_diff:.2f}%\n")
            f.write(f"  Mean strength difference: {avg_strength_diff:.2f}%\n")
            f.write(f"  Mean geometric distance: {avg_geom_dist:.4f} solar radii\n\n")
            
            f.write("DETAILED RESULTS:\n")
            f.write(f"{'CR':<8} {'Length Diff %':<15} {'Strength Diff %':<18} {'Open Δ':<10} {'Geom Dist':<12}\n")
            f.write("-"*70 + "\n")
            for s in summary_stats:
                f.write(f"{s['cr']:<8} {s['length_rel_diff']:<15.2f} {s['strength_rel_diff']:<18.2f} "
                       f"{s['open_diff']:<10} {s['geom_distance']:<12.4f}\n")
        
        print(f"\n✓ Summary saved to {summary_file}")
    
    print(f"\n{'='*70}")
    print(f"BATCH COMPARISON COMPLETE")
    print(f"{'='*70}")
    print(f"Processed: {processed}")
    print(f"Skipped: {skipped}")
    print(f"{'='*70}\n")


# Example usage
if __name__ == "__main__":
    # ============================================================
    # COMPARE SINGLE CR
    # ============================================================
    # compare_single_cr(
    #     lmax30_path=r"D:\engg\2025wintr\Solar\Sunalyse\server\PFSS Analysis\coronal_data\cr2096_coronal.json",
    #     lmax85_path=r"D:\engg\2025wintr\Solar\Sunalyse\server\PFSS Analysis\coronal_data_lmax85\cr2096_coronal.json",
    #     cr_number=2096,
    #     output_dir="comparison_results"
    # )
    
    # ============================================================
    # BATCH COMPARE CR 2096-2100
    # ============================================================
    batch_compare_all_crs(
        lmax30_dir=r"D:\engg\2025wintr\Solar\Sunalyse\server\PFSS Analysis\coronal_data",
        lmax85_dir=r"D:\engg\2025wintr\Solar\Sunalyse\server\PFSS Analysis\coronal_data_lmax85",
        output_dir="comparison_results",
        start_cr=2096,
        end_cr=2100
    )