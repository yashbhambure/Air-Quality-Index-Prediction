import joblib
import matplotlib.pyplot as plt
import numpy as np

# Load trained PCA model
pca = joblib.load("models/pca.pkl")

# Explained variance of each component
explained_variance = pca.explained_variance_ratio_ * 100

# Cumulative explained variance
cumulative_variance = np.cumsum(explained_variance)

components = np.arange(1, len(explained_variance) + 1)

# Create graph
plt.figure(figsize=(9, 5))

plt.plot(
    components,
    cumulative_variance,
    marker='o',
    label='Cumulative Explained Variance'
)

plt.bar(
    components,
    explained_variance,
    alpha=0.5,
    label='Individual Explained Variance'
)

plt.xlabel("Principal Component")
plt.ylabel("Explained Variance (%)")
plt.title("PCA Explained Variance")
plt.xticks(components)
plt.legend()
plt.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("pca_explained_variance.png", dpi=300)
plt.show()