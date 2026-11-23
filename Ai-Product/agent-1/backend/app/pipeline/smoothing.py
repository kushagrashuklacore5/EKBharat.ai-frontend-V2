"""One-Euro and EMA filters to de-jitter box coordinates and keypoints.

The One-Euro filter (Casiez et al., 2012) adapts its cutoff to signal speed: smooth
when still, responsive when moving. Used on overlay geometry server-side so the client
receives already-stable coordinates (it still interpolates between results for smoothness).
"""
from __future__ import annotations

import math

import numpy as np


class _LowPass:
    def __init__(self) -> None:
        self.y: float | np.ndarray | None = None

    def __call__(self, x, alpha: float):
        if self.y is None:
            self.y = x
        else:
            self.y = alpha * x + (1 - alpha) * self.y
        return self.y


class OneEuroFilter:
    """Scalar or vector One-Euro filter. Call with (value, timestamp_seconds)."""

    def __init__(self, min_cutoff: float = 1.0, beta: float = 0.007,
                 d_cutoff: float = 1.0) -> None:
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff
        self._x = _LowPass()
        self._dx = _LowPass()
        self._t_prev: float | None = None
        self._x_prev = None

    @staticmethod
    def _alpha(cutoff: float, dt: float) -> float:
        tau = 1.0 / (2 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def __call__(self, x, t: float):
        x = np.asarray(x, dtype=np.float64)
        if self._t_prev is None:
            self._t_prev = t
            self._x_prev = x
            self._x.y = x
            return x
        dt = max(t - self._t_prev, 1e-3)
        self._t_prev = t

        dx = (x - self._x_prev) / dt
        self._x_prev = x
        edx = self._dx(dx, self._alpha(self.d_cutoff, dt))
        cutoff = self.min_cutoff + self.beta * np.linalg.norm(np.atleast_1d(edx))
        return self._x(x, self._alpha(float(cutoff), dt))


class EMAFilter:
    """Simple exponential moving average fallback."""

    def __init__(self, alpha: float = 0.4) -> None:
        self.alpha = alpha
        self._y = None

    def __call__(self, x):
        x = np.asarray(x, dtype=np.float64)
        if self._y is None:
            self._y = x
        else:
            self._y = self.alpha * x + (1 - self.alpha) * self._y
        return self._y
