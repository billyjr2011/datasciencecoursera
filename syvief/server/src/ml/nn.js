// Perceptron multicouche (MLP) implémenté sans dépendance :
// couches denses, activation ReLU cachée + sigmoïde en sortie,
// entraînement par rétropropagation du gradient (SGD mini-batch),
// perte entropie croisée binaire. Sérialisable en JSON.

// Générateur pseudo-aléatoire déterministe (mulberry32) pour la reproductibilité.
export function rng(seed = 42) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const relu = (z) => (z > 0 ? z : 0);
const reluPrime = (z) => (z > 0 ? 1 : 0);
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

export class MLP {
  // sizes : ex. [11, 16, 8, 1] (entrée, cachées…, sortie)
  constructor(sizes, { seed = 42 } = {}) {
    this.sizes = sizes;
    const rand = rng(seed);
    this.W = []; this.b = [];
    for (let l = 1; l < sizes.length; l++) {
      const fanIn = sizes[l - 1];
      const scale = Math.sqrt(2 / fanIn); // initialisation He
      this.W.push(Array.from({ length: sizes[l] }, () =>
        Array.from({ length: fanIn }, () => (rand() * 2 - 1) * scale)));
      this.b.push(new Array(sizes[l]).fill(0));
    }
  }

  // Propagation avant. Renvoie {a, z} avec les activations de chaque couche.
  _forward(x) {
    const a = [x]; const z = [];
    for (let l = 0; l < this.W.length; l++) {
      const last = l === this.W.length - 1;
      const zl = new Array(this.W[l].length);
      const al = new Array(this.W[l].length);
      for (let j = 0; j < this.W[l].length; j++) {
        let s = this.b[l][j];
        const wj = this.W[l][j], prev = a[l];
        for (let k = 0; k < prev.length; k++) s += wj[k] * prev[k];
        zl[j] = s;
        al[j] = last ? sigmoid(s) : relu(s);
      }
      z.push(zl); a.push(al);
    }
    return { a, z };
  }

  // Prédiction (probabilité de conformité) pour une entrée.
  predict(x) { return this._forward(x).a.at(-1); }

  // Une passe d'entraînement sur un mini-lot ; renvoie la perte moyenne.
  _trainBatch(batch, lr, l2) {
    const gW = this.W.map((m) => m.map((r) => r.map(() => 0)));
    const gb = this.b.map((v) => v.map(() => 0));
    let loss = 0;
    for (const { x, y } of batch) {
      const { a, z } = this._forward(x);
      const out = a.at(-1);
      // entropie croisée + gradient sigmoïde : delta = ŷ - y
      let delta = out.map((o, j) => {
        const yj = y[j];
        loss += -(yj * Math.log(o + 1e-9) + (1 - yj) * Math.log(1 - o + 1e-9));
        return o - yj;
      });
      for (let l = this.W.length - 1; l >= 0; l--) {
        const prev = a[l];
        for (let j = 0; j < this.W[l].length; j++) {
          gb[l][j] += delta[j];
          for (let k = 0; k < prev.length; k++) gW[l][j][k] += delta[j] * prev[k];
        }
        if (l > 0) { // propage vers la couche précédente (cachée ReLU)
          const nd = new Array(prev.length).fill(0);
          for (let k = 0; k < prev.length; k++) {
            let s = 0;
            for (let j = 0; j < this.W[l].length; j++) s += this.W[l][j][k] * delta[j];
            nd[k] = s * reluPrime(z[l - 1][k]);
          }
          delta = nd;
        }
      }
    }
    const n = batch.length;
    for (let l = 0; l < this.W.length; l++) {
      for (let j = 0; j < this.W[l].length; j++) {
        this.b[l][j] -= lr * (gb[l][j] / n);
        for (let k = 0; k < this.W[l][j].length; k++)
          this.W[l][j][k] -= lr * (gW[l][j][k] / n + l2 * this.W[l][j][k]);
      }
    }
    return loss / n;
  }

  // Entraîne le réseau. cb(epoch, loss) optionnel pour le suivi.
  fit(samples, { epochs = 200, lr = 0.05, batchSize = 16, l2 = 1e-4, seed = 7, cb } = {}) {
    const rand = rng(seed);
    let loss = 0;
    for (let e = 0; e < epochs; e++) {
      const data = samples.slice();
      for (let i = data.length - 1; i > 0; i--) { // mélange Fisher-Yates
        const j = Math.floor(rand() * (i + 1)); [data[i], data[j]] = [data[j], data[i]];
      }
      let sum = 0, nb = 0;
      for (let i = 0; i < data.length; i += batchSize) {
        sum += this._trainBatch(data.slice(i, i + batchSize), lr, l2); nb++;
      }
      loss = sum / nb;
      if (cb) cb(e + 1, loss);
    }
    return loss;
  }

  toJSON() { return { sizes: this.sizes, W: this.W, b: this.b }; }

  static fromJSON(o) {
    const net = new MLP(o.sizes);
    net.W = o.W; net.b = o.b;
    return net;
  }
}
