import json
import numpy as np
from pathlib import Path

# ============================================================
# CONFIGURATION
# ============================================================
FILE_A = "coronal_data_lmax85/cr2097_coronal_unvectorised.json"  # original
FILE_B = "coronal_data_lmax85/cr2097_coronal.json"               # vectorised

# Tolerance for floating point comparison
ABS_TOL = 1e-6
REL_TOL = 1e-4
# ============================================================


def load_json(path):
    with open(path) as f:
        return json.load(f)


def compare_metadata(a, b):
    print("\n" + "="*60)
    print("METADATA")
    print("="*60)
    meta_a = a["metadata"]
    meta_b = b["metadata"]

    all_match = True
    for key in set(list(meta_a.keys()) + list(meta_b.keys())):
        va = meta_a.get(key, "MISSING")
        vb = meta_b.get(key, "MISSING")
        match = "✓" if va == vb else "✗"
        if va != vb:
            all_match = False
        print(f"  {match}  {key}: {va}  vs  {vb}")

    return all_match


def compare_field_lines(a, b):
    print("\n" + "="*60)
    print("FIELD LINES")
    print("="*60)

    lines_a = a["fieldLines"]
    lines_b = b["fieldLines"]

    print(f"  Count: {len(lines_a)} (unvectorised)  vs  {len(lines_b)} (vectorised)")

    if len(lines_a) != len(lines_b):
        print("  ✗ Different number of field lines — cannot do point-by-point comparison")
        return

    # --- Polarity classification ---
    print("\n--- Polarity ---")
    polarity_mismatches = 0
    open_a  = sum(1 for fl in lines_a if fl["polarity"] == "open")
    open_b  = sum(1 for fl in lines_b if fl["polarity"] == "open")
    for i, (fla, flb) in enumerate(zip(lines_a, lines_b)):
        if fla["polarity"] != flb["polarity"]:
            polarity_mismatches += 1
            print(f"  ✗ Line {i}: {fla['polarity']} vs {flb['polarity']}")
    if polarity_mismatches == 0:
        print(f"  ✓ All {len(lines_a)} lines have matching polarity")
    print(f"  Open:   {open_a} (unvectorised)  vs  {open_b} (vectorised)")
    print(f"  Closed: {len(lines_a)-open_a} (unvectorised)  vs  {len(lines_b)-open_b} (vectorised)")

    # --- Point counts per line ---
    print("\n--- Points per line ---")
    point_count_diffs = [abs(len(fla["points"]) - len(flb["points"])) for fla, flb in zip(lines_a, lines_b)]
    print(f"  Max point count difference:  {max(point_count_diffs)}")
    print(f"  Mean point count difference: {np.mean(point_count_diffs):.2f}")
    lines_same_length = sum(1 for d in point_count_diffs if d == 0)
    print(f"  Lines with identical point count: {lines_same_length}/{len(lines_a)}")

    # --- Point coordinate comparison (only for lines with same length) ---
    print("\n--- Point coordinates (lines with matching length) ---")
    coord_errors = []
    skipped = 0
    for i, (fla, flb) in enumerate(zip(lines_a, lines_b)):
        pts_a = np.array(fla["points"])
        pts_b = np.array(flb["points"])
        if pts_a.shape != pts_b.shape:
            skipped += 1
            continue
        diff = np.abs(pts_a - pts_b)
        coord_errors.append(diff.max())

    if coord_errors:
        print(f"  Compared {len(coord_errors)} lines (skipped {skipped} with different lengths)")
        print(f"  Max absolute coordinate difference:  {max(coord_errors):.2e}")
        print(f"  Mean absolute coordinate difference: {np.mean(coord_errors):.2e}")
        within_tol = sum(1 for e in coord_errors if e < ABS_TOL)
        print(f"  Lines within abs tolerance ({ABS_TOL}): {within_tol}/{len(coord_errors)}")

        if max(coord_errors) < ABS_TOL:
            print(f"  ✓ All coordinates match within tolerance")
        elif max(coord_errors) < REL_TOL:
            print(f"  ~ Coordinates match within relative tolerance ({REL_TOL}) — minor floating point differences")
        else:
            print(f"  ✗ Some coordinates differ beyond tolerance — check lines below:")
            for i, e in enumerate(coord_errors):
                if e >= REL_TOL:
                    print(f"     Line {i}: max diff = {e:.2e}")

    # --- Field strength comparison (only for lines with same length) ---
    print("\n--- Field strengths (lines with matching length) ---")
    strength_errors = []
    for i, (fla, flb) in enumerate(zip(lines_a, lines_b)):
        sa = np.array(fla["strengths"])
        sb = np.array(flb["strengths"])
        if sa.shape != sb.shape:
            continue
        if len(sa) == 0:
            continue
        diff = np.abs(sa - sb)
        strength_errors.append(diff.max())

    if strength_errors:
        print(f"  Max absolute strength difference:  {max(strength_errors):.2e}")
        print(f"  Mean absolute strength difference: {np.mean(strength_errors):.2e}")
        if max(strength_errors) < ABS_TOL:
            print(f"  ✓ All field strengths match within tolerance")
        elif max(strength_errors) < REL_TOL:
            print(f"  ~ Field strengths match within relative tolerance — minor floating point differences")
        else:
            print(f"  ✗ Some field strengths differ beyond tolerance")


def overall_verdict(meta_match, a, b):
    print("\n" + "="*60)
    print("OVERALL VERDICT")
    print("="*60)
    lines_a = a["fieldLines"]
    lines_b = b["fieldLines"]

    if not meta_match:
        print("  ✗ Metadata mismatch")
        return
    if len(lines_a) != len(lines_b):
        print("  ✗ Different number of field lines")
        return

    point_count_diffs = [abs(len(fla["points"]) - len(flb["points"])) for fla, flb in zip(lines_a, lines_b)]
    polarity_mismatches = sum(1 for fla, flb in zip(lines_a, lines_b) if fla["polarity"] != flb["polarity"])

    coord_errors = []
    for fla, flb in zip(lines_a, lines_b):
        pts_a = np.array(fla["points"])
        pts_b = np.array(flb["points"])
        if pts_a.shape == pts_b.shape:
            coord_errors.append(np.abs(pts_a - pts_b).max())

    max_coord_err = max(coord_errors) if coord_errors else 0

    if polarity_mismatches == 0 and max(point_count_diffs) == 0 and max_coord_err < ABS_TOL:
        print("  ✓ IDENTICAL — vectorised output matches unvectorised exactly")
    elif polarity_mismatches == 0 and max_coord_err < REL_TOL:
        print("  ~ EQUIVALENT — minor floating point differences only, physically identical")
    else:
        print("  ✗ DIFFERENCES FOUND — review output above")
    print("="*60 + "\n")


def main():
    print("="*60)
    print("CORONAL JSON COMPARISON")
    print("="*60)
    print(f"  A (unvectorised): {FILE_A}")
    print(f"  B (vectorised):   {FILE_B}")

    # Check files exist
    for path in [FILE_A, FILE_B]:
        if not Path(path).exists():
            print(f"\n❌ File not found: {path}")
            return

    print(f"\n  File size A: {Path(FILE_A).stat().st_size / 1024:.1f} KB")
    print(f"  File size B: {Path(FILE_B).stat().st_size / 1024:.1f} KB")

    a = load_json(FILE_A)
    b = load_json(FILE_B)

    meta_match = compare_metadata(a, b)
    compare_field_lines(a, b)
    overall_verdict(meta_match, a, b)


if __name__ == "__main__":
    main()