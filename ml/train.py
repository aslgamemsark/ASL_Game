"""C.3 — Train a Bidirectional GRU sign classifier on the cached landmark sequences.

This is the disambiguation-layer model: it predicts the WORD from a landmark sequence. It does
NOT replace the rule verifier (which keeps producing the per-parameter Sign Coach scores) — its
job is a global plausibility/minimal-pair signal layered on top (see Phase C plan).

Designed to run on Kaggle (free T4/P100) where the full ASL Citizen cache lives. TensorFlow is
imported lazily so the data pipeline (load/split/augment) and `--dry-run` work without it.

    # verify the data path locally, no TF needed:
    python -m ml.train --cache data/cache.npz --dry-run
    # real run (Kaggle, or locally once TF is installed):
    python -m ml.train --cache data/cache.npz --epochs 60

Every run is versioned under ml/runs/model_vN/ with the model, config, metrics, confusion
matrix, and a minimal-pair report. Nothing is overwritten.
"""
from __future__ import annotations

import os
# Use legacy Keras 2 so the saved model converts cleanly to TF.js (tensorflowjs speaks Keras 2,
# not Keras 3). Must be set before TensorFlow is imported anywhere.
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

import argparse
import json
from pathlib import Path

import numpy as np

from ml.augment import augment_dataset
from ml.eval_report import per_class_metrics

# Known visually-confusable pairs (scoped to whatever classes are present at train time).
# These are the pairs we care about MORE than overall accuracy — the rules struggle here.
CONFUSABLE_PAIRS = [
    ("DOCTOR", "NURSE"),       # both wrist taps
    ("LETTER_A", "YES"),       # fist vs nodding fist
    ("COFFEE", "YES"),         # stacked fists vs nodding fist
    ("LETTER_V", "LETTER_K"),  # two-finger shapes
    ("LETTER_V", "LETTER_U"),
    ("HELLO", "FEVER"),        # flat hand near the head
    ("MEDICINE", "DOCTOR"),    # tapping on the other hand/wrist
    ("SICK", "FEVER"),         # forehead-located
    ("PLEASE", "SORRY"),       # circular on chest
]


# ----------------------------------------------------------------- data

def load_splits(cache: str):
    data = np.load(cache, allow_pickle=True)
    X, y, split, classes = data["X"], data["y"], data["split"], [str(c) for c in data["classes"]]
    tr, va, te = split == "train", split == "val", split == "test"
    # If the cache has no held-out signers (e.g. single-signer smoke data), carve a
    # stratified val/test out of train so the loop still runs — with a loud warning.
    if va.sum() == 0 and te.sum() == 0:
        print("WARNING: no val/test split in cache (single-signer data?). "
              "Carving a random split — results are NOT generalization estimates.")
        rng = np.random.default_rng(0)
        idx = np.where(tr)[0]
        rng.shuffle(idx)
        n_val = max(1, int(len(idx) * 0.15))
        va = np.zeros_like(tr); te = np.zeros_like(tr)
        va[idx[:n_val]] = True
        te[idx[n_val:2 * n_val]] = True
        tr = tr & ~va & ~te
    return X, y, classes, (tr, va, te)


# ----------------------------------------------------------------- reports

def confusion(y_true, y_pred, n_classes) -> np.ndarray:
    m = np.zeros((n_classes, n_classes), dtype=int)
    for t, p in zip(y_true, y_pred):
        m[t, p] += 1
    return m

def save_confusion_png(cm, classes, path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(max(6, len(classes) * 0.5),) * 2)
    ax.imshow(cm, cmap="Purples")
    ax.set_xticks(range(len(classes))); ax.set_xticklabels(classes, rotation=90, fontsize=6)
    ax.set_yticks(range(len(classes))); ax.set_yticklabels(classes, fontsize=6)
    ax.set_xlabel("predicted"); ax.set_ylabel("true")
    for i in range(len(classes)):
        for j in range(len(classes)):
            if cm[i, j]:
                ax.text(j, i, cm[i, j], ha="center", va="center", fontsize=6)
    fig.tight_layout(); fig.savefig(path, dpi=110); plt.close(fig)

def no_sign_metrics(y_true, y_pred, classes) -> dict | None:
    """NO_SIGN-specific rates, called out on their own rather than buried in the per-class
    table — these are the exact numbers this bug was fixed for. None if the vocab being trained
    has no NO_SIGN class yet (added in a later phase alongside the negative dataset).

    false_positive_rate: a REAL sign predicted when the true label was NO_SIGN (the model
        hallucinating a sign out of nonsense/idle motion — the original bug).
    false_negative_rate: NO_SIGN predicted when the true label was a real sign (over-correction —
        rejecting a genuine attempt).
    no_sign_recall: fraction of true NO_SIGN clips correctly caught.
    """
    if "NO_SIGN" not in classes:
        return None
    ns = classes.index("NO_SIGN")
    is_ns_true = y_true == ns
    is_ns_pred = y_pred == ns
    n_ns_true = int(is_ns_true.sum())
    n_real_true = int((~is_ns_true).sum())
    return {
        "false_positive_rate": float(np.sum(is_ns_true & ~is_ns_pred)) / n_ns_true if n_ns_true else 0.0,
        "false_negative_rate": float(np.sum(~is_ns_true & is_ns_pred)) / n_real_true if n_real_true else 0.0,
        "no_sign_recall": float(np.sum(is_ns_true & is_ns_pred)) / n_ns_true if n_ns_true else 0.0,
        "no_sign_support": n_ns_true,
    }


def minimal_pair_report(cm, classes) -> list[dict]:
    idx = {c: i for i, c in enumerate(classes)}
    out = []
    for a, b in CONFUSABLE_PAIRS:
        if a in idx and b in idx:
            ia, ib = idx[a], idx[b]
            out.append({
                "pair": f"{a}<->{b}",
                "a_as_b": int(cm[ia, ib]), "b_as_a": int(cm[ib, ia]),
                "a_total": int(cm[ia].sum()), "b_total": int(cm[ib].sum()),
            })
    return out


# ----------------------------------------------------------------- model (lazy TF)

def build_model(seq_len, feat_dim, n_classes):
    from tensorflow.keras import layers, models, regularizers
    # Regularized to fight the train/test overfit gap on thin data (~30 clips/sign):
    # recurrent + input dropout inside the GRUs, weight decay on the dense head, and a
    # smaller second recurrent layer.
    l2 = regularizers.l2(1e-4)
    # reset_after=False is REQUIRED for TF.js: its LayersModel GRUCell rejects reset_after=True
    # (the Keras/cuDNN default), so a model trained with the default fails to load in-browser
    # with "GRUCell does not support reset_after parameter set to true". We don't use cuDNN here
    # (CPU training), so there's no speed cost, and accuracy is equivalent.
    return models.Sequential([
        layers.Input(shape=(seq_len, feat_dim)),
        layers.Bidirectional(layers.GRU(
            64, return_sequences=True, dropout=0.25, recurrent_dropout=0.25,
            kernel_regularizer=l2, reset_after=False)),
        layers.Bidirectional(layers.GRU(
            40, dropout=0.25, recurrent_dropout=0.25, kernel_regularizer=l2,
            reset_after=False)),
        layers.Dropout(0.45),
        layers.Dense(64, activation="relu", kernel_regularizer=l2),
        layers.Dropout(0.45),
        layers.Dense(n_classes, activation="softmax"),
    ])


def next_run_dir(root="ml/runs") -> Path:
    rp = Path(root); rp.mkdir(parents=True, exist_ok=True)
    existing = [int(p.name.split("_v")[-1]) for p in rp.glob("model_v*") if p.name.split("_v")[-1].isdigit()]
    return rp / f"model_v{(max(existing) + 1) if existing else 1}"


# ----------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser(description="Train Bi-GRU sign classifier.")
    ap.add_argument("--cache", default="data/cache.npz")
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--n-aug", type=int, default=14, help="augmented copies per training clip")
    ap.add_argument("--dry-run", action="store_true", help="verify data path without TF")
    args = ap.parse_args()

    X, y, classes, (tr, va, te) = load_splits(args.cache)
    seq_len, feat_dim = X.shape[1], X.shape[2]
    print(f"loaded {X.shape}  classes={len(classes)}  "
          f"train={tr.sum()} val={va.sum()} test={te.sum()}")

    Xtr, ytr = augment_dataset(X[tr], y[tr], args.n_aug)
    print(f"after augmentation: train={Xtr.shape}")

    pairs_present = [p for p in CONFUSABLE_PAIRS if p[0] in classes and p[1] in classes]
    print(f"minimal pairs tracked among present classes: {pairs_present or '(none in this vocab)'}")

    if args.dry_run:
        print("\n[dry-run] data path verified — load, split, augment, minimal-pair setup all OK.")
        print("[dry-run] skipping TensorFlow model/fit/export. Run without --dry-run on Kaggle.")
        return

    import tensorflow as tf  # noqa: F401
    from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
    from tensorflow.keras.losses import CategoricalCrossentropy
    from tensorflow.keras.utils import to_categorical

    n_cls = len(classes)
    # One-hot + label smoothing: discourages over-confident memorization on thin data.
    ytr_oh = to_categorical(ytr, n_cls)
    yva_oh = to_categorical(y[va], n_cls) if va.sum() else None

    model = build_model(seq_len, feat_dim, n_cls)
    model.compile(optimizer="adam",
                  loss=CategoricalCrossentropy(label_smoothing=0.1),
                  metrics=["accuracy"])
    cbs = []
    if va.sum() > 0:
        cbs.append(EarlyStopping(monitor="val_loss", patience=14, restore_best_weights=True))
        cbs.append(ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=5, min_lr=1e-5))
    model.fit(Xtr, ytr_oh, validation_data=(X[va], yva_oh) if va.sum() else None,
              epochs=args.epochs, batch_size=args.batch, callbacks=cbs, verbose=2)

    # Evaluate — train/val accuracy re-measured against the FINAL (post-EarlyStopping-restore)
    # weights, not read from Keras's fit history, since restore_best_weights means the history's
    # last logged epoch isn't necessarily the epoch actually saved. This is what closes the
    # original "only ever recorded test accuracy, no way to see over/underfitting" gap.
    train_acc = float(model.evaluate(Xtr, ytr_oh, verbose=0)[1])
    val_acc = float(model.evaluate(X[va], yva_oh, verbose=0)[1]) if va.sum() else None

    eval_mask = te if te.sum() else va
    eval_split = "test" if te.sum() else "val"
    yp = model.predict(X[eval_mask], verbose=0).argmax(1)
    yt = y[eval_mask]
    acc = float((yp == yt).mean())
    cm = confusion(yt, yp, len(classes))
    mpr = minimal_pair_report(cm, classes)
    prec, rec, f1, sup = per_class_metrics(yt, yp, len(classes))
    ns_metrics = no_sign_metrics(yt, yp, classes)

    print(f"\ntrain accuracy: {train_acc:.3f}" + (f"  val accuracy: {val_acc:.3f}" if val_acc is not None else ""))
    print(f"{eval_split} accuracy: {acc:.3f}  (gap vs train: {train_acc - acc:+.3f})")
    for r in mpr:
        print(f"  {r['pair']}: A->B {r['a_as_b']}/{r['a_total']}  B->A {r['b_as_a']}/{r['b_total']}")
    if ns_metrics:
        print(f"  NO_SIGN recall={ns_metrics['no_sign_recall']:.3f}  "
              f"FPR={ns_metrics['false_positive_rate']:.3f}  FNR={ns_metrics['false_negative_rate']:.3f}")

    # Save versioned run
    run = next_run_dir()
    run.mkdir(parents=True, exist_ok=True)
    model.save(run / "model.keras")
    (run / "classes.json").write_text(json.dumps(classes), encoding="utf-8")
    (run / "config.json").write_text(json.dumps(vars(args), indent=2), encoding="utf-8")
    w = sup / sup.sum()
    (run / "metrics.json").write_text(json.dumps({
        "train_accuracy": train_acc,
        "val_accuracy": val_acc,
        f"{eval_split}_accuracy": acc,
        "n_classes": len(classes),
        "minimal_pairs": mpr,
        "no_sign": ns_metrics,
        "per_class": {classes[c]: {"precision": float(prec[c]), "recall": float(rec[c]),
                                    "f1": float(f1[c]), "support": int(sup[c])}
                      for c in range(len(classes))},
        "macro_f1": float(f1.mean()),
        "weighted_f1": float((f1 * w).sum()),
    }, indent=2), encoding="utf-8")
    save_confusion_png(cm, classes, run / "confusion_matrix.png")

    # TF.js export for in-browser inference (optional dep)
    try:
        import sys
        import types
        # tensorflowjs imports tensorflow_decision_forests at load (Linux-only, unused for a GRU).
        sys.modules.setdefault("tensorflow_decision_forests",
                               types.ModuleType("tensorflow_decision_forests"))
        import tensorflowjs as tfjs
        tfjs.converters.save_keras_model(model, str(run / "tfjs"))
        print(f"TF.js model -> {run / 'tfjs'}")
    except ImportError as e:
        print(f"tensorflowjs not available — skipped browser export ({e})")
    print(f"\nrun saved -> {run}")


if __name__ == "__main__":
    main()
